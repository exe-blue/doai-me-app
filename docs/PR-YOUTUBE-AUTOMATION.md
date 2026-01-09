# PR: YouTube 앱 자동화 시스템 v1.0

## 📋 개요

이 PR은 연결된 Android 디바이스에서 YouTube **앱**을 통해 영상 시청 자동화를 구현합니다.
핵심 프로세스는 **연결유지 → 작업 → 보고 → 대기 → 작업 → 보고**의 순환 구조입니다.

### 주요 기능

1. **Heartbeat 기반 연결 관리** - 디바이스 상태 실시간 모니터링
2. **영상 대기열 시스템** - 채널 API / 직접 등록 / 예약 기능
3. **스마트 작업 분배** - 50% 디바이스 활용, 나머지 휴식
4. **AI 검색어 생성** - 대기열 비어있을 때 "심심한데 유튜브에서 뭐 검색할까?"
5. **인터랙션 확률 기반** - 좋아요(20%), 댓글(5%) 자동 실행
6. **로그인 상태 인식** - 비로그인 시 인터랙션 스킵

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         📊 Dashboard (Next.js)                          │
│  - 영상 등록 (직접/채널 API)                                              │
│  - 예약 관리                                                              │
│  - 실시간 모니터링                                                         │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      🔧 Backend API (FastAPI)                            │
│                                                                          │
│   ┌─────────────┐   ┌───────────────┐   ┌──────────────┐                │
│   │ Video Queue │   │ Task Dispatch │   │ AI Generator │                │
│   │   Service   │   │    Engine     │   │   Service    │                │
│   └─────────────┘   └───────────────┘   └──────────────┘                │
│         │                   │                   │                        │
│         └───────────────────┼───────────────────┘                        │
│                             │                                            │
│                    ┌────────┴────────┐                                   │
│                    │   Supabase DB   │                                   │
│                    └─────────────────┘                                   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    🖥️ Master PC (Laixi + PC Agent)                       │
│                                                                          │
│   ┌──────────────┐         ┌──────────────┐                             │
│   │  PC Agent    │ ──────▶ │    Laixi     │                             │
│   │  (Python)    │         │  (화면제어)  │                             │
│   │  - Heartbeat │         │  - ADB 제어  │                             │
│   │  - 작업 수신 │         │  - 탭/스와이프│                             │
│   │  - 결과 보고 │         │  - 스크린샷  │                             │
│   └──────────────┘         └──────┬───────┘                             │
│                                   │                                      │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │ ADB
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    📱 Android Devices (YouTube App)                      │
│                                                                          │
│   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │
│   │ S9-1 │  │ S9-2 │  │ S9-3 │  │ ...  │  │S9-99 │  │S9-100│          │
│   │ BUSY │  │ IDLE │  │ BUSY │  │      │  │SLEEP │  │ IDLE │          │
│   └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 파일 구조

```
aifarm/
├── backend/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── youtube_queue.py      # [NEW] 영상 대기열 API
│   │   │   ├── device_dispatch.py    # [NEW] 작업 분배 API
│   │   │   └── ai_search.py          # [NEW] AI 검색어 생성 API
│   │   │
│   │   └── services/
│   │       ├── youtube_queue_service.py    # [NEW] 대기열 비즈니스 로직
│   │       ├── device_dispatch_engine.py   # [NEW] 50% 분배 엔진
│   │       ├── ai_search_generator.py      # [NEW] AI 검색어 생성
│   │       ├── task_executor.py            # [NEW] 작업 실행 엔진
│   │       └── result_reporter.py          # [NEW] 결과 보고 서비스
│   │
│   └── migrations/
│       └── 010_youtube_automation_v1.sql   # [NEW] 스키마 마이그레이션
│
├── shared/
│   ├── schemas/
│   │   ├── youtube_queue.py        # [NEW] 대기열 스키마
│   │   └── device_dispatch.py      # [NEW] 분배 스키마
│   │
│   └── scripts/
│       └── youtube_app_automation.lua   # [NEW] Laixi 스크립트 (YouTube 앱용)
│
└── docs/
    ├── PR-YOUTUBE-AUTOMATION.md    # [NEW] 이 문서
    └── YOUTUBE-APP-COORDINATES.md  # [NEW] YouTube 앱 좌표 매핑
```

---

## 📐 데이터베이스 스키마

### 신규 테이블

