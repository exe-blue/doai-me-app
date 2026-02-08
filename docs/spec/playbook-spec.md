# Playbook JSON 스펙 (Canonical)

> **tags**: `playbook`, `probability`, `steps`, `command-assets`, `seed`, `execution`
> **sources**: Playbook-JSON-Spec-v1
> **status**: canonical — Playbook 실행은 이 스펙을 따른다

---

## 런타임 JSON 형식

```json
{
  "version": "1",
  "playbook_id": "uuid",
  "name": "My Playbook",
  "defaultStepTimeoutMs": 30000,
  "defaultOnFailure": "stop",
  "globalTimeoutMs": 600000,
  "steps": [
    {
      "id": "step_0",
      "ref": "command_asset_uuid",
      "kind": "adb|js|vendor|assert",
      "sort_order": 0,
      "timeoutMs": 30000,
      "onFailure": "stop|continue|retry",
      "retryCount": 0,
      "probability": 1.0,
      "params": {}
    }
  ]
}
```

---

## Step 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | ✓ | step 식별자 |
| ref | uuid | ✓ | command_assets.id → Node가 내용 조회 |
| kind | string | ✓ | adb, js, vendor, assert |
| sort_order | number | ✓ | 실행 순서 |
| timeoutMs | number | | step 타임아웃(ms). 없으면 default 사용 |
| onFailure | string | | stop, continue, retry |
| retryCount | number | | retry 최대 횟수 (기본 0) |
| probability | number | | 0.0~1.0 (기본 1.0 = 항상 실행) |
| params | object | | {{KEY}} 치환용 |

---

## 확률 실행 (Probability)

- `probability < 1.0`인 step은 실행 전 1회 판정
- **Seed**: `hash(run_id + device_id + step_id)` → 동일 조합이면 항상 같은 결과
- `random(seed) >= probability` → `skipped`로 기록
- 50% 스텝 = 기기 절반에서만 실행, 재현 가능

```
seed = hash(run_id + device_id + step.id)
r = deterministic_random(seed)
if r >= step.probability:
  record_step_result(step.id, "skipped")
  continue
execute_step(step)
```

---

## ref 해석 (Node)

1. `step.ref`로 `command_assets` 조회 (API 또는 캐시)
2. **kind=adb**: inline_content 우선, 없으면 storage_path 다운로드 → params 치환 후 실행
3. **kind=js**: storage_path 다운로드 → 스크립트 엔진/벤더 규약
4. **kind=vendor**: action + params (Minimal Vendor Adapter)
5. 캐싱: `updated_at` 기반 무효화

---

## workflow_id vs playbook_id

| 소스 | Node 전달 |
|------|-----------|
| workflow_id | 기존 definition_json steps 배열. params 치환만 |
| playbook_id | 위 JSON으로 변환. ref → command_assets 조회. probability 적용 |

- Backend: playbook_id면 playbook_steps → JSON 직렬화
- Node: steps 배열만 처리, ref 있으면 command_assets 로드

---

## 관련 문서

- DSL 상세: [workflow-dsl.md](workflow-dsl.md)
- Command Library: [command-library.md](command-library.md)
- API: [api-contracts.md](api-contracts.md) §6 Playbooks
