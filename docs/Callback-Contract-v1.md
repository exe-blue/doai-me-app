# 콜백 모델 통신 계약서 v1

> **CRITICAL**: Backend↔Node 통신은 이 계약서를 따른다.

---

## 1-0. 기본 원칙

- **Backend**가 Run을 생성하고, 노드(PC-01~04)에 "Run 시작"을 알린다.
- **Node Agent**는 노드 내부에서 `list` → 디바이스별 큐 생성 → 글로벌 20 슬롯으로 즉시 실행을 수행한다.
- **Node Agent**는 상태/결과를 Backend로 **콜백(push)** 한다.
- **Backend**는 콜백이 늦거나 누락될 수 있으므로 **하트비트 기반 watchdog**을 둔다.

---

## 1-1. 인증 규칙

모든 노드↔백엔드 요청은 동일:

- **Header**: `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`
- **Body**: JSON
- **서버**: `node_id`가 등록된 노드인지 확인

---

## 1-2. Backend → Node: "Run 시작 알림"

### 권장: 노드→서버 WebSocket(컨트롤 채널) + 나머지 HTTP 콜백

- 노드가 서버에 **WS 연결 유지** → 서버가 그 채널로 `run_start` 이벤트 전송
- 인바운드 이슈 없음(노드가 outbound로 붙어 있음)

### 컨트롤 이벤트: `run_start`

```json
{
  "type": "run_start",
  "run_id": "uuid",
  "trigger": "youtube|manual",
  "scope": "ALL",
  "youtubeVideoId": "xxxx",
  "workflow_id": "login_settings_v1",
  "timeoutOverrides": {
    "BOOTSTRAP_ADB": 120000,
    "LOGIN_FLOW": 150000,
    "SCREENSHOT": 30000,
    "UPLOAD": 60000
  }
}
```

---

## 1-3. Node → Backend: 콜백 이벤트 타입 (필수 6종)

### 1) node_heartbeat (주기 5~15초)

```json
{
  "type": "node_heartbeat",
  "node_id": "PC-01",
  "timestamp": 1760000000000,
  "connected_devices_count": 100,
  "running_devices_count": 20,
  "queue_devices_count": 80,
  "vendor_ws_ok": true,
  "last_vendor_ws_ok_at": 1760000000000
}
```

### 2) run_started

```json
{
  "type": "run_started",
  "node_id": "PC-01",
  "run_id": "uuid",
  "timestamp": 1760000000000,
  "target_devices_count": 100,
  "max_concurrency": 20
}
```

### 3) task_started (디바이스 1대 작업 시작)

```json
{
  "type": "task_started",
  "node_id": "PC-01",
  "run_id": "uuid",
  "task_id": "uuid-or-hash",
  "device_serial": "ABC123",
  "workflow_id": "login_settings_v1",
  "timeoutMs": 150000,
  "timestamp": 1760000000000
}
```

### 4) task_progress (선택, step 단위)

```json
{
  "type": "task_progress",
  "node_id": "PC-01",
  "run_id": "uuid",
  "task_id": "uuid-or-hash",
  "device_serial": "ABC123",
  "step": "LOGIN_FLOW",
  "status": "running",
  "timestamp": 1760000000000
}
```

### 5) task_finished (성공/실패/타임아웃 포함)

```json
{
  "type": "task_finished",
  "node_id": "PC-01",
  "run_id": "uuid",
  "task_id": "uuid-or-hash",
  "device_serial": "ABC123",
  "status": "succeeded|failed",
  "failure_reason": "timeout|vendor_error|adb_error|upload_error|unknown",
  "timings": {
    "startedAt": 1760000000000,
    "endedAt": 1760000123456
  },
  "artifact": {
    "kind": "screenshot",
    "storage_path": "videos/…png",
    "public_url": "https://…"
  },
  "error_message": "optional",
  "timestamp": 1760000123456
}
```

### 6) run_finished (노드 단위 종료)

```json
{
  "type": "run_finished",
  "node_id": "PC-01",
  "run_id": "uuid",
  "timestamp": 1760000999999,
  "summary": {
    "succeeded": 95,
    "failed": 5,
    "timeout": 2
  }
}
```

---

## 1-4. 재전송/내구성 규칙

- **Node Agent**: 콜백 이벤트를 로컬 디스크 큐(append-only 로그 파일)에 먼저 기록 → 전송 성공 시 "ack" 처리.
- **Backend**: 모든 콜백 요청에 `event_id` 기준 **멱등성(idempotent)** 보장 (중복 수신해도 1번만 반영).
- **재시도**: 1s → 2s → 5s → 10s → 30s (최대 5~7회).
- **실패 시**: "degraded" 상태로 표시하고 실행은 계속, 이벤트는 로컬에 보관.
- **Backend watchdog**: heartbeat가 N초(예: 30초) 이상 없으면 해당 노드 offline, 해당 노드 run은 timeout 또는 unknown 상태로 종료 처리.

---

## 1-5. 스케줄 규칙 (확정)

- 디바이스마다 전용 큐(FIFO)
- 같은 디바이스는 절대 동시 실행 금지
- 노드 전체 동시 실행 20
- 슬롯이 19가 되면 즉시 20번째 작업 시작(즉시성)
- 공정성: round-robin
