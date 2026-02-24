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
# ✅ ADD SQS QUEUE URL (NEW)
########################################
SQS_QUEUE_URL="https://sqs.${AWS_REGION}.amazonaws.com/${ACCOUNT_ID}/r2sqs-eb-customer-created-queue"

########################################
# Ensure Docker running
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
# Fetch Secrets
########################################
MONGO_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id r2sqs-eb-mongo-credentials_v2 \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

RABBIT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id r2sqs-eb-rabbitmq-credentials_v2 \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id r2sqs-eb-jwt-secret_v2 \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

MONGO_USERNAME=$(echo "$MONGO_SECRET" | jq -r '.username')
MONGO_PASSWORD=$(echo "$MONGO_SECRET" | jq -r '.password')
RABBITMQ_USERNAME=$(echo "$RABBIT_SECRET" | jq -r '.username')
RABBITMQ_PASSWORD=$(echo "$RABBIT_SECRET" | jq -r '.password')
APP_SECRET=$(echo "$JWT_SECRET" | jq -r '.jwt')
EVENT_BUS_NAME="${PROJECT_NAME}-bus"

########################################
# Write .env file
########################################
cat > .env <<EOF
ACCOUNT_ID=$ACCOUNT_ID
AWS_REGION=$AWS_REGION
MONGO_USERNAME=$MONGO_USERNAME
MONGO_PASSWORD=$MONGO_PASSWORD
RABBITMQ_USERNAME=$RABBITMQ_USERNAME
RABBITMQ_PASSWORD=$RABBITMQ_PASSWORD
APP_SECRET=$APP_SECRET
EVENT_BUS_NAME=$EVENT_BUS_NAME
SQS_QUEUE_URL=$SQS_QUEUE_URL
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