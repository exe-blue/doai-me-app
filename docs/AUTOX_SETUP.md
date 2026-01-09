# AutoX.js 설정 가이드

AIFARM 프로젝트에서 AutoX.js를 사용하여 폰에서 YouTube 자동화를 실행하는 방법입니다.

## 📱 1. 폰 준비

### 1.1 AutoX.js 앱 설치

1. **GitHub에서 다운로드**
   - https://github.com/kkevsekk1/AutoX/releases
   - 최신 `.apk` 파일 다운로드

2. **설치 방법**
   - APK 파일을 폰으로 전송
   - 알 수 없는 출처 허용 후 설치

### 1.2 필수 권한 설정

#### ✅ 접근성 서비스
1. 설정 → 접근성
2. AutoX.js 찾기
3. 활성화

#### ✅ 화면 위에 그리기
1. 설정 → 앱 → 특수 접근
2. 다른 앱 위에 표시
3. AutoX.js 허용

#### ✅ 저장소 접근
1. 설정 → 앱 → AutoX.js → 권한
2. 저장소 허용

## 💻 2. PC 준비

### 2.1 VS Code 확장 설치

```
1. VS Code 열기
2. Ctrl+Shift+X (확장 검색)
3. "Autox.js" 검색
4. "Autox.js-VSCodeExt" 설치
```

### 2.2 Backend 서버 실행

```bash
cd backend
python main.py
```

서버가 `http://0.0.0.0:8000`에서 실행됩니다.

### 2.3 PC IP 주소 확인

**Windows:**
```bash
ipconfig
```

**Mac/Linux:**
```bash
ifconfig
```

예: `192.168.0.100` (이 IP를 설정 파일에 사용)

## 🔌 3. 폰 연결

### 방법 1: Wi-Fi 연결 (추천)

#### PC에서:
1. VS Code 열기
2. `Ctrl+Shift+P`
3. `Autox.js: Start All Server` 실행
4. 우측 하단에 `Auto.js server running...` 표시 확인

#### 폰에서:
1. AutoX.js 앱 실행
2. 좌측 메뉴 → "连接电脑" (컴퓨터 연결)
3. PC의 IP 주소 입력 (예: `192.168.0.100`)
4. 포트: `9317` (기본값)
5. 연결

또는:

1. VS Code에서 `Ctrl+Shift+P` → `Show QR code`
2. 폰에서 QR 코드 스캔

### 방법 2: USB 연결 (ADB)

#### 폰 설정:
1. 설정 → 휴대전화 정보
2. "빌드 번호" 7번 탭 (개발자 모드 활성화)
3. 설정 → 개발자 옵션
4. "USB 디버깅" 활성화

#### PC에서:
1. USB 케이블로 연결
2. 폰에서 "USB 디버깅 허용" 승인
3. VS Code에서 자동으로 디바이스 인식

확인:
```bash
adb devices
```

## ⚙️ 4. 설정 파일 수정

### autox-scripts/config/dev.json

```json
{
  "server": {
    "host": "192.168.0.100",  // ← PC의 IP 주소로 변경
    "port": 8000,
    "protocol": "http"
  },
  "device": {
    "id": "PHONE_001",  // ← 고유한 ID (예: PHONE_001, PHONE_002, ...)
    "model": "Xiaomi Redmi Note 10",
    "pc_id": "PC_01"
  }
}
```

**중요**: 600대 폰을 구별하려면 각 폰마다 `device.id`를 다르게 설정해야 합니다!

### 디바이스 ID 자동 생성 (옵션)

`main.js` 상단에 추가:
```javascript
// Android 디바이스 ID 자동 생성
const deviceId = device.getIMEI() || device.getAndroidId();
config.device.id = deviceId;
```

## 🚀 5. 스크립트 실행

### 방법 1: VS Code에서 실행 (개발용)

1. `autox-scripts/main.js` 파일 열기
2. `F5` 누르기 또는 우측 상단 실행 버튼 클릭
3. 연결된 모든 디바이스에서 실행됨

### 방법 2: 폰에서 직접 실행 (프로덕션)

#### 프로젝트 저장:
1. VS Code에서 `autox-scripts` 폴더 우클릭
2. `Save Project to Device` 선택
3. 모든 파일이 폰으로 복사됨

#### 실행:
1. AutoX.js 앱에서 `main.js` 찾기
2. 재생 버튼(▶️) 탭
3. 백그라운드에서 계속 실행됨

