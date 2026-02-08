# 명령 라이브러리 설계 (Canonical)

> **tags**: `command-library`, `command-assets`, `upload`, `ref`, `workflow-builder`, `folder`, `script`
> **sources**: Command-Library-MVP-Design
> **status**: canonical — Command Library 구현은 이 문서를 따른다

---

## 데이터 모델: command_assets

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| kind | enum | `adb`, `js`, `vendor`, `assert` |
| title | text | 표시명 |
| description | text | 설명 (선택) |
| storage_path | text | 파일 업로드 시 Storage 경로 |
| inline_content | text | 짧은 adb one-liner 등 인라인 |
| default_timeout_ms | int | 기본 타임아웃 |
| folder | text | UI용 폴더 라벨 (파일시스템 아님) |
| tags | text[] | 검색/필터용 |
| created_at, updated_at | timestamptz | |

**제약**: `storage_path` 또는 `inline_content` 중 하나는 반드시 존재.

---

## Workflow step에서 참조 (ref)

기존 inline `command`/`script` 외에 `ref`로 라이브러리 참조 가능:

```json
{ "id": "type-query", "kind": "adb", "ref": "cmd_yt_type_query", "params": { "QUERY": "{{QUERY}}" } }
```

- `ref` = command_assets.id (uuid)
- Node가 ref로 command_assets 조회 → 내용 로드 → params 치환 후 실행
- 기존 inline 방식과 공존 (ref 없으면 command/script 직접 사용)

---

## Node Agent 실행 흐름

1. step에 `ref` 있음 → command_assets 조회
2. **kind=adb**: inline_content 우선, 없으면 storage_path 다운로드 → params 치환 → 실행
3. **kind=js**: storage_path 다운로드 → autojsCreate/벤더 규약
4. **kind=vendor**: action + params → Vendor Adapter
5. **캐싱**: `updated_at` 기반 로컬 캐시 무효화

---

## 프론트엔드 UX (MVP)

### 라이브러리 페이지 (`/dashboard/library`)

- **업로드**: 파일 등록 (ADB/JS). kind, 제목, 설명, 기본 타임아웃, 폴더
- **목록**: 테이블 (검색/필터 by kind, folder). 제목, kind, 폴더, 수정일
- **폴더**: DB `folder` 필드 기반 (파일시스템 아님)

### 워크플로우 빌더 (간단)

- 라이브러리에서 선택 → step 추가 (ref = asset id)
- 순서 변경 (drag/drop)
- 스텝별 onFailure, retryCount, timeout 입력
- 저장 → definition_json 생성

---

## 관련 문서

- API: [api-contracts.md](api-contracts.md) §5 Command Library
- Playbook: [playbook-spec.md](playbook-spec.md)
- DSL: [workflow-dsl.md](workflow-dsl.md)
- 마이그레이션: `supabase/migrations/20250208500000_command_assets.sql`