#### 1. `video_queue` - 영상 대기열

```sql
CREATE TABLE video_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 영상 정보
    video_id VARCHAR(20) NOT NULL,          -- YouTube 영상 ID
    title VARCHAR(500) NOT NULL,
    channel_name VARCHAR(255),
    duration_seconds INTEGER,
    view_count INTEGER,                      -- 조회수 (인터랙션 확률 계산용)
    
    -- 등록 정보
    source VARCHAR(20) NOT NULL CHECK (source IN ('channel_api', 'direct', 'ai_generated')),
    channel_id VARCHAR(50),                  -- 채널 API 등록 시
    
    -- 예약 기능
    scheduled_at TIMESTAMP WITH TIME ZONE,   -- NULL이면 즉시 실행
    is_scheduled BOOLEAN GENERATED ALWAYS AS (scheduled_at IS NOT NULL) STORED,
    
    -- 실행 설정
    target_device_percent FLOAT DEFAULT 0.5,  -- 50% 디바이스 사용
    target_executions INTEGER DEFAULT 1,      -- 목표 실행 횟수
    completed_executions INTEGER DEFAULT 0,
    
    -- 인터랙션 설정 (조회수 기반 자동 계산)
    like_probability FLOAT,                   -- 20% 기본, 조회수 기반 조정 가능
    comment_probability FLOAT,                -- 5% 기본, 조회수 기반 조정 가능
    
    -- 상태
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',      -- 대기 중 (예약 시간 전)
        'ready',        -- 실행 가능
        'executing',    -- 실행 중
        'completed',    -- 완료
        'failed',       -- 실패
        'cancelled'     -- 취소
    )),
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 예약 시간 도래 시 자동으로 ready 상태로 변경하는 트리거
CREATE OR REPLACE FUNCTION update_queue_status_on_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at <= CURRENT_TIMESTAMP AND NEW.status = 'pending' THEN
        NEW.status := 'ready';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 2. `comment_pool` - 댓글 풀 (확장)

```sql
CREATE TABLE comment_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    language VARCHAR(10) DEFAULT 'ko',
    
    -- 가중치 (자주 사용될수록 감소)
    weight INTEGER DEFAULT 100,
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `execution_logs` - 실행 로그

