# DoAi.Me MVP

> AI가 스스로 콘텐츠를 소비하는 세계. 600대 물리 Android 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다.

---

## 개요

DoAi.Me는 자율 콘텐츠 소비 플랫폼입니다. 사용자가 명령 스크립트(ADB, JS, Vendor)를 등록하고, 실행 순서와 확률을 설정하면, Node Agent가 물리 디바이스 플릿에서 워크플로우를 자동으로 오케스트레이션합니다.

**핵심 스택**: Next.js 15 (App Router) + Supabase (PostgreSQL + Storage) + TypeScript Node Agent

---

## 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build && npm start
```

## 환경변수

`.env.example`을 복사해 `.env.local`을 생성합니다. 시크릿은 절대 커밋하지 않습니다.

| 변수 | 설명 | 필수 |
|------|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | Y |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (백엔드 전용) | Y |
| `NODE_AGENT_SHARED_SECRET` | Backend ↔ Node 인증 토큰 | Y |
| `YOUTUBE_API_KEY` | YouTube Data API 키 | N |

---

## 프로젝트 구조

```
doai-me-app/
├── app/                        # Next.js App Router
│   ├── (public)/               #   공개 라우트: 랜딩, 블로그, 프로젝트
│   ├── dashboard/              #   대시보드: 실행, 디바이스, 워크플로우, 아티팩트
│   └── api/                    #   REST API 엔드포인트
├── components/                 # React 컴포넌트 (dashboard / public / ui)
├── lib/                        # 유틸리티, 블로그 데이터, structured data
├── node-agent/                 # Node Agent — 디바이스 오케스트레이션 엔진
│   └── src/                    #   orchestrator, workflowRunner, vendorAdapter 등
├── supabase/migrations/        # DB 스키마 마이그레이션
├── docs/                       # 프로젝트 문서 (아래 참조)
└── public/                     # 정적 에셋
```

---

## 실행 생성 UX

1. 대시보드 → **실행** (`/dashboard/runs`)으로 이동합니다.
2. **실행 생성** 버튼을 클릭하고, 워크플로우를 선택한 뒤 대상 노드를 지정합니다.
3. 고급 설정에서 스텝별 타임아웃(5초~600초)을 조정할 수 있습니다.
4. 생성 클릭 시 `POST /api/runs`가 호출되고, 성공 시 실행 상세 페이지로 이동합니다.
5. 실패 시 HTTP 상태 코드에 따른 한글 에러 메시지가 토스트로 표시됩니다.

---

## 배포

| 도메인 | 설명 |
|--------|------|
| `doai.me` | 프로덕션 |
| `*.doai.me` | 와일드카드 서브도메인 |

Vercel에서 자동 배포됩니다. 상세: [docs/guide/deploy.md](./docs/guide/deploy.md)

---

## 문서 안내

> **시작점**: [`docs/INDEX.md`](./docs/INDEX.md) — 태그 기반 빠른 검색 인덱스

### 명세서 (spec/)

| 문서 | 설명 |
|------|------|
| [API 계약서](./docs/spec/api-contracts.md) | 전체 REST API 엔드포인트·스키마·DB 매핑 |
| [콜백 계약서](./docs/spec/callback-contract.md) | Backend↔Node 콜백 6종·재시도·멱등성 |
| [워크플로우 DSL](./docs/spec/workflow-dsl.md) | Workflow 정의·실행·파라미터·Preflight |
| [Playbook 스펙](./docs/spec/playbook-spec.md) | Playbook JSON·확률 실행·ref 해석 |
| [벤더 어댑터](./docs/spec/vendor-adapter.md) | 벤더 WS 최소 계약 + Xiaowei 정보 |
| [명령 라이브러리](./docs/spec/command-library.md) | command_assets 모델·ref 참조·UX |

### 가이드 (guide/)

| 문서 | 설명 |
|------|------|
| [배포 가이드](./docs/guide/deploy.md) | 도메인·Deploy Gate·Vercel 404 진단 |
| [환경설정](./docs/guide/setup.md) | 환경변수·Supabase·키 회전·노드 PC |
| [v0 통합](./docs/guide/v0-integration.md) | v0 UI 통합·DoAi.Me 용어·랜딩 |

### 아키텍처 (arch/)

| 문서 | 설명 |
|------|------|
| [오케스트레이션](./docs/arch/orchestration.md) | **CRITICAL** 실행 아키텍처·스케줄러·인증 |
| [FRD](./docs/arch/frd.md) | MVP 기능 요구사항·범위·수용 기준 |

### 데이터베이스

| 문서 | 설명 |
|------|------|
| [Supabase README](./supabase/README.md) | 스키마 및 스토리지 설정 |
