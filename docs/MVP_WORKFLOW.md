# MVP 워크플로우 상세 가이드

## 🎯 시스템 구성 요약

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ☁️ 중앙 서버 (VPS/클라우드)                       │
│                                                                     │
│   [웹 대시보드]  ←──→  [API Gateway]  ←──→  [PostgreSQL + Redis]   │
│        │                    │                                       │
│        └────────────────────┴───────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
                                  │
                          인터넷 (HTTPS)
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
   ┌─────────┐              ┌─────────┐              ┌─────────┐
   │  PC 1   │              │  PC 2   │              │  PC N   │
   │ 마스터  │              │ 마스터  │              │ 마스터  │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │PC Agent │              │PC Agent │              │PC Agent │
   │(Python) │              │(Python) │              │(Python) │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │ Laixi   │              │ Laixi   │              │ Laixi   │
   │ (제어)  │              │ (제어)  │              │ (제어)  │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │📱 x100  │              │📱 x100  │              │📱 x100  │
   └─────────┘              └─────────┘              └─────────┘
```

---

## 📋 워크플로우 단계별 설명

### Phase 1: 초기 설정 (1회)

#### 1.1 중앙 서버 배포
```bash
# VPS에서 (예: Ubuntu 22.04)
git clone https://github.com/exe-blue/youtube_automation_human_bot.git
cd youtube_automation_human_bot

# Docker Compose로 실행
docker-compose up -d

# 상태 확인
docker-compose ps
curl http://localhost:8000/health
```

#### 1.2 마스터 PC 설정 (각 PC마다)
```bash
# 1. Laixi 설치 (기존 사용)
# 2. PC Agent 설치
cd workers
pip install -r requirements.txt

# 3. 스크립트 복사
# scripts/human_patterns.js → Laixi/Scripts/
# scripts/youtube_automation.js → Laixi/Scripts/
```

#### 1.3 Android 기기 연결
```bash
# ADB로 기기 연결 확인
adb devices

# 예상 출력:
# List of devices attached
# XXXXXXXX001  device
# XXXXXXXX002  device
# ...
```

---

### Phase 2: 작업 등록 (관리자)

#### 2.1 웹 대시보드 접속
```
브라우저: https://your-server.com
로그인 (API 키 입력)
```

#### 2.2 영상 등록
| 필드 | 예시 |
|------|------|
| URL | https://youtube.com/watch?v=xxx |
| 제목 | 테스트 영상 |
| 키워드 | 유튜브 자동화 |
| 길이 | 300 (초) |
| 우선순위 | 5 |

#### 2.3 작업 생성
```
"이 영상을 100대 기기로 각 1회씩 시청"
→ 100개의 작업(Task)이 생성됨
→ 각 작업에 휴먼 패턴이 자동 생성됨
```

---

### Phase 3: 작업 실행 (자동)

#### 3.1 PC Agent 시작 (각 마스터 PC에서)
```bash
cd workers
python pc_agent.py --pc-id PC1 --server https://your-server.com --api-key xxx
```

또는 배치 파일:
```bash
start_agent.bat PC1 https://your-server.com xxx
```

#### 3.2 자동 흐름
```
[PC Agent]
    │
    │ 1. 서버에 연결된 기기 등록
    │ 2. 10초마다 하트비트 전송
    │ 3. 5초마다 작업 폴링
    │
    ▼
[작업 수신]
    │
    │ {
    │   task_id: "xxx",
    │   video: {url, title, keyword},
    │   pattern: {watch_time: 180, like: true, like_timing: 120, ...}
    │ }
    │
    ▼
[Laixi에 전달]
    │
    │ WebSocket 또는 스크립트 실행
    │
    ▼
[Laixi → Android]
    │
    │ 1. YouTube 앱 실행
    │ 2. 키워드 검색 "유튜브 자동화"
    │ 3. 영상 찾기 (제목 매칭)
    │ 4. 휴먼 패턴대로 시청 (180초)
    │ 5. 120초에 좋아요 클릭
    │
    ▼
[완료 보고]
    │
    │ POST /tasks/{id}/complete
    │ POST /results
    │
    ▼
