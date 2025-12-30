# AIFarm Database Schema Requirements

이 문서는 AIFarm 대시보드의 모든 기능을 지원하기 위해 필요한 데이터베이스 스키마를 정의합니다.

## 1. Activities (활동)

### `activities` 테이블

```sql
CREATE TABLE activities (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  description TEXT,
  color VARCHAR(20) NOT NULL,
  allocated_devices INTEGER DEFAULT 0,
  active_devices INTEGER DEFAULT 0,
  items_processed_today INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**기본 데이터 예시:**

- shorts_remix, playlist_curator, persona_commenter, trend_scout, challenge_hunter, thumbnail_lab

---

## 2. Channels (채널)

### `channels` 테이블

```sql
CREATE TABLE channels (
  id VARCHAR(50) PRIMARY KEY,
  youtube_channel_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  thumbnail_url TEXT,
  subscriber_count BIGINT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  experience_to_next_level INTEGER DEFAULT 1000,
  composite_score DECIMAL(5,2) DEFAULT 0,
  category_rank INTEGER DEFAULT 0,
  global_rank INTEGER DEFAULT 0,
  weekly_growth DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `channel_stats` 테이블

```sql
CREATE TABLE channel_stats (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(50) REFERENCES channels(id) ON DELETE CASCADE,
  hp INTEGER DEFAULT 0,
  mp INTEGER DEFAULT 0,
  atk INTEGER DEFAULT 0,
  def INTEGER DEFAULT 0,
  spd INTEGER DEFAULT 0,
  intelligence INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **Note:** The column `intelligence` was renamed from `int` to avoid conflicts with SQL reserved words.

---

## 3. Competitors (경쟁자)

### `competitors` 테이블

```sql
CREATE TABLE competitors (
  id VARCHAR(50) PRIMARY KEY,
  youtube_channel_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  subscriber_count BIGINT DEFAULT 0,
  recent_views BIGINT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  category_rank INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Quests (퀘스트)

### `quests` 테이블

```sql
CREATE TABLE quests (
  id VARCHAR(50) PRIMARY KEY,
  channel_id VARCHAR(50) REFERENCES channels(id) ON DELETE CASCADE,
  quest_type VARCHAR(20) NOT NULL, -- daily, weekly, achievement
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_metric VARCHAR(50), -- views, comments, subscribers, viral, trend_catch
  target_value INTEGER DEFAULT 0,
  current_value INTEGER DEFAULT 0,
  progress DECIMAL(5,2) DEFAULT 0,
  reward_exp INTEGER DEFAULT 0,
  reward_badge VARCHAR(10),
  status VARCHAR(20) DEFAULT 'active', -- active, completed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## 5. Battle Log (배틀 로그)

### `battle_log` 테이블

```sql
CREATE TABLE battle_log (
  id VARCHAR(50) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- viral_hit, rank_up, rank_down, quest_complete, trend_catch, challenge_join
  our_channel_name VARCHAR(200),
  competitor_channel_name VARCHAR(200),
  description TEXT NOT NULL,
  impact_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Trending Shorts (트렌딩 쇼츠)

### `trending_shorts` 테이블

```sql
CREATE TABLE trending_shorts (
  id VARCHAR(50) PRIMARY KEY,
  video_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  channel_name VARCHAR(200),
  view_count BIGINT DEFAULT 0,
  viral_score DECIMAL(3,2) DEFAULT 0,
  viral_factors TEXT[], -- PostgreSQL array
  music_title VARCHAR(200),
  hashtags TEXT[], -- PostgreSQL array
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Remix Ideas (리믹스 아이디어)

### `remix_ideas` 테이블

```sql
CREATE TABLE remix_ideas (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  concept_description TEXT,
  differentiation_point TEXT,
  remix_direction VARCHAR(50), -- twist, parody, expand, mashup
  recommended_music VARCHAR(200),
  estimated_viral_probability DECIMAL(3,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `remix_idea_sources` 테이블 (Many-to-Many)

```sql
CREATE TABLE remix_idea_sources (
  id SERIAL PRIMARY KEY,
  remix_idea_id VARCHAR(50) REFERENCES remix_ideas(id) ON DELETE CASCADE,
  trending_short_id VARCHAR(50) REFERENCES trending_shorts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Challenges (챌린지)

### `challenges` 테이블

```sql
CREATE TABLE challenges (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  hashtags TEXT[], -- PostgreSQL array
  lifecycle_stage VARCHAR(20), -- birth, growth, peak, decline
  total_participants INTEGER DEFAULT 0,
  daily_new_participants INTEGER DEFAULT 0,
  avg_view_count BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  first_detected_at TIMESTAMP,
  opportunity_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 9. Personas (페르소나)

### `personas` 테이블

```sql
CREATE TABLE personas (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INTEGER,
  interests TEXT[], -- PostgreSQL array
  tone_description TEXT,
  sample_comments TEXT[], -- PostgreSQL array
  is_active BOOLEAN DEFAULT true,
  comments_today INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Playlist Themes (플레이리스트 테마)

### `playlist_themes` 테이블

```sql
CREATE TABLE playlist_themes (
  id VARCHAR(50) PRIMARY KEY,
  theme_name VARCHAR(200) NOT NULL,
  theme_description TEXT,
  search_keywords TEXT[], -- PostgreSQL array
  mood_tags TEXT[], -- PostgreSQL array
  target_video_count INTEGER DEFAULT 0,
  current_video_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, paused
  theme_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 11. Dashboard Stats (대시보드 통계)

### `dashboard_stats` 테이블

```sql
CREATE TABLE dashboard_stats (
  id SERIAL PRIMARY KEY,
  total_devices INTEGER DEFAULT 0,
  active_devices INTEGER DEFAULT 0,
  idle_devices INTEGER DEFAULT 0,
  error_devices INTEGER DEFAULT 0,
  total_channels INTEGER DEFAULT 0,
  avg_channel_level DECIMAL(5,2) DEFAULT 0,
  total_quests_active INTEGER DEFAULT 0,
  quests_completed_today INTEGER DEFAULT 0,
  trends_detected_today INTEGER DEFAULT 0,
  remix_ideas_today INTEGER DEFAULT 0,
  challenges_tracked INTEGER DEFAULT 0,
  comments_posted_today INTEGER DEFAULT 0,
  recorded_at DATE UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. Notifications (알림)

### `notifications` 테이블

```sql
CREATE TABLE notifications (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL, -- success, alert, warning, error, info
  source_activity VARCHAR(50),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 13. Devices (디바이스)

### `devices` 테이블

```sql
CREATE TABLE devices (
  id INTEGER PRIMARY KEY,
  phone_board_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'idle', -- active, idle, error, offline
  current_activity VARCHAR(50),
  total_activities_today INTEGER DEFAULT 0,
  error_count_today INTEGER DEFAULT 0,
  last_active_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 14. DO Requests (DO 요청)

### `do_requests` 테이블

```sql
CREATE TABLE do_requests (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- youtube_watch, youtube_comment, youtube_subscribe
  title VARCHAR(200) NOT NULL,
  description TEXT,
  keyword VARCHAR(200),
  video_title VARCHAR(500),
  video_url TEXT,
  video_id VARCHAR(100),
  channel_name VARCHAR(200),
  agent_range_start INTEGER,
  agent_range_end INTEGER,
  batch_size INTEGER DEFAULT 5,
  like_probability INTEGER DEFAULT 0,
  comment_probability INTEGER DEFAULT 0,
  subscribe_probability INTEGER DEFAULT 0,
  watch_time_min INTEGER DEFAULT 0,
  watch_time_max INTEGER DEFAULT 0,
  watch_percent_min INTEGER DEFAULT 0,
  watch_percent_max INTEGER DEFAULT 0,
  ai_comment_enabled BOOLEAN DEFAULT false,
  ai_comment_style VARCHAR(200),
  scheduled_at TIMESTAMP,
  execute_immediately BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, failed, cancelled
  priority INTEGER DEFAULT 3,
  total_agents INTEGER DEFAULT 0,
  completed_agents INTEGER DEFAULT 0,
  failed_agents INTEGER DEFAULT 0,
  memo TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## 15. BE Activity Logs (백엔드 활동 로그)

### `be_activity_logs` 테이블

```sql
CREATE TABLE be_activity_logs (
  id VARCHAR(50) PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id),
  activity_type VARCHAR(50) NOT NULL,
  do_request_id VARCHAR(50) REFERENCES do_requests(id),
  description TEXT NOT NULL,
  result VARCHAR(20), -- success, partial, failed
  discovered_data JSONB,
  metrics JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER, -- milliseconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 16. Unified Logs (통합 로그)

### `unified_logs` 테이블

```sql
CREATE TABLE unified_logs (
  id VARCHAR(50) PRIMARY KEY,
  source VARCHAR(10) NOT NULL, -- BE, DO
  source_id VARCHAR(50) NOT NULL,
  device_id INTEGER,
  activity_type VARCHAR(50),
  description TEXT NOT NULL,
  status VARCHAR(20), -- success, partial, failed, in_progress, scheduled, pending, cancelled
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 인덱스 생성 권장사항

```sql
-- Channels
CREATE INDEX idx_channels_youtube_id ON channels(youtube_channel_id);
CREATE INDEX idx_channels_category ON channels(category);
CREATE INDEX idx_channels_rank ON channels(category_rank, global_rank);

-- Devices
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_phone_board ON devices(phone_board_id);
CREATE INDEX idx_devices_activity ON devices(current_activity);

-- Battle Log
CREATE INDEX idx_battle_log_created ON battle_log(created_at DESC);
CREATE INDEX idx_battle_log_type ON battle_log(event_type);

-- Notifications
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- DO Requests
CREATE INDEX idx_do_requests_status ON do_requests(status);
CREATE INDEX idx_do_requests_created ON do_requests(created_at DESC);

-- Unified Logs
CREATE INDEX idx_unified_logs_timestamp ON unified_logs(timestamp DESC);
CREATE INDEX idx_unified_logs_source ON unified_logs(source);
CREATE INDEX idx_unified_logs_status ON unified_logs(status);
```

---

## 초기 데이터 마이그레이션

데이터베이스 스키마 생성 후:

1. 각 테이블의 기본 데이터가 없으면 NULL 또는 0으로 표시
2. 프론트엔드는 빈 데이터를 적절하게 처리
3. 실제 백엔드 시스템이 데이터를 수집하기 시작하면 점진적으로 채워짐

---

## 데이터베이스 선택

- **PostgreSQL** (권장): 배열, JSONB 지원, 확장성
- **MySQL/MariaDB**: JSON 컬럼으로 대체 가능
- **SQLite**: 개발/테스트용

---

## 환경 변수 설정

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aifarm
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aifarm
DB_USER=user
DB_PASSWORD=password
```
