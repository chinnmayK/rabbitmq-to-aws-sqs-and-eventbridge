#!/bin/bash
set -euo pipefail

APP_DIR="/opt/node-app"

########################################
# Detect AWS Region (IMDSv2)
########################################
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

AWS_REGION=$(curl -s \
  -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/dynamic/instance-identity/document \
  | grep region \
  | awk -F\" '{print $4}')

if [ -z "$AWS_REGION" ]; then
  echo "Failed to detect AWS region"
  exit 1
fi

echo "Detected region: $AWS_REGION"

########################################
# Fetch Account ID
########################################
echo "===== Fetching AWS Account ID ====="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

IMAGE_TAG="${IMAGE_TAG:-latest}"

########################################
# Ensure Docker is running
########################################
echo "===== Verifying Docker service ====="
if ! systemctl is-active --quiet docker; then
    echo "Docker not running. Starting Docker..."
    systemctl start docker
    sleep 5
fi

########################################
# Login to ECR
########################################
echo "===== Logging into ECR ====="
aws ecr get-login-password --region "$AWS_REGION" | \
docker login --username AWS --password-stdin "$ECR_URL"

########################################
# Verify app directory
########################################
if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: Application directory $APP_DIR does not exist."
    exit 1
fi

cd "$APP_DIR"

########################################
# Detect Docker Compose
########################################
if docker compose version >/dev/null 2>&1; then
    DOCKER_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
else
    echo "ERROR: Neither 'docker compose' nor 'docker-compose' found."
    exit 1
fi

echo "Using Docker command: $DOCKER_CMD"

########################################
# Stop old containers
########################################
echo "===== Stopping old containers ====="
$DOCKER_CMD down || true

########################################
# Pull images
########################################
echo "===== Pulling latest images ====="
docker pull "$ECR_URL/node-microservices-customer:$IMAGE_TAG"
docker pull "$ECR_URL/node-microservices-products:$IMAGE_TAG"
docker pull "$ECR_URL/node-microservices-shopping:$IMAGE_TAG"
docker pull "$ECR_URL/node-microservices-gateway:$IMAGE_TAG"

########################################
# Start containers
########################################
echo "===== Starting containers ====="
$DOCKER_CMD up -d

########################################
# Cleanup
########################################
echo "===== Cleaning up unused images ====="
docker image prune -f --filter "dangling=true"

echo "===== Deployment complete ====="