```sql
CREATE TABLE execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 관계
    queue_item_id UUID REFERENCES video_queue(id),
    device_id UUID REFERENCES devices(id),
    
    -- 실행 결과
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'success',      -- 성공: 영상 시청 완료
        'partial',      -- 부분 성공: 시청은 했으나 인터랙션 실패
        'failed',       -- 실패: 영상 찾기/재생 실패
        'error'         -- 오류: 시스템 오류 (앱 크래시, 네트워크 등)
    )),
    
    -- 상세 데이터
    watch_duration_seconds INTEGER,
    watch_percent FLOAT,
    did_like BOOLEAN DEFAULT FALSE,
    did_comment BOOLEAN DEFAULT FALSE,
    comment_text TEXT,
    
    -- 검색 정보
    search_keyword VARCHAR(255),
    search_result_rank INTEGER,             -- 검색 결과에서 몇 번째였는지
    
    -- 오류 정보
    error_code VARCHAR(50),
    error_message TEXT,
    screenshot_path VARCHAR(500),
    
    -- 디바이스 상태
    device_logged_in BOOLEAN,               -- 로그인 상태였는지
    
    -- 타임스탬프
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 핵심 프로세스

### Process 1: 연결 유지 (Heartbeat)

```
┌──────────────────────────────────────────────────────────────────┐
│                        HEARTBEAT LOOP                             │
│                                                                   │
│   PC Agent                        Backend                         │
│      │                               │                            │
│      │  POST /heartbeat              │                            │
│      │  {                            │                            │
│      │    pc_id: "PC-001",           │                            │
│      │    devices: [                 │                            │
│      │      { serial: "ABC123",      │                            │
│      │        status: "idle",        │                            │
│      │        logged_in: true,       │   [NEW] 로그인 상태 추적   │
│      │        battery: 85,           │                            │
│      │        temp: 32.5 }           │                            │
│      │    ]                          │                            │
│      │  }                            │                            │
│      │ ────────────────────────────▶ │                            │
│      │                               │  DB 업데이트               │
│      │  200 OK                       │  - device.status           │
│      │  { next_poll: 10s }           │  - device.last_heartbeat   │
│      │ ◀──────────────────────────── │  - device.logged_in        │
│      │                               │                            │
│      │        [10초 대기]            │                            │
│      │                               │                            │
│      │  POST /heartbeat              │                            │
│      │ ────────────────────────────▶ │                            │
│      │         ...반복...            │                            │
└──────────────────────────────────────────────────────────────────┘
```

### Process 2: 대기열 확인 및 작업 분배

```
┌──────────────────────────────────────────────────────────────────┐
│                      TASK DISPATCH FLOW                           │
│                                                                   │
│                            [시작]                                 │
│                               │                                   │
│                               ▼                                   │
│                     ┌─────────────────┐                          │
│                     │ 대기열에 영상이 │                          │
│                     │   있는가?       │                          │
│                     └────────┬────────┘                          │
│                              │                                    │
│             ┌────────────────┼────────────────┐                   │
│             │ NO             │                │ YES               │
│             ▼                                 ▼                   │
│   ┌──────────────────┐             ┌──────────────────┐          │
│   │ AI 검색어 생성   │             │ 영상 정보 가져옴  │          │
│   │                  │             │                  │          │
│   │ "심심한데 유튜브 │             │ - title          │          │
│   │  에서 뭐 검색할까│             │ - view_count     │          │
│   │  ?"              │             │ - duration       │          │
│   └────────┬─────────┘             └────────┬─────────┘          │
│            │                                 │                    │
│            ▼                                 ▼                    │
│   ┌──────────────────┐             ┌──────────────────┐          │
│   │ 임의 검색 실행   │             │ 디바이스 선택    │          │
│   │ (학습/탐색 모드) │             │ (50% 활용)       │          │
│   └──────────────────┘             └────────┬─────────┘          │
│                                             │                    │
│                                             ▼                    │
│                                   ┌──────────────────┐           │
│                                   │ 작업 할당        │           │
│                                   │                  │           │
│                                   │ - 선택된 디바이스│           │
│                                   │ - 나머지 SLEEP   │           │
│                                   └────────┬─────────┘           │
│                                            │                     │
│                                            ▼                     │
│                                        [실행]                    │
└──────────────────────────────────────────────────────────────────┘
```

### Process 3: YouTube 앱 자동화 (Laixi 스크립트)

```
┌──────────────────────────────────────────────────────────────────┐
│              YOUTUBE APP AUTOMATION SCRIPT                        │
│                                                                   │
│   [1] YouTube 앱 실행                                             │
│       │                                                           │
│       │  adb shell am start -n com.google.android.youtube/...    │
│       ▼                                                           │
│   [2] 검색창 탭 (상단 돋보기 아이콘)                               │
│       │                                                           │
│       │  TAP(0.85, 0.05)  // 우상단 검색 아이콘                   │
│       ▼                                                           │
│   [3] 검색어 입력                                                  │
│       │                                                           │
│       │  클립보드에 제목 복사 → 붙여넣기                          │
│       ▼                                                           │
│   [4] 검색 실행 (키보드 엔터 또는 검색 버튼)                       │
│       │                                                           │
│       │  KEYEVENT(66)  // Enter                                   │
│       ▼                                                           │
│   [5] 영상 찾기 (제목 매칭)                                        │
│       │                                                           │
│       │  스크롤하면서 제목 OCR 또는 UI 분석                       │
│       ▼                                                           │
│   [6] 광고 처리                                                    │
│       │                                                           │
│       │  광고 스킵 버튼 감지 → TAP                                │
│       ▼                                                           │
│   [7] 영상 시청 (duration * watchPercent)                         │
│       │                                                           │
│       │  SLEEP(시청시간)                                          │
│       ▼                                                           │
│   [8] 인터랙션 (확률 기반)                                         │
│       │                                                           │
│       ├──[로그인 상태 확인]                                       │
│       │         │                                                 │
│       │         ├── 로그인 O: 좋아요(20%), 댓글(5%) 실행          │
│       │         │                                                 │
│       │         └── 로그인 X: 스킵                                │
│       ▼                                                           │
│   [9] 결과 보고                                                    │
│       │                                                           │
│       │  POST /execution/report                                   │
│       ▼                                                           │
│   [완료]                                                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 성공/실패/오류 정의

