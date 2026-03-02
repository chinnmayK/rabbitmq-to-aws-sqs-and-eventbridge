#!/bin/bash
set -euo pipefail

APP_DIR="/opt/node-app"

echo "===== Starting Deployment ====="

########################################
# Detect AWS Region (IMDSv2 Safe)
########################################
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

AWS_REGION=$(curl -s \
  -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/dynamic/instance-identity/document \
  | grep region \
  | awk -F\" '{print $4}')

if [ -z "$AWS_REGION" ]; then
  echo "❌ Failed to detect AWS region"
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PROJECT_NAME="r2sqs-eb"
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"

########################################
# SQS Queue URLs (one per service)
########################################
CUSTOMER_CREATED_QUEUE_URL="https://sqs.${AWS_REGION}.amazonaws.com/${ACCOUNT_ID}/${PROJECT_NAME}-customer-created-queue"
ORDER_CREATED_QUEUE_URL="https://sqs.${AWS_REGION}.amazonaws.com/${ACCOUNT_ID}/${PROJECT_NAME}-order-created-queue"
ORDER_CREATED_PRODUCTS_QUEUE_URL="https://sqs.${AWS_REGION}.amazonaws.com/${ACCOUNT_ID}/${PROJECT_NAME}-order-created-products-queue"

########################################
# Ensure Docker is running
########################################
if ! systemctl is-active --quiet docker; then
    systemctl start docker
    sleep 5
fi

########################################
# Login to ECR
########################################
aws ecr get-login-password --region "$AWS_REGION" | \
docker login --username AWS --password-stdin "$ECR_URL"

cd "$APP_DIR"

########################################
# Auto-Setup SonarQube (idempotent)
# Runs only if token not yet in SSM
########################################
SONAR_TOKEN_EXISTING=$(aws ssm get-parameter \
  --name "/${PROJECT_NAME}/sonar_token" \
  --region "$AWS_REGION" \
  --query Parameter.Value \
  --output text 2>/dev/null || true)

if [ -z "$SONAR_TOKEN_EXISTING" ]; then
  echo "===== SonarQube first-time setup ====="

  # Ensure vm.max_map_count is set (required by SonarQube Elasticsearch)
  sysctl -w vm.max_map_count=524288 2>/dev/null || true

  # Start SonarQube container if not already running
  if ! docker ps --format '{{.Names}}' | grep -q '^sonarqube$'; then
    echo "Starting SonarQube container..."
    docker run -d \
      --name sonarqube \
      --restart always \
      -p 9000:9000 \
      -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
      sonarqube:lts
  else
    echo "SonarQube already running"
  fi

  # Wait for SonarQube to be ready (up to 3 minutes)
  SONAR_URL="http://localhost:9000"
  SONAR_NEW_PASS="SonarAdmin@123"
  MAX_WAIT=180
  elapsed=0
  echo "Waiting for SonarQube to become ready..."
  until curl -sf "${SONAR_URL}/api/system/status" | grep -q '"status":"UP"'; do
    [ $elapsed -ge $MAX_WAIT ] && { echo "ERROR: SonarQube timed out"; break; }
    echo "  Waiting... (${elapsed}s)"
    sleep 10; elapsed=$((elapsed+10))
  done
  echo "SonarQube ready after ${elapsed}s"

  # Change default admin password (no-op if already changed)
  curl -sf -X POST "${SONAR_URL}/api/users/change_password" \
    -u "admin:admin" \
    -d "login=admin&password=${SONAR_NEW_PASS}&previousPassword=admin" || true

  # Create project (no-op if already exists)
  curl -sf -X POST "${SONAR_URL}/api/projects/create" \
    -u "admin:${SONAR_NEW_PASS}" \
    -d "project=${PROJECT_NAME}&name=${PROJECT_NAME}+Microservices&visibility=private" || true

  # Revoke old token if it exists, then generate fresh one
  curl -sf -X POST "${SONAR_URL}/api/user_tokens/revoke" \
    -u "admin:${SONAR_NEW_PASS}" \
    -d "name=codebuild-token" || true

  TOKEN_JSON=$(curl -sf -X POST "${SONAR_URL}/api/user_tokens/generate" \
    -u "admin:${SONAR_NEW_PASS}" \
    -d "name=codebuild-token&type=GLOBAL_ANALYSIS_TOKEN")

  SONAR_TOKEN=$(echo "$TOKEN_JSON" | jq -r '.token // empty')

  if [ -n "$SONAR_TOKEN" ]; then
    PUBLIC_IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" \
      http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")

    aws ssm put-parameter \
      --name "/${PROJECT_NAME}/sonar_token" \
      --value "$SONAR_TOKEN" \
      --type SecureString --overwrite \
      --region "$AWS_REGION"

    aws ssm put-parameter \
      --name "/${PROJECT_NAME}/sonar_host_url" \
      --value "http://${PUBLIC_IP}:9000" \
      --type String --overwrite \
      --region "$AWS_REGION"

    echo "✅ SonarQube setup complete — token stored in SSM"
    echo "   Web UI: http://${PUBLIC_IP}:9000  password: ${SONAR_NEW_PASS}"
  else
    echo "⚠️  Could not generate SonarQube token — analysis stage will fail until fixed"
  fi
