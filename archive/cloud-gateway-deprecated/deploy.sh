#!/bin/bash
# DoAi.Me Cloud Gateway - Vultr 배포 스크립트
# 
# 사용법:
#   1. Vultr VPS에 SSH 접속
#   2. git clone 또는 파일 업로드
#   3. chmod +x deploy.sh && ./deploy.sh

set -e

echo "============================================"
echo "DoAi.Me Cloud Gateway 배포"
echo "============================================"

# 1. Docker 확인
if ! command -v docker &> /dev/null; then
    echo "Docker 설치 중..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# 2. Docker Compose 확인
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose 설치 중..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 3. 이전 컨테이너 정리
echo "기존 컨테이너 정리..."
docker-compose down --remove-orphans 2>/dev/null || true

# 4. 빌드 및 시작
echo "빌드 및 시작..."
docker-compose build --no-cache
docker-compose up -d

# 5. 상태 확인
echo ""
echo "============================================"
echo "배포 완료!"
echo "============================================"
echo ""
docker-compose ps
echo ""
echo "로그 확인: docker-compose logs -f"
echo "WebSocket: wss://api.doai.me/ws/node"
echo "API: https://api.doai.me/api/nodes"
echo ""

# 6. 헬스체크
sleep 5
echo "헬스체크..."
curl -s http://localhost:8000/health || echo "Gateway 시작 중..."

