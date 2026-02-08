# DoAi.Me MVP 오케스트레이션 규칙 v1

> **CRITICAL**: Follow this document strictly. No ALL execution directly from frontend.

---

## 0. Workflow 모델 (Prometheus)

- **디바이스 1대 = 1 Workflow** 한 번에 실행. **금지**: 한 논리 플로우를 여러 개의 큐 작업으로 분할.
- Workflow = 단일 연결 프로세스 per device (adb bootstrap → login → screenshot → upload → report). 디바이스가 슬롯을 점유하는 동안 실행.
- `workflows` 테이블에 버전 관리된 JSON 레시피 저장; Run 생성 시 `workflow_id` 참조.
- 프론트엔드: per-step timeout override 및 bounds 설정 가능.
- 상세: `docs/Prometheus-Workflow-DSL-v1.md`

---

## 1. Node Agent (TypeScript)

- **노드당 ~100 디바이스**, **동시 실행 20대** (노드당).
- **디바이스 전용 FIFO 큐**: 각 디바이스마다 별도 큐. 동일 디바이스에서 동시 작업 금지.
- **글로벌 스케줄러**:
  - 20 슬롯 즉시 채움.
  - 하나 끝나면 바로 다음 디바이스 시작.
  - eligible device 큐들 간 **round-robin**으로 다음 작업 선택.
- Runs **vendor WS locally** (`ws://127.0.0.1:22222`).
- **Timeouts**: step별, 프론트 override; 90s task / 30s upload 기본.
- **Fail-soft**: 단일 디바이스 실패 시 run 중단 없음; 상태 보고 후 계속.
- **Callback 모델**: node가 status/task updates + artifacts를 backend로 push. callback 실패 시 buffering/retry.

### Path Convention (Storage)

```
{ youtubeVideoId }/{ node_id }/{ device_serial }/{ run_id }/{ timestamp }.png
```

Example: `dQw4w9WgXcQ/node-A1/ABC123/run-uuid/1739012345.png`

---

## 2. Backend

- **Creates `run_id`** — one per job; `workflow_id` 참조.
- **Shared secret auth** — server↔node uses `NODE_AGENT_SHARED_SECRET` (X-Node-Auth).
- **Callback 수신**: node가 status/task updates, artifacts push. buffering/retry는 node 측 담당.
- No ALL execution directly from frontend.

---

## 3. Authentication

- **Server↔Node**: `NODE_AGENT_SHARED_SECRET` — never expose in frontend.
- Node Agent sends secret in request headers when calling Backend APIs.

---

## 4. Logging

Every log **must** include when applicable:

- `run_id`
- `node_id`
- `device_serial`

Example: `[run_id=xxx node_id=node-A1 device_serial=ABC123] Task started`

---

## 5. Summary

| Component      | Responsibility                                              |
|----------------|-------------------------------------------------------------|
| Frontend       | UI only; no run execution                                   |
| Backend        | Creates run_id, broadcasts to nodes, aggregates status      |
| Node Agent     | Connects vendor WS, FIFO queue, device lock, timeouts, fail-soft |
| Supabase       | Storage path: `{youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png` |
