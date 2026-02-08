# 오케스트레이션 규칙 (Canonical — CRITICAL)

> **tags**: `orchestration`, `node-agent`, `scheduler`, `fifo`, `concurrency`, `device`, `workflow`, `callback`, `storage`, `logging`, `offline`, `grace`
> **sources**: DoAi-Me-MVP-Orchestration-Rules-v1, Execution-Rules-Offline-Grace
> **status**: canonical — 실행 아키텍처는 이 문서를 반드시 따른다

---

## 0. Workflow 모델 (Prometheus)

- **디바이스 1대 = 1 Workflow** 한 번에 실행. 큐 작업 분할 금지.
- Workflow = 단일 연결 프로세스 per device (preflight → bootstrap → login → screenshot → upload → report)
- `workflows` 테이블에 버전 관리된 JSON 레시피 저장; Run 생성 시 `workflow_id` 참조
- 상세 DSL: [../spec/workflow-dsl.md](../spec/workflow-dsl.md)

---

## 1. Node Agent (TypeScript)

| 항목 | 값 |
|------|-----|
| 노드당 디바이스 | ~100대 |
| 동시 실행 | 20대 (MAX_CONCURRENCY_PER_NODE=20) |
| 큐 | 디바이스 전용 FIFO, 동일 디바이스 동시 작업 금지 |
| 스케줄러 | round-robin, 슬롯 빈 즉시 다음 디바이스 |
| Vendor WS | `ws://127.0.0.1:22222` 로컬 연결 |
| Timeout 기본 | 90s task, 30s upload |
| Fail-soft | 단일 디바이스 실패 시 run 중단 없음 |
| Callback | status/task updates + artifacts push; 실패 시 buffering/retry |

---

## 2. 3중 문지기 (Preflight)

| 순서 | 계층 | 시점 | 실패 시 |
|------|------|------|--------|
| 1 | Emulator Health Gate | 워크플로우 직전 | 자동 기동/재기동 시도 → 실패 시 skip |
| 2 | Device Preflight | 매 run 직전 (10~20s) | failure_reason 기록 후 종료 |
| 3 | Node Preflight | 주기/부팅 시 | heartbeat에 vendor_ws_ok 반영 |

상세: [../spec/workflow-dsl.md](../spec/workflow-dsl.md) §3

---

## 3. Backend

- Run 생성: `POST /api/runs` → `run_id` + `workflow_id`
- Node에 알림: MVP는 polling (`/api/nodes/pull`)
- Callback 수신: [../spec/callback-contract.md](../spec/callback-contract.md)
- **Frontend에서 직접 실행 금지** (No ALL execution from frontend)

---

## 4. 인증

| 주체 | 방식 |
|------|------|
| Node → Backend | `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>` 또는 `X-Node-Auth` |
| Frontend | service_role 키 절대 사용 금지 |

---

## 5. Storage 경로

```
{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png
```

예: `dQw4w9WgXcQ/PC-01/ABC123/run-uuid/1739012345.png`

---

## 6. 디바이스 식별

| 식별자 | 용도 |
|--------|------|
| `device_id` = onlySerial | DB/큐 키 (불변) |
| `runtime_handle` = serial | 벤더/ADB 실행 대상 |

---

## 7. 로깅 규칙

모든 로그에 반드시 포함 (해당 시):
- `run_id`
- `node_id`
- `device_id` (device_serial)

예: `[run_id=xxx node_id=PC-01 device_id=ABC123] Task started`

---

## 8. Offline 스킵 / 무응답 처리

| 상태 | 정의 | 실행 시 |
|------|------|---------|
| Online | `last_seen` ≤ 30초 이내 | 실행 대상 |
| Offline | 그 외 전부 | 큐에서 제외, `skipped_offline` 기록 |

- UI: Online/Offline 2값만 표기. 세부 원인은 `last_error_message`로만 표시.
- Online인데 무응답/에러 → `grace_wait_ms`(기본 15초) 대기 → 미회복 시 실패 처리 후 다음 디바이스 진행
- Run Monitor: SKIPPED(offline) / WAIT 15s 배지 → Error 테두리

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| online_window_sec | 30 | last_seen 이내면 Online |
| device_grace_wait_ms | 15000 | 무응답 시 대기 후 실패 처리 |

---

## 9. 컴포넌트 책임

| 컴포넌트 | 책임 |
|----------|------|
| Frontend | UI only; 실행 금지 |
| Backend | run_id 생성, 노드 브로드캐스트, 상태 집계 |
| Node Agent | vendor WS, FIFO 큐, device lock, timeout, fail-soft |
| Supabase | Storage 경로 관리, DB 스키마 |

---

## 관련 문서

- API: [../spec/api-contracts.md](../spec/api-contracts.md)
- Workflow DSL: [../spec/workflow-dsl.md](../spec/workflow-dsl.md)
- Callback: [../spec/callback-contract.md](../spec/callback-contract.md)
- Vendor: [../spec/vendor-adapter.md](../spec/vendor-adapter.md)
- 배포: [../guide/deploy.md](../guide/deploy.md)
- 환경설정: [../guide/setup.md](../guide/setup.md)