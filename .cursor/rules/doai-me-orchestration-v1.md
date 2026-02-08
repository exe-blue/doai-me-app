# DoAi.Me MVP 오케스트레이션 규칙 v1

> **CRITICAL**: Follow strictly. See docs/DoAi-Me-MVP-Orchestration-Rules-v1.md for full spec.

## References (Workflow Recipe DSL v1)
- **Q&A / 결정사항**: docs/Workflow-Recipe-DSL-v1-QA.md
- **API 계약**: docs/API-Contracts-v1.md
- **DSL 명세**: docs/Prometheus-Workflow-DSL-v1.md
- **Minimal Vendor Adapter**: docs/Minimal-Vendor-Adapter-Contract.md
- **Callback**: docs/Callback-Contract-v1.md

## Node + Scheduler
- ~100 devices per node; 20 concurrent
- Device-dedicated FIFO queue per device; never concurrent on same device
- Global scheduler: 20 slots; round-robin; slot 19→20 즉시 시작
- Callback model: node pushes 6 event types; disk queue + retry (1s→2s→5s→10s→30s, max 5~7회); Backend 멱등성 (event_id)

## Workflow (Prometheus)
- 디바이스 1대 = 1 Workflow 연속 실행; 작업 따로 큐에 넣기 금지
- workflows 테이블: definition_json (DSL); runs.workflow_id 참조; frontend timeout overrides
- ADB bootstrap recipe: locale/resolution/density/animations/stay-awake; accessibility manual fallback
- Preflight: device (adb unauthorized → needs_usb_authorization); node (vendor WS + list)

## Node Agent (TS)
- Vendor WS locally; MAX_CONCURRENCY_PER_NODE=20; FIFO queue; device-level lock
- device_id=onlySerial; runtime_handle=serial (Minimal Vendor Adapter)
- Timeouts: 90s task, 30s upload; fail-soft; step bounds 5s~10m

## Backend
- POST /api/runs (workflow_id, timeoutOverrides); GET /api/runs/[run_id]; GET /api/workflows; GET /api/nodes; POST /api/nodes/callback (event_id idempotency)
- MVP: nodes poll /api/nodes/pending-runs (WS control channel 추후)
- Shared secret auth: Authorization Bearer or X-Node-Auth

## Storage path
`{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png`

## Logging
Every log MUST include run_id, node_id, device_serial/device_id when applicable.
