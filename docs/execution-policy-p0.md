# P0 실행 엔진 정책 (멈추지 않게)

| 정책 | 값 | 설명 |
|------|-----|------|
| **Offline 처리** | 제외 | 실행 대상에서 제외. `skipped_offline`으로 기록 가능. |
| **무응답/에러 시** | grace wait 15s 후 다음 디바이스 | 한 디바이스에서 응답 없음/에러 시 15초 대기 후 다음으로 진행. |
| **동시성** | 1 (순차) | 디바이스당 동시 실행 1. 순차 진행. |
| **online 판정** | last_seen 30s 이내 | UI Online/Offline은 last_seen 기준 30초. |

## 적용 위치

- **Node Agent**: 디바이스 선택 시 online만 대상; 타임아웃/에러 시 15초 대기 후 다음 디바이스; 동시 실행은 `NODE_MAX_CONCURRENCY`(P0 권장 1). `config.graceWaitMs` = 15_000.
- **API**: POST /api/runs 시 target.scope, target.device_indexes; 기본 정책 상수(30s, 15s, 1) 문서화.
