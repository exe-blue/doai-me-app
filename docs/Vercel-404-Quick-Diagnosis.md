# Vercel 404 즉시 진단 루틴 (5분 컷)

Vercel 프로젝트에서 **Deployments → 최신 배포** 클릭 후 아래를 **순서대로** 확인한다.

---

## 404 원인 1순위: Vercel이 다른 브랜치/커밋을 배포 중

GitHub에는 `app/page.tsx`가 있는데 Production이 그 커밋을 빌드하지 않은 상태일 가능성이 가장 크다.

**바로 확인 (Vercel UI)**  
- **Deployments** → 최신 Production 배포 클릭 → 상단 **Git Branch / Commit SHA** 확인  
- 그 커밋에서 GitHub에서 `app/page.tsx` 존재·경로·대소문자 확인  

**해결**  
- **Settings → Git → Production Branch** 를 **main**으로 고정  
- **Deployments**에서 **Redeploy** (가능하면 "Clear cache and redeploy")  

**원인 판별**: 최신 배포의 **Commit SHA(7자리)** 를 알려주면, "이 커밋에 app/page.tsx 없음 → 브랜치 문제" vs "있는데 / 미포함 → 구조/설정 문제" 로 즉시 구분 가능.

**루트 리다이렉트**: 이 레포는 `app/page.tsx`에서 `redirect("/dashboard")`로 처리한다. **middleware.ts는 제거됨** (Edge 500 회피).

---

## 404 원인 2순위: app/page.tsx가 빌드에 포함되지 않음

**빌드 라우트 목록에 `/`가 없고 `/dashboard`만 있는 경우** 보통 둘 중 하나다:

1. **해당 배포 커밋에 `app/page.tsx`가 실제로 없음** (다른 브랜치/커밋이 Production으로 배포 중)
2. **파일 경로·대소문자** (`App/page.tsx` 등), `app` 폴더 무시 설정, route group 충돌

**확정**: 배포된 커밋에서 GitHub로 `app/page.tsx` 존재 여부·대소문자 확인.  
`app/page.tsx`에 `redirect("/dashboard")`만 넣어두면 `/` 라우트가 생성되면서 이 문제도 함께 해결된다.

**미들웨어 500 원인 확인(선택)**: Vercel **Deployments → 해당 배포 → Runtime Logs / Edge Middleware Logs** 에 스택이 찍힌다.

---

## A. 빌드가 실제로 성공했는지

- **Deployment 화면**에 **Build Logs**가 있는지 확인.
- `next build`가 실행됐는지 확인 (Next.js 프로젝트인 경우).

**주의**

- Build Logs가 거의 비어 있거나 **"Framework: Other"**로 잡히면  
  → **Vercel이 Next 프로젝트를 못 찾은 것** (Root Directory 설정 문제 가능성 높음).
- **Root Directory**가 레포 루트가 아니라 하위 폴더로 잡혀 있으면, `next build`가 안 돌거나 잘못된 앱이 배포될 수 있음.

---

## B. `/` 자체가 404인지, 특정 라우트만 404인지

| 상황 | 추정 원인 |
|------|------------|
| **`/` 도 404** | 프로젝트 루트/빌드 산출물/프레임워크 감지 문제. A(빌드·Root Directory)부터 다시 점검. |
| **`/` 은 되는데 `/dashboard` 등만 404** | 이 레포는 Next App Router라서 보통 그런 식으로만 깨지진 않음. 가능성: **배포가 다른 앱을 가리킴**, **브랜치/커밋 불일치**. |

---

## C. 실제로 어떤 커밋이 배포되고 있는지

- Deployment 상세에 **Commit SHA** / **Branch** 표시됨.
- “방금 만든 프론트가 배포에 반영이 안 됨”이면  
  → **Vercel이 다른 브랜치**(예: `master`, `dev`)를 Production으로 보고 있을 가능성 큼.
- **Production Branch** 설정: Project **Settings → Git** 에서 어떤 브랜치가 Production인지 확인.

---

## 체크리스트 요약

1. [ ] Build Logs에 `next build` 성공 여부
2. [ ] Framework가 Next.js로 감지되는지 (Other 아님)
3. [ ] Root Directory가 레포 루트(또는 올바른 앱 루트)인지
4. [ ] `/` 404인지, 특정 경로만 404인지 구분
5. [ ] 배포된 Commit SHA / Branch가 기대한 브랜치·커밋과 일치하는지

---

# 2) 가장 흔한 원인별 해결책 (Vercel 전용)

## 원인 1) Root Directory가 잘못되어 Next 앱을 못 보고 있음 (가장 흔함)

**증상**: `/` 404, 빌드 로그가 Next가 아니라 다른 걸로 뜨거나 거의 없음.

**해결**

- **Vercel Project Settings → General → Root Directory**
- 이 레포는 Next 앱이 **루트**에 있으므로 보통 **`.`** 이어야 함.
- monorepo처럼 하위 경로로 설정돼 있었다면 **루트로 되돌리기**.
- **Settings → Build & Development Settings**에서:
  - **Framework Preset**: Next.js
  - **Build Command**: `npm run build`
  - **Output Directory**: (비움. Next는 자동)
  - **Install Command**: `npm install` (또는 pnpm/yarn 사용 시 해당 명령)

---

## 원인 2) Production Branch가 다름 (배포는 되는데 내가 만든 화면이 없음)

**증상**: 배포는 “성공”인데 화면/코드가 옛날 상태, `/` 404 또는 다른 페이지.

**해결**

- **Settings → Git → Production Branch** 를 **main**으로 맞추기.
- **Deployments**에서 **Redeploy** (캐시 포함) 한 번 실행.

---

## 원인 3) 빌드는 실패했는데, Vercel이 404처럼 보이게 내보내는 경우

**증상**: Deployment는 존재하지만 실제 방문 시 404 또는 기본 에러.

**해결**

- **Build Logs**에서 실패 지점 확인.
- 이 레포는 **next@15 + react@19**라서, Vercel 런타임 Node 버전이 낮으면 문제가 날 수 있음.
- **Vercel Settings → General → Node.js Version** 을 **20.x 이상**으로 맞추기 (최소 18도 가능할 수 있으나 20 권장).

---

## 원인 4) “도메인/프로젝트”를 헷갈려서 다른 프로젝트 URL을 보고 있음

**증상**: 내가 배포한 URL인데도 계속 404, 로그상으로는 정상.

**해결**

- **Vercel Dashboard**에서 프로젝트를 열고,
- **Domains**에 연결된 도메인과
- **Deployment**에서 제공하는 **Preview URL**이 **같은 프로젝트**인지 확인.
