# "홈이 대시보드로 뜸 / 랜딩으로 설정했는데 안 됨" 점검 순서

에이전트/개발자용 체크리스트.

## 원칙 (MVP)

- **`/`는 무조건 랜딩**으로 고정.
- 로그인 상태여도 `/`·`/landing`에서는 랜딩만 표시.
- 로그인 사용자는 랜딩 상단 CTA **"대시보드로 이동"** 버튼으로만 대시보드 진입.

## 확인 순서

### 1. app/page.tsx가 실제로 랜딩인지, 아니면 middleware/redirect가 /dashboard로 보내는지

- **확인:** `app/page.tsx`(루트)는 랜딩으로 보내는지, 대시보드로 보내는지.
- **기대:** `redirect("/landing")` 또는 랜딩 컴포넌트만 렌더. `redirect("/dashboard")` 없어야 함.

### 2. middleware.ts가 "로그인 됐으면 dashboard" 로직을 강제하는지 (쿠키/토큰 체크)

- **확인:** `middleware.ts`에서 pathname이 `/` 또는 `/landing`일 때 쿠키/토큰 보고 `/dashboard`로 리다이렉트하는지.
- **기대:** MVP에서는 해당 로직 없음. (middleware는 예: `/api/*` 요청 ID 등만 처리.)

### 3. next.config.ts에 redirects()나 rewrites()로 / -> /dashboard가 박혀 있는지

- **확인:** `next.config.ts` `redirects()`/`rewrites()`에 `source: '/'` → `destination: '/dashboard'` 있는지.
- **기대:** `source: '/'` → `destination: '/landing'` (또는 랜딩). `/` → `/dashboard` 없어야 함.

### 4. Vercel에서 "Output Directory / Root Directory" 설정이 잘못돼서 라우팅이 꼬이는지

- **확인:** Vercel 프로젝트 설정에서 Root Directory가 비어 있거나 프로젝트 루트인지, Output Directory가 Next.js 기본값과 맞는지.
- **기대:** Next.js 앱이면 별도 Output Directory 변경 없음. Root가 잘못되면 `app/` 라우팅이 안 먹을 수 있음.

## 현재 코드 기준 정리

| 항목 | 상태 |
|------|------|
| app/page.tsx | `redirect("/landing")` 만 사용 → 랜딩으로 유도 ✅ |
| middleware | `/api/*` 만 매칭, 로그인→dashboard 없음 ✅ |
| next.config redirects | `/` → `/landing` ✅, `/` → `/dashboard` 없음 ✅ |
| landing 페이지 | 로그인 시 redirect('/dashboard') 제거됨 → 항상 랜딩 표시, CTA로 대시보드 이동 ✅ |

## 수정 이력

- 랜딩 페이지에서 `hasAuth` 시 `redirect('/dashboard')` 제거. `/`·`/landing`은 항상 랜딩만 표시.
