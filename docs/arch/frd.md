# FRD: DoAi.Me MVP v1 (Canonical)

> **tags**: `frd`, `requirements`, `command-library`, `status-dashboard`, `run-monitor`, `playbook`, `scan`, `probability`
> **sources**: FRD-DoAi-Me-MVP-v1
> **status**: canonical — MVP 기능 요구사항 기준 문서

---

## 목적

컨텐츠 소비 여정 구현. MVP = "사용자가 명령을 등록하고, 순서/조합/확률을 설정해, 다수 기기(OTG 100대)에서 순차 실행하고, 실행과 상태를 관측"하는 최소 제품.

---

## 범위

### 포함 (MVP)

| # | 항목 | 상세 |
|---|------|------|
| 1 | Command Library | 스크립트 업로드/관리 + 폴더 + 제목/순서 |
| 2 | Status Dashboard | 기기 Online/Offline + 상세 패널 |
| 3 | Run Monitor | 진행률/로그/스크린샷/헬스 |
| 4 | Playbook | 명령 선택 → 순서 → timeout/retry/onFailure/probability |
| 5 | 확률 실행 | seed=hash(run_id+device_id+step_id) 재현 가능 |
| 6 | Scan Job | IP 대역 스캔 → 기기 자동 등록 |
| 7 | Seed | demo_20steps_v1 + Run params 치환 |

### 제외

- 기기 상태 세분화 UI (내부 로그/진단은 보관)
- 고급 개인화/추천/학습, 복잡한 권한

---

## 페르소나

| 역할 | 설명 |
|------|------|
| Operator | 기기군 관리, 스캔/실행/문제 확인 |
| Builder | 명령 업로드, 조합/확률 설계 |
| Observer | 실행 과정·결과 모니터링 |

---

## 수용 기준 (DoD)

- 랜딩/대시보드 배포 정상
- Command Library 업로드/목록/Playbook 생성 가능
- Playbook 3개 명령 → 순서 변경 → 실행 가능
- 확률 step이 일부 디바이스 skip 확인 가능
- Status Dashboard Online/Offline + 스캔 등록 증가
- Run Monitor 디바이스별 step/로그/스크린샷 확인 가능

---

## 개발 패키지

| 산출물 | 경로 |
|--------|------|
| DB DDL | `supabase/migrations/20250208600000_frd_mvp_schema.sql` |
| API 스키마 | [../spec/api-contracts.md](../spec/api-contracts.md) |
| Playbook 스펙 | [../spec/playbook-spec.md](../spec/playbook-spec.md) |
| 명령 라이브러리 | [../spec/command-library.md](../spec/command-library.md) |
| 구현 플랜 | `.sisyphus/plans/doai-me-frd-mvp-v1.md` |

---

## 관련 문서

- 오케스트레이션: [orchestration.md](orchestration.md)
- Workflow DSL: [../spec/workflow-dsl.md](../spec/workflow-dsl.md)