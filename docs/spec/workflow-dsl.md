# 워크플로우 DSL (Canonical — Prometheus v1)

> **tags**: `workflow`, `dsl`, `prometheus`, `steps`, `timeout`, `params`, `preflight`, `bootstrap`, `template`
> **sources**: Prometheus-Workflow-DSL-v1, Workflow-Recipe-DSL-v1-QA, Workflow-Params-Injection
> **status**: canonical — 워크플로우 정의·실행·파라미터 주입은 이 문서를 따른다

---

## 1. 핵심 원칙

- **디바이스 1대 = 1 Workflow** 연속 실행. 작업을 쪼개서 큐에 넣기 금지.
- 디바이스 내부 순차 실행 기본 (MVP: 디바이스 내부 병렬 금지)
- 노드당 글로벌 슬롯 20대 동시, 디바이스별 FIFO 큐
- Workflow = `workflows` 테이블의 `definition_json`에 DSL로 저장

---

## 2. Step 정의

```json
{
  "id": "step-unique-id",
  "kind": "adb|vendor|js|upload|assert",
  "command": "adb shell input tap 500 300",
  "params": { "KEY": "{{VALUE}}" },
  "timeoutMs": 30000,
  "onFailure": "stop|continue|retry",
  "retryCount": 0,
  "ref": "command_asset_uuid (optional)"
}
```

### Step Kind

| kind | 용도 | 실행 |
|------|------|------|
| `adb` | ADB 셸 명령 | `adb -s {runtime_handle} shell ...` |
| `vendor` | 벤더 WS 액션 | Vendor Adapter 경유 (→ [vendor-adapter.md](vendor-adapter.md)) |
| `js` | AutoJS 스크립트 | 벤더 autojsCreate 또는 ADB 대체 |
| `upload` | 스크린샷 업로드 | 로컬 파일 → Supabase Storage |
| `assert` | 상태 확인 | 결과 기반 pass/fail 판정 |

### onFailure 동작

| 값 | 동작 |
|----|------|
| `stop` | 해당 디바이스 워크플로우 즉시 중단 |
| `continue` | 실패 기록 후 다음 step 진행 |
| `retry` | `retryCount`만큼 재시도 후 실패 시 onFailure 기본값 적용 |

### Timeout Bounds

| 범위 | 최소 | 최대 |
|------|------|------|
| Step | 5초 | 10분 |
| Global (전체 workflow) | 1분 | 30분 |

프론트엔드에서 per-step timeout override 가능. bounds 벗어나면 인라인 오류.

---

## 3. 3중 문지기 (Preflight)

실행 순서: **Emulator Health Gate → Device Preflight → Workflow Steps**
(Node Preflight는 주기/부팅 시 별도 실행)

### Emulator Health Gate

| 조건 | 확인 방법 |
|------|-----------|
| 에뮬레이터 프로세스 존재 | `adb devices`에 serial 노출 또는 프로세스 리스트 |
| ADB online | 기기 상태 = `device` |
| 부팅 완료 | `adb shell getprop sys.boot_completed` == 1 |

미통과 시: 자동 기동/재기동 → 안정화 대기(최대 60초) → 재검사. 실패 시 `emulator_not_online` 또는 `emulator_not_booted`.

### Device Preflight (매 run 직전, 10~20초)

| ADB 상태 | failure_reason |
|----------|----------------|
| unauthorized | `needs_usb_authorization` (fail-fast) |
| offline | `adb_offline` |
| missing | `adb_missing` |

### Node Preflight (주기/부팅 시)

- Vendor WS `ws://127.0.0.1:22222` 연결
- `action=list` 호출 성공 여부
- 결과를 heartbeat에 `vendor_ws_ok` 반영

---

## 4. Bootstrap Recipe (ADB)

표준 디바이스 초기화:
- locale/resolution/density 설정
- 애니메이션 끄기
- stay-awake 활성화
- Accessibility 서비스: ADB로 시도, 실패 시 manual fallback

---

## 5. 파라미터 주입 (Template Substitution)

### Run 생성 시

```json
POST /api/runs
{
  "workflow_id": "demo_20steps_v1",
  "params": { "QUERY": "sleep music", "VIDEO_PICK": "first_result" }
}
```

### Node 치환 규칙

1. `runs.params`를 workflow defaults와 병합
2. 런타임 자동 주입: `AUTO_SCREENSHOT_PATH` = `{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png`
3. Step 내용(inline_content/파일)의 `{{KEY}}` 치환
4. 미치환 키: 정책에 따라 step 실패 또는 기본값 사용

### ref를 통한 Command Library 참조

- step에 `ref` 필드가 있으면 → `command_assets` 테이블에서 조회
- `kind=adb`: `inline_content` 우선, 없으면 `storage_path` 다운로드
- `kind=js`: `storage_path` 다운로드 후 스크립트 엔진 전달
- `params` 치환은 내용 로드 후 적용
- 캐싱: `command_assets.updated_at` 기반 로컬 캐시 무효화

상세: [command-library.md](command-library.md)

---

## 6. Seed Workflows

| workflow_id | 용도 |
|-------------|------|
| `bootstrap_only_v1` | 디바이스 초기화만 |
| `login_settings_screenshot_v1` | 로그인 → 설정 → 스크린샷 |
| `demo_20steps_v1` | 20+ step 데모 (params 치환 포함) |

---

## 7. Storage 경로

```
{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png
```

예: `dQw4w9WgXcQ/PC-01/ABC123/run-uuid/1739012345.png`

---

## 8. Callback 모델 (요약)

- Node가 6종 이벤트를 Backend에 push
- `event_id` 기반 멱등성
- 디스크 큐 + 재시도 (1s→2s→5s→10s→30s, max 5~7회)
- 상세: [callback-contract.md](callback-contract.md)

---

## 9. 아키텍처 결정 (Q&A 요약)

| 결정 | 내용 |
|------|------|
| Vendor WS | 벤더 네이티브 프로토콜 사용; Minimal Adapter로 추상화 |
| device_id vs serial | `device_id`=onlySerial(DB키), `runtime_handle`=serial(실행대상) |
| WS Control | MVP는 polling; 추후 별도 WS 서버로 이전 |
| UI | 최소 변경; workflow dropdown + timeout override |
| API/CLI | UI가 늦으면 API/CLI로 run 생성 가능 |
| failure_reason | `device_tasks`에 표준값 저장 (enum) |
| 확률 실행 | seed=hash(run_id+device_id+step_id), 재현 가능 |