else
  echo "SonarQube already configured (token found in SSM) — skipping setup"
fi

########################################
# Fetch Secrets
########################################
MONGO_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id r2sqs-eb-mongo-credentials \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)



JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id r2sqs-eb-jwt-secret \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

MONGO_USERNAME=$(echo "$MONGO_SECRET" | jq -r '.username')
MONGO_PASSWORD=$(echo "$MONGO_SECRET" | jq -r '.password')

APP_SECRET=$(echo "$JWT_SECRET" | jq -r '.jwt')
EVENT_BUS_NAME="${PROJECT_NAME}-bus"

########################################
# Fetch DocumentDB Endpoint from SSM
########################################
DOCDB_ENDPOINT=$(aws ssm get-parameter \
  --name "/${PROJECT_NAME}/docdb_endpoint" \
  --region "$AWS_REGION" \
  --query Parameter.Value \
  --output text 2>/dev/null || true)

if [ -z "$DOCDB_ENDPOINT" ]; then
  echo "❌ ERROR: DOCDB_ENDPOINT not found in SSM at /${PROJECT_NAME}/docdb_endpoint"
  echo "   Run: aws ssm put-parameter --name /${PROJECT_NAME}/docdb_endpoint --value <endpoint> --type String --region $AWS_REGION"
  exit 1
fi

DOCDB_USERNAME="$MONGO_USERNAME"
DOCDB_PASSWORD="$MONGO_PASSWORD"

########################################
# Fetch SonarQube host URL from SSM (for reference — CodeBuild reads directly)
########################################
SONAR_HOST_URL=$(aws ssm get-parameter \
  --name "/${PROJECT_NAME}/sonar_host_url" \
  --region "$AWS_REGION" \
  --query Parameter.Value \
  --output text 2>/dev/null || echo "not-set")

echo "DOCDB endpoint: $DOCDB_ENDPOINT"
echo "Sonar host:     $SONAR_HOST_URL"

########################################
# Write .env file
########################################
cat > .env <<EOF
ACCOUNT_ID=$ACCOUNT_ID
AWS_REGION=$AWS_REGION

# DocumentDB (replaces local MongoDB)
DOCDB_ENDPOINT=$DOCDB_ENDPOINT
DOCDB_USERNAME=$DOCDB_USERNAME
DOCDB_PASSWORD=$DOCDB_PASSWORD

# App secrets
APP_SECRET=$APP_SECRET
EVENT_BUS_NAME=$EVENT_BUS_NAME

# SQS Queue URLs
CUSTOMER_CREATED_QUEUE_URL=$CUSTOMER_CREATED_QUEUE_URL
ORDER_CREATED_QUEUE_URL=$ORDER_CREATED_QUEUE_URL
ORDER_CREATED_PRODUCTS_QUEUE_URL=$ORDER_CREATED_PRODUCTS_QUEUE_URL

# Service routing
CUSTOMER_SERVICE_URL=http://customer:8001
SHOPPING_SERVICE_URL=http://shopping:8003
EOF

########################################
# Docker Compose
########################################
if docker compose version >/dev/null 2>&1; then
    DOCKER_CMD="docker compose"
else
    DOCKER_CMD="docker-compose"
fi

$DOCKER_CMD down || true

docker pull "$ECR_URL/r2sqs-eb-customer:$IMAGE_TAG"
docker pull "$ECR_URL/r2sqs-eb-products:$IMAGE_TAG"
docker pull "$ECR_URL/r2sqs-eb-shopping:$IMAGE_TAG"
docker pull "$ECR_URL/r2sqs-eb-gateway:$IMAGE_TAG"

$DOCKER_CMD up -d

########################################
# Wait for Gateway
########################################
echo "Waiting for gateway..."

READY=false
for i in {1..30}; do
  if curl -s http://localhost:8000 >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 3
done

if [ "$READY" = false ]; then
  echo "❌ Gateway failed to start"
  exit 1
fi

########################################
# Start ngrok
########################################
systemctl restart ngrok

docker image prune -f --filter "dangling=true"

echo "===== Deployment complete ====="