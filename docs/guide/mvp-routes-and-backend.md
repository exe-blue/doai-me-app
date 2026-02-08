# MVP 명칭/라우트·백엔드 고정 규칙

doai.me 웹(컨트롤 플레인) + Windows node-runner.exe(실행 플레인) MVP의 **명칭·URL·백엔드·동기화** 규칙. **기능 확장보다 「웹 Run → 노드 실행 → callback → 웹 반영」 1회 완주가 우선**이며, 삭제/이동 없이 **alias만 추가**해 정합성을 유지한다.

---

## 1) 사용자-facing URL 5개 고정 (필수)

| URL | 용도 |
|-----|------|
| `/` | 랜딩 |
| `/dashboard` | 상태 요약 |
| `/devices` | 온라인/오프라인만 |
| `/commands` | 명령 라이브러리 |
| `/runs` | 실행/로그 (상세 `/runs/[runId]` 포함) |

- **내부** 폴더/DB 테이블명은 `command_catalogs` 등 그대로 둬도 됨. **겉 URL만** `/commands`로 통일.
- **QA·문서·테스트 스크립트**는 위 5개 URL만 사용한다.
- 추가 노출이 필요하면 **리다이렉트(alias)** 만 추가하고, 기존 경로 삭제/이동은 하지 않는다 (빌드 누락 방지).

---

## 2) MVP 백엔드 “콜백 기반” 최소 기능 (필수)

WebSocket 없이 **pull + callback**만 사용한다.

### Nodes

- **heartbeat**: online/offline (단순)
- **pull**: 작업 수신, **lease**로 중복 실행 방지
- **callback**: 결과 보고, **event_id 멱등**, 재시도 안전

### Runs

- **create / list / get**
- 상태: `queued` → `running` → `succeeded` / `failed`

### Commands

- 최소 모델: `id`, `title`, `type`(adb/cmd/js/json), `body`

---

## 3) node-runner.exe 역할 (필수)

- **headless**, 서비스로 상시 실행
- 서버에 주기적으로 **heartbeat + pull**
- 받은 job을 로컬에서 실행 (adb/cmd/js)
- 결과/로그를 **callback**으로 보고
- **기본 정책**: 노드당 동시 **1개**, device offline/timeout 시 **스킵** (예: 15s)

---

## 4) 준실시간 동기화 (필수)

- MVP는 프론트에서 **폴링(1~2초)** 또는 **SSE**로 runs/nodes 상태 갱신
- “실시간 정도”면 충분. **WebSocket은 MVP에서 제외**

---

## 참고

- 리다이렉트 정의: `next.config.ts` `redirects()`
- 노드 프로토콜: `docs/contracts/node-protocol.md`, `docs/spec/callback-contract.md`
- 단일 adb 플로우: `docs/guide/mvp-one-adb-flow.md`
