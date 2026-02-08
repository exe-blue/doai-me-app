# Workflow Recipe DSL v1 — Work Plan

> **Scope**: Implement Workflow Recipe DSL v1 (no UI redesign). Refer to `docs/Workflow-Recipe-DSL-v1-QA.md`, `docs/API-Contracts-v1.md`, `docs/Prometheus-Workflow-DSL-v1.md`.

---

## 1. Requirements Summary

### Key Constraints

| Constraint | Detail |
|------------|--------|
| Per node | Global concurrency 20 (MAX_CONCURRENCY_PER_NODE=20) |
| Per device | Dedicated FIFO queue + device lock (device_id=onlySerial) |
| Workflow | One connected process per device: Preflight → Bootstrap → LoginFlow → Vendor Screenshot → Upload → Callback. Never split into separate queued jobs |
| Preflight | Detect adb unauthorized → `failure_reason=needs_usb_authorization` quickly (10~20s) |
| Device identity | `device_id=onlySerial` (queue/DB key), `runtime_handle=serial` (vendor/ADB target) |
| Screenshot | Vendor `action=screen` + savePath on node → upload to Supabase Storage with path `{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png` |
| Timeouts | Overrideable from frontend per step key; enforce min (5s) / max (10m) bounds |
| Callback | Node pushes events; idempotency via `event_id`; disk-backed retry queue |

### References

- `docs/Workflow-Recipe-DSL-v1-QA.md` — 확정 Q&A
- `docs/API-Contracts-v1.md` — API contracts + Next.js path mapping
- `docs/Prometheus-Workflow-DSL-v1.md` — DSL spec
- `docs/Callback-Contract-v1.md` — Callback event types

---

## 2. Acceptance Criteria

- [x] **Supabase**: Schema updated (failure_reason, error_message, device_id, runtime_handle, runs columns); workflows seed (bootstrap_only_v1, login_settings_screenshot_v1)
- [x] **Backend**: POST /api/runs accepts workflow_id, timeoutOverrides; GET /api/runs/[run_id]; GET /api/workflows; GET /api/nodes; POST /api/nodes/callback with event_id idempotency
- [x] **Node Agent**: DSL runner (Preflight, Bootstrap, LoginFlow, Screenshot, Upload, Callback); device_id vs runtime_handle; CallbackBuffer with event_id + disk-backed retry
- [x] **Frontend**: Run create form: workflow dropdown (optional default), timeout_overrides as advanced option
- [x] **Docs**: Minimal Vendor Adapter Contract (list, screen)

---

## 3. Implementation Steps

### Phase A: Supabase Schema & Seed

| Step | File(s) | Action |
|------|---------|--------|
| A1 | `supabase/migrations/YYYYMMDD_workflow_dsl_v1_schema.sql` | New migration: add `device_tasks.failure_reason`, `device_tasks.error_message`, `device_tasks.device_id` (alias/sync with device_serial), `device_tasks.runtime_handle`, `device_tasks.node_id`; add `runs.trigger`, `runs.scope`, `runs.youtube_video_id` (nullable), `runs.timeout_overrides` (jsonb); add `artifacts.public_url` if missing; update runs status check to include `queued`, `completed_with_errors` |
| A2 | `supabase/migrations/YYYYMMDD_workflow_seed.sql` or `supabase/seed.sql` | Seed workflows: `bootstrap_only_v1`, `login_settings_screenshot_v1` with definition_json (DSL steps per Prometheus spec) |

**Schema details (device_tasks)**:
- `failure_reason` text nullable: `needs_usb_authorization`, `adb_offline`, `adb_missing`, `vendor_ws_error`, `vendor_command_error`, `bootstrap_critical_failed`, `login_flow_timeout`, `screenshot_error`, `upload_error`, `callback_error`, `unknown`
- `error_message` text nullable
- `device_id` = onlySerial (can keep device_serial for compat; API uses device_id)
- `runtime_handle` text nullable (vendor serial)

### Phase B: Backend API

| Step | File(s) | Action |
|------|---------|--------|
| B1 | `app/api/runs/route.ts` | Extend POST: accept `workflow_id`, `timeoutOverrides`, `target.node_ids`, `trigger`, `scope`, `youtubeVideoId`; upsert video by youtubeVideoId; insert run with workflow_id (lookup by workflow_id text), timeout_overrides, global_timeout_ms; enforce timeout bounds (step 5s~600s, global 60s~1800s) |
| B2 | `app/api/runs/[run_id]/route.ts` | New: GET run summary (run + nodes aggregation + totals) per API-Contracts-v1 |
| B3 | `app/api/workflows/route.ts` | New: GET list workflows |
| B4 | `app/api/nodes/route.ts` | New: GET node status (aggregate from heartbeats/tasks); or consolidate with existing `app/api/nodes/status/route.ts` and expose as GET /api/nodes |
| B5 | `app/api/nodes/callback/route.ts` | New: POST callback with envelope `{ event_id, type, payload }`; verify X-Node-Auth / Authorization Bearer; idempotency by event_id (dedup table or in-memory short TTL); route by type → update device_tasks, runs, artifacts, node_heartbeat table |
| B6 | `app/api/nodes/pending-runs/route.ts` | Extend: return run_start payload for nodes (MVP polling fallback for run_start) |

**Idempotency**: Create `callback_events` table with `event_id` primary key; insert or ignore; use for dedup.

