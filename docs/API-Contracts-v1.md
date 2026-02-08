# API Contracts v1 (DoAi.Me MVP)

> 콜백 모델 + 노드 컨트롤 채널(노드→서버 WS 유지) + 디바이스별 큐/노드당 20 동시성 + 워크플로우/타임아웃 오버라이드 반영.

---

## 0) Conventions

### Base URL

- Backend: `https://doai.me`
- All endpoints are under: `/api/*`

### Auth

- **Node → Backend**: Header `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`
- **Frontend → Backend**: User auth는 MVP에서 단순화 가능(추후). 단, service role key는 프론트 금지.

### Idempotency

- Node 콜백 이벤트는 `event_id`로 멱등 처리.
- Backend는 event_id 중복 수신 시 200 OK로 처리하되, DB 반영은 1회만.

### IDs

| ID | 설명 |
|----|------|
| `node_id` | "PC-01" \| "PC-02" \| "PC-03" \| "PC-04" \| ... |
| `device_id` | onlySerial (불변) |
| `runtime_handle` | vendor list의 serial (USB면 기기시리얼, WiFi면 ip:5555) |
| `run_id` | UUID |

---

## 1) Frontend → Backend

### 1.1 Create Run

**POST /api/runs**

**Request**

```json
{
  "trigger": "youtube|manual",
  "scope": "ALL",
  "youtubeVideoId": "string|null",
  "workflow_id": "login_settings_screenshot_v1",
  "timeoutOverrides": {
    "PREFLIGHT": 20000,
    "BOOTSTRAP": 120000,
    "LOGIN_FLOW": 180000,
    "SCREENSHOT": 30000,
    "UPLOAD": 60000
  },
  "target": {
    "node_ids": ["PC-01","PC-02","PC-03","PC-04"]
  },
  "metadata": {
    "note": "optional"
  }
}
```

**Rules**

- scope MVP는 "ALL"만 사용.
- timeoutOverrides는 선택. 미지정 시 workflow defaults 사용.
- Backend는 timeout bounds 강제: step timeout 5s~10m, global 1m~30m
- target.node_ids 미지정 시 "등록된 전체 노드"로 브로드캐스트 가능.

**Response (201)**

```json
{
  "run_id": "uuid",
  "status": "queued",
  "created_at": 1760000000000
}
```

---

### 1.2 Get Run Summary

**GET /api/runs/{runId}**

**Response (200)**

```json
{
  "run_id": "uuid",
  "trigger": "youtube|manual",
  "scope": "ALL",
  "workflow_id": "login_settings_screenshot_v1",
  "status": "queued|running|completed|completed_with_errors",
  "created_at": 1760000000000,
  "started_at": 1760000001000,
  "ended_at": 1760000100000,
  "nodes": [
    {
      "node_id": "PC-01",
      "status": "running|completed|offline",
      "summary": { "succeeded": 95, "failed": 5, "timeout": 2 }
    }
  ],
  "totals": { "succeeded": 380, "failed": 20, "timeout": 6 }
}
```

---

### 1.3 List Workflows

**GET /api/workflows**

**Response (200)**

```json
{
  "workflows": [
    { "workflow_id": "bootstrap_only_v1", "version": 1, "name": "Bootstrap Only" },
    { "workflow_id": "login_settings_screenshot_v1", "version": 1, "name": "Login → Settings → Screenshot" }
  ]
}
```

---

### 1.4 Node Status (for dashboard)

**GET /api/nodes**

**Response (200)**

```json
{
  "nodes": [
    {
      "node_id": "PC-01",
      "status": "online|offline|degraded",
      "last_heartbeat_at": 1760000000000,
      "connected_devices_count": 100,
      "running_devices_count": 20,
      "queue_devices_count": 80,
      "vendor_ws_ok": true
    }
  ]
}
```

---

## 2) Node ↔ Backend Control Channel

### 2.1 Node Connect (WebSocket)

**WS /api/nodes/control?node_id=PC-01**

**Auth**: Header `Authorization: Bearer ...` (preferred) or query `?token=...` if header isn't available.

**Backend → Node Events**

**run_start**

```json
{
  "type": "run_start",
  "run_id": "uuid",
  "trigger": "youtube|manual",
  "scope": "ALL",
  "youtubeVideoId": "string|null",
  "workflow_id": "login_settings_screenshot_v1",
  "timeoutOverrides": {
    "PREFLIGHT": 20000,
    "BOOTSTRAP": 120000,
    "LOGIN_FLOW": 180000,
    "SCREENSHOT": 30000,
    "UPLOAD": 60000
  }
}
```

**run_cancel (optional MVP)**

```json
{
  "type": "run_cancel",
  "run_id": "uuid"
}
```

**Node → Backend Events (optional over WS)**

- node_hello (node metadata)
- MVP에서는 콜백 HTTP로 보내고 WS는 control만 써도 됨

---

## 3) Node → Backend Callback (Single Endpoint)

### 3.1 Callback Endpoint

**POST /api/nodes/callback**

**Auth**: `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`

**Request Envelope**

```json
{
  "event_id": "string",
  "type": "node_heartbeat|run_started|task_started|task_progress|task_finished|run_finished",
  "payload": {}
}
```

