# Phase A: Emulator Health Gate + 2계층 Preflight — Work Plan

> **Scope**: Workflow Recipe DSL v1 유지, UI 대개편 없음. Preflight를 **2계층**으로 고정하고, 그 앞단에 **Emulator Health Gate**를 둔 3중 문지기 구조. Next.js App Router 백엔드 사용.

---

## 1. Requirements Summary

### 1.1 Preflight — 2계층 고정 + Emulator Gate

| 계층 | 시점 | 내용 | 실패 시 |
|------|------|------|--------|
| **Emulator Health Gate** | Device Preflight보다 앞단 | 에뮬레이터 구동 여부 체크. 통과 조건(최소): (1) 에뮬레이터 프로세스 존재 (2) ADB에서 online (3) 부팅 완료(boot_completed 또는 홈 화면 도달). 미통과 시 자동 기동/재기동 → 안정화 대기 → ADB online 확보 | Gate 통과 전까지 워크플로우 진입 불가 |
| **Device Preflight** | 매 run 시작 직전, 10~20초 | ADB 상태: device / unauthorized / offline / missing. unauthorized면 즉시 `needs_usb_authorization`으로 fail-fast | failure_reason 기록 후 종료 |
| **Node Preflight** | 노드 부팅 시 또는 주기 | 벤더 WS `ws://127.0.0.1:22222` 연결 가능, `action=list` 호출 성공 | 결과를 노드 상태(online/offline/vendor_ws_ok)로 보고 |

목표: "시작하자마자 터지는 실패"를 줄이기 위한 3중 문지기.

### 1.2 Vendor Adapter — MVP 최소 계약만

- **action=list** (기기 조회)
- **action=screen(savePath)** (스크린샷) — 로컬 저장 후 Supabase Storage 업로드 (문서 경로 템플릿: `{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png`)
- 입력/스크립트(autojsCreate 등): "가능하면 vendor, 아니면 ADB로 대체"
- **device_id** = onlySerial (DB/큐/불변 키). **runtime_handle** = serial (벤더/ADB 실행 대상). **절대 serial을 키로 쓰지 말 것** (연결 방식에 따라 ip:5555로 바뀔 수 있음)

참조: `docs/Minimal-Vendor-Adapter-Contract.md`, `docs/vendor-xiaowei-notes.md`

### 1.3 Workflow 원칙 (레포 DSL 문서)

- **20+ sequential commands = 한 개의 Workflow**로 실행. 대기열에 쪼개서 넣지 말고, **디바이스 1대에 대해 하나의 Workflow를 연속 실행**.
- 디바이스 내부는 **순차 실행** 기본 (MVP에서 디바이스 내부 병렬 금지).
- (운영 확장 시) 노드당 글로벌 슬롯 20대 동시, 디바이스별 FIFO 큐.

### 1.4 MVP 필수

- **Workflow seed 2개**: `bootstrap_only_v1`, `login_settings_screenshot_v1` (QA 문서 결정사항 그대로).
- **문서 명시**: UI가 늦으면 API/CLI로 run 생성해도 됨 (`docs/Workflow-Recipe-DSL-v1-QA.md` 등에 반영).

### 1.5 제외 (이번 MVP에서 빼기)

- UI 대개편 (no UI redesign, 최소 배선만).
- 복잡한 병렬 step (디바이스 내부 병렬 금지).
- 고급 벤더 기능 전체 흡수 (최소 계약만).

---

## 2. Acceptance Criteria (Phase A)

- [ ] **Emulator Health Gate** 구현: 에뮬레이터 프로세스 존재 여부, ADB online, 부팅 완료(boot_completed류 또는 홈 화면) 확인; 미통과 시 자동 기동/재기동 → 안정화 대기 → ADB online.
- [ ] **Node Preflight** 유지/보강: 벤더 WS 22222 + `action=list` 성공 시 노드 상태(online/offline/vendor_ws_ok)로 heartbeat에 보고.
- [ ] **Device Preflight** 유지: 매 run 직전 10~20초 내, unauthorized → `needs_usb_authorization` fail-fast; offline/missing → 해당 failure_reason 기록.
- [ ] 실행 순서: (선택 디바이스에 대해) Emulator Health Gate → Device Preflight → 워크플로우 스텝. Node Preflight는 주기/부팅 시 별도.
- [ ] 문서: Preflight 2계층 + Emulator Gate 구조, API/CLI run 생성 허용 문구 반영.

