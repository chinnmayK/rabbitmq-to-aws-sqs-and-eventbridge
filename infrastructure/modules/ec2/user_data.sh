#!/bin/bash
set -euxo pipefail

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

echo "===== EC2 Bootstrap Complete ====="