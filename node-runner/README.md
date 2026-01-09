# DoAi.Me NodeRunner

> **The Muscle** - 로컬 디바이스를 제어하는 실행기

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
pip install -r requirements.txt
```

### 2. 로컬 테스트

```bash
# Gateway가 localhost:8000에서 실행 중일 때
python noderunner.py --local
```

### 3. 프로덕션 실행

```bash
# Windows
start_production.bat

# 또는 직접 실행
set CENTRAL_URL=wss://api.doai.me/ws/node
python noderunner.py
```

## ⚙️ 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NODE_ID` | 호스트명 | 노드 식별자 |
| `CENTRAL_URL` | `wss://api.doai.me/ws/node` | Gateway WebSocket URL |
| `LAIXI_HOST` | `127.0.0.1` | Laixi 호스트 |
| `LAIXI_PORT` | `22221` | Laixi WebSocket 포트 |
| `LAIXI_PATH` | `C:\Laixi\Laixi.exe` | Laixi 실행 파일 (Self-Healing용) |

## 📡 프로토콜

### 1. 연결

```json
// NodeRunner → Gateway
{"type": "HELLO", "node_id": "win-home-001", "device_count": 13}

// Gateway → NodeRunner
{"type": "HELLO_ACK", "server_time": "2025-01-01T00:00:00Z"}
```

### 2. Heartbeat (30초)

```json
// NodeRunner → Gateway
{"type": "HEARTBEAT", "node_id": "win-home-001", "device_count": 13, "uptime": 3600}

// Gateway → NodeRunner
{"type": "HEARTBEAT_ACK", "server_time": "..."}
```

### 3. 명령

```json
// Gateway → NodeRunner
{"type": "COMMAND", "command_id": "abc123", "action": "watch", "device_id": "all", "params": {"url": "...", "duration": 60}}

// NodeRunner → Gateway
{"type": "RESULT", "command_id": "abc123", "success": true, "data": {"watched_sec": 60}}
```

## 🔧 지원 명령

| Action | 설명 | Params |
|--------|------|--------|
| `list` | 디바이스 목록 | - |
| `watch` | YouTube 시청 | `url`, `duration` |
| `tap` | 화면 탭 | `x`, `y` (0.0-1.0) |
| `swipe` | 스와이프 | `x1`, `y1`, `x2`, `y2`, `duration` |
| `adb` | ADB 명령 | `command` |

## 🛡️ Self-Healing

Laixi 연결 실패 시 자동으로:
1. 기존 Laixi 프로세스 종료
2. Laixi 재시작
3. 3회 재연결 시도

## 📊 모니터링

```bash
# 로컬 헬스체크
curl http://localhost:9999/health

# 응답
{
  "status": "ok",
  "node_id": "win-home-001",
  "central_connected": true,
  "laixi_connected": true,
  "device_count": 13,
  "uptime": 3600
}
```

## 🪟 Windows 서비스 등록 (선택)

```powershell
# NSSM으로 서비스 등록
nssm install DoAiMe-NodeRunner "C:\Python311\python.exe" "D:\aifarm\node-runner\noderunner.py"
nssm set DoAiMe-NodeRunner AppDirectory "D:\aifarm\node-runner"
nssm set DoAiMe-NodeRunner DisplayName "DoAi.Me NodeRunner"
nssm start DoAiMe-NodeRunner
```

