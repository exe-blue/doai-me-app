# DoAi-Gateway v2.0

> **통합 관제 서버** - ADB Device Control + React Dashboard

오리온 지시에 따라 Appsmith를 제거하고 자체 Control Room을 구현합니다.

## 🏗️ 아키텍처

```
gateway/
├── src/                    # Node.js 서버 (Express + WebSocket)
│   ├── index.js            # 메인 엔트리 (정적 파일 서빙 포함)
│   ├── adb/                # ADB 모듈 (client, tracker, commander)
│   ├── api/routes/         # REST API 엔드포인트
│   ├── discovery/          # Dynamic Device Discovery
│   ├── websocket/          # WebSocket Multiplexer
│   ├── stream/             # H.264 스트림 서버
│   └── utils/              # Logger, Config
│
├── client/                 # React 대시보드 (Vite + Tailwind)
│   ├── src/
│   │   ├── components/     # UI 컴포넌트
│   │   ├── hooks/          # React Hooks (WebSocket, Grid, Devices)
│   │   ├── pages/          # Dashboard, DeviceDetail
│   │   └── lib/            # Grid Calculator
│   └── dist/               # 빌드 결과물 (서버가 서빙)
│
└── package.json            # Monorepo 스크립트
```

## 🚀 실행 방법

### 개발 모드 (서버 + 클라이언트)

```bash
cd gateway

# 의존성 설치
npm install

# 동시 실행 (서버 :3100, 클라이언트 :3000)
npm run dev:all
```

### 프로덕션 빌드

```bash
# 클라이언트 빌드 (client/dist 생성)
npm run build

# 서버 시작 (빌드된 클라이언트 서빙)
npm start
```

## 🔌 API 엔드포인트

### Device Management

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/devices` | 전체 디바이스 목록 |
| GET | `/api/devices/:id` | 단일 디바이스 상세 |
| POST | `/api/discovery/scan` | 디바이스 재스캔 |

### Control

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/control/:id/key` | 키 이벤트 전송 |
| POST | `/api/control/:id/tap` | 터치 이벤트 |
| POST | `/api/control/:id/screenshot` | 스크린샷 캡처 |
| POST | `/api/control/:id/restart-autox` | AutoX.js 재시작 |

### Dispatch (ADB Broadcast)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/dispatch` | 전체/선택 디바이스에 명령 전송 |

```json
// POST /api/dispatch
{
  "target": "*",          // "*" 또는 디바이스 ID
  "type": "POP",          // POP, ACCIDENT, COMMISSION
  "payload": { "url": "..." }
}
```

## 🎨 브랜드 컬러

Tailwind 설정에 DoAi Yellow 추가:

```js
// tailwind.config.js
colors: {
  doai: {
    400: '#E6B84D',  // 메인 DoAi Yellow
    // ... 50~950 shades
  }
}
```

## 📡 WebSocket

```js
// 연결
const ws = new WebSocket('ws://localhost:3100/ws');

// 구독
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['devices', 'stream']
}));

// 메시지 수신
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'devices:updated') {
    // 디바이스 상태 변경
  }
};
```

## 🔧 환경 변수

```env
# 서버 설정
PORT=3100
HOST=0.0.0.0

# ADB 설정
ADB_HOST=127.0.0.1
ADB_PORT=5037

# Supabase (선택)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# 모니터링
HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
```

## 🐳 Docker

```bash
# 빌드
docker build -t doai-gateway .

# 실행
docker run -d \
  -p 3100:3100 \
  -v /dev/bus/usb:/dev/bus/usb \
  --name doai-gateway \
  doai-gateway
```

## 📱 지원 기능

- ✅ USB/WiFi/LAN 디바이스 자동 발견
- ✅ 실시간 디바이스 상태 모니터링
- ✅ WebSocket 기반 실시간 업데이트
- ✅ 스크린샷 기반 화면 보기
- ✅ ADB Broadcast 명령 전송
- ✅ 동적 그리드 레이아웃 (N대 자동 계산)
- ✅ 페이지네이션 (600대 지원)
- ✅ DoAi Yellow 브랜딩

---

**Author:** Axon (Tech Lead)  
**Version:** 2.0.0  
**License:** MIT
