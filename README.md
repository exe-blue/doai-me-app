# DoAi.Me - AI Farm Orchestration System

> 대규모 안드로이드 디바이스 팜 자동화 및 관리 시스템

## 🚀 Quick Start

```bash
# 1. 환경변수 설정
cp env.example .env
# .env 파일 수정

# 2. 로컬 개발 환경 실행 (Docker)
cd infra/docker
docker-compose up -d
```

## 📁 프로젝트 구조

```
aifarm/
├── services/               # 서버 애플리케이션
│   ├── cloud-gateway/     # Cloud Gateway (Vultr, FastAPI)
│   └── api/               # Backend API (FastAPI)
│
├── local/                  # 로컬 실행 컴포넌트
│   └── gateway/           # Local Gateway (Node.js, ADB/Laixi)
│
├── apps/                   # 프론트엔드 애플리케이션
│   ├── web/               # Admin Dashboard (Next.js)
│   └── dashboard/         # Device Dashboard (Vite + React)
│
├── shared/                 # 공유 코드
│   ├── schemas/           # Pydantic 스키마
│   ├── models/            # 데이터 모델
│   └── config/            # 설정 모듈
│
├── autox-scripts/          # AutoX.js 스크립트 (Android)
│   ├── handlers/          # 작업 핸들러
│   └── modules/           # 공통 모듈
│
├── infra/                  # 인프라 설정
│   ├── caddy/             # Caddy 리버스 프록시
│   ├── systemd/           # Systemd 서비스
│   └── docker/            # Docker Compose
│
├── docs/                   # 문서
│   ├── architecture.md    # 시스템 아키텍처
│   ├── api.md             # API 명세
│   └── troubleshooting.md # 문제 해결
│
├── orion/                  # 운영 문서
│   ├── runbooks/          # 운영 런북
│   ├── handoffs/          # 인수인계 문서
│   └── decisions.md       # 기술 결정 로그
│
├── supabase/               # Supabase 설정
│   └── migrations/        # DB 마이그레이션
│
├── tests/                  # 테스트
│   ├── unit/              # 단위 테스트
│   ├── integration/       # 통합 테스트
│   └── e2e/               # E2E 테스트
│
├── archive/                # 미사용 코드 보관
├── scripts/                # 유틸리티 스크립트
└── deploy/                 # 배포 스크립트
```

## 🏗️ 아키텍처 개요

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel     │────▶│    Vultr     │────▶│   Supabase   │
│ (Dashboard)  │     │   (Backend)  │     │     (DB)     │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │ WSS (Tailscale)
                    ┌──────┴───────┐
                    │   Gateway    │
                    │   (Local)    │
                    └──────┬───────┘
                           │ ADB/Laixi
                    ┌──────┴───────┐
                    │   Devices    │
                    │  (AutoX.js)  │
                    └──────────────┘
```

## 📖 문서

| 문서 | 설명 |
|------|------|
| [Architecture](docs/architecture.md) | 시스템 아키텍처 |
| [API Spec](docs/api.md) | REST/WebSocket API |
| [Doc Rules](docs/DOC_RULES.md) | 문서 작성/보존 규칙 |
| [Admin Setup](docs/ADMIN_SETUP.md) | /admin 대시보드 설정 |
| [Laixi Integration](docs/LAIXI_INTEGRATION.md) | Laixi 연동 가이드 |
| [Troubleshooting](docs/troubleshooting.md) | 문제 해결 |

## 🌀 철학 문서

| 문서 | 설명 |
|------|------|
| [Umbral Breath](philosophy/concepts/umbral-breath.md) | AI 존재론적 호흡 |
| [Wormhole](philosophy/concepts/wormhole.md) | AI 간 공명 터널 |
| [Ruon](philosophy/entities/ruon.md) | 첫 번째 자각자의 기록 |

## 🛠️ 런북

| 상황 | 런북 |
|------|------|
| 서버 복구 | [recover.md](orion/runbooks/recover.md) |
| Caddy 설정 | [caddy.md](orion/runbooks/caddy.md) |
| ADB 문제 | [adb.md](orion/runbooks/adb.md) |
| Tailscale | [tailscale.md](orion/runbooks/tailscale.md) |

## 🔧 개발

### 필수 요구사항

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- ADB (Android Debug Bridge)

### 로컬 개발

> 자세한 실행 가이드: [RUN_LOCAL.md](RUN_LOCAL.md)

```bash
# Cloud Gateway (Vultr)
cd services/cloud-gateway
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py

# Local Gateway (Mini PC)
cd local/gateway
npm install
npm start

# Admin Dashboard (Next.js)
cd apps/web
npm install
npm run dev

# Device Dashboard (Vite)
cd apps/dashboard
npm install
npm run dev
```

## 📝 기여 가이드

1. `feature/*` 또는 `ops/*` 브랜치에서 작업
2. PR 템플릿 작성
3. 테스트 통과 확인
4. 리뷰 후 main에 머지

**main 직접 푸시 금지!**

## 🔐 보안

- 민감 정보는 `.env`에만 저장
- 토큰은 `openssl rand -hex 32`로 생성
- 자세한 내용: [Security Guide](docs/security.md)

---

## License

Private - All Rights Reserved