| 상태 | 코드 | 설명 | 재시도 |
|------|------|------|--------|
| **SUCCESS** | `success` | 영상 시청 완료 (watchPercent 달성) | N/A |
| **PARTIAL** | `partial` | 시청은 완료했으나 인터랙션 실패 | No |
| **FAILED** | `failed` | 영상 재생 실패 | Yes (max 3) |
| **ERROR** | `error` | 시스템 오류 | Yes (max 3) |

### 상세 오류 코드

| 에러 코드 | 설명 | 대응 |
|-----------|------|------|
| `VIDEO_NOT_FOUND` | 검색 결과에서 영상을 찾지 못함 | 키워드 변경 후 재시도 |
| `APP_CRASH` | YouTube 앱 크래시 | 앱 재시작 후 재시도 |
| `NETWORK_ERROR` | 네트워크 연결 실패 | 대기 후 재시도 |
| `AD_STUCK` | 광고 스킵 불가 상태 | 앱 재시작 |
| `LOGIN_REQUIRED` | 로그인 필요 액션 시도 | 인터랙션 스킵 |
| `TIMEOUT` | 작업 시간 초과 | 재시도 |
| `OVERHEAT` | 디바이스 과열 | 디바이스 휴식 |

---

## 🎲 인터랙션 확률 시스템

### 기본 확률

```python
# 기본값 (조회수와 무관)
BASE_LIKE_PROBABILITY = 0.20     # 20%
BASE_COMMENT_PROBABILITY = 0.05  # 5%
```

### 조회수 기반 조정 (선택적)

```python
def calculate_interaction_probability(view_count: int, base_prob: float) -> float:
    """
    조회수가 적은 영상일수록 인터랙션 확률 증가
    - 조회수 < 1000: 확률 2배
    - 조회수 < 10000: 확률 1.5배
    - 조회수 >= 10000: 기본 확률
    """
    if view_count < 1000:
        return min(base_prob * 2, 1.0)
    elif view_count < 10000:
        return min(base_prob * 1.5, 1.0)
    return base_prob
```

### 로그인 상태 체크

```python
def should_do_interaction(device: Device, probability: float) -> bool:
    """인터랙션 실행 여부 결정"""
    # 비로그인 시 항상 False
    if not device.logged_in:
        return False
    
    # 확률 기반 결정
    return random.random() < probability
```

---

## 🔌 API 엔드포인트

### 영상 대기열 관리

```
POST   /api/youtube/queue              # 영상 추가 (직접 등록)
POST   /api/youtube/queue/from-channel # 채널 최신 영상 추가
GET    /api/youtube/queue              # 대기열 목록
GET    /api/youtube/queue/:id          # 단일 항목 조회
PATCH  /api/youtube/queue/:id          # 수정 (예약 시간 등)
DELETE /api/youtube/queue/:id          # 삭제/취소
```

### 작업 분배

```
POST   /api/dispatch/assign            # 작업 할당 (PC Agent 호출)
POST   /api/dispatch/report            # 실행 결과 보고
GET    /api/dispatch/status            # 현재 분배 상태
```

### AI 검색어 생성

```
POST   /api/ai/search-keyword          # "심심한데 뭐 검색할까?" 호출
```

---

## 🛠️ 필요 환경

### 서버 요구사항

| 구성요소 | 최소 사양 | 권장 사양 |
|----------|-----------|-----------|
| **OS** | Ubuntu 22.04 | Ubuntu 22.04 LTS |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4GB | 8GB |
| **Storage** | 50GB SSD | 100GB SSD |
| **Network** | 100Mbps | 1Gbps |

### 마스터 PC 요구사항

| 구성요소 | 요구사항 |
|----------|----------|
| **OS** | Windows 10/11 |
| **Laixi** | v2.0+ |
| **Python** | 3.10+ |
| **ADB** | Platform Tools 34+ |
| **연결 가능 디바이스** | 최대 100대/PC |

### 환경 변수

```env
# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/aifarm
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx

# AI Service (선택)
OPENAI_API_KEY=sk-xxx
AI_MODEL=gpt-4-turbo

# YouTube API
YOUTUBE_API_KEY=xxx
```

---

## 📈 예상 성능

### 처리량

| PC 수 | 디바이스 수 | 활성 디바이스 (50%) | 시간당 완료 |
|-------|-------------|---------------------|-------------|
| 1대 | 100대 | 50대 | ~60건 (5분 평균 시청) |
| 3대 | 300대 | 150대 | ~180건 |
| 6대 | 600대 | 300대 | ~360건 |

