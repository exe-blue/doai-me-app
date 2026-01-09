# DoAi.ME - Laixi Bridge

Laixi 투屏 소프트웨어와 DoAi.ME Market을 연결하는 브릿지 시스템입니다.

## 📋 개요

이 브릿지를 통해:
- 실제 Android 디바이스의 상태를 Market 페이지에서 실시간 확인
- YouTube 영상 시청 명령을 디바이스에 전달
- 시청 완료 시 결과를 수집하여 표시
- 좋아요/댓글(로그인 시) 기능 지원

## 🏗️ 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  DoAi.ME Web    │────▶│  Market Bridge   │────▶│    Laixi        │
│  (Market Page)  │ WS  │  (Node.js)       │ WS  │  (Port 22221)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        ▼
        │                        │               ┌─────────────────┐
        │                        │               │  Android 기기    │
        │                        │               │  (AutoX.js)     │
        │                        │               └─────────────────┘
        │                        │
        └────────────────────────┘
                  API (REST)
```

## 🚀 빠른 시작

### 1. 사전 요구사항

- **Node.js** 18+ 설치
- **Laixi** 투屏 프로그램 설치 및 실행 (기본 포트: 22221)
- **Android 기기** Laixi에 연결됨
- **AutoX.js** (선택) 기기에 설치됨

### 2. 브릿지 실행

#### Windows (배치 파일)
```batch
# 더블클릭으로 실행
start_doai_bridge.bat
```

#### Windows (PowerShell)
```powershell
# 기본 설정으로 실행
.\start_doai_bridge.ps1

# 커스텀 설정
.\start_doai_bridge.ps1 -LaixiUrl "ws://192.168.1.100:22221"
```

#### Node.js 직접 실행
```bash
# 의존성 설치 (최초 1회)
npm install ws

# 실행
node doai_market_bridge.js
```

### 3. 환경변수 설정 (선택)

```bash
# DoAi.ME API 주소
set DOAI_API_URL=http://localhost:3000

# Bridge WebSocket 포트 (Market 페이지 연결용)
set DOAI_WS_PORT=8080

# Laixi WebSocket 주소
set LAIXI_WS_URL=ws://127.0.0.1:22221
```

## 📁 파일 구조

```
gateway/scripts/laixi/
├── doai_market_bridge.js    # 메인 브릿지 스크립트
├── youtube_watch.js         # AutoX.js YouTube 자동화 스크립트
├── start_doai_bridge.bat    # Windows 배치 실행 파일
├── start_doai_bridge.ps1    # PowerShell 실행 스크립트
└── README.md                # 이 파일
```

## 🔧 설정

### Bridge 설정 (doai_market_bridge.js)

```javascript
const CONFIG = {
  API_URL: 'http://localhost:3000',    // DoAi.ME API
  WS_PORT: 8080,                        // Market 연결 포트
  LAIXI_WS_URL: 'ws://127.0.0.1:22221', // Laixi 주소
  REPORT_INTERVAL: 5000,                // 상태 보고 간격
  HEALTH_CHECK_INTERVAL: 30000,         // 헬스체크 간격
  RECONNECT_DELAY: 3000,                // 재연결 대기
  MAX_RECONNECT_ATTEMPTS: 10,           // 최대 재연결 시도
};
```

### Market 페이지 설정 (Next.js)

`.env.local` 파일 생성:
```env
# Bridge WebSocket URL
NEXT_PUBLIC_DOAI_WS_URL=ws://localhost:8080

# 강제 시뮬레이션 모드 (Bridge 없이 테스트)
NEXT_PUBLIC_FORCE_SIMULATION=false
```

## 📡 WebSocket API

### Bridge → Market (서버 → 클라이언트)

| 타입 | 설명 |
|------|------|
| `INIT` | 초기 연결 시 노드 목록, 통계 전송 |
| `NODES_LIST` | 전체 노드 목록 |
| `NODE_STATUS` | 단일 노드 상태 변경 |
| `VIDEO_PROGRESS` | 영상 시청 진행 상황 |
| `LOG` | 실시간 로그 |
| `LAIXI_CONNECTED` | Laixi 연결 성공 |
| `LAIXI_DISCONNECTED` | Laixi 연결 끊김 |

### Market → Bridge (클라이언트 → 서버)

| 타입 | 설명 |
|------|------|
| `GET_NODES` | 노드 목록 요청 |
| `SET_NODE_STATUS` | 노드 상태 변경 |
| `START_WATCHING` | 특정 노드에 시청 명령 |
| `ADD_VIDEO` | 새 영상 등록 및 배분 |
| `RECONNECT_LAIXI` | Laixi 재연결 요청 |
| `SEND_TOAST` | 디바이스에 Toast 메시지 |

## 📱 AutoX.js 스크립트

`youtube_watch.js`는 Laixi를 통해 Android 기기에서 실행됩니다.

### 기능
- ✅ YouTube 앱 열기
- ✅ URL로 특정 영상 열기
- ✅ 광고 자동 스킵
- ✅ 설정 시간만큼 시청
- ✅ 좋아요 누르기
- ✅ 댓글 작성 (로그인 필요)
- ✅ 구독하기 (로그인 필요)
- ✅ 로그인 상태 확인

### 파라미터

| 이름 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `videoUrl` | string | null | YouTube 영상 URL |
| `videoId` | string | auto | DoAi.ME 내부 ID |
| `minWatchSeconds` | number | 30 | 최소 시청 시간 |
| `maxWatchSeconds` | number | 180 | 최대 시청 시간 |
| `like` | boolean | false | 좋아요 여부 |
| `comment` | string | null | 댓글 내용 |
| `subscribe` | boolean | false | 구독 여부 |
| `requireLogin` | boolean | false | 로그인 필수 여부 |
| `skipAds` | boolean | true | 광고 스킵 여부 |

## 🐛 문제 해결

### Bridge가 Laixi에 연결되지 않음

1. Laixi가 실행 중인지 확인
2. WebSocket API가 활성화되어 있는지 확인 (Laixi 설정)
3. 포트 번호 확인 (기본: 22221)
4. 방화벽 설정 확인

### Market 페이지가 Bridge에 연결되지 않음

1. Bridge가 실행 중인지 확인
2. `NEXT_PUBLIC_DOAI_WS_URL` 환경변수 설정 확인
3. 브라우저 콘솔에서 WebSocket 오류 확인
4. CORS 설정 확인 (필요시)

### 시뮬레이션 모드로 전환됨

- Bridge 연결 실패 시 자동으로 시뮬레이션 모드로 전환됩니다.
- 강제로 시뮬레이션 모드를 사용하려면:
  ```env
  NEXT_PUBLIC_FORCE_SIMULATION=true
  ```

### 디바이스가 감지되지 않음

1. Laixi에서 디바이스가 보이는지 확인
2. ADB 연결 상태 확인
3. 디바이스의 USB 디버깅 활성화 확인
4. ADB 권한 승인 확인

## 📞 지원

- **Laixi 공식 문서**: https://docs.laixi.app
- **DoAi.ME**: https://doai.me
