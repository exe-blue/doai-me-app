# DoAi.Me MVP — 문서 인덱스

> 개발 에이전트는 이 파일을 먼저 읽고, 태그로 필요한 문서를 즉시 찾는다.

---

## 구조

```
docs/
├── INDEX.md          ← 지금 이 파일
├── api/              ← API 명세 (구현/운영/디버깅용)
├── contracts/        ← 프로토콜 계약 (Node pull/callback 등)
├── spec/             ← 명세서 (구현 기준, "무엇을 만드는가")
├── guide/            ← 가이드 (절차, "어떻게 하는가")
├── arch/             ← 아키텍처 (설계 결정, "왜 이렇게 하는가")
├── qa/               ← QA/E2E (시나리오·장애 케이스·버그 템플릿·체크리스트)
└── plan/             ← 실행 계획 아카이브 (이력)
```

---

## 명세서 (spec/)

| 문서 | 태그 | 한줄 요약 |
|------|------|-----------|
| [api-contracts.md](spec/api-contracts.md) | `api` `rest` `runs` `workflows` `nodes` `callback` `devices` `library` `playbooks` `scan` | 전체 REST API 엔드포인트·요청·응답·DB 매핑 |
| [callback-contract.md](spec/callback-contract.md) | `callback` `node` `backend` `heartbeat` `event` `retry` `idempotency` | Backend↔Node 콜백 6종 이벤트·재시도·멱등성 |
| [workflow-dsl.md](spec/workflow-dsl.md) | `workflow` `dsl` `prometheus` `steps` `timeout` `params` `preflight` `bootstrap` `template` | Workflow 정의·실행·파라미터 주입·3중 Preflight |
| [playbook-spec.md](spec/playbook-spec.md) | `playbook` `probability` `steps` `command-assets` `seed` `execution` | Playbook JSON 스펙·확률 실행·ref 해석 |
| [vendor-adapter.md](spec/vendor-adapter.md) | `vendor` `xiaowei` `websocket` `list` `screen` `adb` `device` `serial` | 벤더 WS 최소 계약 (list/screen) + Xiaowei 정보 |
| [command-library.md](spec/command-library.md) | `command-library` `command-assets` `upload` `ref` `workflow-builder` `folder` `script` | 명령 라이브러리 데이터 모델·ref 참조·UX |
| [operator-console-pages.md](spec/operator-console-pages.md) | `operator` `console` `dashboard` `devices` `runs` `commands` `pages` | 운영자 콘솔 5페이지 기능·레이아웃·핵심 API + 코어 3가지 엔진 |

## API 명세 (api/)

| 문서 | 태그 | 한줄 요약 |
|------|------|-----------|
| [v0.1.md](api/v0.1.md) | `api` `rest` `dashboard` `nodes` `runs` `playbooks` `pull` `callback` `v0.1` | MVP REST API v0.1 — 공통 응답·에러 코드·Dashboard/Nodes/Runs/Playbooks/Node Protocol |

## 계약 (contracts/)

| 문서 | 태그 | 한줄 요약 |
|------|------|-----------|
| [node-protocol.md](contracts/node-protocol.md) | `node` `pull` `callback` `lease` `idempotency` | Node Pull & Callback 코어 계약만 (인증·멱등·lease_token) |

## 가이드 (guide/)

| 문서 | 태그 | 한줄 요약 |
|------|------|-----------|
| [deploy.md](guide/deploy.md) | `deploy` `vercel` `404` `middleware` `domain` `health` `baseline` | 배포 도메인·Deploy Gate·Vercel 404 진단·Middleware 규칙 |
| [setup.md](guide/setup.md) | `setup` `env` `supabase` `node-agent` `secret` `key-rotation` `security` | 환경변수·Supabase·키 회전·노드 PC 요구사항 |
| [v0-integration.md](guide/v0-integration.md) | `v0` `ui` `integration` `landing` `frontend` `cta` `glossary` | v0 코드 통합 절차·DoAi.Me 용어·랜딩 CTA |
| [code-quality.md](guide/code-quality.md) | `sonar` `complexity` `refactor` `s3776` `s2004` | SonarQube 이슈별 선택지·리팩터 가이드 |
| [node-runner-windows-packaging.md](guide/node-runner-windows-packaging.md) | `node-runner` `windows` `exe` `winsw` `service` `release` `update.ps1` | Node Runner exe 빌드·WinSW 서비스·GitHub Release·update.ps1 핸드오프 |
| [node-runner-exe-build-points.md](guide/node-runner-exe-build-points.md) | `node-runner` `exe` `pkg` `cjs` `tsup` `actions` | exe 빌드 정확한 수정 포인트: 엔트리 경로·CJS 번들·워크플로 pkg 단계 치환 |
| [mvp-api-execution-consistency.md](guide/mvp-api-execution-consistency.md) | `mvp` `xiaowei` `node-runner` `callback` `command_catalogs` `acceptance` | **Canonical** MVP API/실행 정합성·Xiaowei 액션·노드 부팅·체크 순서 5단계·수용 기준 |

## QA / E2E (qa/)

| 문서 | 태그 | 한줄 요약 |
|------|------|-----------|
| [e2e-scenarios.md](qa/e2e-scenarios.md) | `e2e` `scenario` `lease` `callback` `duplicate` `node-death` | E2E 1사이클 + 장애 시나리오 3개(중복 pull, 노드 죽음, 늦은 callback) |
| [bug-report-template.md](qa/bug-report-template.md) | `bug` `template` `repro` `logs` | 재현/기대/실제/로그/스크린샷 포함 버그 제보 템플릿 |
| [todays-pass-checklist.md](qa/todays-pass-checklist.md) | `checklist` `pass` `release` | 오늘의 통과 조건 — 배포/머지 전 체크리스트 |
| [gap-list-pages-vs-apis.md](qa/gap-list-pages-vs-apis.md) | `gap` `pages` `api` `ui` | 페이지 vs 미반영 핵심 기능/API 갭 리스트 (우선순위·QA 기준) |