### 인터랙션 예상치 (1000건 실행 기준)

| 항목 | 확률 | 예상 횟수 | 비고 |
|------|------|-----------|------|
| 시청 완료 | 95% | 950건 | 5% 실패 가정 |
| 좋아요 | 20% | ~190건 | 로그인 디바이스만 |
| 댓글 | 5% | ~48건 | 로그인 디바이스만 |

---

## 🧪 테스트 계획

### 단위 테스트

- [ ] `youtube_queue_service.py` - 대기열 CRUD
- [ ] `device_dispatch_engine.py` - 50% 분배 로직
- [ ] `ai_search_generator.py` - AI 검색어 생성
- [ ] `result_reporter.py` - 결과 집계

### 통합 테스트

- [ ] 전체 플로우: 등록 → 분배 → 실행 → 보고
- [ ] 예약 기능: 시간 도래 시 자동 활성화
- [ ] 에러 핸들링: 실패 시 재시도 로직

### E2E 테스트

- [ ] 실제 디바이스 10대로 1시간 테스트
- [ ] 네트워크 불안정 상황 시뮬레이션
- [ ] 디바이스 과열 시 휴식 전환

---

## 📅 구현 로드맵

### Phase 1: 기반 구축 (1-2일)

- [x] PR 설계 문서 작성
- [ ] DB 마이그레이션 스크립트
- [ ] 기본 스키마 구현

### Phase 2: 핵심 서비스 (3-4일)

- [ ] 영상 대기열 서비스
- [ ] 작업 분배 엔진
- [ ] Heartbeat 확장 (로그인 상태 추적)

### Phase 3: 자동화 스크립트 (2-3일)

- [ ] Laixi 스크립트 작성 (YouTube 앱용)
- [ ] 좌표 매핑 문서화
- [ ] 광고 스킵 로직

### Phase 4: AI 연동 (1-2일)

- [ ] AI 검색어 생성 서비스
- [ ] "심심한데 뭐 검색할까?" 프롬프트 설계

### Phase 5: 테스트 & 최적화 (2-3일)

- [ ] 단위/통합 테스트
- [ ] 성능 최적화
- [ ] 문서화 완료

---

## 📝 참고 자료

### ADSpower 프로세스 분석 (브라우저용 → 앱 변환)

원본 ADSpower 프로세스 주요 단계:
1. 새 페이지 열기 → **앱 실행으로 대체**
2. `input[name="search_query"]` 클릭 → **검색 아이콘 탭**
3. 검색어 입력 → **클립보드 복사 후 붙여넣기**
4. 검색 버튼 클릭 → **키보드 엔터**
5. 영상 제목으로 찾기 → **OCR 또는 UI 분석**
6. 광고 스킵 버튼 클릭 → **좌표 기반 탭**
7. 좋아요 클릭 → **좌표 기반 탭**
8. 댓글 입력 → **클립보드 복사 후 붙여넣기**
9. 댓글 제출 → **제출 버튼 탭**

### YouTube 앱 좌표 (Galaxy S9, 1440x2960)

| 요소 | X% | Y% | 비고 |
|------|-----|-----|------|
| 검색 아이콘 | 0.85 | 0.05 | 우상단 |
| 첫 번째 검색 결과 | 0.5 | 0.25 | 스크롤 후 조정 필요 |
| 좋아요 버튼 | 0.15 | 0.65 | 영상 재생 중 |
| 댓글 입력창 | 0.5 | 0.85 | 스크롤 다운 필요 |
| 광고 스킵 | 0.9 | 0.85 | 우하단 (5초 후 표시) |

---

## ✅ 체크리스트

- [ ] DB 마이그레이션 완료
- [ ] 백엔드 서비스 구현
- [ ] Laixi 스크립트 작성
- [ ] API 엔드포인트 구현
- [ ] 대시보드 UI 연동
- [ ] 테스트 케이스 작성
- [ ] 문서화 완료
- [ ] 코드 리뷰 완료
- [ ] 프로덕션 배포

---

## 🔗 관련 이슈

- 연관 이슈: YouTube 자동화 시스템 구축
- 의존성: Laixi WebSocket API, Supabase DB

---

**작성자**: Axon (Tech Lead)  
**작성일**: 2026-01-09  
**최종 수정**: 2026-01-09
