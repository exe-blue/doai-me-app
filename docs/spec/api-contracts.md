# API 계약서 (Canonical)

> **tags**: `api`, `rest`, `runs`, `workflows`, `nodes`, `callback`, `devices`, `library`, `playbooks`, `scan`
> **sources**: API-Contracts-v1, API-Schema-FRD-v1
> **status**: canonical — 모든 API 구현은 이 문서를 기준으로 한다

---

## 0. Conventions

| 항목 | 값 |
|------|-----|
| Base URL | `https://doai.me/api/*` |
| Node Auth | `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>` |
| Idempotency | 콜백 `event_id` 기반 멱등 처리 |
| Frontend | service_role 키 사용 금지; 모든 쓰기는 Backend API 경유 |

**ID 규약**

| ID | 설명 |
|----|------|
| `node_id` | `PC-01` ~ `PC-04` 등 |
| `device_id` | onlySerial (불변) |
| `runtime_handle` | vendor list serial (USB=시리얼, WiFi=ip:5555) |
| `run_id` | UUID |

---

## 1. Runs

### POST /api/runs — 의식 실행 생성

```json
{
  "trigger": "youtube|manual",
  "scope": "ALL",
  "youtubeVideoId": "string|null",
  "workflow_id": "login_settings_screenshot_v1",
  "playbook_id": null,
  "params": { "QUERY": "sleep music" },
  "timeoutOverrides": {
    "PREFLIGHT": 20000,
    "BOOTSTRAP": 120000,
    "LOGIN_FLOW": 180000,
    "SCREENSHOT": 30000,
    "UPLOAD": 60000
  },
  "globalTimeoutMs": 600000,
  "target": { "node_ids": ["PC-01","PC-02","PC-03","PC-04"] },
  "metadata": { "note": "optional" }
}
```

**규칙**
- `workflow_id` 또는 `playbook_id` 중 하나 필수
- `params`: Node에서 `{{KEY}}` 치환용
- timeout bounds: step 5s~10m, global 1m~30m
- target.node_ids 미지정 시 전체 노드 브로드캐스트

**Response** `201`
```json
{ "run_id": "uuid", "status": "queued", "created_at": 1760000000000 }
```

### GET /api/runs/{runId} — 실행 상세

**Response** `200`
```json
{
  "run_id": "uuid",
  "trigger": "youtube|manual",
  "scope": "ALL",
  "workflow_id": "...",
  "playbook_id": "uuid|null",
  "params": {},
  "status": "queued|running|completed|completed_with_errors|failed",
  "timeout_overrides": {},
  "global_timeout_ms": 600000,
  "created_at": "...", "started_at": "...", "ended_at": "...",
  "nodes": [
    { "node_id": "PC-01", "status": "running", "summary": { "succeeded": 95, "failed": 5, "timeout": 2 } }
  ],
  "totals": { "succeeded": 380, "failed": 20, "timeout": 6 },
  "device_tasks": [
    { "id": "uuid", "device_id": "...", "status": "...", "failure_reason": "...", "error_message": "..." }
  ]
}
```

### GET /api/runs/{runId}/steps — 스텝별 결과 (Run Monitor)

**Response** `200`
```json
{
  "run_id": "uuid",
  "steps": [
    {
      "step_id": "...", "sort_order": 0,
      "device_results": [
        { "device_task_id": "uuid", "device_id": "...", "status": "pending|skipped|running|completed|failed",
          "started_at": "...", "finished_at": "...", "log_snippet": "...", "artifact_id": "uuid|null", "error_message": "..." }
      ]
    }
  ]
}
```

### POST /api/runs/{runId}/stop — 실행 중지

**Response** `200`: `{ "ok": true, "run_id": "uuid", "status": "running" }`

---

## 2. Workflows

### GET /api/workflows — 워크플로우 목록

**Response** `200`
```json
{
  "workflows": [
    { "workflow_id": "bootstrap_only_v1", "version": 1, "name": "Bootstrap Only" },
    { "workflow_id": "login_settings_screenshot_v1", "version": 1, "name": "Login → Settings → Screenshot" }
  ]
}
```

---

## 3. Nodes

### GET /api/nodes — 노드 상태

**Response** `200`
```json
{
  "nodes": [
    {
      "node_id": "PC-01", "status": "online|offline|degraded",
      "last_heartbeat_at": 1760000000000,
      "connected_devices_count": 100, "running_devices_count": 20,
      "queue_devices_count": 80, "vendor_ws_ok": true
    }
  ]
}
```

