# Laixi App 통합 가이드

AIFarm 시스템에 Laixi App을 통합하여 Android 기기를 제어하는 방법을 설명합니다.

## 📋 목차

1. [Laixi란?](#laixi란)
2. [설치 및 설정](#설치-및-설정)
3. [아키텍처](#아키텍처)
4. [API 사용법](#api-사용법)
5. [예제](#예제)
6. [문제 해결](#문제-해결)

---

## Laixi란?

**Laixi**는 PC에서 여러 Android 기기를 동시에 제어할 수 있는 앱입니다.

### 주요 기능

- **WebSocket API**: `ws://127.0.0.1:22221/` 엔드포인트로 JSON 기반 명령 전송
- **다중 기기 제어**: "all" 파라미터로 모든 기기에 한 번에 명령 전송
- **터치/스와이프**: 백분율 좌표(0.0-1.0)로 정확한 제어
- **스크린샷**: 빠른 화면 캡처
- **클립보드**: 한글 포함 텍스트 입력 지원
- **ADB 명령**: 직접 ADB 명령 실행

### xinhui와의 차이점

| 기능 | xinhui | Laixi |
|------|--------|-------|
| **통신** | TCP 소켓 (10039) | WebSocket (22221) |
| **좌표계** | 픽셀 좌표 | 백분율 (0.0-1.0) |
| **텍스트 입력** | 직접 HID | 클립보드 사용 |
| **프로토콜** | 바이너리 (길이 프리픽스) | JSON |
| **멀티터치** | 지원 (핀치 등) | 미지원 |

---

## 설치 및 설정

### 1. Laixi 앱 다운로드

- 공식 웹사이트에서 Laixi 설치 파일 다운로드
- `touping.exe` 실행

### 2. Python 의존성 설치

```bash
pip install websockets
```

### 3. 기기 연결 확인

Laixi 앱을 실행하고 Android 기기가 연결되어 있는지 확인합니다.

```bash
# Laixi에서 기기 목록 확인
python -c "
import asyncio
from shared.laixi_client import LaixiClient

async def test():
    client = LaixiClient()
    await client.connect()
    devices = await client.list_devices()
    print(f'연결된 기기: {len(devices)}대')
    for device in devices:
        print(f' - {device}')
    await client.disconnect()

asyncio.run(test())
"
```

---

## 아키텍처

```
┌─────────────────┐
│   AIFarm        │
│   Backend       │
└────────┬────────┘
         │ HTTP
         │
┌────────▼────────┐
│   PC Agent      │
│  (pc_agent.py)  │
└────────┬────────┘
         │ WebSocket
         │ ws://127.0.0.1:22221/
┌────────▼────────┐
│   Laixi App     │
│  (touping.exe)  │
└────────┬────────┘
         │ USB/WiFi ADB
         │
┌────────▼────────┐
│ Android Devices │
│  (Phone Farm)   │
└─────────────────┘
```

### 구성 요소

1. **shared/laixi_client.py**: Laixi WebSocket API 클라이언트
2. **workers/pc_agent.py**: 중앙 서버와 Laixi 사이의 브릿지
3. **Laixi App**: PC에서 실행되는 기기 제어 앱

---

## API 사용법

### 기본 연결

```python
from shared.laixi_client import LaixiClient

client = LaixiClient()
await client.connect()

# 작업 수행...

await client.disconnect()
```

### 디바이스 목록 조회

```python
devices = await client.list_devices()
for device in devices:
    print(f"Device: {device['id']}, Model: {device.get('model', 'Unknown')}")
```

### 터치 입력 (백분율 좌표)

```python
# 화면 중앙 탭
await client.tap("all", 0.5, 0.5)

# 특정 디바이스만 탭
await client.tap("fa3523ea0510", 0.3, 0.7)
```

### 스와이프 (스크롤)

```python
# 위로 스크롤
await client.swipe(
    "all",
    0.5, 0.7,  # 시작: 중앙, 70%
    0.5, 0.3,  # 종료: 중앙, 30%
    duration_ms=300
)

# 왼쪽으로 스와이프
await client.swipe("all", 0.8, 0.5, 0.2, 0.5, 300)
```

### 텍스트 입력

```python
# 클립보드에 텍스트 설정
await client.set_clipboard("all", "안녕하세요! 한글도 지원됩니다.")

# 클립보드 내용 확인 (단일 디바이스만)
text = await client.get_clipboard("fa3523ea0510")
print(f"Clipboard: {text}")
```

### 스크린샷

```python
# 스크린샷 저장 (Laixi가 지정한 경로에 저장됨)
await client.screenshot("all", "d:\\screenshots")
```

### ADB 명령 실행

```python
# YouTube 앱 실행
await client.execute_adb(
    "fa3523ea0510",
    "am start -a android.intent.action.VIEW -d https://youtube.com"
)

# 앱 강제 종료
await client.execute_adb("all", "am force-stop com.google.android.youtube")
```

### 기본 작업

```python
# Home 버튼
await client.press_home("all")

# Back 버튼
await client.press_back("all")

# 화면 켜기/끄기
await client.screen_on("all")
await client.screen_off("all")

# 볼륨 조절
await client.volume_up("all")
await client.volume_down("all")
```

### Toast 메시지

```python
await client.show_toast("all", "작업 완료!")
```

---

## 예제

### 예제 1: YouTube 영상 자동 재생

```python
import asyncio
from shared.laixi_client import LaixiClient

async def watch_youtube_video():
    client = LaixiClient()
    await client.connect()

    try:
        # YouTube 앱으로 영상 열기
        video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        await client.execute_adb(
            "all",
            f"am start -a android.intent.action.VIEW -d {video_url}"
        )

        # 30초 시청
        await asyncio.sleep(30)

        # Home 버튼으로 나가기
        await client.press_home("all")

    finally:
        await client.disconnect()

asyncio.run(watch_youtube_video())
```

### 예제 2: 검색 및 스크롤

```python
async def search_and_scroll():
    client = LaixiClient()
    await client.connect()

    try:
        # YouTube 앱 실행
        await client.execute_adb(
            "all",
            "am start -n com.google.android.youtube/.HomeActivity"
        )
        await asyncio.sleep(3)

        # 검색 버튼 탭 (상단 우측, 예시 좌표)
        await client.tap("all", 0.9, 0.1)
        await asyncio.sleep(2)

        # 검색어 입력
        await client.set_clipboard("all", "AI 뉴스")
        await asyncio.sleep(1)

        # 엔터 (검색 실행)
        await client.execute_adb("all", "input keyevent 66")
        await asyncio.sleep(3)

        # 스크롤 5회
        for _ in range(5):
            await client.swipe("all", 0.5, 0.7, 0.5, 0.3, 300)
            await asyncio.sleep(2)

    finally:
        await client.disconnect()

asyncio.run(search_and_scroll())
```

### 예제 3: PC Agent 통합

`workers/pc_agent.py`는 이미 Laixi가 통합되어 있습니다.

```bash
# PC Agent 실행
python workers/pc_agent.py \
    --pc-id PC1 \
    --server https://your-backend-url.com \
    --api-key your-api-key
```

---

## 문제 해결

### 연결 실패

```
Laixi 연결 실패: [WinError 10061] 대상 컴퓨터에서 연결을 거부했으므로 연결하지 못했습니다
```

**해결 방법**:
1. Laixi 앱(touping.exe)이 실행 중인지 확인
2. 방화벽에서 22221 포트 허용
3. Laixi 앱 재시작

### 기기 목록이 비어있음

```python
devices = await client.list_devices()
# devices = []
```

**해결 방법**:
1. Android 기기가 USB 또는 WiFi ADB로 연결되어 있는지 확인
2. `adb devices` 명령으로 기기 연결 확인
3. Laixi 앱에서 기기 목록 확인

### 좌표 변환

xinhui는 픽셀 좌표를 사용하지만, Laixi는 백분율(0.0-1.0)을 사용합니다.

```python
# xinhui (픽셀)
x_pixel = 540  # 1080 화면의 중앙
y_pixel = 960  # 1920 화면의 중앙

# Laixi (백분율)
x_percent = x_pixel / 1080  # = 0.5
y_percent = y_pixel / 1920  # = 0.5

await client.tap("all", x_percent, y_percent)
```

### 한글 입력

Laixi는 클립보드를 사용하여 한글을 입력합니다.

```python
# 클립보드에 한글 설정
await client.set_clipboard("all", "안녕하세요")

# 텍스트 필드에 포커스 후 붙여넣기 (Ctrl+V)
await client.execute_adb("all", "input keyevent 279")
```

---

## 참고 자료

- **Laixi API 문서**: `PoC_Laixi_App_API_구성도.pdf`
- **WebSocket 테스트**: https://websocketking.com/
- **예제 코드**: [examples/laixi_example.py](../examples/laixi_example.py)
- **클라이언트 소스**: [shared/laixi_client.py](../shared/laixi_client.py)

---

## 라이선스

이 문서와 코드는 AIFarm 프로젝트의 일부입니다.
