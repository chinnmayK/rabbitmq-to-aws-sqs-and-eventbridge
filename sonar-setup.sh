#!/bin/bash
# ============================================================
# sonar-setup.sh
# Run this ONCE on an existing EC2 to set up SonarQube
# automatically (same logic as user_data.sh boot steps).
#
# Usage: ssh into EC2, then:
#   bash /opt/node-app/sonar-setup.sh
# ============================================================
set -euo pipefail

PROJECT_NAME="r2sqs-eb"
SONAR_URL="http://localhost:9000"
SONAR_DEFAULT_PASS="admin"
SONAR_NEW_PASS="SonarAdmin@123"
SONAR_PROJECT_KEY="r2sqs-eb"
MAX_WAIT=180

########################################
# Detect Region
########################################
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

AWS_REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/dynamic/instance-identity/document \
  | grep region | awk -F\" '{print $4}')

PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

echo "Region: $AWS_REGION | Public IP: $PUBLIC_IP"

########################################
# Start SonarQube if not running
########################################
if ! docker ps --format '{{.Names}}' | grep -q "^sonarqube$"; then
  echo "SonarQube not running — starting it..."
  sudo sysctl -w vm.max_map_count=524288

  docker run -d \
    --name sonarqube \
    --restart always \
    -p 9000:9000 \
    -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
    sonarqube:lts
else
  echo "SonarQube already running"
fi

########################################
# Wait for SonarQube to be ready
########################################
echo "Waiting for SonarQube to become ready (up to ${MAX_WAIT}s)..."
elapsed=0
until curl -sf "${SONAR_URL}/api/system/status" | grep -q '"status":"UP"'; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    echo "ERROR: SonarQube not ready after ${MAX_WAIT}s"
    exit 1
  fi
  echo "  Waiting... (${elapsed}s)"
  sleep 10
  elapsed=$((elapsed + 10))
done
echo "SonarQube is UP"

########################################
# Change default admin password
########################################
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${SONAR_URL}/api/users/change_password" \
  -u "admin:${SONAR_DEFAULT_PASS}" \
  -d "login=admin&password=${SONAR_NEW_PASS}&previousPassword=${SONAR_DEFAULT_PASS}")

if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "Admin password changed"
else
  echo "Password already changed, or token regeneration (HTTP $HTTP_STATUS) — continuing"
fi

########################################
# Create Project
########################################
curl -s -X POST "${SONAR_URL}/api/projects/create" \
  -u "admin:${SONAR_NEW_PASS}" \
  -d "project=${SONAR_PROJECT_KEY}&name=r2sqs-eb+Microservices&visibility=private" \
  | jq '.' || true
echo "Project '${SONAR_PROJECT_KEY}' created (or already exists)"

########################################
# Revoke old token if it exists, then regenerate
########################################
curl -s -X POST "${SONAR_URL}/api/user_tokens/revoke" \
  -u "admin:${SONAR_NEW_PASS}" \
  -d "name=codebuild-token" || true

TOKEN_RESPONSE=$(curl -s -X POST "${SONAR_URL}/api/user_tokens/generate" \
  -u "admin:${SONAR_NEW_PASS}" \
  -d "name=codebuild-token&type=GLOBAL_ANALYSIS_TOKEN")

SONAR_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token // empty')

if [ -z "$SONAR_TOKEN" ]; then
  echo "ERROR: Could not generate token: $TOKEN_RESPONSE"
  exit 1
fi

########################################
# Store in SSM
########################################
aws ssm put-parameter \
  --name "/${PROJECT_NAME}/sonar_token" \
  --value "$SONAR_TOKEN" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/sonar_host_url" \
  --value "http://${PUBLIC_IP}:9000" \
  --type String \
  --overwrite \
  --region "$AWS_REGION"

echo ""
echo "===== SonarQube Setup Complete ====="
echo "  Web UI:          http://${PUBLIC_IP}:9000"
echo "  Admin password:  ${SONAR_NEW_PASS}"
echo "  Project key:     ${SONAR_PROJECT_KEY}"
echo "  SSM token:       /${PROJECT_NAME}/sonar_token (SecureString)"
echo "  SSM host URL:    /${PROJECT_NAME}/sonar_host_url"
