#!/bin/bash
set -uo pipefail

exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

echo "===== Starting EC2 Bootstrap ====="

trap 'echo "ERROR on line $LINENO"; exit 1' ERR

export DEBIAN_FRONTEND=noninteractive

########################################
# Wait for apt lock
########################################
echo "Waiting for apt lock..."
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
  sleep 5
done

########################################
# Detect Region
########################################
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

REGION=$(curl -s \
  -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/dynamic/instance-identity/document \
  | grep region \
  | awk -F\" '{print $4}')

if [ -z "$REGION" ]; then
  echo "Failed to detect region"
  exit 1
fi

echo "Detected region: $REGION"
export AWS_REGION="$REGION"
PROJECT_NAME="r2sqs-eb"

########################################
# Update System
########################################
apt-get clean
rm -rf /var/lib/apt/lists/*
apt-get update -y
apt-get upgrade -y
apt-get install -y jq
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  unzip \
  wget \
  git \
  ruby-full \
  software-properties-common

########################################
# Install Docker
########################################
install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

chmod a+r /etc/apt/keyrings/docker.gpg

UBUNTU_CODENAME=$(lsb_release -cs)

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  ${UBUNTU_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y

apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable docker
systemctl start docker
sleep 15

if ! systemctl is-active --quiet docker; then
  echo "Docker failed to start"
  exit 1
fi

usermod -aG docker ubuntu

########################################
# Install AWS CLI v2
########################################
cd /tmp
curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -o awscliv2.zip
./aws/install

########################################
# Install ngrok
########################################
cd /tmp
wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
mv ngrok /usr/local/bin/
chmod +x /usr/local/bin/ngrok

########################################
# Fetch ngrok token
########################################
NGROK_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id r2sqs-eb-ngrok-token \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

if [ -z "$NGROK_TOKEN" ]; then
  echo "ERROR: NGROK token not found"
  exit 1
fi

mkdir -p /root/.config/ngrok

ngrok config add-authtoken "$NGROK_TOKEN" \
  --config /root/.config/ngrok/ngrok.yml

########################################
# Create systemd service (DO NOT START HERE)
########################################
cat <<EOF > /etc/systemd/system/ngrok.service
[Unit]
Description=ngrok tunnel
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/ngrok http 8000 --config /root/.config/ngrok/ngrok.yml
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ngrok

########################################
# Install CodeDeploy Agent
########################################
cd /home/ubuntu

wget -q https://aws-codedeploy-${REGION}.s3.${REGION}.amazonaws.com/latest/install || \
wget -q https://aws-codedeploy-${REGION}.s3.amazonaws.com/latest/install

chmod +x install
./install auto

systemctl enable codedeploy-agent
systemctl start codedeploy-agent
sleep 5

########################################
# Create Application Directory
########################################
mkdir -p /opt/node-app
chown -R ubuntu:ubuntu /opt/node-app

echo "CUSTOMER_SERVICE_URL=http://customer:8001" >> /opt/node-app/.env
echo "SHOPPING_SERVICE_URL=http://shopping:8003" >> /opt/node-app/.env

########################################
# Launch SonarQube (static analysis)
########################################
echo "Starting SonarQube container..."

# Increase vm.max_map_count required by Elasticsearch inside SonarQube
sysctl -w vm.max_map_count=524288
echo "vm.max_map_count=524288" >> /etc/sysctl.conf

docker run -d \
  --name sonarqube \
  --restart always \
  -p 9000:9000 \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  sonarqube:lts

echo "SonarQube container started — waiting for it to become ready..."

########################################
# Wait for SonarQube to be ready
########################################
SONAR_URL="http://localhost:9000"
SONAR_DEFAULT_PASS="admin"
SONAR_NEW_PASS="SonarAdmin@123"
SONAR_PROJECT_KEY="r2sqs-eb"
MAX_WAIT=180   # seconds

elapsed=0
until curl -sf "${SONAR_URL}/api/system/status" | grep -q '"status":"UP"'; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    echo "ERROR: SonarQube did not become ready within ${MAX_WAIT}s"
    exit 1
  fi
  echo "Waiting for SonarQube... (${elapsed}s elapsed)"
  sleep 10
  elapsed=$((elapsed + 10))
done

echo "SonarQube is UP after ${elapsed}s"

########################################
# Change default admin password
########################################
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${SONAR_URL}/api/users/change_password" \
  -u "admin:${SONAR_DEFAULT_PASS}" \
  -d "login=admin&password=${SONAR_NEW_PASS}&previousPassword=${SONAR_DEFAULT_PASS}")

if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "Admin password changed successfully"
else
  echo "Admin password already changed or failed (HTTP $HTTP_STATUS) — continuing"
fi

########################################
# Create SonarQube Project
########################################
curl -s -X POST "${SONAR_URL}/api/projects/create" \
  -u "admin:${SONAR_NEW_PASS}" \
  -d "project=${SONAR_PROJECT_KEY}&name=r2sqs-eb+Microservices&visibility=private" \
  | jq '.' || true

echo "SonarQube project '${SONAR_PROJECT_KEY}' created (or already exists)"

########################################
# Generate CI Token and store in SSM
########################################
TOKEN_RESPONSE=$(curl -s -X POST "${SONAR_URL}/api/user_tokens/generate" \
  -u "admin:${SONAR_NEW_PASS}" \
  -d "name=codebuild-token&type=GLOBAL_ANALYSIS_TOKEN")

SONAR_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token // empty')

if [ -z "$SONAR_TOKEN" ]; then
  echo "ERROR: Failed to generate SonarQube token: $TOKEN_RESPONSE"
  exit 1
fi

echo "SonarQube token generated — storing in SSM..."

# Store token (SecureString)
aws ssm put-parameter \
  --name "/${PROJECT_NAME}/sonar_token" \
  --value "$SONAR_TOKEN" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"

# Store Sonar host URL (plain String — CodeBuild reads this too)
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

aws ssm put-parameter \
  --name "/${PROJECT_NAME}/sonar_host_url" \
  --value "http://${PUBLIC_IP}:9000" \
  --type String \
  --overwrite \
  --region "$AWS_REGION"

echo "SSM parameters stored:"
echo "  /${PROJECT_NAME}/sonar_token     → (SecureString)"
echo "  /${PROJECT_NAME}/sonar_host_url  → http://${PUBLIC_IP}:9000"

echo "===== EC2 Bootstrap Complete ====="