---

## 3. Implementation Steps (Phase A)

### Phase A1. Emulator Health Gate (신규)

| Step | File(s) | Action |
|------|---------|--------|
| A1.1 | `node-agent/src/emulatorGate.ts` (신규) | 에뮬레이터 구동 여부 체크: (1) 프로세스 존재 (2) ADB에서 해당 기기 online (3) boot_completed 또는 홈 화면 도달. 미통과 시 자동 기동/재기동(플랫폼별: adb emu 또는 AVD 목록에서 기동), 안정화 대기(폴링 또는 shell getprop sys.boot_completed), ADB online 확보. 반환: `{ ok: boolean; failure_reason?: string }`. |
| A1.2 | `node-agent/src/config.ts` (또는 .env) | (선택) 에뮬레이터 기동 관련 설정: AVD 이름, 타임아웃(안정화 대기 최대 N초). |
| A1.3 | `node-agent/src/workflowRunner.ts` | 워크플로우 실행 직전, 해당 device의 runtime_handle에 대해 Emulator Health Gate 호출; 통과 후에만 Device Preflight → Bootstrap 등 진행. Gate 실패 시 task 실패로 기록(failure_reason) 후 해당 디바이스 스킵. |

**Gate 통과 조건 요약**:
- 에뮬레이터 프로세스 존재 (예: `adb devices`에 해당 serial 노출되거나, 프로세스 리스트에 emulator 존재).
- ADB에서 해당 기기 상태가 `device` (online).
- 부팅 완료: `adb shell getprop sys.boot_completed` == 1 또는 홈 화면 도달 확인(간단히 boot_completed만 해도 MVP 가능).

**자동 기동**: 미통과 시 `emulator -list-avds` 등으로 AVD 확인 후 `emulator -avd <name>` 백그라운드 기동(또는 벤더/ADB 문서 참조). 안정화 대기 루프(예: 최대 60초) 후 재검사.

### Phase A2. Node Preflight (유지·보강)

| Step | File(s) | Action |
|------|---------|--------|
| A2.1 | `node-agent/src/vendorAdapter.ts` | `nodePreflight()` 유지: WS 22222 연결, `action=list` 호출 성공 시 `{ ok: true }`, 실패 시 `{ ok: false }`. (이미 구현됨) |
| A2.2 | `node-agent/src/index.ts` | 주기/부팅 시 Node Preflight 실행 결과를 heartbeat payload에 반영: `vendor_ws_ok: boolean`, 노드 상태 online/offline/degraded 결정. |
| A2.3 | `app/api/nodes/route.ts` | GET /api/nodes 응답에 `vendor_ws_ok` 등 노드 상태 필드 이미 있으면 유지. (현재 node_heartbeats.payload에서 사용 중) |

### Phase A3. Device Preflight (유지)

| Step | File(s) | Action |
|------|---------|--------|
| A3.1 | `node-agent/src/preflight.ts` | 현재 구현 유지: `devicePreflight(runtime_handle)` — adb devices 파싱, unauthorized → needs_usb_authorization, offline → adb_offline, missing → adb_missing. (이미 구현됨) |
| A3.2 | `node-agent/src/workflowRunner.ts` | Run 시작 시 Device Preflight 호출 순서 확정: **Emulator Health Gate 통과 → Device Preflight** 호출. Device Preflight 실패 시 즉시 failure_reason 기록, callback 전송, 해당 디바이스 워크플로우 종료. |

### Phase A4. Docs & API/CLI 명시

