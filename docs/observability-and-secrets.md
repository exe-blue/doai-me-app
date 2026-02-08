# DevOps / 관측 / 시크릿 규칙

> 고장 나면 즉시 찾을 수 있게: Sentry, X-Request-Id, Storage 경로, 시크릿 노출 금지.

---

## 1. Sentry

- **서버(Next.js API)**: `sentry.server.config.ts` + `instrumentation.ts` → API 오류/예외 전송.
- **프론트**: `instrumentation-client.ts` → 클라이언트 오류 + Replay(오류 시 100%).
- **API 요청 추적**: `/api/*` 호출 시 `x-request-id`를 요청에 붙이고, 응답에 `X-Request-Id` 헤더로 동일 값 반환. Sentry 이벤트에는 `request_id`, `node_id`(nodes/pull·callback), `run_id`(callback) 태그로 설정.

---

## 2. X-Request-Id

- **규칙**: 모든 API 응답에 `X-Request-Id` 헤더(UUID)를 붙인다.
- **구현**: `middleware.ts`가 `/api/*` 요청에 `x-request-id`를 설정. 각 API 라우트는 `withRequestId(NextResponse.json(...), req)`로 응답에 `X-Request-Id`를 설정.
- **노드 callback**: 노드가 callback 시 서버가 부여한 요청 ID는 응답 헤더 `X-Request-Id`로 내려가므로, 재시도/로그 상관 시 동일 요청으로 추적 가능. (노드에서 요청 시 `X-Request-Id`를 넣어 보내도 되며, 없으면 서버가 생성.)

---

## 3. Artifacts 업로드 경로 규칙

- **Bucket**: `artifacts` (Supabase Storage). `command-assets` bucket은 명령 에셋용으로 유지.
- **스크린샷 경로(권장)**:
  ```
  artifacts/{run_id}/{device_index}/{timestamp}.png
  ```
  - `run_id`: run UUID
  - `device_index`: 디바이스 인덱스(정수)
  - `timestamp`: Unix timestamp (초 단위)
- 노드 러너는 이 규칙에 맞춰 업로드하고, callback 시 `artifact.storage_path`로 전달. 서버는 `artifacts` 테이블에 `storage_path`를 저장하고, 공개 URL이 필요하면 signed URL 등으로 변환.

---

## 4. 시크릿 / 환경 변수 (고정)

- **절대 클라이언트 노출 금지**
  - `NODE_AGENT_SHARED_SECRET` (노드 ↔ 서버 인증)
  - `SUPABASE_SERVICE_ROLE_KEY`
- 이 값들은 서버 전용(API route, middleware, server components)에서만 사용하고, `NEXT_PUBLIC_*` 또는 클라이언트 번들에 포함되지 않도록 한다.

---

## 5. Node callback 추적

- callback 수신 시 서버는 `request_id`(middleware/헤더), payload의 `run_id`·`node_id`·`event_id`를 Sentry 태그로 설정.
- **모든 API 응답**에 `X-Request-Id`가 붙으므로, 노드가 callback 응답 헤더를 로그에 남기면 job/callback 추적 시 동일 요청으로 상관 가능.
- 노드에서 callback 요청 시 선택적으로 `X-Request-Id` 헤더를 넣어 보내도 되며, 없으면 서버가 생성해 응답 헤더로 내려준다.
