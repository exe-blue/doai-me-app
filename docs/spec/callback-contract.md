# 콜백 통신 계약서 (Canonical)

> **tags**: `callback`, `node`, `backend`, `heartbeat`, `event`, `retry`, `idempotency`
> **sources**: Callback-Contract-v1
> **status**: canonical — Backend↔Node 통신은 이 문서를 따른다

---

## 원칙

- Backend가 Run 생성 → Node에 run_start 알림 (MVP: polling `/api/nodes/pull`)
- Node Agent가 디바이스별 큐 → 글로벌 20 슬롯 실행 → 콜백 push
- 모든 콜백은 `event_id` 기반 멱등 처리
- Backend watchdog: heartbeat N초(30초) 이상 없으면 노드 offline 처리

---

## 엔드포인트

**POST /api/nodes/callback**

- Auth: `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`
- Body: `{ "event_id": "string", "type": "...", "payload": {} }`
- Response: `{ "ok": true }`

---

## 이벤트 타입 (필수 6종)

### 1. node_heartbeat (주기 30초)

```json
{
  "type": "node_heartbeat",
  "node_id": "PC-01", "timestamp": 1760000000000,
  "connected_devices_count": 100, "running_devices_count": 20,
  "queue_devices_count": 80, "vendor_ws_ok": true
}
```

### 2. run_started

```json
{
  "type": "run_started",
  "node_id": "PC-01", "run_id": "uuid", "timestamp": 1760000000000,
  "target_devices_count": 100, "max_concurrency": 20
}
```

### 3. task_started (디바이스 1대 작업 시작)

```json
{
  "type": "task_started",
  "node_id": "PC-01", "run_id": "uuid", "task_id": "string",
  "device_id": "onlySerial", "runtime_handle": "serial",
  "workflow_id": "login_settings_screenshot_v1",
  "timeoutMs": 180000, "timestamp": 1760000000000
}
```

### 4. task_progress (선택, step 단위)

```json
{
  "type": "task_progress",
  "node_id": "PC-01", "run_id": "uuid", "task_id": "string",
  "device_id": "onlySerial",
  "step": "PREFLIGHT|BOOTSTRAP|LOGIN_FLOW|SCREENSHOT|UPLOAD",
  "status": "running|done", "timestamp": 1760000000000
}
```

### 5. task_finished

```json
{
  "type": "task_finished",
  "node_id": "PC-01", "run_id": "uuid", "task_id": "string",
  "device_id": "onlySerial", "runtime_handle": "serial",
  "status": "succeeded|failed",
  "failure_reason": "needs_usb_authorization|adb_offline|adb_missing|vendor_ws_error|vendor_command_error|bootstrap_critical_failed|login_flow_timeout|screenshot_error|upload_error|callback_error|emulator_not_online|emulator_not_booted|unknown",
  "timings": { "startedAt": 1760000000000, "endedAt": 1760000123456 },
  "artifact": {
    "kind": "screenshot",
    "storage_path": "videos/{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png",
    "public_url": "https://..."
  },
  "error_message": "optional", "timestamp": 1760000123456
}
```

### 6. run_finished (노드 단위 종료)

```json
{
  "type": "run_finished",
  "node_id": "PC-01", "run_id": "uuid", "timestamp": 1760000999999,
  "summary": { "succeeded": 95, "failed": 5, "timeout": 2 }
}
```

---

## 재전송/내구성

| 항목 | 규칙 |
|------|------|
| 저장 | 로컬 디스크 큐 (append-only log) → 전송 성공 시 ack |
| 멱등 | Backend: event_id 기준 중복 수신 시 200 OK, DB 반영 1회 |
| 재시도 | 1s → 2s → 5s → 10s → 30s (최대 5~7회) |
| 실패 시 | degraded 상태 표시, 실행 계속, 이벤트 로컬 보관 |
| Watchdog | heartbeat 30초 이상 없으면 노드 offline 처리 |

---

## 스케줄 규칙

- 디바이스마다 전용 FIFO 큐
- 같은 디바이스 동시 실행 금지
- 노드 전체 동시 20 슬롯
- 슬롯 빈 즉시 다음 작업 시작 (round-robin)