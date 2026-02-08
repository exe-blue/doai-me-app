# 실행 계획 아카이브

> **tags**: `plan`, `archive`, `sisyphus`, `pr`
> **status**: 참조용 — 실행 계획의 이력 및 상태 추적

---

## .sisyphus/plans/ 인덱스

| 계획서 | 상태 | 요약 |
|--------|------|------|
| `workflow-recipe-dsl-v1.md` | ✅ 완료 | Workflow DSL v1 전체 구현 (Schema → API → Node → Frontend → Docs) |
| `phase-a-gates-and-preflight.md` | ✅ 완료 | Emulator Health Gate + 2계층 Preflight 구현 |
| `phase-a-qa-report.md` | ✅ 완료 | Phase A QA 검증 리포트 (5/5 통과) |
| `api-routes-and-pr.md` | ✅ 완료 | API Routes 정렬 + PR 계획 |
| `doai-me-frd-mvp-v1.md` | 진행 | FRD MVP v1 구현 플랜 (Command Library, Playbook, Scan 등) |

---

## MVP PR 순서 (참조)

| PR | 목표 | 상태 |
|----|------|------|
| PR-1 | Emulator Health Gate | ✅ |
| PR-2 | Preflight 2계층 | ✅ |
| PR-3 | Vendor Adapter (list/screen) | ✅ |
| PR-4 | Workflow Runner (DSL v1) + 20+ sequential | ✅ |
| PR-5 | Observability (로그/failure_reason/screenshot) | ✅ |
| PR-6 | Seed workflows + demo_20steps_v1 | ✅ |
| FRD | Command Library + Playbook + Status + Scan | 진행 |

---

## 관련 문서

- 오케스트레이션: [../arch/orchestration.md](../arch/orchestration.md)
- API: [../spec/api-contracts.md](../spec/api-contracts.md)
- FRD: [../arch/frd.md](../arch/frd.md)