### 방법 3: 자동 시작 설정

1. AutoX.js 앱 → 좌측 메뉴 → "定时任务" (예약 작업)
2. 새 작업 추가
3. 트리거: "앱 시작 시"
4. 실행할 스크립트: `main.js`
5. 저장

이제 폰을 재부팅해도 자동으로 스크립트가 실행됩니다!

## 🧪 6. 테스트

### 6.1 로컬 시뮬레이터 (PC에서)

Backend 서버만 실행 후:

```bash
cd autox-scripts/tests
node simulator.js
```

이렇게 하면 실제 폰 없이도 전체 플로우를 테스트할 수 있습니다.

### 6.2 작업 등록 테스트

```bash
# 테스트 작업 등록
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "여행 브이로그",
    "title": "테스트 영상",
    "priority": 5
  }'
```

### 6.3 로그 확인

#### VS Code에서:
1. `Ctrl+Shift+P` → `Toggle Developer Tools`
2. `Console` 탭 확인

#### 폰에서:
1. AutoX.js 앱 → 로그 탭
2. 실시간 로그 확인

## 📊 7. 모니터링

### 7.1 Backend API로 현황 확인

```bash
# 전체 작업 현황
curl http://localhost:8000/api/tasks/status

# 디바이스 목록
curl http://localhost:8000/api/devices

# 특정 디바이스 상세
curl http://localhost:8000/api/devices/PHONE_001
```

### 7.2 Frontend 대시보드

브라우저에서 `http://localhost:3000/dashboard` 접속하여 실시간 현황을 그래픽으로 확인할 수 있습니다.

## 🔧 8. 트러블슈팅

### 문제 1: 서버 연결 실패
```
[ERROR] 서버 연결 실패
```

**해결**:
1. Backend 서버가 실행 중인지 확인
2. 방화벽에서 8000 포트 열기:
   ```bash
   # Windows
   netsh advfirewall firewall add rule name="AIFARM" dir=in action=allow protocol=TCP localport=8000
   ```
3. 폰과 PC가 같은 Wi-Fi에 연결되어 있는지 확인
4. IP 주소가 정확한지 재확인

### 문제 2: YouTube 앱 실행 실패
```
[ERROR] YouTube 앱 실행 실패
```

**해결**:
1. YouTube 앱이 설치되어 있는지 확인
2. AutoX.js의 접근성 권한 재확인
3. 폰 재부팅

### 문제 3: 작업이 오지 않음
```
[DEBUG] 대기 중인 작업 없음
```

**해결**:
1. Frontend에서 작업 등록 확인
2. DB 상태 확인:
   ```bash
   curl http://localhost:8000/api/tasks/status
   ```
3. Backend 로그 확인

### 문제 4: 스크립트가 자꾸 멈춤

**해결**:
1. AutoX.js 앱 → 설정 → "배터리 최적화 제외" 추가
2. "백그라운드 실행 허용" 활성화
3. 폰 잠금 화면 비활성화 (개발 중)

## 📱 9. 다중 디바이스 관리

### 9.1 30개 폰보드 × 20개 폰 = 600대 설정

각 폰보드별로 디바이스 ID 체계화:

```
PC_01: PHONE_001 ~ PHONE_020
PC_02: PHONE_021 ~ PHONE_040
...
PC_30: PHONE_581 ~ PHONE_600
```

### 9.2 배치 배포 스크립트

`autox-scripts/deploy.sh`:

```bash
#!/bin/bash

# 모든 연결된 디바이스에 배포
for device in $(adb devices | grep -v "List" | awk '{print $1}')
do
  echo "Deploying to $device..."
  adb -s $device push autox-scripts /sdcard/autox-scripts/
done

echo "Deployment complete!"
```

## 🔐 10. 보안 고려사항

### 프로덕션 배포 시:

1. **HTTPS 사용**
   - `config/prod.json`에서 `protocol: "https"` 설정
   - SSL 인증서 설정

2. **API 키 인증**
   - Backend에 API 키 추가
   - 각 디바이스별 고유 키 발급

3. **IP 화이트리스트**
   - Backend에서 허용된 IP만 접근 가능하도록 설정

## 📞 지원

문제가 발생하면:
- GitHub Issues: https://github.com/exe-blue/aifarm/issues
- 문서: `docs/` 폴더 참조
