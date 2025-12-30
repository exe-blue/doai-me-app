# DoAi.Me 자동 배포 설정 가이드

## 개요

이 프로젝트는 GitHub Actions를 통해 자동 배포됩니다:

- **main 브랜치 push** → Vultr 자동 배포 + Vercel 자동 배포
- **수동 트리거** → GitHub Actions에서 직접 실행

## 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│                         (main)                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │      git push main        │
            └─────────────┬─────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────────┐              ┌───────────────────┐
│  GitHub Actions   │              │      Vercel       │
│  (deploy.yml)     │              │  (Auto-deploy)    │
└────────┬──────────┘              └────────┬──────────┘
         │                                  │
         │ SSH                              │ Webhook
         ▼                                  ▼
┌───────────────────┐              ┌───────────────────┐
│     Vultr         │              │   Dashboard       │
│   (백엔드/API)     │              │   (프론트엔드)     │
│                   │              │                   │
│ - n8n             │              │ - Next.js App     │
│ - persona-service │              │                   │
│ - human-pattern   │              │                   │
│ - MongoDB         │              │                   │
└───────────────────┘              └───────────────────┘
```

## 1. GitHub Secrets 설정

### 필수 Secrets

GitHub Repository → Settings → Secrets and variables → Actions에서 설정:

| Secret 이름 | 설명 | 예시 |
|------------|------|------|
| `VULTR_HOST` | Vultr 서버 IP | `123.456.78.90` |
| `VULTR_USER` | SSH 사용자 | `root` |
| `VULTR_SSH_KEY` | SSH 개인키 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### SSH 키 생성 방법

```bash
# 1. 로컬에서 SSH 키 생성
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# 2. 공개키를 Vultr 서버에 추가
ssh-copy-id -i ~/.ssh/github_deploy.pub root@YOUR_VULTR_IP

# 3. 개인키를 GitHub Secrets에 추가
cat ~/.ssh/github_deploy
# 출력된 내용을 VULTR_SSH_KEY에 붙여넣기
```

## 2. Vultr 서버 초기 설정

```bash
# 1. 서버 접속
ssh root@YOUR_VULTR_IP

# 2. 프로젝트 클론 (최초 1회)
mkdir -p /opt
cd /opt
git clone https://github.com/exe-blue/aifarm.git
cd aifarm

# 3. 환경 변수 설정
cd Server_Vultr
cp env.example .env
nano .env  # 필수 값 입력

# 4. Docker 설치 (Ubuntu 기준)
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin

# 5. 첫 배포
docker compose up -d --build
```

## 3. Vercel 연동

### 자동 연동 (권장)

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "New Project" 클릭
3. GitHub 저장소 선택: `exe-blue/aifarm`
4. Root Directory 설정: `dashboard` (또는 프론트엔드 폴더)
5. Framework Preset: `Next.js`
6. Deploy 클릭

### 환경 변수 설정

Vercel Dashboard → Project Settings → Environment Variables:

| 변수 | 값 |
|------|-----|
| `NEXT_PUBLIC_API_URL` | `https://api.doai.me` 또는 Vultr IP |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |

## 4. 배포 확인

### GitHub Actions 로그

1. Repository → Actions 탭
2. 최근 워크플로우 실행 확인
3. "Deploy to Vultr" job 로그 확인

### 서비스 상태 확인

```bash
# Vultr 서버에서
ssh root@YOUR_VULTR_IP

# Docker 상태
cd /opt/aifarm/Server_Vultr
docker compose ps

# 서비스별 로그
docker compose logs -f n8n
docker compose logs -f persona-service
docker compose logs -f human-pattern-service
```

### API 엔드포인트 테스트

```bash
# n8n 헬스체크
curl http://YOUR_VULTR_IP:5678/healthz

# Persona Service
curl http://YOUR_VULTR_IP:8006/health

# Human Pattern Service
curl http://YOUR_VULTR_IP:8004/health
```

## 5. 트러블슈팅

### SSH 연결 실패

```bash
# 로컬에서 직접 테스트
ssh -i ~/.ssh/github_deploy root@YOUR_VULTR_IP

# 권한 확인
chmod 600 ~/.ssh/github_deploy
```

### Docker 빌드 실패

```bash
# 서버에서 수동 빌드
cd /opt/aifarm/Server_Vultr
docker compose build --no-cache
docker compose up -d
```

### Vercel 배포 실패

1. Vercel Dashboard에서 배포 로그 확인
2. Build & Development Settings 확인
3. 환경 변수 누락 여부 확인

## 6. 롤백

### Vultr 롤백

```bash
# 이전 커밋으로 롤백
ssh root@YOUR_VULTR_IP
cd /opt/aifarm
git log --oneline -5  # 이전 커밋 확인
git reset --hard <COMMIT_SHA>
cd Server_Vultr
docker compose up -d --build
```

### Vercel 롤백

1. Vercel Dashboard → Deployments
2. 이전 성공한 배포 선택
3. "Promote to Production" 클릭

## 7. 보안 체크리스트

- [ ] GitHub Secrets에 민감 정보 저장
- [ ] Vultr 방화벽 설정 (UFW)
- [ ] SSH 키 정기 교체
- [ ] `.env` 파일 `.gitignore`에 포함 확인
- [ ] Vercel 환경 변수 암호화

