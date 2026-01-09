#!/bin/bash
# AIFarm Vultr 서버 초기 설정 스크립트

set -e

echo "=========================================="
echo "AIFarm 서버 설정 (600대 관리)"
echo "=========================================="

# 1. 시스템 업데이트
echo "[1/7] 시스템 업데이트..."
apt update && apt upgrade -y

# 2. 필수 패키지 설치
echo "[2/7] 필수 패키지 설치..."
apt install -y python3.11 python3.11-venv python3-pip git curl wget htop tmux nginx ufw

# 3. 프로젝트 디렉토리 생성 및 저장소 클론
echo "[3/7] AIFarm 프로젝트 설정..."
mkdir -p /opt/aifarm
cd /opt/aifarm

# 저장소 클론 또는 업데이트 - FAIL FAST on clone failure
if [ -d ".git" ]; then
    echo "기존 저장소 업데이트..."
    git pull
else
    echo "저장소 클론..."
    if ! git clone https://github.com/exe-blue/aifarm.git .; then
        echo "ERROR: Repository clone failed!"
        echo "Please check:"
        echo "  1. Network connectivity"
        echo "  2. Repository URL is correct"
        echo "  3. Git is properly installed"
        exit 1
    fi
fi

# 4. 가상환경 생성
echo "[4/7] Python 가상환경 설정..."
python3.11 -m venv venv
source venv/bin/activate

# 5. Python 패키지 설치
echo "[5/7] Python 패키지 설치..."
pip install --upgrade pip

# requirements.txt가 있으면 설치
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    # 기본 패키지 설치 - synchronized with DEPLOY_GUIDE.md
    # Note: asyncio is stdlib in Python 3.11+, removed from pip install
    pip install fastapi uvicorn pydantic aiohttp python-dotenv \
        uiautomator2 supabase gspread google-auth openai tenacity Pillow jinja2
fi

# 6. 방화벽 설정
echo "[6/7] 방화벽 설정..."
ufw allow 22/tcp    # SSH
ufw allow 8080/tcp  # Web Dashboard

# ADB Port Security Warning:
# Port 5555 (ADB) should NOT be open to all IPs as it allows remote device control.
# Options:
#   1. Restrict to specific IP/CIDR: ufw allow from <YOUR_IP> to any port 5555 proto tcp
#   2. Use VPN/Tailscale and only allow from VPN network
#   3. Use SSH tunneling instead of direct port access
#
# Uncomment and modify ONE of the following based on your security requirements:

# Option 1: Restrict to specific IP (recommended for production)
# Replace ALLOWED_IP_OR_CIDR with your management IP or CIDR range
if [ -n "${ADB_ALLOWED_IP:-}" ]; then
    echo "Restricting ADB port 5555 to: $ADB_ALLOWED_IP"
    ufw allow from "$ADB_ALLOWED_IP" to any port 5555 proto tcp
else
    echo ""
    echo "⚠️  WARNING: ADB port 5555 is NOT configured!"
    echo "   ADB access requires one of the following:"
    echo "   1. Set ADB_ALLOWED_IP environment variable and re-run"
    echo "   2. Manually add UFW rule: ufw allow from <YOUR_IP> to any port 5555 proto tcp"
    echo "   3. Use VPN/SSH tunnel to access ADB (most secure)"
    echo ""
    echo "   See DEPLOY_GUIDE.md for detailed security guidance."
    echo ""
fi

ufw --force enable

# 7. systemd 서비스 등록
echo "[7/7] systemd 서비스 등록..."
cat > /etc/systemd/system/aifarm.service << 'EOF'
[Unit]
Description=AIFarm Server (600 Devices Management)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/aifarm
Environment=PATH=/opt/aifarm/venv/bin
ExecStart=/opt/aifarm/venv/bin/python run_intranet.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aifarm

echo "=========================================="
echo "설정 완료!"
echo ""
echo "다음 단계:"
echo "1. 환경변수 설정: nano /opt/aifarm/.env"
echo "   SUPABASE_URL=https://your-project.supabase.co"
echo "   SUPABASE_KEY=your-anon-key"
echo "   HOST=0.0.0.0"
echo "   PORT=8080"
echo "   MAX_WORKERS=100"
echo ""
echo "2. ADB 포트 보안 설정 (필수!):"
echo "   ufw allow from <YOUR_IP> to any port 5555 proto tcp"
echo "   또는 VPN/SSH 터널 사용"
echo ""
echo "3. 서비스 시작: systemctl start aifarm"
echo "4. 상태 확인: systemctl status aifarm"
echo "5. 로그 확인: journalctl -u aifarm -f"
echo "=========================================="
