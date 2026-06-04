#!/bin/bash
# ============================================================
# setup-ec2.sh — One-Time EC2 Instance Provisioning
# ============================================================
# Run this script on a fresh Ubuntu 22.04/24.04 EC2 instance
# to prepare it for Docker-based deployments.
#
# Usage:
#   chmod +x setup-ec2.sh
#   sudo ./setup-ec2.sh
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[SETUP]${NC} $1"; }

# ─── Check root ──────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./setup-ec2.sh"
    exit 1
fi

# ─── Step 1: Update system packages ─────────────────────────
log "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# ─── Step 2: Install prerequisites ──────────────────────────
log "Installing prerequisites..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common

# ─── Step 3: Install Docker ─────────────────────────────────
log "Installing Docker..."

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker repo
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# ─── Step 4: Configure Docker ───────────────────────────────
log "Configuring Docker..."

# Add ubuntu user to docker group (so no sudo needed)
usermod -aG docker ubuntu

# Enable Docker on boot
systemctl enable docker
systemctl start docker

# ─── Step 5: Configure Docker daemon ────────────────────────
log "Configuring Docker daemon (log rotation)..."
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

systemctl restart docker

# ─── Step 6: Install additional useful tools ────────────────
log "Installing additional tools..."
apt-get install -y \
    htop \
    net-tools \
    jq

# ─── Step 7: Configure firewall (UFW) ───────────────────────
log "Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # App port
ufw --force enable

# ─── Step 8: Verify installation ────────────────────────────
log "Verifying Docker installation..."
docker --version
docker compose version

# ─── Done ────────────────────────────────────────────────────
log "═══════════════════════════════════════════════"
log "  EC2 setup complete!"
log ""
log "  Docker:    $(docker --version)"
log "  Compose:   $(docker compose version)"
log ""
log "  IMPORTANT: Log out and log back in for"
log "  docker group changes to take effect:"
log "    exit"
log "    ssh ubuntu@<your-ec2-ip>"
log "═══════════════════════════════════════════════"
