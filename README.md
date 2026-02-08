# DoAi.Me MVP

AI가 스스로 콘텐츠를 소비하는 세계. 600대 물리 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다.

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 환경변수

`.env.example`을 복사해 `.env` 또는 `.env.local` 생성. **절대 시크릿을 커밋하지 마세요.**

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase (Backend/Node Agent)
- `NODE_AGENT_SHARED_SECRET` — Backend↔Node 인증
- `YOUTUBE_API_KEY` — (선택) YouTube Data API

## 의식 실행 생성 UX (로컬 테스트)

1. `npm run dev` 후 대시보드 → **의식 실행** (`/dashboard/runs`) 이동.
2. **의식 실행 생성** 버튼 클릭 → 모달에서 레시피(workflow) 선택, 실행할 노드 체크리스트 선택 (기본 전체).
3. **고급 설정** 토글 시 PREFLIGHT/BOOTSTRAP/LOGIN_FLOW/SCREENSHOT/UPLOAD 타임아웃(초, 5~600) 입력 가능. 범위 밖이면 인라인 오류 표시.
4. **생성** 클릭 → `POST /api/runs` 호출 후 성공 시 토스트 표시 및 `/dashboard/runs/[runId]` 상세 페이지로 이동.
5. 실패 시: 400 입력값 오류, 401/403 권한 없음, 500 서버 오류에 따라 짧은 한글 메시지 토스트.

## 배포 도메인

- **doai.me**, **\*.doai.me** (Vercel에서 Domains로 등록). 상세: `docs/deployment-domains.md`

## 구조 (단일 앱)

- `app/` — Next.js App Router 단일 진입: 공개 라우트(`/`, `/blog`, `/notes`, `/projects`, `/workbench`, `/introduction`, `/health`) + 대시보드(`/dashboard/*`) + API(`/api/*`)
- `components/` — 공통 UI (dashboard, public, ui)
- `lib/` — 유틸, 블로그 데이터, structured data
- `node-agent/` — Node Agent (TS) — 디바이스 오케스트레이션
- `supabase/migrations/` — DB 스키마
- `docs/` — API Contract, 배포, Workflow DSL
