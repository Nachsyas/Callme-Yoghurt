#!/usr/bin/env bash
# ==============================================================================
# Callme Yoghurt ERP Core — VPS Hardening Script (Phase 1.5)
# Target OS: Ubuntu 24.04 LTS
# Target Specs: 4 vCPU, 8GB RAM, 160GB NVMe SSD
# Security Mandate: Zero-Trust, Strict UFW, Fail2ban, Key-Only SSH
# ==============================================================================
set -euo pipefail

echo "====================================================="
echo " Callme Yoghurt — Phase 1.5 Server Security Hardening"
echo "====================================================="

if [[ $EUID -ne 0 ]]; then
   echo "ERROR: This script must be run as root (or via sudo)." >&2
   exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "[1/6] Updating system package index and security upgrades..."
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban curl wget git unattended-upgrades apt-transport-https ca-certificates gnupg lsb-release

echo "[2/6] Configuring Unattended Security Upgrades..."
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "[3/6] Hardening SSH Configuration..."
SSH_CONFIG="/etc/ssh/sshd_config"
SSH_CONFIG_D="/etc/ssh/sshd_config.d/50-callme-hardening.conf"

cat << 'EOF' > "$SSH_CONFIG_D"
# Callme Yoghurt SSH Hardening Baseline
PermitRootLogin prohibit-password
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
MaxAuthTries 4
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

systemctl restart ssh || systemctl restart sshd

echo "[4/6] Configuring UFW Firewall..."
# Reset to safe defaults
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow only mandatory ingress ports
ufw allow 22/tcp comment 'SSH Remote Administration'
ufw allow 80/tcp comment 'HTTP ACME & Reverse Proxy'
ufw allow 443/tcp comment 'HTTPS Reverse Proxy'

# Explicitly ensure database and internal ports are NEVER public
ufw deny 5432 comment 'Block Public PostgreSQL'
ufw deny 6379 comment 'Block Public Redis'
ufw deny 8000 comment 'Block Direct Artisan Serve'

# Enable firewall
ufw --force enable
ufw status verbose

echo "[5/6] Configuring Fail2ban..."
cat << 'EOF' > /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo "[6/6] Creating application service user (callme)..."
if ! id -u callme > /dev/null 2>&1; then
    useradd -m -s /bin/bash -G www-data callme
    mkdir -p /home/callme/.ssh
    if [[ -f /root/.ssh/authorized_keys ]]; then
        cp /root/.ssh/authorized_keys /home/callme/.ssh/
        chown -R callme:callme /home/callme/.ssh
        chmod 700 /home/callme/.ssh
        chmod 600 /home/callme/.ssh/authorized_keys
    fi
    echo "callme ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/99-callme-user
    chmod 440 /etc/sudoers.d/99-callme-user
    echo "Service user 'callme' created with sudo privileges."
else
    echo "User 'callme' already exists."
fi

echo "====================================================="
echo " Security Hardening Complete!"
echo " Firewall: 22, 80, 443 allowed. 5432, 6379, 8000 blocked."
echo " SSH: Key authentication only. Password login disabled."
echo "====================================================="
