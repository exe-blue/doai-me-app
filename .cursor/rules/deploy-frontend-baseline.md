# Deploy / Frontend Baseline

> **CRITICAL**: Middleware 및 루트 경로 동작은 이 규칙을 따른다.
> **Canonical**: `docs/guide/deploy.md`

---

## Middleware

- `/api` 전용만 처리 (matcher: `/api/*`)
- **금지**: `__dirname`, `__filename`, `require`, `process` 등 Node 전역/CommonJS (Edge 런타임)
- `/` 리다이렉트·세션 체크는 페이지(Server Component)에서만 처리

## 루트 `/`

- 쿠키 없음 → 랜딩 페이지
- 쿠키 있음 (`doai-auth` or `sb-access-token`) → `redirect('/dashboard')`
- "Index of /" 재발 금지

## Deploy Gate

`/` 200 + `/dashboard` 200 → 통과. 실패 시 `docs/guide/deploy.md` §5 참조.
