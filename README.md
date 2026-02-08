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

## 구조

- `app/` — Next.js App Router (API routes + Dashboard UI)
- `node-agent/` — Node Agent (TS) — 디바이스 오케스트레이션
- `supabase/migrations/` — DB 스키마
- `docs/` — Callback Contract, Orchestration Rules, Workflow DSL
