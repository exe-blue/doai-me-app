# Prometheus: Workflow DSL v1 — 명령 레시피 + 모듈 조합 + 연결 실행

> **핵심**: 대기열에 여러 작업을 따로 넣지 말고, 디바이스 1대에 대해 **하나의 Workflow**를 한 번에 실행한다.

---

## 1. Workflow 모델

- **노드당 ~100 디바이스**, **동시 20대** (글로벌 슬롯).
- **디바이스 전용 FIFO 큐**: 각 디바이스마다 별도 큐. 동일 디바이스에서 동시 작업 금지.
- **글로벌 스케줄러**: 20 슬롯 즉시 채움; 하나 끝나면 바로 다음 디바이스 시작. eligible device 큐 간 **round-robin**.
- 디바이스 1대가 슬롯을 점유하면 → **ADB bootstrap → 앱 실행 → 접근성 로그인 → 설정 → 스크린샷 → 업로드 → report**를 **연속 실행**
- **금지**: 한 논리 플로우를 여러 개의 큐 작업으로 분할

---

## 2. 저장/재사용 (Recipe)

| 테이블 | 용도 |
|--------|------|
| `workflows` | workflow_id, name, version, description, definition_json (DSL) |
| `runs.workflow_id` | 어떤 workflow로 실행했는지 추적 |
| `runs.timeout_overrides` | 프론트에서 step별 timeout override |
| `runs.global_timeout_ms` | 전체 workflow 상한 (옵션) |

---

## 3. DSL (definition_json)

```json
{
  "steps": [
    {
      "id": "bootstrap",
      "kind": "adb",
      "command": "settings put global window_animation_scale 0",
      "timeoutMs": 5000,
      "onFailure": "stop"
    },
    {
      "id": "stay-awake",
      "kind": "adb",
      "command": "settings put global stay_on_while_plugged_in 7",
      "timeoutMs": 5000,
      "onFailure": "continue"
    },
    {
      "id": "try-accessibility",
      "kind": "adb",
      "command": "adb shell settings put secure enabled_accessibility_services ...",
      "timeoutMs": 10000,
      "onFailure": "continue",
      "onFailureSetRequiresManualAccessibility": true
    },
    {
      "id": "launch-app",
      "kind": "vendor",
      "action": "launch",
      "params": { "package": "com.example.app" },
      "timeoutMs": 15000,
      "onFailure": "retry",
      "retryCount": 2
    },
    {
      "id": "login",
      "kind": "js",
      "script": "autojsCreate",
      "params": { "id": "login-flow" },
      "timeoutMs": 60000,
      "onFailure": "stop"
    },
    {
      "id": "screenshot",
      "kind": "vendor",
      "action": "screenshot",
      "timeoutMs": 10000,
      "onFailure": "retry",
      "retryCount": 1
    },
    {
      "id": "upload",
      "kind": "upload",
      "source": "screenshot",
      "timeoutMs": 30000,
      "onFailure": "retry",
      "retryCount": 2
    }
  ],
  "defaultStepTimeoutMs": 30000,
  "defaultOnFailure": "stop"
}
```

### step.kind

| kind | 설명 |
|------|------|
| `adb` | adb shell / adb command |
| `vendor` | 벤더 WS action (launch, screenshot 등) |
| `js` | autojsCreate 같은 스크립트 실행 |
| `upload` | 파일 업로드 (Supabase Storage) |
| `assert` | 조건 체크 (선택) |

### onFailure

| 값 | 동작 |
|----|------|
| `stop` | 해당 디바이스 failed, workflow 종료 |
| `continue` | 실패 무시, 다음 step 진행 |
| `retry` | retryCount 만큼 재시도 후 stop |

### onFailureSetRequiresManualAccessibility

- `true`면: adb로 접근성 활성화 실패 시 `device_tasks.requires_manual_accessibility=true`로 표기
- 운영자가 수동 설정 후 진행 가능

---

## 4. 병렬 규칙

| 레벨 | 규칙 |
|------|------|
| **디바이스 간** | 노드당 최대 20대 동시 (글로벌 슬롯) |
| **디바이스 내부** | **순차 실행** 기본. 병렬은 "진짜 안전한 것만" 제한적 허용 |

- "병렬 때문에 하나 끝나고 대기" 문제 → 작업을 잘게 쪼개서 큐에 넣는 구조에서 발생
- **Workflow로 묶으면 해결**: 한 디바이스에서 한 Workflow가 끝날 때까지 슬롯 점유

---

## 5. 타임아웃 (프론트 Override)

Run 생성 시:

```json
{
  "workflow_id": "uuid",
  "youtube_video_id": "dQw4w9WgXcQ",
  "timeoutOverrides": {
    "screenshot": 15000,
    "upload": 45000
  },
  "globalTimeoutMs": 600000
}
```

- **timeoutOverrides**: `stepId` 또는 `stepKind` → timeoutMs
- **globalTimeoutMs**: 전체 workflow 상한 (1분~30분, MVP 권장 10분)

### Node Agent

- step별 timeout 적용
- timeout 발생 시 해당 디바이스만 failed, 다른 디바이스는 계속 (fail-soft)

### 권장 상한

| 항목 | 범위 |
|------|------|
| step timeout | 5초 ~ 10분 |
| 전체 workflow | 1분 ~ 30분 (MVP: 10분) |

---

## 6. ADB Bootstrap 레시피 (부트스트랩)

워크플로우 첫 단계로 고정. locale/resolution/density/animations/stay-awake 표준화. 기기별 1회 캐싱 가능.

| 항목 | 내용 |
|------|------|
| 애니메이션 off | `window_animation_scale 0` |
| Stay awake | `stay_on_while_plugged_in 7` |
| 로케일/언어 통일 | 가능 범위 |
| 해상도/밀도 통일 | 가능 범위 |
| 화면 깨우기/잠금 해제 | 루틴 |
| 접근성 | adb try-enable; **실패 시 manual fallback** (`requires_manual_accessibility=true`) |

- adb로 접근성 활성화 실패 가능 → `onFailureSetRequiresManualAccessibility: true`로 표기. 운영자가 수동 설정 후 진행.

---

## 7. Callback 모델

- **Node → Backend**: node가 status/task updates + artifacts를 push (pull 아님).
- **Buffering/Retry**: callback 실패 시 node가 버퍼에 적재 후 재시도. 재시도 정책: exponential backoff 또는 고정 간격.
- Backend API: `POST /api/nodes/status`, `POST /api/nodes/artifacts` 등. X-Node-Auth 인증.

---

## 8. 노드별 .env

**추천**: 레포에는 `.env.example` 하나만 커밋. 각 노드 PC에는 로컬에만 `.env` (커밋 금지).

- PC-01: `NODE_ID=PC-01`
- PC-02: `NODE_ID=PC-02`
- 나머지 값은 동일 (SUPABASE_*, NODE_AGENT_SHARED_SECRET 등)

**주의**: Service Role / Shared Secret / YouTube 키 노출 시 키 회전 후 재설정 권장.
