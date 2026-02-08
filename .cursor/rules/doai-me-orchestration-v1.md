# DoAi.Me MVP 오케스트레이션 규칙

> **CRITICAL**: 모든 구현은 이 규칙과 canonical 문서를 따른다.
> **Canonical**: `docs/arch/orchestration.md`
> **문서 인덱스**: `docs/INDEX.md`

---

## 핵심 참조

| 영역 | 문서 |
|------|------|
| 오케스트레이션 전체 | `docs/arch/orchestration.md` |
| API 계약 | `docs/spec/api-contracts.md` |
| 워크플로우 DSL | `docs/spec/workflow-dsl.md` |
| 콜백 계약 | `docs/spec/callback-contract.md` |
| 벤더 어댑터 | `docs/spec/vendor-adapter.md` |
| 명령 라이브러리 | `docs/spec/command-library.md` |
| Playbook 스펙 | `docs/spec/playbook-spec.md` |
| FRD | `docs/arch/frd.md` |

---

## 요약 (상세 → canonical 문서 참조)

### Node + Scheduler
- ~100 devices/node; 동시 20; 디바이스별 FIFO; round-robin
- Callback: 6종 이벤트 push; disk queue + retry; event_id 멱등

### Workflow (Prometheus)
- 디바이스 1대 = 1 Workflow 연속 실행; 분할 큐 금지
- 3중 문지기: Emulator Health Gate → Device Preflight → Workflow Steps
- Node Preflight: 주기/부팅 시 별도 (vendor WS + list)

### 디바이스 식별
- `device_id` = onlySerial (DB키, 불변)
- `runtime_handle` = serial (벤더/ADB 대상)

### 인증
- Node → Backend: `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`
- Frontend: service_role 키 사용 금지

### Storage
```
{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png
```

### 로깅
모든 로그에 `run_id`, `node_id`, `device_id` 포함 (해당 시)
