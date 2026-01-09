# DoAi.Me Cloud Gateway

> **The Brain** - 모든 NodeRunner의 WebSocket 연결을 관리하는 중앙 서버

## 🚀 Vultr 배포

### 1. VPS 준비

```bash
# Vultr Ubuntu 22.04 권장
# 최소 사양: 1 vCPU, 1GB RAM

# SSH 접속
ssh root@your-vultr-ip
```

### 2. 도메인 설정

DNS에서 `api.doai.me` → Vultr IP 연결

```
A Record: api.doai.me → 149.xxx.xxx.xxx
```

### 3. 배포

```bash
# 저장소 클론 또는 파일 업로드
cd /opt
git clone https://github.com/your-repo/aifarm.git
cd aifarm/cloud-gateway

# 배포 스크립트 실행
chmod +x deploy.sh
./deploy.sh
```

### 4. 확인

```bash
# 컨테이너 상태
docker-compose ps

# 로그 확인
docker-compose logs -f gateway

# 헬스체크
curl https://api.doai.me/health

# 노드 목록
curl https://api.doai.me/api/nodes
```

## 🎮 Control Room

웹 기반 대시보드로 모든 노드를 실시간으로 모니터링하고 명령을 전송합니다.

### 접속

```
http://localhost:8000/
또는
https://api.doai.me/
```

### 기능

- **실시간 노드 상태**: WebSocket으로 600개 노드 시각화
- **브로드캐스트**: YouTube 시청 명령을 모든 노드에 일괄 전송
- **로그 모니터링**: 실시간 시스템 로그

## 📡 API

### WebSocket

```
# NodeRunner용
wss://api.doai.me/ws/node

# 대시보드용 (실시간 피드)
wss://api.doai.me/ws/dashboard
```

**NodeRunner Protocol:**
1. `HELLO` → `HELLO_ACK`
2. `HEARTBEAT` (30초) → `HEARTBEAT_ACK`
3. `COMMAND` → `RESULT`

**Dashboard Protocol:**
- `INIT`: 초기 노드 목록
- `NODE_CONNECTED`: 새 노드 연결
- `NODE_DISCONNECTED`: 노드 연결 해제
- `NODE_UPDATE`: 노드 상태 업데이트
- `BROADCAST_STARTED`: 브로드캐스트 시작
- `COMMAND_RESULT`: 명령 결과

### REST

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | 헬스체크 |
| `/api/nodes` | GET | 연결된 노드 목록 |
| `/api/nodes/{id}` | GET | 특정 노드 상태 |
| `/api/command` | POST | 특정 노드에 명령 전송 (동기) |
| `/api/queue/command` | POST | 명령 큐에 추가 (비동기) |
| `/api/broadcast` | POST | 모든 노드에 브로드캐스트 |

### 명령 예시

```bash
# 디바이스 목록
curl -X POST https://api.doai.me/api/command \
  -H "Content-Type: application/json" \
  -d '{"node_id": "win-home-001", "action": "list", "device_id": "all"}'

# YouTube 시청 (특정 노드)
curl -X POST https://api.doai.me/api/command \
  -H "Content-Type: application/json" \
  -d '{"node_id": "win-home-001", "action": "watch", "device_id": "all", "params": {"url": "https://youtube.com/watch?v=xxx", "duration": 60}}'

# 브로드캐스트 (모든 노드)
curl -X POST https://api.doai.me/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://youtu.be/dQw4w9WgXcQ",
    "duration_seconds": 60,
    "target_node_count": 0,
    "priority": "HIGH"
  }'
```

## 🔧 관리

```bash
# 재시작
docker-compose restart gateway

# 로그
docker-compose logs -f --tail=100 gateway

# 중지
docker-compose down

# 업데이트
git pull
docker-compose build --no-cache gateway
docker-compose up -d gateway
```

## 📊 모니터링

- **Caddy 로그**: `/var/log/caddy/access.log`
- **Gateway 로그**: `docker-compose logs gateway`
- **연결 상태**: `https://api.doai.me/api/nodes`

