# Workflow Recipe DSL v1 — 확정 Q&A (결정사항)

> **CRITICAL**: 이 문서의 답변은 프로젝트 기준 확정 결정사항이다. 개발 에이전트가 참조한다.

---

## Vendor WS protocol

**Q**: ws://127.0.0.1:22222 API 문서가 있나? 없으면 최소 계약을 정의할까?

**A**: 문서가 있고(우리가 이미 list, screen 성공 검증), WS 프로토콜은 벤더 스펙을 그대로 사용한다. 다만 우리 시스템 관점에서 **Minimal Vendor Adapter Contract**는 정의한다.

- 벤더 쪽에 의존하는 최소 액션:
  - `action=list` (기기 조회)
  - `action=screen` (savePath 포함)
  - (선택) autojsCreate 또는 입력 관련 액션은 "가능하면 사용", 안 되면 ADB로 대체
- 즉, "벤더 프로토콜을 새로 정의"하는 게 아니라, **노드 에이전트가 따라야 하는 최소 사용 규칙(어댑터 규약)**을 문서로 고정한다.

---

## onlySerial vs serial

**Q**: onlySerial이 vendor list의 serial과 동일인가, 정규화된 값인가?

**A**: onlySerial을 우리 시스템의 device_id로 고정하고, serial은 runtime handle로만 사용한다.

- `device_id` = onlySerial (불변 식별자, DB 기본키/큐 키)
- `runtime_handle` = serial (벤더 devices 파라미터/ADB -s 대상으로 사용)
- 정규화/가공은 하지 않는다(원문 그대로 저장).
- 같은 기기라도 연결 방식에 따라 serial이 `ip:5555` 형태로 바뀔 수 있으니, serial을 키로 쓰면 안 된다.

---

## Preflight scope

**Q**: Preflight는 adb unauthorized만 확인? 아니면 USB 연결/벤더 WS도 확인?

**A**: Preflight는 "빠른 실패를 위한 게이트"로 **2계층**으로 고정하고, 그 **앞단에 Emulator Health Gate**를 둔 **3중 문지기** 구조다.

### 0. Emulator Health Gate (Device Preflight보다 앞단)

- **통과 조건(최소)**: (1) 에뮬레이터 프로세스 존재 (2) ADB에서 해당 기기 online (3) 부팅 완료(`sys.boot_completed` 또는 홈 화면 도달).
- 미통과 시: 자동 기동/재기동(선택, env `EMULATOR_AVD` 등) → 안정화 대기 → ADB online 확보. 통과 전까지 워크플로우 진입 불가.
- 실패 시 `failure_reason`: `emulator_not_online`, `emulator_not_booted` 등.

### 1. Device Preflight (필수, 매 run 직전 10~20초)

- ADB 상태 확인: `device` / `unauthorized` / `offline` / `missing`
- unauthorized면 즉시 `needs_usb_authorization`으로 fail-fast

### 2. Node Preflight (필수, 부팅 시 또는 주기)

- 벤더 WS `ws://127.0.0.1:22222` 연결 가능 여부, `action=list` 호출 성공 여부
- 이 결과를 노드 상태(online/offline/vendor_ws_ok)로 heartbeat에 보고

**정리하면**:

- 실행 순서: **Emulator Health Gate → Device Preflight → 워크플로우 스텝**. Node Preflight는 주기/부팅 시 별도.
- 디바이스 작업 시작 직전에는 "에뮬레이터 구동·ADB online·부팅 완료" → "adb unauthorized/offline" 순으로 확인.
- 노드 전체 관점으로는 "벤더 WS/list 가능"을 heartbeat에 포함.

---

## Default workflow

**Q**: Supabase에 기본 workflow를 seed할까, 아니면 외부에서 생성?

**A**: seed 한다. MVP는 "표준 레시피"가 있어야 운영이 된다.

- 최소 seed 2개:
  1. `bootstrap_only_v1`
  2. `login_settings_screenshot_v1`
- Supabase에 workflows 테이블을 만들고, 초기 마이그레이션/seed 스크립트(한 번 실행)로 등록한다.
- 이후 UI에서 workflow를 "선택"하고 timeout override만 조절하도록 한다.

---

## Frontend ("no UI redesign")

**Q**: Run 생성 폼만 workflow_id + timeout_overrides 연결? UI는 그대로?

**A**: **UI는 그대로 두고, "필수 입력만 최소로 배선"**한다.

- 기존 UI 변경 최소화
- 해야 할 것:
  - workflow 선택 dropdown (또는 기본값 자동 선택)
  - timeout overrides는 "고급 옵션"으로 숨기고 기본값 사용 가능
- **UI가 늦으면 API/CLI로 run 생성해도 된다.** MVP에서는 백엔드 `POST /api/runs`(POSTman/CLI)로 run 생성 가능; 프론트는 조회·최소 배선 중심으로 둔다.

---

## Callback API shape

**Q**: 단일 endpoint vs 이벤트별 endpoint?

**A**: 단일 endpoint 권장: `POST /api/nodes/callback`

**이유**:

- 노드 구현이 단순해짐(전송 로직 1개)
- 서버는 type으로 라우팅 처리
- 멱등성(event_id) 적용도 쉬움

**추가로**:

- 컨트롤 채널은 "노드→서버 WebSocket 연결 유지"를 추천(서버→노드 인바운드 없이 run_start 전달).

---

## failure_reason storage

**Q**: device_tasks에 failure_reason 컬럼을 둘까?

**A**: 반드시 둔다. 운영에서 제일 중요한 진단 필드다.

- `device_tasks.failure_reason` (enum/string)
  - `emulator_not_online`, `emulator_not_booted` (Emulator Health Gate)
  - `needs_usb_authorization`, `adb_offline`, `adb_missing` (Device Preflight)
  - `vendor_ws_error`
  - `timeout`
  - `upload_error`
  - … 등 표준값 사용
- 추가로 `error_message`(짧은 텍스트)도 둔다.

---

## 다음 문서 예정

- **API Contracts v1**:
  - POST /api/runs (workflow_id, timeoutOverrides 포함)
  - POST /api/nodes/callback (event schema + idempotency)
  - GET /api/runs/:id (집계)
  - WS /api/nodes/control (run_start 이벤트)
- 현재 레포에 맞춘 엔드포인트 이름/경로도 함께 고정 예정
