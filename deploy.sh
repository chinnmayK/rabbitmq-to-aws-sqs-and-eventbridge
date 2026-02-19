#!/bin/bash

set -e

APP_DIR=/opt/node-app
AWS_REGION=ap-south-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
docker login --username AWS --password-stdin \
$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "Stopping old containers..."
cd $APP_DIR || exit
docker compose down || true

echo "Pulling latest images..."
docker pull $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/node-microservices-customer:latest
docker pull $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/node-microservices-products:latest
docker pull $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/node-microservices-shopping:latest
docker pull $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/node-microservices-gateway:latest

echo "Starting containers..."
docker compose up -d

echo "Deployment complete."