### GET /api/nodes/pull — Node가 pending run_start 수신

- Auth: Bearer NODE_AGENT_SHARED_SECRET
- Query: `node_id`
- Hybrid: pull=run_start, callback=status
- 하위호환: `/api/nodes/pending-runs`도 동일 payload

### POST /api/nodes/callback — 콜백 수신

상세: [callback-contract.md](callback-contract.md)

### POST /api/nodes/scan — IP 대역 스캔

**Request**: `{ "ip_range": "192.168.0.0/24", "ports": [5555, 5556] }`
**Response** `202`: `{ "scan_job_id": "uuid", "status": "pending" }`

---

## 4. Devices

### GET /api/devices — 기기 목록 (Status Dashboard)

**Query**: `node_id`, `online_only` (last_seen_at 임계 이내)

**Response** `200`
```json
{
  "devices": [
    { "id": "uuid", "device_id": "...", "node_id": "...", "last_seen_at": "...", "last_error_message": "...", "online": true }
  ]
}
```

---

## 5. Command Library

### POST /api/library/upload — 스크립트 업로드

**Request**: `multipart/form-data` — file, title, folder, asset_type(`adb_script|js|json|text|vendor_action`), description, default_timeout_ms

**Response** `201`
```json
{ "id": "uuid", "title": "...", "folder": "...", "asset_type": "adb_script", "storage_path": "...", "default_timeout_ms": 30000, "created_at": "..." }
```

### GET /api/library/list — 스크립트 목록

**Query**: `type`, `folder`, `q`

---

## 6. Playbooks

### POST /api/playbooks — 플레이북 생성

**Request**
```json
{
  "name": "My Playbook", "description": "optional",
  "steps": [
    { "command_asset_id": "uuid", "sort_order": 0, "timeout_ms": 30000, "on_failure": "stop", "retry_count": 0, "probability": 1.0, "params": {} }
  ]
}
```

### GET /api/playbooks/{id} — 플레이북 상세

### PATCH /api/playbooks/{id} — 플레이북 수정

---

## 7. Next.js App Router 매핑

| Method | Path | File |
|--------|------|------|
| POST | /api/runs | `app/api/runs/route.ts` |
| GET | /api/runs/{runId} | `app/api/runs/[runId]/route.ts` |
| GET | /api/runs/{runId}/steps | `app/api/runs/[runId]/steps/route.ts` |
| POST | /api/runs/{runId}/stop | `app/api/runs/[runId]/stop/route.ts` |
| GET | /api/workflows | `app/api/workflows/route.ts` |
| GET | /api/nodes | `app/api/nodes/route.ts` |
| GET | /api/nodes/pull | `app/api/nodes/pull/route.ts` |
| POST | /api/nodes/callback | `app/api/nodes/callback/route.ts` |
| POST | /api/nodes/scan | `app/api/nodes/scan/route.ts` |
| GET | /api/devices | `app/api/devices/route.ts` |
| POST | /api/library/upload | `app/api/library/upload/route.ts` |
| GET | /api/library/list | `app/api/library/list/route.ts` |
| POST | /api/playbooks | `app/api/playbooks/route.ts` |
| GET/PATCH | /api/playbooks/{id} | `app/api/playbooks/[id]/route.ts` |

**WS Control Channel**: Vercel serverless는 WS 미지원. MVP는 polling(`/api/nodes/pull`). 추후 별도 WS 서버로 이전 가능.

---

## 8. 인증

| 주체 | 방식 |
|------|------|
| Node → Backend | `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>` 또는 `X-Node-Auth` |
| Frontend → Backend | MVP 최소 인증 (세션/쿠키); service_role 금지 |

---

## 9. DB 테이블 요약

| 테이블 | 핵심 필드 |
|--------|-----------|
| workflows | workflow_id (pk), version, name, definition_json |
| runs | run_id (pk), trigger, scope, workflow_id, playbook_id, params, timeout_overrides, status |
| device_tasks | task_id (pk), run_id (fk), node_id, device_id, runtime_handle, status, failure_reason, error_message |
| artifacts | artifact_id (pk), run_id (fk), node_id, device_id, storage_path, public_url |
| command_assets | id (pk), kind, title, storage_path, inline_content, folder, tags |
| playbooks | id (pk), name, steps[] |
| playbook_steps | id (pk), playbook_id (fk), command_asset_id, sort_order, probability |
| videos | youtube_video_id (unique) |
| node_heartbeats | node_id, payload, timestamp |
| callback_events | event_id (pk) — 멱등성 |
| scan_jobs | id, ip_range, status |
