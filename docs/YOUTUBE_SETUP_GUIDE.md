# 🎬 YouTube 자동화 시스템 실행 가이드

**DoAi.Me - YouTube Automation Setup Guide**

---

## 📋 목차

1. [필수 준비물](#필수-준비물)
2. [Laixi App 설정](#laixi-app-설정)
3. [백엔드 서버 실행](#백엔드-서버-실행)
4. [Gateway 실행](#gateway-실행)
5. [테스트 및 검증](#테스트-및-검증)
6. [트러블슈팅](#트러블슈팅)

---

## 🔧 1. 필수 준비물

### 하드웨어
- Android 디바이스 (S9 또는 호환 기기)
- USB 케이블 또는 WiFi ADB 연결
- Windows PC (Laixi 실행용)

### 소프트웨어
| 소프트웨어 | 버전 | 설명 |
|-----------|------|------|
| Node.js | 18.x+ | Gateway 실행 |
| Python | 3.10+ | Backend API |
| Laixi App | 최신 | 디바이스 제어 |
| AutoX.js | 6.x+ | 스크립트 실행 (선택) |

### 계정 및 키
- Supabase 프로젝트 (DB)
- YouTube 계정 (디바이스에 로그인)

---

## 📱 2. Laixi App 설정

### 2.1 Laixi 앱 실행

1. PC에서 `touping.exe` 실행
2. 앱이 시작되면 WebSocket 서버가 `ws://127.0.0.1:22221/`에서 대기

### 2.2 디바이스 연결

```bash
# USB 연결 확인
adb devices

# WiFi ADB 활성화 (선택)
adb tcpip 5555
adb connect 192.168.x.x:5555
```

### 2.3 연결 확인

Laixi 앱 UI에서 연결된 디바이스 목록 확인

---

## 🖥️ 3. 백엔드 서버 실행

### 3.1 환경변수 설정

```bash
cd backend
```

`backend/.env` 파일 생성:

```env
SUPABASE_URL=https://hycynmzdrngsozxdmyxi.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# API 설정
API_HOST=0.0.0.0
API_PORT=8001
DEBUG=false
```

### 3.2 의존성 설치

```bash
# Python 의존성
pip install -r api/requirements.txt

# Node.js 의존성 (분산 시스템용)
npm install
```

### 3.3 DB 마이그레이션

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. SQL Editor 열기
3. `backend/migrations/DATABASE_SCHEMA_V2.sql` 내용 붙여넣기
4. **Run** 클릭

### 3.4 서버 실행

```bash
# FastAPI 서버
cd api
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# 또는 Docker로 실행
docker-compose up -d
```

**확인:**
- http://localhost:8001/docs (Swagger UI)
- http://localhost:8001/health (헬스체크)

---

## 🌉 4. Gateway 실행

### 4.1 의존성 설치

```bash
cd gateway
npm install
```

### 4.2 Laixi Adapter 테스트

```bash
node src/adapters/laixi/test-adapter.js
```

**예상 출력:**
```
╔═══════════════════════════════════════════════════════════════╗
║     🔌 Laixi Adapter 테스트                                    ║
╚═══════════════════════════════════════════════════════════════╝

🔌 Step 1: 연결 중... ws://127.0.0.1:22221/
✅ 연결 성공!

💓 Step 2: Heartbeat (연결 상태 확인)...
✅ Heartbeat 정상!

📱 Step 3: 디바이스 목록 조회...
   디바이스 수: 2
   - [1] SERIAL_001 (WiFi)
   - [2] SERIAL_002 (USB)
```

### 4.3 YouTube Controller 테스트

```bash
node src/adapters/laixi/test-youtube.js
```

---

## ✅ 5. 테스트 및 검증

### 5.1 단일 영상 시청 테스트

```bash
# 테스트 스크립트 실행
node test-single-video.js
```

### 5.2 API 테스트

```bash
# 영상 추가
curl -X POST http://localhost:8001/api/youtube/videos \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_001",
    "keyword": "요리",
    "title": "맛있는 파스타",
    "url": "https://youtube.com/watch?v=xxx"
  }'

# 영상 목록 조회
curl http://localhost:8001/api/youtube/videos

# 결과 저장
curl -X POST http://localhost:8001/api/youtube/results \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEVICE_001",
    "video_id": "test_001",
    "watch_time": 120,
    "liked": true,
    "status": "completed"
  }'
```

### 5.3 더미 프론트엔드

브라우저에서 열기:
```
file:///d:/exe.blue/aifarm/gateway/public/laixi-test.html
```

---

## 🛠️ 6. 트러블슈팅

### 연결 실패: ECONNREFUSED

```
Error: connect ECONNREFUSED 127.0.0.1:22221
```

**해결:** Laixi 앱(touping.exe)이 실행 중인지 확인

### 디바이스 목록 비어있음

**해결:**
1. ADB 연결 확인: `adb devices`
2. Laixi 앱에서 디바이스 새로고침
3. USB 디버깅 활성화 확인

### 한글 입력 안됨

**해결:** 클립보드 방식 사용 (자동 처리됨)
```javascript
// YouTubeController.js에서 자동으로 처리
const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(query);
if (hasKorean) {
  await this.adapter.setClipboard(deviceId, query);
  await this.adapter.paste(deviceId);
}
```

### Supabase 연결 실패

**해결:**
1. `.env` 파일 확인
2. Service Role Key 사용 여부 확인
3. 네트워크 연결 확인

---

## 📁 관련 파일

```
aifarm/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI 메인
│   │   └── routers/youtube.py   # YouTube API
│   ├── migrations/
│   │   └── DATABASE_SCHEMA_V2.sql
│   └── .env                     # 환경변수
│
├── gateway/
│   ├── src/adapters/laixi/
│   │   ├── LaixiAdapter.js      # Laixi WebSocket
│   │   ├── YouTubeController.js # YouTube 제어
│   │   ├── SomaticEngine.js     # Human-like 행동
│   │   └── test-adapter.js      # 테스트
│   └── public/
│       └── laixi-test.html      # 테스트 UI
│
├── code/                        # 참고 스크립트
│   ├── youtube_agent.js
│   ├── youtube_automation.js
│   └── youtube_api_schema.md
│
└── docs/
    ├── CODE_ANALYSIS_YOUTUBE.md # 코드 분석
    └── YOUTUBE_SETUP_GUIDE.md   # 이 문서
```

---

## 🚀 빠른 시작 (Quick Start)

```bash
# 1. Laixi 앱 실행 (Windows)
# touping.exe 더블클릭

# 2. 백엔드 시작
cd backend/api && uvicorn main:app --port 8001

# 3. Gateway 테스트
cd gateway && node src/adapters/laixi/test-adapter.js

# 4. 브라우저에서 테스트
# gateway/public/laixi-test.html 열기
```

---

**문서 버전:** 1.0  
**최종 수정:** 2026-01-01  
**작성자:** Axon (DoAi.Me Tech Lead)


