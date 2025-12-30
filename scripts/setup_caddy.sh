#!/bin/bash
# ============================================================
# DoAi.Me Caddy Setup Script
# Vultr VPS에서 실행하세요
# ============================================================

set -e

echo "🚀 DoAi.Me Caddy 설치 시작..."

# ============================================================
# 1. Caddy 설치 (Debian/Ubuntu)
# ============================================================
echo "📦 Caddy 설치 중..."

sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# Caddy GPG 키 추가
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

# Caddy 저장소 추가
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Caddy 설치
sudo apt update
sudo apt install -y caddy

echo "✅ Caddy 설치 완료"

# ============================================================
# 2. Caddyfile 설정
# ============================================================
echo "📝 Caddyfile 설정 중..."

# 기존 Caddyfile 백업
if [ -f /etc/caddy/Caddyfile ]; then
    sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup
    echo "   기존 Caddyfile 백업됨: /etc/caddy/Caddyfile.backup"
fi

# 새 Caddyfile 작성
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
# ============================================================
# DoAi.Me Caddy Configuration
# 자동 HTTPS (Let's Encrypt) 적용됨
# ============================================================

# API 서버 (FastAPI)
api.doai.me {
    reverse_proxy localhost:8000
    
    # CORS 헤더 (필요시)
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
    
    # 로그
    log {
        output file /var/log/caddy/api.log
        format json
    }
}

# Gateway 서버 (Node.js ADB Gateway)
gateway.doai.me {
    reverse_proxy localhost:3100
    
    # CORS 헤더
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
    
    log {
        output file /var/log/caddy/gateway.log
        format json
    }
}

# n8n 워크플로우 자동화
n8n.doai.me {
    reverse_proxy localhost:5678
    
    log {
        output file /var/log/caddy/n8n.log
        format json
    }
}
EOF

echo "✅ Caddyfile 설정 완료"

# ============================================================
# 3. 로그 디렉토리 생성
# ============================================================
echo "📁 로그 디렉토리 생성 중..."
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

# ============================================================
# 4. 방화벽 설정 (UFW)
# ============================================================
echo "🔥 방화벽 설정 중..."

# UFW가 설치되어 있는 경우에만 실행
if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "   포트 80, 443 열림"
else
    echo "   UFW가 설치되어 있지 않음 - 수동으로 방화벽 설정 필요"
fi

# ============================================================
# 5. Caddy 서비스 시작
# ============================================================
echo "🔄 Caddy 서비스 재시작 중..."

sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl restart caddy

# 상태 확인
sleep 2
if sudo systemctl is-active --quiet caddy; then
    echo "✅ Caddy 서비스 실행 중"
else
    echo "❌ Caddy 서비스 시작 실패. 로그 확인:"
    sudo journalctl -u caddy --no-pager -n 20
    exit 1
fi

# ============================================================
# 6. 설정 검증
# ============================================================
echo ""
echo "🔍 설정 검증 중..."
sudo caddy validate --config /etc/caddy/Caddyfile

echo ""
echo "============================================================"
echo "✅ DoAi.Me Caddy 설정 완료!"
echo "============================================================"
echo ""
echo "📌 도메인 매핑:"
echo "   https://api.doai.me     → localhost:8000 (FastAPI)"
echo "   https://gateway.doai.me → localhost:3100 (Gateway)"
echo "   https://n8n.doai.me     → localhost:5678 (n8n)"
echo ""
echo "📌 유용한 명령어:"
echo "   sudo systemctl status caddy    # 상태 확인"
echo "   sudo systemctl restart caddy   # 재시작"
echo "   sudo journalctl -u caddy -f    # 로그 실시간 확인"
echo "   sudo caddy reload --config /etc/caddy/Caddyfile  # 설정 리로드"
echo ""
echo "📌 로그 위치:"
echo "   /var/log/caddy/api.log"
echo "   /var/log/caddy/gateway.log"
echo "   /var/log/caddy/n8n.log"
echo ""
echo "⚠️  SSL 인증서는 첫 요청 시 자동으로 발급됩니다 (Let's Encrypt)"
echo "============================================================"



