# v0.dev UI 코드 통합 지시문 (Cursor + Claude용)

> v0에서 다운받은 프론트 코드를 레포에 통합할 때 사용하는 지시 템플릿이다.

---

## A) v0 코드 전달 방식

### 1. PR로 전달 (권장)

- 브랜치명: `chore/v0-ui-import`
- v0 결과를 `apps/web` 또는 `frontend` 폴더에 넣고 커밋
- PR 생성 후 Cursor+Claude에게 PR 링크 제공 + 아래 지시문 붙여넣기

### 2. ZIP으로 전달

- v0 결과 zip을 레포 루트에 `frontend/`로 압축 해제
- 커밋 후 PR 생성

---

## B) "적용하라고 명령" 템플릿

아래 문구를 그대로 Cursor에게 주면 된다.

```
We downloaded v0.dev generated UI code. Do NOT redesign UI. Your job is to integrate it into our repo as the frontend package and wire it to our MVP API contracts.

Integration requirements:
1) Place v0 code under /frontend (or /apps/web) and make it build on Vercel.
2) Keep the DoAi.Me glossary and labels (기기/호스트/의식 실행/기록 보관소, 상태칩 등) as the single source of truth.
3) Implement only the minimum pages:
   - /dashboard
   - /dashboard/devices
   - /dashboard/videos
   - /dashboard/runs
   - /dashboard/artifacts
   - /dashboard/onboarding
   - /dashboard/settings
4) Frontend must NEVER use service_role keys. All writes go through backend API routes.
5) Add a "Run create" form that includes per-action timeout overrides. Validate bounds.
6) The backend API routes should follow the Callback Contract v1 (node->backend events + heartbeat + run start via control channel).
7) Produce a PR with: build passing, env.example updated (no secrets), and a short README on local dev commands.

Repo의 Next.js 버전/라우터(app router)를 기준으로 v0 코드를 맞춰라. 혼재 금지.
```

---

## C) v0 코드 형태별 주의사항

v0는 보통 Next.js + shadcn/ui 형태로 나온다. 흔한 문제:

| 문제 | 대응 |
|------|------|
| 경로 alias `@/components` 깨짐 | tsconfig paths 확인 |
| tailwind config 충돌 | 기존 config에 병합 |
| app router / pages router 혼재 | **app router만 사용** |

**지시 추가**: "repo의 Next.js 버전/라우터(app router)를 기준으로 v0 코드를 맞춰라. 혼재 금지."

---

## D) 참조 문서

- Callback Contract v1: `docs/Callback-Contract-v1.md`
- Orchestration Rules: `docs/DoAi-Me-MVP-Orchestration-Rules-v1.md`
- Workflow DSL: `docs/Prometheus-Workflow-DSL-v1.md`
