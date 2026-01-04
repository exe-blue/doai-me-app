# Handoff: To Axon (Tech Lead)

> 구현 작업 지시서
> **Last Updated:** 2026-01-04
> **From:** @orion, @strategos

---

## 📋 현재 상태

### 완료된 작업
- [x] 레포 구조 표준화 문서
- [x] GitHub 템플릿 (PR, Issue)
- [x] 운영 런북 (`orion/runbooks/`)
- [x] API 명세 (`docs/api.md`)
- [x] /admin 대시보드 스펙 (`docs/admin-dashboard-spec.md`)

### 대기 중인 작업
- [ ] **Priority 1:** 레포 구조 마이그레이션
- [ ] **Priority 2:** /admin 대시보드 구현
- [ ] **Priority 3:** Emergency API 구현

---

## 🔴 Priority 1: 레포 구조 마이그레이션

### 목표
현재 파편화된 코드를 표준 구조로 정리

### 작업 내용

```bash
# 브랜치 생성
git checkout -b ops/repo-cleanup

# 폴더 이동
git mv apps/dashboard apps/web
git mv central-orchestrator apps/orchestrator
git mv node-runner apps/node-runner

# 커밋
git commit -m "chore: restructure repo to standard layout"
```

### 수정 필요 파일
| 파일 | 변경 내용 |
|------|----------|
| `infra/systemd/*.service` | WorkingDirectory 경로 수정 |
| `infra/docker/docker-compose.yml` | build context 경로 수정 |
| `.github/workflows/*.yml` | 경로 참조 수정 |

### 미사용 코드 정리 대상 (검토 필요)
- `doai-sdk/` - 현재 사용 여부?
- `gateway/` - central-orchestrator와 중복?
- `backend/` - deprecated?
- `stage1/` - 아카이브?

### PR 체크리스트
- [ ] 모든 서비스가 새 경로에서 실행 가능
- [ ] Docker Compose 정상 동작
- [ ] 기존 기능 그대로 유지

---

## 🟡 Priority 2: /admin 대시보드 구현

### 목표
관리자가 시스템을 모니터링하고 비상 제어할 수 있는 최소 기능 대시보드

### 스펙 문서
📄 **[docs/admin-dashboard-spec.md](../../docs/admin-dashboard-spec.md)**

### 핵심 기능 (MVP)

#### 1. Supabase Auth 연동
```typescript
// 요구사항
- 이메일/비밀번호 로그인
- 세션 관리
- /admin/* 경로 보호 (미인증 시 리다이렉트)
```

#### 2. 대시보드 메인 (`/admin`)
```
┌─────────────────────────────────────────────────────────────────┐
│  Stats Cards: 노드 수, 온라인 수, 디바이스 수, 활성 수          │
├─────────────────────────────────────────────────────────────────┤
│  Emergency Controls: [L1] [L2] [L3] 버튼                        │
├─────────────────────────────────────────────────────────────────┤
│  Nodes List: 실시간 노드 상태 (🟢온라인/🔴오프라인)            │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Emergency API 연동
| Level | 동작 | 확인 절차 |
|-------|------|----------|
| L1 Soft Reset | 즉시 실행 | 없음 |
| L2 Service Reset | 모달 확인 | 코드 입력 + 사유 |
| L3 Box Reset | 2단계 승인 | 1차 + 30초 대기 + 2차 |

### 기술 스택
- Next.js 14+ (App Router)
- Supabase Auth
- Tailwind CSS + shadcn/ui
- Zustand (상태 관리)
- WebSocket (실시간)

### 구현 순서

#### Phase 1: 기본 구조 (2일)
```
1. Next.js 프로젝트 설정 (apps/web/)
2. Supabase 클라이언트 설정
3. 로그인 페이지 (/admin/login)
4. 인증 미들웨어
```

#### Phase 2: 대시보드 UI (2일)
```
1. 레이아웃 컴포넌트
2. Stats Cards 컴포넌트
3. Nodes List 컴포넌트 (REST API 연동)
4. Emergency Controls UI
```

#### Phase 3: Real-time + Emergency (3일)
```
1. WebSocket 연결 (Orchestrator)
2. 실시간 노드 상태 업데이트
3. L1/L2/L3 Emergency 모달 및 API 연동
```

### API 엔드포인트 (Orchestrator에 추가 필요)

```python
# Emergency API (추가 구현 필요)
POST /api/emergency/soft-reset      # L1
POST /api/emergency/service-reset   # L2
POST /api/emergency/box-reset       # L3

