#!/bin/bash
# ==============================================================================
# AIFarm 600대 서버 초기 설정 스크립트
# ==============================================================================
#
# 이 스크립트는 다음 보안 모범 사례를 적용합니다:
#   - 전용 비-root 서비스 사용자 (aifarm) 생성
#   - 적절한 파일/디렉토리 권한 설정
#   - root로 서비스 실행 방지
#   - systemd 보안 강화 옵션 적용 (NoNewPrivileges, PrivateTmp 등)
#
# 사용법:
#   curl -fsSL https://raw.githubusercontent.com/exe-blue/youtube_automation_human_bot/main/deploy/aifarm_setup.sh -o /tmp/aifarm_setup.sh
#   chmod +x /tmp/aifarm_setup.sh
#   sudo bash /tmp/aifarm_setup.sh
#
# NOTE: This script is intended for NEW server setup.
# Running on an existing server may overwrite configurations.
# For existing servers, review each step before executing.
#
# ==============================================================================

set -e

echo "=========================================="
echo "AIFarm 서버 설정 시작"
echo "=========================================="

# 1. 시스템 업데이트
echo "[1/7] 시스템 업데이트..."
apt update && apt upgrade -y

# 2. 필수 패키지 설치
echo "[2/7] 필수 패키지 설치..."
apt install -y python3.11 python3.11-venv python3-pip git curl wget htop tmux nginx ufw

# 3. 프로젝트 디렉토리 설정
echo "[3/7] 프로젝트 설정..."
mkdir -p /opt/aifarm
cd /opt/aifarm

# GitHub에서 클론 (이미 있으면 pull) - fail fast on clone failure
if [ -d ".git" ]; then
    git pull
else
    if ! git clone https://github.com/exe-blue/aifarm.git .; then
        echo "ERROR: Repository clone failed!"
        echo "Please check network connectivity and repository URL."
        exit 1
    fi
fi

# 4. Create dedicated service user for security
echo "[4/7] Creating dedicated service user..."
if ! id "aifarm" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin aifarm
    echo "Created aifarm service user"
else
    echo "aifarm user already exists"
fi

# Add aifarm user to plugdev group for device access if the group exists
if getent group plugdev > /dev/null 2>&1; then
    usermod -aG plugdev aifarm
fi

# Set ownership of project directory
chown -R aifarm:aifarm /opt/aifarm

# 5. 가상환경 생성 및 패키지 설치 (as aifarm user)
echo "[5/7] Python 가상환경 설정..."
sudo -u aifarm python3.11 -m venv /opt/aifarm/venv
sudo -u aifarm /opt/aifarm/venv/bin/pip install --upgrade pip

# requirements.txt가 있으면 설치
if [ -f "requirements.txt" ]; then
    sudo -u aifarm /opt/aifarm/venv/bin/pip install -r requirements.txt
else
    sudo -u aifarm /opt/aifarm/venv/bin/pip install fastapi uvicorn pydantic aiohttp adb-shell pure-python-adb
fi

# 6. 방화벽 설정 (with backup and safety checks)
echo "[6/7] 방화벽 설정..."

# Check current UFW status and backup existing rules
UFW_STATUS=$(ufw status 2>/dev/null | head -1)
echo "Current UFW status: $UFW_STATUS"

# Backup existing UFW rules if UFW is active
if echo "$UFW_STATUS" | grep -q "Status: active"; then
    echo "WARNING: UFW is already active. Backing up existing rules..."
    UFW_BACKUP_FILE="/root/ufw_backup_$(date +%Y%m%d_%H%M%S).txt"
    ufw status numbered > "$UFW_BACKUP_FILE"
    echo "UFW rules backed up to: $UFW_BACKUP_FILE"
    echo ""
    echo "Existing rules will be preserved. Adding new rules..."
else
    echo "UFW is inactive. Will enable after adding rules."
fi

# Add firewall rules (idempotent - won't duplicate)
ufw allow 22/tcp    # SSH
ufw allow 8080/tcp  # Web Dashboard

# ADB port 5555 - DO NOT open to all IPs!
# See DEPLOY_GUIDE.md for security guidance
echo ""
echo "⚠️  NOTE: ADB port 5555 is NOT opened by default for security."
echo "   To enable ADB access, use one of these options:"
echo "   1. Restrict to specific IP: ufw allow from <YOUR_IP> to any port 5555 proto tcp"
echo "   2. Use VPN/SSH tunnel (recommended)"
echo ""

# Only force enable if UFW was inactive
if ! echo "$UFW_STATUS" | grep -q "Status: active"; then
    ufw --force enable
    echo "UFW enabled."
else
    echo "UFW was already active. Rules added without restart."
    # Optionally reload UFW to apply changes
    ufw reload 2>/dev/null || true
fi

# 7. systemd 서비스 등록 (with dedicated user and security hardening)
echo "[7/7] systemd 서비스 등록..."
cat > /etc/systemd/system/aifarm.service << 'EOF'
[Unit]
Description=AIFarm Server
After=network.target

[Service]
Type=simple
User=aifarm
Group=aifarm
WorkingDirectory=/opt/aifarm
Environment=PATH=/opt/aifarm/venv/bin
ExecStart=/opt/aifarm/venv/bin/python run_intranet.py
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/opt/aifarm

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aifarm

echo "=========================================="
echo "기본 설정 완료!"
echo ""
echo "Service user: aifarm (non-root)"
echo "Project directory: /opt/aifarm (owned by aifarm)"
echo ""
echo "다음 단계:"
echo "1. 환경변수 설정: sudo nano /opt/aifarm/.env"
echo "2. ADB 포트 보안 설정:"
echo "   sudo ufw allow from <YOUR_IP> to any port 5555 proto tcp"
echo "3. 서비스 시작: sudo systemctl start aifarm"
echo "4. 상태 확인: sudo systemctl status aifarm"
echo "5. 로그 확인: sudo journalctl -u aifarm -f"
echo "6. 헬스체크: curl http://localhost:8080/health"
echo "=========================================="