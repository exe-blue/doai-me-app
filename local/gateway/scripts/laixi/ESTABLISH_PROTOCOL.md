# DoAi.Me Connection Establishment Protocol v1.0

최초 접속 무결성 검증 및 소켓 성립 명령 프로토콜

## 📋 개요

이 프로토콜은 600대 Android 기기와의 안정적인 연결을 위한 **최초 성립 명령**을 정의합니다.

### 목적
1. **무결성 검증**: 각 디바이스가 정상 동작하는지 확인
2. **환경 초기화**: 폰보드 환경에 최적화된 설정 적용
3. **연결 유지**: 지속적인 Heartbeat로 연결 상태 모니터링

---

## 🔌 성립 시퀀스

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ESTABLISHMENT PROTOCOL v1.0                      │
└─────────────────────────────────────────────────────────────────────┘

Phase 1: CONNECT        → Laixi WebSocket 연결 (ws://127.0.0.1:22221)
         ↓ 성공
Phase 2: DISCOVER       → 디바이스 목록 조회 (action: "list")
         ↓ 디바이스 발견
Phase 3: VALIDATE       → 각 디바이스 무결성 검증 (Toast 응답 확인)
         ↓ 검증 완료
Phase 4: INITIALIZE     → 폰보드 환경 초기화 (ADB 명령)
         ↓ 초기화 완료
Phase 5: HEARTBEAT      → 5초 간격 연결 유지 루프
         ↓ 무한 반복
```

---

## 📁 파일 구조

```
gateway/scripts/laixi/
├── establish_connection.js    # 핵심 성립 명령 스크립트
├── start_establish.bat        # Windows 실행 스크립트
├── start_establish.ps1        # PowerShell 고급 스크립트
└── ESTABLISH_PROTOCOL.md      # 이 문서

autox-scripts/modules/
└── establish.js               # AutoX.js용 성립 확인 모듈
```

---

## 🚀 실행 방법

### Windows (BAT)

```batch
cd gateway\scripts\laixi
start_establish.bat
```

실행 모드 선택:
1. **전체 실행**: 연결 → 검증 → 초기화 → Heartbeat
2. **검증만 실행**: 연결 → 검증 후 종료
3. **초기화만 실행**: 검증 스킵, 바로 초기화

### PowerShell (고급)

```powershell
# 전체 실행
.\start_establish.ps1

# 검증만
.\start_establish.ps1 -Mode Verify

# 초기화만 (검증 스킵)
.\start_establish.ps1 -Mode Init

# 자동 재시작 (오류 시)
.\start_establish.ps1 -AutoRestart

# 로그 파일 기록
.\start_establish.ps1 -LogFile "C:\logs\establish.log"
```

### Node.js 직접 실행

```bash
cd gateway/scripts/laixi
npm install ws --save

# 전체 실행
node establish_connection.js

# 검증만
node establish_connection.js --verify-only

# 초기화만
node establish_connection.js --init-only
```

---

## 📊 각 Phase 상세

### Phase 1: CONNECT

Laixi WebSocket 서버에 연결합니다.

```javascript
const ws = new WebSocket('ws://127.0.0.1:22221');
```

**실패 시**: 3초 간격으로 최대 10회 재연결 시도

### Phase 2: DISCOVER

연결된 디바이스 목록을 조회합니다.

**요청**:
```json
{ "action": "list" }
```

**응답**:
```json
{
  "StatusCode": 200,
  "result": "[{\"deviceId\":\"fa3523ea0510\",\"no\":1,\"name\":\"SM-G965U1\",\"isOtg\":false}]"
}
```

### Phase 3: VALIDATE

각 디바이스에 Toast 메시지를 전송하여 응답을 확인합니다.

**요청**:
```json
{
  "action": "Toast",
  "comm": {
    "deviceIds": "fa3523ea0510",
    "content": "DoAi.Me 검증 ✓"
  }
}
```

**검증 기준**:
- `StatusCode === 200`
- 응답의 `result` 배열에서 해당 디바이스의 `success === true`

**경고 상황**:
- `errmsg`에 "来喜APP" 포함 → Laixi 앱 업데이트 필요 (사용 가능)

### Phase 4: INITIALIZE

폰보드 환경에 최적화된 설정을 적용합니다.

**초기화 명령 목록**:

| 순서 | 명령 | 목적 |
|------|------|------|
| 1 | `dumpsys deviceidle disable` | Doze 모드 비활성화 |
| 2 | `settings put global stay_on_while_plugged_in 3` | 화면 항상 켜짐 (USB) |
| 3 | `settings put system screen_brightness 10` | 화면 밝기 최소 (발열 방지) |
| 4 | `settings put global wifi_sleep_policy 2` | WiFi 절전 끄기 |
| 5 | `input keyevent 82` | 잠금 해제 시도 |
| 6 | `input keyevent 224` | 화면 켜기 |

**요청 포맷**:
```json
{
  "action": "ADB",
  "comm": {
    "deviceIds": "fa3523ea0510,abc123def456",
    "command": "adb shell dumpsys deviceidle disable"
  }
}
```

### Phase 5: HEARTBEAT

5초 간격으로 디바이스 목록을 조회하여 연결 상태를 확인합니다.

```javascript
setInterval(async () => {
  const response = await sendCommand({ action: 'list' });
  // 디바이스 수 변경 감지
  // 오류 시 재연결 시도
}, 5000);
```

---

## 📱 AutoX.js 연동

디바이스 측에서 성립 확인 요청을 수신하려면 `establish.js` 모듈을 사용합니다.

### main.js에서 사용

```javascript
const EstablishModule = require('./modules/establish.js');

const establish = new EstablishModule(config, logger);
establish.startListening();

// 상태 확인
console.log(establish.getStatus());

// 종료 시
establish.stopListening();
```

### 지원 명령

| 명령 | 설명 |
|------|------|
| `PING` | 연결 확인 (PONG 응답) |
| `VERIFY` | 무결성 검증 |
| `INIT` | 디바이스 초기화 |
| `DIAGNOSTICS` | 진단 정보 요청 |
| `STATUS` | 현재 상태 요청 |

### Broadcast 액션

- **수신**: `com.doai.me.ESTABLISH`
- **응답**: `com.doai.me.ESTABLISH_RESPONSE`

---

## 🔧 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LAIXI_WS_URL` | `ws://127.0.0.1:22221` | Laixi WebSocket URL |

---

## ⚠️ 오류 처리

### 연결 실패

```
Phase 1: CONNECT - Laixi WebSocket 연결
❌ 연결 실패: ECONNREFUSED
```

**해결**: Laixi.exe가 실행 중인지 확인

### 디바이스 없음

```
❌ 최소 1개 디바이스 필요 (현재: 0)
```

**해결**: ADB로 기기 연결 확인 (`adb devices`)

### 검증 실패

```
⚠ fa3523ea0510: 请升级来喜APP到最新版本
```

**해결**: 해당 기기의 Laixi 앱 업데이트 (사용은 가능)

---

## 📈 결과 예시

```
╔═══════════════════════════════════════════════════════════╗
║            성립 명령 결과 요약                             ║
╠═══════════════════════════════════════════════════════════╣
║  Node ID:         node_a1b2c3d4                          ║
║  총 디바이스:      20                                     ║
║  검증 완료:        18                                     ║
║  초기화 완료:      18                                     ║
╠═══════════════════════════════════════════════════════════╣
║  연결 시간:        152ms                                  ║
║  조회 시간:        89ms                                   ║
║  검증 시간:        24531ms                                ║
║  초기화 시간:      3421ms                                 ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🔄 연결 유지 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    연결 유지 상태 머신                        │
└─────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │ 연결 시도 │
    └────┬─────┘
         │
         ▼
    ┌──────────┐     실패 (최대 10회)     ┌──────────┐
    │  연결됨   │ ◄────────────────────► │  재연결   │
    └────┬─────┘                         └──────────┘
         │
         │ 5초마다 Heartbeat
         ▼
    ┌──────────┐
    │ 상태 확인 │ ◄─── 디바이스 수 변경 감지
    └────┬─────┘
         │
         │ 연결 끊김
         ▼
    ┌──────────┐
    │  재연결   │ ──► 3초 후 연결 시도
    └──────────┘
```

---

## 📚 관련 문서

- [Laixi 통합 가이드](../../../docs/LAIXI_INTEGRATION.md)
- [Gateway 프로토콜](../../../docs/GATEWAY_PROTOCOL_V2.md)
- [AutoX.js 설정](../../../docs/AUTOX_SETUP.md)

---

## 👤 Author

Axon (Tech Lead) - DoAi.Me Project
