# Minimal Vendor Adapter Contract

> Node Agent가 벤더 WS(예: ws://127.0.0.1:22222)를 사용할 때 따르는 **최소 사용 규칙**. 벤더 프로토콜 자체는 벤더 스펙을 그대로 사용한다.

---

## 필수 액션

### 1. action=list (기기 조회)

- **목적**: 연결된 디바이스 목록 획득.
- **사용**: 노드 기동 시 및 주기적으로 호출; `serial`을 `runtime_handle`로, `device_id`(onlySerial)로 사용.
- **반환**: 기기별 `serial` (USB 시리얼 또는 ip:5555 등).

### 2. action=screen (스크린샷)

- **목적**: 현재 기기 화면 캡처.
- **파라미터**: `savePath` — 노드 로컬 저장 경로(필수).
- **사용**: Vendor Screenshot 단계에서 호출 후, 해당 파일을 Supabase Storage에 업로드.
- **경로 템플릿**: `{youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png`

---

## 선택 액션

- **autojsCreate / 입력 관련**: 가능하면 사용; 불가 시 ADB로 대체.
- **launch 등**: 벤더 스펙에 따라 사용.

---

## 디바이스 식별

- `device_id` = onlySerial (시스템 불변 식별자, 큐/DB 키).
- `runtime_handle` = vendor list의 serial (ADB `-s` 대상, 벤더 API 파라미터).
- 정규화/가공 없이 원문 그대로 저장.
