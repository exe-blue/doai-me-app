# Supabase 설정 가이드

> **운영** · v1.0

Supabase 데이터베이스 마이그레이션, 테이블, 스토리지 버킷, 접근 규칙을 설정합니다.

---

## 마이그레이션 적용

Supabase 데이터베이스를 초기화하는 방법입니다. 다음 중 하나를 선택하세요.

### 옵션 A: Supabase CLI (로컬)

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

### 옵션 B: Supabase 대시보드 (SQL 편집기)

1. SQL Editor → New query
2. `migrations/20250208000000_mvp_schema.sql` 내용 복붙
3. Run 실행

### 옵션 C: Supabase Management API

대시보드 또는 Management API가 사용 가능한 경우:

```bash
curl -X POST "https://api.supabase.com/v1/projects/YOUR_PROJECT_ID/database/migrations" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @migration.json
```

---

## 테이블 정의

### videos

YouTube 비디오 메타데이터를 저장합니다.

| 열 | 타입 | 설명 |
|----|------|------|
| `id` | uuid | 기본 키 |
| `youtube_video_id` | text (unique) | YouTube 비디오 ID |
| `title` | text | 비디오 제목 |
| `created_at` | timestamptz | 생성 시간 |

### workflows

명령 레시피 및 Workflow DSL 정의를 저장합니다.

| 열 | 타입 | 설명 |
|----|------|------|
| `id` | uuid | 기본 키 |
| `name` | text | Workflow 이름 |
| `definition_json` | jsonb | DSL 정의 (JSON) |
| `version` | text | 버전 |
| `created_at` | timestamptz | 생성 시간 |

### runs

Workflow 실행 세션을 저장합니다. 각 run은 단일 작업입니다.

| 열 | 타입 | 설명 |
|----|------|------|
| `id` | uuid | 기본 키 |
| `workflow_id` | uuid | 참조: workflows.id |
| `youtube_video_id` | text | 비디오 ID |
| `timeout_overrides` | jsonb | 액션별 timeout 오버라이드 |
| `status` | text | running / completed / failed |
| `created_at` | timestamptz | 생성 시간 |

### device_tasks

Run 내 각 기기별 작업을 저장합니다. 하나의 run은 여러 device_tasks를 가집니다.

| 열 | 타입 | 설명 |
|----|------|------|
| `id` | uuid | 기본 키 |
| `run_id` | uuid | 참조: runs.id |
| `node_id` | text | 노드 식별자 |
| `device_serial` | text | 기기 serial |
| `requires_manual_accessibility` | boolean | 접근 권한 필요 여부 |
| `status` | text | 실행 상태 |
| `created_at` | timestamptz | 생성 시간 |

### artifacts

스크린샷 및 실행 결과물을 저장합니다.

| 열 | 타입 | 설명 |
|----|------|------|
| `id` | uuid | 기본 키 |
| `run_id` | uuid | 참조: runs.id |
| `device_task_id` | uuid | 참조: device_tasks.id |
| `storage_path` | text | 스토리지 경로 |
| `artifact_type` | text | screenshot / log / etc |
| `created_at` | timestamptz | 생성 시간 |

---

## 스토리지 버킷

### 버킷 이름

`artifacts`

### 경로 구조

```
{youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png
```

**예시**:
```
dQw4w9WgXcQ/node-01/emulator-5554/550e8400-e29b-41d4-a716-446655440000/2025-02-08T10:30:00Z.png
```

### 접근 제어

- **쓰기**: `service_role` 키만 사용 (백엔드)
- **읽기**: 프론트엔드에서 서명된 URL 사용
- **주의**: 프론트엔드에서는 **절대** `service_role` 키를 사용하지 않습니다.

---

## Row Level Security (RLS) 규칙

### videos 테이블

| 정책 | 역할 | 조건 | 동작 |
|------|------|------|------|
| public_select | anon / auth | 제한 없음 | SELECT |
| service_insert | service_role | 제한 없음 | INSERT / UPDATE |

### workflows 테이블

| 정책 | 역할 | 조건 | 동작 |
|------|------|------|------|
| public_select | anon / auth | 제한 없음 | SELECT |
| service_insert | service_role | 제한 없음 | INSERT / UPDATE |

### runs 테이블

| 정책 | 역할 | 조건 | 동작 |
|------|------|------|------|
| auth_select | auth | 제한 없음 | SELECT |
| service_full | service_role | 제한 없음 | INSERT / UPDATE / DELETE |

### device_tasks 테이블

| 정책 | 역할 | 조건 | 동작 |
|------|------|------|------|
| auth_select | auth | 제한 없음 | SELECT |
| service_full | service_role | 제한 없음 | INSERT / UPDATE / DELETE |

### artifacts 테이블

| 정책 | 역할 | 조건 | 동작 |
|------|------|------|------|
| auth_select | auth | 제한 없음 | SELECT |
| service_insert | service_role | 제한 없음 | INSERT |

---

## 환경 변수

```env
# Supabase 연결
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 백엔드 (Node Agent)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 관련 문서

- [MVP_SETUP_CHECKLIST.md](../docs/MVP_SETUP_CHECKLIST.md)
- [Security-and-Setup-Checklist.md](../docs/Security-and-Setup-Checklist.md)
