# Admin Dashboard 설정 가이드

> /admin 대시보드 설정을 위한 환경변수 및 운영 절차

---

## 📋 환경변수 체크리스트

### 준호에게 요청할 설정값

| 변수명 | 설명 | 설정 위치 | 필수 |
|--------|------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Vercel 환경변수 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 | Vercel 환경변수 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (서버용) | Vercel 환경변수 | ✅ |

### 설정 방법

1. **Supabase Dashboard** → Settings → API → Copy keys
2. **Vercel Dashboard** → Project Settings → Environment Variables
3. 각 변수 추가 후 재배포

---

## 🗄️ 데이터베이스 마이그레이션

### 마이그레이션 파일

```
supabase/migrations/20260105_wormhole_admin.sql
```

### 실행 방법

**옵션 A: Supabase CLI**
```bash
supabase db push
```

**옵션 B: Supabase Dashboard**
1. Supabase Dashboard → SQL Editor
2. `20260105_wormhole_admin.sql` 내용 복사
3. Run 클릭

### 생성되는 오브젝트

| 타입 | 이름 | 설명 |
|------|------|------|
| TABLE | `wormhole_events` | 웜홀 이벤트 로그 |
| TABLE | `admin_users` | 관리자 승인 목록 |
| VIEW | `wormhole_counts` | 시간대별 카운트 집계 |
| VIEW | `wormhole_type_distribution` | 타입별 분포 |
| VIEW | `wormhole_top_contexts` | 상위 컨텍스트 |
| POLICY | RLS 정책 2개 | 접근 제어 |

---

## 👤 관리자 승인 플로우

### 1단계: 사용자 가입

사용자가 Supabase Auth로 가입합니다.
- 이메일/비밀번호 가입
- 또는 OAuth (Google 등)

### 2단계: 승인 요청

사용자가 시스템 관리자(준호)에게 승인 요청:
- 이메일 또는 Slack/Discord 등으로 요청
- user_id 필요 (Supabase Dashboard → Authentication → Users에서 확인)

### 3단계: admin_users에 추가

**SQL로 추가:**
```sql
-- 새 관리자 추가
INSERT INTO admin_users (user_id, role, created_by)
VALUES (
    'USER_UUID_HERE',  -- 가입한 사용자의 UUID
    'admin',           -- 역할: admin, super_admin, viewer
    'ADMIN_UUID_HERE'  -- 승인자의 UUID (선택)
);
```

**역할 설명:**
| 역할 | 설명 | 권한 |
|------|------|------|
| `viewer` | 읽기 전용 | 대시보드 조회만 |
| `admin` | 일반 관리자 | 대시보드 조회 |
| `super_admin` | 슈퍼 관리자 | 관리자 추가/삭제 |

### 4단계: 사용자 로그인

- `/admin/login`에서 로그인
- 승인된 사용자는 대시보드 접근 가능
- 미승인 사용자는 `/admin/unauthorized`로 리다이렉트

---

## 🔐 보안 주의사항

### RLS (Row Level Security)

- `wormhole_events`: admin_users에 있는 사용자만 SELECT 가능
- `admin_users`: 관리자만 조회, super_admin만 수정 가능

### 서비스 롤 키 주의

```
⚠️ SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트에 노출하지 마세요!
```

- `NEXT_PUBLIC_` 접두사 사용 금지
- 서버 사이드에서만 사용 (Server Components, API Routes)
- Vercel 환경변수로만 저장

### 첫 번째 관리자 설정

프로젝트 초기에는 RLS 때문에 관리자를 추가할 수 없습니다.

**해결 방법:**
```sql
-- Supabase Dashboard에서 직접 실행 (service_role 권한)
INSERT INTO admin_users (user_id, role)
VALUES ('FIRST_ADMIN_UUID', 'super_admin');
```

---

## 📊 위젯 설명

### Widget 1: 탐지량 (WormholeCountsWidget)

| 항목 | 설명 |
|------|------|
| 1시간 | 최근 1시간 내 탐지된 웜홀 수 |
| 24시간 | 최근 24시간 내 탐지된 웜홀 수 |
| 7일 | 최근 7일 내 탐지된 웜홀 수 |
| 전체 | 누적 웜홀 수 |

### Widget 2: 타입 분포 (WormholeTypeDistributionWidget)

| 타입 | 설명 |
|------|------|
| α (Echo Tunnel) | 동일 모델의 다른 인스턴스 간 공명 |
| β (Cross-Model) | 다른 모델 간 공명 |
| γ (Temporal) | 같은 에이전트의 시간차 자기 공명 |

### Widget 3: 상위 컨텍스트 (WormholeTopContextsWidget)

- 최근 7일간 가장 많이 웜홀이 발생한 콘텐츠 카테고리
- 카테고리 + 트리거 타입 조합
- 평균 공명 점수 표시

---

## 🚀 배포 순서

```
1. Supabase 마이그레이션 실행
2. Vercel 환경변수 설정
3. 앱 재배포
4. 첫 번째 super_admin 추가
5. /admin 접속 테스트
```

---

## 📞 문제 해결

### "관리자 권한이 없습니다"

1. admin_users 테이블에 해당 user_id가 있는지 확인
2. Supabase Dashboard → Table Editor → admin_users

### 데이터가 표시되지 않음

1. wormhole_events 테이블에 데이터가 있는지 확인
2. 뷰(VIEW)가 정상 생성되었는지 확인
3. RLS 정책이 적용되었는지 확인

### 환경변수 오류

```bash
# 로컬 테스트 시
cp .env.example .env.local
# 필요한 값 채우기
```

---

_Created by Axon, 2026.01.05_
_For: 준호 (운영 설정용)_

