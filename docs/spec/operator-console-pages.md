# 운영자 콘솔 — 제공 페이지 맵

> 운영자가 매일 쓰는 콘솔 페이지별 기능·레이아웃·핵심 API 정리. 문서화/핸드오프/QA 기준점.

---

## 1) 대시보드 `/`

| 항목 | 내용 |
|------|------|
| **무엇을 하는가** | 지난 24시간 기준으로 "지금 시스템이 잘 돌고 있는지"를 한 화면에서 요약. 노드(PC-01~) 단위 미니맵 + 전체 KPI + 시간대별 실행/실패 흐름. |
| **레이아웃 주안점** | "즉시성" 최우선: 첫 화면 5초 안에 상태 판단 가능. 전체 보기(Overview) 중심, 클릭하면 `/devices`, `/runs`로 내려가기(drill-down). |

**핵심 API/기능 3가지**

1. `GET /api/dashboard?window=24h`
2. 노드별 미니맵(노드 전환/hover focus + 100슬롯 고정)
3. To-do(오프라인/실패/주의 항목) → 바로 이동 링크

---

## 2) 기기 `/devices`

| 항목 | 내용 |
|------|------|
| **무엇을 하는가** | OTG/내부망 환경에서 "온라인/오프라인"만 단순하게 보고, 문제 기기를 빠르게 찾는 화면. 노드별 필터/전환 + 타일(인덱스) 클릭 → 우측 상세. |
| **레이아웃 주안점** | 탐색 속도: 100대(또는 노드 여러 개) 중 죽은 애를 즉시 찾기. 중앙: 타일(항상 100칸, 빈칸 포함). 우측: 선택 기기 상세(최근 스샷/최근 에러/last_seen). |

**핵심 API/기능 3가지**

1. `GET /api/nodes/status` (또는 노드 단위 상태 API)
2. `/devices?node=...&sel=...` 딥링크로 바로 선택 상태 복원
3. (선택) `POST /api/nodes/scan`로 자동 등록/갱신 트리거

---

## 3) 실행 목록 `/runs`

| 항목 | 내용 |
|------|------|
| **무엇을 하는가** | 최근 Run들의 상태를 보고, 실패/진행 중인 Run을 빠르게 들어가는 "인덱스". |
| **레이아웃 주안점** | 리스트의 정보 밀도: status + 카운트(running/done/error/offline skip)만 딱. 클릭 1번으로 상세 모니터(`/runs/[runId]`) 진입. |

**핵심 API/기능 3가지**

1. `GET /api/runs?window=24h&status=...`
2. Run별 집계(counts) 표시 규칙 고정
3. 실패/중단 Run을 우선 노출하는 기본 정렬

---

## 4) 실행 모니터 `/runs/[runId]`

| 항목 | 내용 |
|------|------|
| **무엇을 하는가** | "지금 실제로 실행이 진행되는 장면"을 보는 화면. 어떤 디바이스가 어디서 멈췄는지(스텝/로그/스크린샷) 즉시 파악. |
| **레이아웃 주안점** | 중앙: 히트맵(노드 또는 전체). 우측: 선택 디바이스 "현재 스텝 + 로그 tail + 마지막 스샷". 멈추지 않는 실행이 핵심: offline/무응답은 기다렸다가 다음 디바이스로 넘어감. |

**핵심 API/기능 3가지**

1. `GET /api/runs/:runId` (heatmap + selected + logs_tail + last_artifacts)
2. `POST /api/runs/:runId/stop` (운영자 제어)
3. 상태 전이 규칙(lease_token/멱등 callback 기반)이 UI에 즉시 반영

---

## 5) 명령 `/commands`

| 항목 | 내용 |
|------|------|
| **무엇을 하는가** | "명령 라이브러리(Atomic)"를 보고 선택해서, 순서/확률/타임아웃/재시도 조합으로 플레이북을 만드는 화면. 저장 또는 즉시 실행. |
| **레이아웃 주안점** | 중앙: 명령 테이블(검색/폴더/타입: adb/js/vendor/json). 우측: Builder(선택 명령의 순서, 확률, 기본 실패 정책). "중복 없는 조합"을 위해 기기 기본세팅 PB_BASE는 프리셋으로 분리해서 맨 앞 1회만. |

**핵심 API/기능 3가지**

1. `POST /api/playbooks`, `GET /api/playbooks/:id`
2. `POST /api/runs` (playbook/workflow 실행)
3. command_assets(업로드/폴더/버전) 기반 ref resolve

---

## 시스템 전체 — 가장 중요한 코어 3가지

페이지가 많아 보여도, MVP에서 실제로 돌아가게 하는 엔진은 아래 3개다.

| # | 엔진 | 설명 |
|---|------|------|
| 1 | **작업 할당 엔진** | `fn_pull_job` + lease(lease_owner / lease_until / lease_token) |
| 2 | **노드 실행 루프** | 노드가 pull → execute → callback (outbound only) |
| 3 | **관측/모니터링** | callback 멱등(node_events) + artifacts(스크린샷) + logs tail |

---

## 참고

- API 상세: [api-contracts.md](api-contracts.md)
- 콜백/멱등: [callback-contract.md](callback-contract.md)
- E2E/QA 기준: [../qa/e2e-scenarios.md](../qa/e2e-scenarios.md), [../qa/todays-pass-checklist.md](../qa/todays-pass-checklist.md)
