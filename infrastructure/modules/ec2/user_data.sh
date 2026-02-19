#!/bin/bash
set -e

# Redirect output to log for debugging
exec > /var/log/user-data.log 2>&1

echo "Starting EC2 bootstrap..."

# 1. Update system and install prerequisites
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release

# 2. Add Docker’s official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Set up the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine and Docker Compose Plugin
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin awscli ruby wget git unzip

# 5. Enable & start Docker
systemctl enable docker
systemctl start docker

# Add ubuntu to docker group so 'docker' commands work without sudo
usermod -aG docker ubuntu

# 6. Install CloudWatch Agent
cd /tmp
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# 7. Install CodeDeploy Agent
cd /home/ubuntu
wget https://aws-codedeploy-ap-south-1.s3.ap-south-1.amazonaws.com/latest/install
chmod +x ./install
./install auto
systemctl enable codedeploy-agent
systemctl start codedeploy-agent

# 8. Create application directory
mkdir -p /opt/node-app
chown ubuntu:ubuntu /opt/node-app

echo "EC2 bootstrap complete"