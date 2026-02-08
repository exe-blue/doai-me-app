# 벤더 어댑터 계약서 (Canonical)

> **tags**: `vendor`, `xiaowei`, `websocket`, `list`, `screen`, `adb`, `device`, `serial`
> **sources**: Minimal-Vendor-Adapter-Contract, vendor-xiaowei-notes
> **status**: canonical — 벤더 WS 사용 시 이 계약을 따른다

---

## 최소 액션 (필수)

### action=list (기기 조회)

- 노드 기동 시 및 주기적 호출
- 반환: 기기별 `serial`
- `serial` → `runtime_handle` 및 `device_id`(onlySerial)로 사용

### action=screen (스크린샷)

- 파라미터: `savePath` (노드 로컬 저장 경로, 필수)
- 저장 후 Supabase Storage 업로드
- 경로: `{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png`

---

## 선택 액션

| 액션 | 용도 | 대체 |
|------|------|------|
| autojsCreate | JS 스크립트 실행 | ADB로 대체 가능 |
| launch | 앱 실행 | ADB am start |
| 입력 관련 | 텍스트/탭 입력 | ADB input |

---

## 디바이스 식별 규칙

| 식별자 | 용도 | 값 |
|--------|------|-----|
| `device_id` | DB/큐/불변 키 | onlySerial |
| `runtime_handle` | 벤더/ADB 실행 대상 | vendor list serial |

- 정규화/가공 없이 원문 그대로 저장
- serial은 연결 방식에 따라 변할 수 있음 (USB=시리얼, WiFi=ip:5555)
- **절대 serial을 불변 키로 쓰지 말 것** → device_id(onlySerial) 사용

---

## 벤더 정보: Xiaowei (效卫投屏)

| 항목 | 값 |
|------|-----|
| 제조사 | 郑州效卫科技有限公司 |
| 공식 | https://www.xiaowei.xin/ |
| 도움말 | https://www.xiaowei.xin/help/70 |
| 문서 | https://xiaowei.run/docs/ |
| WS 포트 | 22222 (기본) |
| 무료 | 40대까지 |

### 통합 체크리스트

1. WS/HTTP/API 프로토콜 및 포트 확인 (기본 22222)
2. device identifier(serial/IP) → device_id/runtime_handle 매핑
3. ADB·스크립트 기능 preflight/bootstrap/login 검증
4. xiaowei.xin vs xiaowei.run 문서 버전 차이 확인

---

## 관련 문서

- 워크플로우 DSL: [workflow-dsl.md](workflow-dsl.md) §3 Preflight
- 콜백: [callback-contract.md](callback-contract.md)
