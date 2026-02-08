# 배포 가이드 (Canonical)

> **tags**: `deploy`, `vercel`, `404`, `middleware`, `domain`, `health`, `baseline`
> **sources**: DEPLOY-FRONTEND-BASELINE, Vercel-404-Quick-Diagnosis, deployment-domains
> **status**: canonical — 배포·진단 절차는 이 문서를 따른다

---

## 1. 배포 도메인

| 도메인 | 용도 |
|--------|------|
| `doai.me` | Production (apex) |
| `*.doai.me` | Wildcard 서브도메인 |
| `doai-me-app-git-main-exe-blue.vercel.app` | Vercel auto-deploy (main) |

Vercel Dashboard → Settings → Domains에서 등록. DNS는 gaby.kr 또는 Cloudflare에서 설정.

---

## 2. Deploy Gate (합격 조건)

| # | 경로 | 기대 |
|---|------|------|
| 1 | `/` | "Index of /" 금지. 랜딩 또는 → /dashboard redirect |
| 2 | `/dashboard` | 200 |
| 3 | `/health` | 200 (선택) |
| 4 | `/api/health` | 200 (선택) |

검증: `curl -s -o /dev/null -w "%{http_code}" https://doai.me/`

---

## 3. Middleware 규칙

- Middleware **존재 가능** (과거 500 원인: Edge에서 Node 전역 사용)
- **규칙**:
  - `/api` 전용만 처리 (matcher: `/api/*`)
  - **금지**: `__dirname`, `__filename`, `require`, `process` 등 Node 전역/CommonJS
- `/` 리다이렉트·세션 체크 → 페이지(Server Component)에서만 처리

---

## 4. 루트 `/` 동작

| 조건 | 동작 |
|------|------|
| 쿠키 없음 | 랜딩 페이지 렌더 |
| 쿠키 있음 (`doai-auth` or `sb-access-token`) | `redirect('/dashboard')` |

구현: `app/(public)/page.tsx` (Server Component, `cookies()` 사용)

---

## 5. Vercel 404 진단

### 제일 먼저 (99% 해결)

1. Vercel → Project Settings → General:
   - Root Directory = `.`
   - Framework = Next.js
2. Build & Development → Output Directory = 비움
3. Git → Production Branch = `main`
4. **Clear cache and redeploy**

### 추가 확인

| 원인 | 확인 |
|------|------|
| Root Directory 오설정 | Settings → General |
| Branch 불일치 | Git → Production Branch |
| 빌드 실패 | Build Logs (Node ≥20 확인) |
| 파일 미포함 | `app/page.tsx` 존재 확인 |

---

## 6. 랜딩 CTA (참조)

- Navigation: Dashboard, Runs, Devices, Artifacts, Settings, Health
- 없는 기능은 stub 페이지로 처리
- 기존 라우트만 연결

---

## 관련 문서

- 오케스트레이션: [../arch/orchestration.md](../arch/orchestration.md)
- API: [../spec/api-contracts.md](../spec/api-contracts.md)