| Step | File(s) | Action |
|------|---------|--------|
| A4.1 | `docs/Workflow-Recipe-DSL-v1-QA.md` (또는 `docs/Prometheus-Workflow-DSL-v1.md`) | Preflight 섹션 보강: (1) Emulator Health Gate (에뮬레이터 구동·ADB online·부팅 완료), (2) Node Preflight (WS 22222, action=list, 노드 상태 보고), (3) Device Preflight (매 run 직전, 10~20초, unauthorized fail-fast). |
| A4.2 | `docs/Workflow-Recipe-DSL-v1-QA.md` | "UI가 늦으면 API/CLI로 run 생성해도 된다" 문구 명시 (Frontend 섹션에 이미 유사 내용 있으면 정리만). |
| A4.3 | `.cursor/rules/doai-me-orchestration-v1.md` | (선택) Phase A Gate/Preflight 구조 한 줄 요약 추가. |

---

## 4. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| 에뮬레이터 자동 기동이 OS/환경마다 다름 | 플랫폼별 분기(Windows/macOS/Linux); AVD 이름을 env로 받기; 타임아웃으로 무한 대기 방지. |
| boot_completed만으로는 홈 화면 미도달 가능 | MVP는 getprop sys.boot_completed == 1 만으로 통과 허용; 추후 "홈 화면 도달" 조건 추가 가능. |
| Gate 대기 시간이 run 타임아웃과 겹침 | PREFLIGHT 단계 타임아웃(기존 5s~10m)에 Gate 포함; 필요 시 PREFLIGHT 상한을 20초 이상으로 설정 가능. |

---

## 5. Verification Steps

1. `cd node-agent && npm run build` — Node Agent 빌드 성공.
2. (로컬) 벤더 WS 미기동 시 Node Preflight 실패 → heartbeat에 vendor_ws_ok false 반영 확인.
3. (로컬) 에뮬레이터 종료 상태에서 run 시작 → Emulator Health Gate가 기동 시도 또는 실패 반환 확인.
4. (로컬) ADB unauthorized 디바이스에 대해 run 시작 → Device Preflight에서 needs_usb_authorization 즉시 반환 확인.
5. `npm run build` — Next.js 빌드 성공 (API 변경 없을 수 있음).

---

## 6. File Checklist (Phase A)

| Path | Status |
|------|--------|
| `node-agent/src/emulatorGate.ts` | 신규 |
| `node-agent/src/config.ts` 또는 `.env.example` | 필요 시 확장 |
| `node-agent/src/workflowRunner.ts` | 수정 (Gate → Device Preflight 순서, Gate 실패 처리) |
| `node-agent/src/index.ts` | 수정 (heartbeat에 vendor_ws_ok 등 반영 확인) |
| `node-agent/src/preflight.ts` | 유지 (변경 없음 가능) |
| `node-agent/src/vendorAdapter.ts` | 유지 (변경 없음 가능) |
| `docs/Workflow-Recipe-DSL-v1-QA.md` 또는 `docs/Prometheus-Workflow-DSL-v1.md` | Preflight 3층 구조 + API/CLI run 생성 명시 |
| `.cursor/rules/doai-me-orchestration-v1.md` | 선택 보강 |

---

## 7. PR 계획 및 실행

1. **브랜치**: `feat/phase-a-emulator-gate-preflight` (또는 `feat/gates-and-preflight`) 생성.
2. **커밋**: Phase A 구현 (Emulator Health Gate, workflowRunner 순서, docs 보강).
3. **PR**: base `main` (또는 현재 통합 브랜치). 제목 예: `feat(node-agent): Emulator Health Gate + 2-layer Preflight (Phase A)`.
4. **설명**: 3중 문지기(Emulator Gate → Node Preflight → Device Preflight), 최소 계약·문서 명시 요약.

---

## 8. Execution Order

1. Phase A1 (Emulator Health Gate 신규).
2. Phase A3 (workflowRunner에서 Gate → Device Preflight 순서 및 Gate 실패 처리).
3. Phase A2 (Node Preflight 결과 heartbeat 반영 확인).
4. Phase A4 (Docs).
5. PR 생성 및 푸시.
