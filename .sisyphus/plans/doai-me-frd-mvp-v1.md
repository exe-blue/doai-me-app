# DoAi.Me MVP v1 FRD — Work Plan

> **Scope**: FRD DoAi.Me MVP v1 구현. Command Library, Status Dashboard (Online/Offline), Run Monitor, Playbook(순서/확률), Scan Job, demo_20steps_v1 seed + params. UI 리디자인 제외.

---

## 1. Requirements Summary (FRD)

### 목적

컨텐츠 소비 여정 구현. MVP는 “사용자가 명령(스크립트)을 등록하고, 순서/조합/확률을 설정해, 다수 기기(OTG 100대)에서 순차 실행하고, 실행과 상태를 관측”하는 최소 제품.

### 포함(MVP)

| # | 항목 |
|---|------|
| 1 | Command Library: 스크립트 업로드/관리(ADB/JS/JSON/텍스트) + 폴더 + 제목/순서 |
| 2 | Status Dashboard: 기기 Online/Offline + 상세 패널(접속/최근응답/헬스) |
| 3 | Run Monitor: 진행률/주요 로그/마지막 스크린샷/기기 헬스 |
| 4 | Playbook: 여러 명령 선택 → 순서 → timeout/retry/onFailure/probability |
| 5 | 확률 실행: step별 probability, seed(run_id+device_id+step_id)로 재현 가능 |
| 6 | Scan Job: IP 대역 스캔 → 기기 자동 등록 |
| 7 | Seed: demo_20steps_v1 + Run params 치환 |

### 제외

- 기기 상태 세분화 UI (unauthorized/offline 등 배지). 내부 로그/진단 값은 보관 가능.
- 고급 개인화/추천/학습, 복잡한 권한.

### 개발 시작용 패키지 (이미 생성됨)

| 산출물 | 경로 |
|--------|------|
| DB DDL | `supabase/migrations/20250208600000_frd_mvp_schema.sql` |
| API 스키마 | `docs/API-Schema-FRD-v1.md` |
| Playbook JSON 스펙 | `docs/Playbook-JSON-Spec-v1.md` |

---

## 2. Acceptance Criteria (DoD)

- [ ] 랜딩/대시보드 배포 정상
- [ ] Command Library: 스크립트 업로드/목록/Playbook 생성 가능
- [ ] Playbook: 3개 명령 선택 → 순서 변경 → 실행 가능
- [ ] 확률 step이 Run Monitor에서 일부 디바이스 skip 확인 가능
- [ ] Status Dashboard: 기기 Online/Offline + 스캔 시작으로 등록 증가 확인
- [ ] Run Monitor: 디바이스별 step 진행/로그/스크린샷 확인 가능

---

## 3. 우선순위 제안 (개발 순서)

1. **demo_20steps_v1 seed + params 치환 + 실행 로그/아티팩트** (이미 seed/params 적용됨; Node 측 치환/run_step_results 콜백 연동)
2. **command_assets 업로드 API + 목록 API**
3. **Playbook builder (순서/확률 포함)** — DB + API + Playbook JSON 생성
4. **Run Monitor** — 로그/스크린샷/Offline 표시
5. **Status Dashboard + Scan Job**

---

## 4. Implementation Steps

### Phase 1: DB 및 API 기반

| Step | File(s) | Action |
|------|---------|--------|
| 1.1 | `supabase/migrations/20250208600000_frd_mvp_schema.sql` | 이미 생성. `supabase db push` 또는 migrate 적용 |
| 1.2 | `app/api/library/upload/route.ts` | POST multipart → Storage command-assets + command_assets 행 삽입 |
| 1.3 | `app/api/library/list/route.ts` | GET list (type, folder, q) |
| 1.4 | `app/api/playbooks/route.ts` | POST playbooks (name, steps[]) |
| 1.5 | `app/api/playbooks/[id]/route.ts` | GET / PATCH playbook |
| 1.6 | `app/api/runs/route.ts` | POST 시 playbook_id 지원 (workflow_id 또는 playbook_id) |
| 1.7 | `app/api/runs/[id]/steps/route.ts` | GET run_step_results (Run Monitor) |
| 1.8 | `app/api/runs/[id]/stop/route.ts` | POST stop |
| 1.9 | `app/api/devices/route.ts` | GET devices (online_only, node_id). Online = last_seen_at 임계 이내 |
| 1.10 | `app/api/nodes/scan/route.ts` | POST scan (ip_range, ports) → scan_jobs 생성, 백그라운드 스캔 |

### Phase 2: Node Agent

| Step | File(s) | Action |
|------|---------|--------|
| 2.1 | `node-agent` | pending-runs 응답에 playbook payload 포함 시 playbook JSON 해석 |
| 2.2 | `node-agent` | step.ref → command_assets 조회(또는 API) 후 내용 로드 |
| 2.3 | `node-agent` | probability 판정: seed=hash(run_id+device_id+step_id), skip 시 run_step_results에 skipped 콜백 |
| 2.4 | `node-agent` | run_step_results 업데이트 콜백 (step 시작/종료/로그/artifact) |

### Phase 3: Frontend (MVP)

| Step | File(s) | Action |
|------|---------|--------|
| 3.1 | Command Library 화면 | 업로드 폼 + 목록(검색/필터) + 폴더 |
| 3.2 | Playbook Builder | 스텝 선택 + 순서(drag/drop 또는 up/down) + timeout/retry/onFailure/probability |
| 3.3 | Status Dashboard | 기기 목록 Online/Offline + 상세 패널 + 스캔 시작 버튼 |
| 3.4 | Run Monitor | Run별 디바이스 진행률 + 로그 N줄 + 마지막 스크린샷 + Offline 표시 + Stop |

### Phase 4: Scan (백그라운드)

| Step | File(s) | Action |
|------|---------|--------|
| 4.1 | Scan worker 또는 API 내부 | ip_range/ports로 스캔 → scan_results 적재 → devices 테이블에 등록 |

---

## 5. References

- FRD (사용자 제공): 목적, 범위, 사용자 스토리, FR-CL, FR-SD, FR-RM, FR-NA, Seed 요구사항, DoD
- `docs/API-Schema-FRD-v1.md` — API 초안
- `docs/Playbook-JSON-Spec-v1.md` — 확률/step 스펙
- `docs/Workflow-Params-Injection.md` — params 치환
- `docs/Command-Library-MVP-Design.md` — command_assets / ref
- `docs/Minimal-Vendor-Adapter-Contract.md` — list, screen

---

## 6. Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Scan 대역이 크면 장시간 | scan_jobs 상태 + 진행 로그; 타임아웃 설정 |
| 확률 재현성 | seed = hash(run_id+device_id+step_id) 문서화 및 Node 구현 시 준수 |
| Playbook ↔ Workflow 이원화 | Run 생성 시 playbook이면 Playbook JSON으로 직렬화해 Node에 전달; Node는 steps 배열만 처리 |
