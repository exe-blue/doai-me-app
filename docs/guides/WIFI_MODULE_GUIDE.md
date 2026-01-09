# WiFi 자동 연결 모듈 가이드

> 📋 **Status:** 구현 완료  
> 🔧 **Version:** 1.0.0  
> 📅 **Updated:** 2025-12-31

---

## 📁 파일 구조

```
backend/api/
├── services/
│   ├── laixi_client.py      # Laixi WebSocket 클라이언트 ✅
│   └── wifi_service.py      # WiFi 연결 로직 ✅
├── routers/
│   └── wifi.py              # REST API 엔드포인트 ✅
└── main.py                  # 라우터 등록 ✅

backend/tests/
└── test_wifi.py             # 테스트 스위트 ✅

code/
└── Wifi.js                  # AutoX.js 버전 (백업용) ✅
```

---

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd backend/api
pip install -r requirements.txt
```

### 2. 서버 실행

```bash
uvicorn backend.api.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. API 문서 확인

```
http://localhost:8001/docs
```

---

## 📡 API 엔드포인트

### WiFi 연결

```bash
POST /api/v1/wifi/connect

{
  "ssid": "YOUR_SSID",
  "password": "YOUR_PASSWORD",
  "device_ids": "all",  // 또는 "device1,device2"
  "retry": true
}

# ⚠️ 주의: 실제 자격 증명을 공개 저장소에 커밋하지 마세요!
# 환경 변수 또는 보안 볼트를 사용하세요.
```

**응답:**
```json
{
  "success": true,
  "ssid": "JH-Wifi",
  "device_ids": "all",
  "status": "completed",
  "steps": [
    {"step": 1, "action": "open_settings", "status": "ok"},
    {"step": 2, "action": "tap_search", "status": "ok"},
    ...
  ],
  "duration_ms": 12500
}
```

### 전체 WiFi 상태 조회

```bash
GET /api/v1/wifi/status
```

**응답:**
```json
[
  {
    "device_id": "device1",
    "connected": true,
    "ssid": "JH-Wifi",
    "ip_address": "192.168.1.100",
    "rssi": -45,
    "link_speed": 72
  },
  ...
]
```

### 특정 기기 WiFi 상태 조회

```bash
GET /api/v1/wifi/status/{device_id}
```

### WiFi 연결 검증

```bash
POST /api/v1/wifi/verify

{
  "ssid": "JH-Wifi",
  "device_ids": ["device1", "device2", "device3"]
}
```

**응답:**
```json
{
  "target_ssid": "JH-Wifi",
  "total_devices": 3,
  "connected": [
    {"device_id": "device1", "ip_address": "192.168.1.100"}
  ],
  "failed": [
    {"device_id": "device2", "reason": "not_connected"}
  ],
  "success_rate": 66.67,
  "timestamp": "2026-01-01T12:00:00.000000"
}
```

### WiFi 연결 해제 (재시작)

```bash
POST /api/v1/wifi/disconnect?device_ids=all
```

---

## 🧪 테스트

### 단위 테스트 실행

```bash
cd backend
pytest tests/test_wifi.py -v -k "unit"
```

### 통합 테스트 실행 (Laixi 서버 필요)

```bash
pytest tests/test_wifi.py -v -k "integration"
```

### E2E 테스트 실행 (실제 기기 필요)

```bash
pytest tests/test_wifi.py -v -k "e2e"
```

### 수동 테스트

```bash
python backend/tests/test_wifi.py
```

---

## 🎯 S9 좌표 조정

좌표가 안 맞을 경우 다음 단계로 조정하세요:

### 1. 스크린샷 촬영

Laixi API로 스크린샷 촬영:
```json
{
  "action": "screen",
  "comm": {
    "deviceIds": "device1",
    "savePath": "C:\\screenshots"
  }
}
```

### 2. 픽셀 좌표 측정

이미지 편집기에서 각 UI 요소의 픽셀 좌표를 측정:
- 검색 아이콘
- 검색 결과 첫 번째 항목
- 비밀번호 입력 필드
- 연결 버튼

### 3. 백분율 변환

```
x% = 픽셀x / 1440
y% = 픽셀y / 2960
```

### 4. 좌표 업데이트

`backend/api/services/wifi_service.py`의 `S9Coordinates` 클래스 수정:

```python
class S9Coordinates:
    SEARCH_ICON = (0.92, 0.05)       # 수정 필요
    FIRST_RESULT = (0.5, 0.25)       # 수정 필요
    PASSWORD_FIELD = (0.5, 0.45)     # 수정 필요
    CONNECT_BUTTON = (0.85, 0.95)    # 수정 필요
```

---

## ✅ 체크리스트

- [x] Laixi WebSocket 클라이언트 구현
- [x] WiFi 서비스 구현
- [x] REST API 엔드포인트 구현
- [x] 테스트 스위트 작성
- [ ] Laixi WebSocket 연결 확인
- [ ] 기기 목록 조회 정상 작동
- [ ] 단일 기기 탭 테스트
- [ ] 스크린샷으로 좌표 검증
- [ ] COORDS 값 조정
- [ ] WiFi 연결 단일 기기 테스트
- [ ] WiFi 연결 전체 기기 테스트
- [ ] 상태 확인 API 테스트
- [ ] 실패 기기 재시도 로직
- [ ] 대시보드 연동

---

## 🔧 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| Laixi 연결 실패 | 서버 미실행 | Laixi 앱 실행 확인 |
| 좌표가 안 맞음 | 해상도/DPI 차이 | 스크린샷으로 검증 후 조정 |
| 검색 결과 없음 | WiFi가 범위 밖 | WiFi 신호 확인 |
| 비밀번호 필드 안 나옴 | 이미 저장된 네트워크 | 분기 처리 필요 |
| 연결 버튼 위치 다름 | 한글/영어 UI | 두 가지 좌표 시도 |
| WebSocket 타임아웃 | 네트워크 불안정 | 타임아웃 값 조정 |

---

## 📊 성공 기준

- ✅ WiFi 연결 성공률 **95% 이상**
- ✅ 연결 시도 → 상태 확인: **30초 이내**
- ✅ 실패 기기 자동 재시도 **1회**

---

## 📞 지원

문의: Axon (Tech Lead)