## 아키텍처 (arch/)

| 문서 | 태그 | 한줄 요약 |
|------|------|-----------|
| [architecture-single-line-and-phases.md](arch/architecture-single-line-and-phases.md) | `architecture` `outbound` `adapters` `phase-a` `phase-b` `phase-c` `consistency` | **Canonical** 구조 한 문장(웹↛노드)·4어댑터·Phase A/B/C·에이전트 지시문·수용테스트 |
| [orchestration.md](arch/orchestration.md) | `orchestration` `node-agent` `scheduler` `fifo` `concurrency` `device` `workflow` `callback` `storage` `logging` `offline` `grace` | **CRITICAL** 실행 아키텍처·스케줄러·인증·Offline 처리·로깅 |
| [frd.md](arch/frd.md) | `frd` `requirements` `command-library` `status-dashboard` `run-monitor` `playbook` `scan` `probability` | MVP 기능 요구사항·범위·수용 기준 |

## 실행 계획 (plan/)

| 문서 | 한줄 요약 |
|------|-----------|
| [_ARCHIVE.md](plan/_ARCHIVE.md) | .sisyphus/plans 인덱스·PR 이력·상태 추적 |

---

## 빠른 검색 (키워드 → 문서)

| 키워드 | 문서 |
|--------|------|
| API 명세 v0.1 (구현/운영/디버깅) | [api/v0.1.md](api/v0.1.md) |
| Node Pull/Callback 계약만 | [contracts/node-protocol.md](contracts/node-protocol.md) |
| 페이지 vs API 갭 리스트 | [qa/gap-list-pages-vs-apis.md](qa/gap-list-pages-vs-apis.md) |
| 운영자 콘솔 페이지 맵 / 대시보드·기기·runs·명령 | [spec/operator-console-pages.md](spec/operator-console-pages.md) |
| API 엔드포인트 구현 | [spec/api-contracts.md](spec/api-contracts.md) |
| 콜백 이벤트 타입 | [spec/callback-contract.md](spec/callback-contract.md) |
| 워크플로우 step 추가 | [spec/workflow-dsl.md](spec/workflow-dsl.md) |
| 파라미터 치환 `{{KEY}}` | [spec/workflow-dsl.md](spec/workflow-dsl.md) §5 |
| Preflight / Gate | [spec/workflow-dsl.md](spec/workflow-dsl.md) §3 |
| Playbook 확률 실행 | [spec/playbook-spec.md](spec/playbook-spec.md) |
| 벤더 WS 연동 | [spec/vendor-adapter.md](spec/vendor-adapter.md) |
| command_assets / ref | [spec/command-library.md](spec/command-library.md) |
| device_id vs serial | [spec/vendor-adapter.md](spec/vendor-adapter.md) §디바이스 식별 |
| 배포 / 404 | [guide/deploy.md](guide/deploy.md) |
| 환경변수 / .env | [guide/setup.md](guide/setup.md) |
| 키 회전 | [guide/setup.md](guide/setup.md) §5 |
| Node Runner Windows exe/서비스/릴리즈 | [guide/node-runner-windows-packaging.md](guide/node-runner-windows-packaging.md) |
| v0 UI 통합 | [guide/v0-integration.md](guide/v0-integration.md) |
| 오케스트레이션 전체 | [arch/orchestration.md](arch/orchestration.md) |
| FRD / 요구사항 | [arch/frd.md](arch/frd.md) |
| E2E 시나리오 / 장애 케이스 | [qa/e2e-scenarios.md](qa/e2e-scenarios.md) |
| 버그 제보 템플릿 | [qa/bug-report-template.md](qa/bug-report-template.md) |
| 오늘의 통과 조건 체크리스트 | [qa/todays-pass-checklist.md](qa/todays-pass-checklist.md) |
| 동시성 / FIFO / 스케줄러 | [arch/orchestration.md](arch/orchestration.md) §1 |
| Storage 경로 | [arch/orchestration.md](arch/orchestration.md) §5 |
| 로깅 규칙 | [arch/orchestration.md](arch/orchestration.md) §7 |
| Node Agent 아키텍처 | [arch/orchestration.md](arch/orchestration.md) §1 |
| Supabase 스키마 | [spec/api-contracts.md](spec/api-contracts.md) §9 |
| 실행 계획 이력 | [plan/_ARCHIVE.md](plan/_ARCHIVE.md) |
| Offline / grace 처리 | [arch/orchestration.md](arch/orchestration.md) §8 |
| SonarQube / 리팩터 | [guide/code-quality.md](guide/code-quality.md) |

---

## 규칙 (Rule Files)

| 위치 | 용도 |
|------|------|
| `.cursor/rules/doai-me-orchestration-v1.md` | 에이전트용 오케스트레이션 요약 → [arch/orchestration.md](arch/orchestration.md) |
| `.cursor/rules/deploy-frontend-baseline.md` | 배포 기준선 → [guide/deploy.md](guide/deploy.md) |
| `.cursor/rules/v0-integration.md` | v0 통합 규칙 → [guide/v0-integration.md](guide/v0-integration.md) |
| `.cursor/rules/sisyphus-default-global.md` | Sisyphus 플러그인 설정 (외부) |
| `.cursor/agents/deploy-gate.md` | Deploy Gate 검증 에이전트 |
