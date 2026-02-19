#!/bin/bash
set -e

exec > /var/log/user-data.log 2>&1

echo "Starting EC2 bootstrap..."

# ----------------------------
# Update system
# ----------------------------
apt update -y

# DO NOT use apt upgrade in production user-data
# It slows provisioning and may break AMI assumptions

# ----------------------------
# Install required packages
# ----------------------------
apt install -y \
  docker.io \
  docker-compose-plugin \
  awscli \
  ruby \
  wget \
  git \
  curl \
  unzip

# ----------------------------
# Enable & start Docker
# ----------------------------
systemctl enable docker
systemctl start docker

# Add ubuntu to docker group
usermod -aG docker ubuntu

# ----------------------------
# Install CloudWatch Agent
# ----------------------------
cd /tmp
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# ----------------------------
# Install CodeDeploy Agent
# ----------------------------
cd /home/ubuntu
wget https://aws-codedeploy-ap-south-1.s3.ap-south-1.amazonaws.com/latest/install
chmod +x ./install
./install auto

systemctl enable codedeploy-agent
systemctl start codedeploy-agent

# ----------------------------
# Create application directory
# ----------------------------
mkdir -p /opt/node-app
chown ubuntu:ubuntu /opt/node-app

echo "EC2 bootstrap complete"
