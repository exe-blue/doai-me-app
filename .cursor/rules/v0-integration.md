# v0.dev UI 통합 규칙

> v0 코드를 레포에 통합할 때 따른다.
> **Canonical**: `docs/guide/v0-integration.md`

---

## 핵심

1. v0 코드를 **재설계하지 말고** 기존 레포 구조에 **흡수**
2. DoAi.Me glossary: 기기/호스트/의식 실행/기록 보관소
3. 필수 페이지: /dashboard, /dashboard/devices, /dashboard/videos, /dashboard/runs, /dashboard/artifacts, /dashboard/onboarding, /dashboard/settings
4. Frontend: `service_role` 키 금지; 모든 쓰기는 backend API
5. Run create 폼: per-action timeout overrides + bounds 검증
6. Callback Contract 준수 → `docs/spec/callback-contract.md`
7. Next.js App Router 전용; pages router 혼재 금지