### Phase C: Node Agent

| Step | File(s) | Action |
|------|---------|--------|
| C1 | `docs/Minimal-Vendor-Adapter-Contract.md` | New doc: action=list, action=screen (savePath), optional autojsCreate |
| C2 | `node-agent/src/queue.ts` | Extend WorkflowPayload: ensure `workflow_id`, `timeout_overrides`, `global_timeout_ms`, `youtube_video_id` |
| C3 | `node-agent/src/vendorAdapter.ts` | New: minimal adapter for vendor WS (list → devices with serial; screen(savePath) → screenshot) |
| C4 | `node-agent/src/preflight.ts` | New: Device Preflight (adb devices → check unauthorized/offline/missing); Node Preflight (vendor WS + list success) |
| C5 | `node-agent/src/workflowRunner.ts` | New: DSL step runner; load workflow from Supabase by workflow_id; execute steps in order (Preflight, Bootstrap, LoginFlow, Screenshot, Upload); apply timeout_overrides with bounds; call CallbackBuffer for task_started, task_progress, task_finished |
| C6 | `node-agent/src/index.ts` | Wire: fetch pending runs (poll /api/nodes/pending-runs); for each device from vendor list, map serial→device_id (onlySerial); enqueue WorkflowPayload per device; executeWorkflow → workflowRunner.run(payload, device_id, runtime_handle) |
| C7 | `node-agent/src/callbackBuffer.ts` | Extend: add event_id to payload; disk-backed queue (append-only log file); retry 1s→2s→5s→10s→30s (max 5~7); POST to /api/nodes/callback |
| C8 | `node-agent/src/storage.ts` | Ensure path: `{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png` (use device_id not device_serial) |

**Device identity**: When iterating vendor list, use `serial` as runtime_handle; use `serial` as device_id for MVP (onlySerial = serial when no normalization). Document: device_id=onlySerial, runtime_handle=serial.

### Phase D: Frontend (Minimal)

| Step | File(s) | Action |
|------|---------|--------|
| D1 | `app/dashboard/runs/page.tsx` | Add workflow dropdown (fetch GET /api/workflows); default to login_settings_screenshot_v1; add optional "Advanced" section with timeout_overrides (PREFLIGHT, BOOTSTRAP, LOGIN_FLOW, SCREENSHOT, UPLOAD); POST /api/runs with workflow_id, timeoutOverrides, globalTimeoutMs |

### Phase E: Docs & Verification

| Step | File(s) | Action |
|------|---------|--------|
| E1 | `docs/Minimal-Vendor-Adapter-Contract.md` | Document: list, screen (savePath) |
| E2 | `.cursor/rules/doai-me-orchestration-v1.md` | Update: link Workflow-Recipe-DSL-v1-QA, API-Contracts-v1, Minimal Vendor Adapter |

---

## 4. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Runs.video_id required but API may send youtubeVideoId only | Upsert videos by youtube_video_id; create run with video_id from upsert |
| workflow_id string vs workflows.id uuid | Lookup workflow by workflow_id text; use workflows.id for FK in runs |
| Vercel serverless no WS | MVP: polling /api/nodes/pending-runs; document WS as future |
| Callback disk queue path | Use node-agent local dir (e.g. ./data/callback-queue.jsonl); ensure dir exists |
| device_serial vs device_id | API Contracts use device_id; DB can keep device_serial + add device_id; node sends device_id=onlySerial |

---

## 5. Verification Steps

1. `supabase db push` or `supabase migration up` — schema + seed apply
2. `npm run build` — Next.js build OK
3. `cd node-agent && npm run build` — Node Agent build OK
4. POST /api/runs with workflow_id, timeoutOverrides → 201
5. GET /api/workflows → workflows list
6. GET /api/runs/{run_id} → run summary
7. POST /api/nodes/callback with event_id, type, payload (node auth) → 200; duplicate event_id → 200 (idempotent)
8. Node Agent: poll pending-runs → enqueue → execute workflow steps → callback task_finished

---

## 6. File Checklist

| Path | Status |
|------|--------|
| `supabase/migrations/*_workflow_dsl_v1_schema.sql` | New |
| `supabase/migrations/*_workflow_seed.sql` or `supabase/seed.sql` | New |
| `app/api/runs/route.ts` | Modify |
| `app/api/runs/[run_id]/route.ts` | New |
| `app/api/workflows/route.ts` | New |
| `app/api/nodes/route.ts` or merge with status | New/Modify |
| `app/api/nodes/callback/route.ts` | New |
| `app/api/nodes/pending-runs/route.ts` | Modify |
| `node-agent/src/vendorAdapter.ts` | New |
| `node-agent/src/preflight.ts` | New |
| `node-agent/src/workflowRunner.ts` | New |
| `node-agent/src/index.ts` | Modify |
| `node-agent/src/callbackBuffer.ts` | Modify |
| `node-agent/src/queue.ts` | Modify |
| `node-agent/src/storage.ts` | Modify |
| `app/dashboard/runs/page.tsx` | Modify |
| `docs/Minimal-Vendor-Adapter-Contract.md` | New |

---

## 7. Execution Order

1. Phase A (Schema + Seed)
2. Phase B (Backend API)
3. Phase C (Node Agent) — can parallelize C1–C4 with B
4. Phase D (Frontend)
5. Phase E (Docs)