[서버 업데이트]
    │
    │ DB 저장, 통계 갱신
    │
    ▼
[대시보드 반영] ✅
```

---

### Phase 4: 모니터링 (관리자)

#### 4.1 실시간 대시보드
- **영상별 진행률**: 100/100 완료
- **기기 상태**: 활성 85대, 오프라인 15대
- **성공률**: 92%
- **평균 시청률**: 68%

#### 4.2 통계 확인
- 일별 작업 완료 그래프
- 좋아요/댓글 비율
- 검색 경로 분포

---

## 🔧 명령 흐름 정리

### 누가 누구에게 명령하는가?

```
┌──────────────┐
│   관리자      │  ← 인간
└──────┬───────┘
       │ 웹 UI로 작업 등록
       ▼
┌──────────────┐
│  중앙 서버    │  ← 클라우드
│  (작업 큐)   │
└──────┬───────┘
       │ PC Agent가 폴링으로 가져감
       ▼
┌──────────────┐
│  PC Agent    │  ← 마스터 PC
│  (브릿지)    │
└──────┬───────┘
       │ WebSocket으로 전달
       ▼
┌──────────────┐
│   Laixi      │  ← 마스터 PC
│  (화면제어)  │
└──────┬───────┘
       │ ADB/미러링으로 제어
       ▼
┌──────────────┐
│  Android     │  ← 폰팜 기기
│  (YouTube)   │
└──────────────┘
```

### 핵심 포인트

1. **관리자는 웹에서만 작업** - 마스터 PC 직접 조작 불필요
2. **PC Agent가 자동으로 작업 가져옴** - 폴링 방식
3. **Laixi가 실제 제어 담당** - 기존 시스템 활용
4. **모든 결과는 중앙 서버로** - 통합 모니터링

---

## ⚙️ 설정 파일

### 중앙 서버 (.env)
```env
DB_PASSWORD=securepassword123
API_KEYS=admin-key-456,worker-key-789
```

### PC Agent (실행 인자)
```bash
python pc_agent.py \
    --pc-id PC1 \
    --server https://api.your-domain.com \
    --api-key worker-key-789 \
    --laixi-port 9317
```

### Laixi 스크립트 (youtube_automation.js)
```javascript
var CONFIG = {
    API_GATEWAY_URL: "https://api.your-domain.com",
    API_KEY: "worker-key-789",
    DEVICE_ID: device.serial
};
```

---

## 🚀 빠른 시작 체크리스트

### 중앙 서버
- [ ] VPS 준비 (최소 2GB RAM)
- [ ] Docker 설치
- [ ] `docker-compose up -d` 실행
- [ ] 방화벽 8000 포트 오픈
- [ ] HTTPS 설정 (선택)

### 마스터 PC (각각)
- [ ] Python 3.8+ 설치
- [ ] Laixi 설치 및 실행
- [ ] `pip install -r workers/requirements.txt`
- [ ] 스크립트 복사
- [ ] ADB 드라이버 설치
- [ ] Android 기기 연결 확인

### 작업 시작
- [ ] 웹 대시보드 접속
- [ ] 영상 등록
- [ ] 작업 생성
- [ ] PC Agent 시작
- [ ] 모니터링

---

## 📊 예상 처리량

| PC 수 | 기기 수 | 동시 작업 | 시간당 완료 |
|-------|---------|-----------|-------------|
| 1대 | 100대 | 100개 | ~120개 (5분 평균 시청) |
| 3대 | 300대 | 300개 | ~360개 |
| 6대 | 600대 | 600개 | ~720개 |

---

## 🔮 MVP 이후 로드맵

### Phase 2: AI 에이전트 학습
- OpenAI/Claude API 연동
- 댓글 자동 생성 (맥락 이해)
- 시청 패턴 실시간 최적화

### Phase 3: 자율 에이전트
- 영상 자동 발견 및 선택
- 인간 문화 반응 데이터 수집
- 600개 에이전트 병렬 운영

### Phase 4: 연구 데이터 분석
- 휴먼 시뮬레이션 정확도 평가
- 플랫폼 탐지 회피율 분석
- AI 존재 규정에 대한 인사이트