**Response (200)**

```json
{ "ok": true }
```

---

### 3.2 Event Payload Schemas

#### node_heartbeat

```json
{
  "node_id": "PC-01",
  "timestamp": 1760000000000,
  "connected_devices_count": 100,
  "running_devices_count": 20,
  "queue_devices_count": 80,
  "vendor_ws_ok": true,
  "last_vendor_ws_ok_at": 1760000000000
}
```

#### run_started

```json
{
  "node_id": "PC-01",
  "run_id": "uuid",
  "timestamp": 1760000000000,
  "target_devices_count": 100,
  "max_concurrency": 20
}
```

#### task_started

```json
{
  "node_id": "PC-01",
  "run_id": "uuid",
  "task_id": "string",
  "device_id": "onlySerial",
  "runtime_handle": "serial",
  "workflow_id": "login_settings_screenshot_v1",
  "timeoutMs": 180000,
  "timestamp": 1760000000000
}
```

#### task_progress (optional)

```json
{
  "node_id": "PC-01",
  "run_id": "uuid",
  "task_id": "string",
  "device_id": "onlySerial",
  "step": "PREFLIGHT|BOOTSTRAP|LOGIN_FLOW|SCREENSHOT|UPLOAD",
  "status": "running|done",
  "timestamp": 1760000000000
}
```

#### task_finished

```json
{
  "node_id": "PC-01",
  "run_id": "uuid",
  "task_id": "string",
  "device_id": "onlySerial",
  "runtime_handle": "serial",
  "status": "succeeded|failed",
  "failure_reason": "needs_usb_authorization|adb_offline|adb_missing|vendor_ws_error|vendor_command_error|bootstrap_critical_failed|login_flow_timeout|screenshot_error|upload_error|callback_error|unknown",
  "timings": {
    "startedAt": 1760000000000,
    "endedAt": 1760000123456
  },
  "artifact": {
    "kind": "screenshot",
    "local_path": "D:\\Pictures\\doai\\...",
    "storage_path": "videos/{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png",
    "public_url": "https://..."
  },
  "error_message": "optional short string",
  "timestamp": 1760000123456
}
```

#### run_finished

```json
{
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

## 4) Backend Data Model Expectations (Supabase)

### 4.1 Tables (minimum)

| Table | Key fields |
|-------|------------|
| **workflows** | workflow_id (pk), version (int), name, definition_json (jsonb), created_at |
| **runs** | run_id (pk), trigger, scope, workflow_id, youtubeVideoId (nullable), status, timestamps |
| **device_tasks** | task_id (pk), run_id (fk), node_id, device_id (=onlySerial), runtime_handle, status, **failure_reason (nullable)**, **error_message (nullable)**, timestamps |
| **artifacts** | artifact_id (pk), run_id (fk), node_id, device_id, storage_path, public_url, timestamps |

### 4.2 Status rules

- Run status is aggregated from tasks:
  - all succeeded → `completed`
  - any failed/timeout → `completed_with_errors`

---

## 5) Node Execution Rules (must align)

- Device identity: `device_id = onlySerial`, `runtime_handle = serial`
- Node concurrency: `MAX_CONCURRENCY_PER_NODE = 20`
- Per-device FIFO queue and device lock
- Workflow is one connected process per device (no re-queuing between steps)
- Timeouts are per-step keys with frontend override

---

## 6) Suggested Seed Workflows

1. `bootstrap_only_v1`
2. `login_settings_screenshot_v1`

---

## 7) Repo-specific: Next.js App Router Mapping

> 백엔드는 **Next.js `/app/api/*`** 사용. Vercel serverless 배포 기준.

### HTTP Endpoints → File Paths

| Method | Path | File |
|--------|------|------|
| POST | /api/runs | `app/api/runs/route.ts` |
| GET | /api/runs/{runId} | `app/api/runs/[runId]/route.ts` |
| GET | /api/workflows | `app/api/workflows/route.ts` |
| GET | /api/nodes | `app/api/nodes/route.ts` |
| GET | /api/nodes/pull | `app/api/nodes/pull/route.ts` (node pulls pending run_start) |
| POST | /api/nodes/callback | `app/api/nodes/callback/route.ts` |

### 기존 경로 vs API Contracts v1

| 기존 | API Contracts v1 | 비고 |
|------|------------------|------|
| POST /api/nodes/tasks | POST /api/nodes/callback | callback으로 통합 |
| GET /api/nodes/status | GET /api/nodes | 노드 상태 통합 |
| GET /api/nodes/pull | 노드가 pending run_start 수신 (hybrid: pull=run_start, callback=status) | 권장 |
| GET /api/nodes/pending-runs | (레거시) pull과 동일 payload | 하위 호환 |

### WS Control Channel (MVP)

- **Vercel/Next.js serverless는 WS 미지원.**
- **MVP**: 노드가 `GET /api/nodes/pending-runs?node_id=PC-01` 폴링하여 run_start 대체. (기존 구조 유지)
- **추후**: 별도 WS 서버(Railway, Fly.io 등) 또는 Pusher/Ably 등으로 `WS /api/nodes/control` 이전 시 컨트롤 채널 교체.