# Dashboard WebSocket (추가 구현 필요)
WS /ws/dashboard?token=<ADMIN_TOKEN>
```

### PR 체크리스트
- [ ] Supabase Auth 정상 동작
- [ ] 노드 목록 표시
- [ ] Emergency L1 동작
- [ ] 모바일 반응형

---

## 🟢 Priority 3: Emergency API 구현

### 목표
런북의 3단계 비상 버튼을 API로 구현

### 스펙
📄 **[docs/api.md](../../docs/api.md)** - Emergency API 섹션

### 엔드포인트

#### L1 Soft Reset
```python
@router.post("/api/emergency/soft-reset")
async def soft_reset(
    request: SoftResetRequest,
    _: bool = Depends(verify_admin_token)
):
    """
    서비스 재시작 (무중단)
    - 승인: 불필요
    - 타임아웃: 30초
    """
    # 1. 현재 상태 로깅
    # 2. systemctl restart doai-orchestrator
    # 3. health check 대기
    # 4. 결과 반환
```

#### L2 Service Reset
```python
@router.post("/api/emergency/service-reset")
async def service_reset(
    request: ServiceResetRequest,  # confirm_code, reason, approver
    _: bool = Depends(verify_admin_token)
):
    """
    전체 서비스 재시작
    - 승인: 1단계 (코드 확인)
    - 타임아웃: 2분
    """
    # 1. confirm_code 검증
    # 2. 상태 스냅샷 저장
    # 3. 서비스 중지 → 캐시 정리 → 재시작
    # 4. health check
    # 5. 결과 반환
```

#### L3 Box Reset
```python
@router.post("/api/emergency/box-reset")
async def box_reset(
    request: BoxResetRequest,  # step, approver, code, reason
    _: bool = Depends(verify_admin_token)
):
    """
    서버 재부팅 (Vultr API)
    - 승인: 2단계
    - 타임아웃: 10분
    """
    # Step 1: 1차 승인 기록, 토큰 발급
    # Step 2: 2차 승인 검증, 실행
```

### 로깅 형식
```python
# /var/log/doai/emergency.log
logger.info(f"[{level}] {action}: {message}", extra={
    "level": level,
    "action": action,
    "approver": approver,
    "confirm_code": confirm_code,
    "timestamp": datetime.now(UTC).isoformat()
})
```

---

## 📐 코드 품질 기준

### 필수 준수 사항

1. **TypeScript Strict Mode**
   ```json
   // tsconfig.json
   { "compilerOptions": { "strict": true } }
   ```

2. **로깅 표준화**
   - `console.log` 금지
   - Python: `logging` 모듈
   - TypeScript: 커스텀 logger

3. **에러 처리**
   - 모든 API에 try-catch
   - 에러 코드 체계 준수 (`docs/api.md`)

4. **함수 제한**
   - 100줄 이내
   - 복잡도 10 미만

### PR 요구사항
- 템플릿 체크리스트 완료
- main 직접 푸시 금지
- 테스트 포함 (가능한 경우)

---

## 🗓️ 예상 일정

| 작업 | 예상 소요 | 우선순위 |
|------|----------|----------|
| 레포 마이그레이션 | 1일 | P1 |
| /admin 기본 구조 | 2일 | P2 |
| /admin 대시보드 UI | 2일 | P2 |
| Emergency API | 2일 | P2 |
| Real-time 연동 | 2일 | P2 |
| 테스트 및 버그 수정 | 1일 | - |
| **총계** | **~10일** | |

---

## ❓ 질문/확인 필요

1. `doai-sdk/`의 현재 사용처와 보존 여부?
2. `gateway/`와 `central-orchestrator/`의 관계?
3. Supabase 프로젝트 접근 권한?
4. Vultr API 키 접근 권한 (L3 Box Reset용)?

---

## 📎 참조 문서

- [Architecture](../../docs/architecture.md)
- [API Spec](../../docs/api.md)
- [Admin Dashboard Spec](../../docs/admin-dashboard-spec.md)
- [Security Guide](../../docs/security.md)
- [Recovery Runbook](../runbooks/recover.md)
- [Structure Migration Guide](../STRUCTURE_MIGRATION.md)

---

_Last updated: 2026-01-04 by @orion_
_Approved by: @strategos_
