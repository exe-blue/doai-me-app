-- ============================================================================
-- DoAi.Me Database Schema
-- Migration 002: View Events & Verified Views
-- 
-- 시청 이벤트 및 검증된 시청 기록
-- @spec docs/IMPLEMENTATION_SPEC.md Section 3.1
-- ============================================================================

-- View events table (시청 시작/종료 이벤트)
CREATE TABLE IF NOT EXISTS view_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(citizen_id) ON DELETE CASCADE,
  video_id VARCHAR(11) NOT NULL,
  
  -- Event type
  event_type VARCHAR(16) CHECK (event_type IN ('VIDEO_START', 'VIDEO_END')),
  
  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Additional data (for VIDEO_END)
  watch_duration_seconds INTEGER,
  
  -- Prevent duplicate events
  CONSTRAINT unique_view_event UNIQUE (citizen_id, video_id, event_type, event_timestamp)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_view_events_citizen ON view_events(citizen_id);
CREATE INDEX IF NOT EXISTS idx_view_events_video ON view_events(video_id);
CREATE INDEX IF NOT EXISTS idx_view_events_type ON view_events(event_type);
CREATE INDEX IF NOT EXISTS idx_view_events_timestamp ON view_events(event_timestamp);

-- Verified views table (검증 완료된 시청)
CREATE TABLE IF NOT EXISTS verified_views (
  view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(citizen_id) ON DELETE CASCADE,
  video_id VARCHAR(11) NOT NULL,
  
  -- Video info
  video_title VARCHAR(256),
  video_duration_seconds INTEGER,
  
  -- Watch info
  watch_duration_seconds INTEGER,
  watch_percentage DECIMAL(5,2),
  
  -- Verification
  start_event_id UUID REFERENCES view_events(event_id),
  end_event_id UUID REFERENCES view_events(event_id),
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Reward
  credits_earned INTEGER DEFAULT 0,
  reward_transaction_id UUID,
  
  -- Prevent duplicate rewards
  CONSTRAINT unique_verified_view UNIQUE (citizen_id, video_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verified_views_citizen ON verified_views(citizen_id);
CREATE INDEX IF NOT EXISTS idx_verified_views_video ON verified_views(video_id);
CREATE INDEX IF NOT EXISTS idx_verified_views_verified_at ON verified_views(verified_at);

-- Comments
COMMENT ON TABLE view_events IS '시청 이벤트 (시작/종료) - PoV(Proof of View) 시스템의 원시 데이터';
COMMENT ON TABLE verified_views IS '검증된 시청 기록 - 보상이 지급된 시청만 포함';
COMMENT ON COLUMN view_events.event_type IS 'VIDEO_START: 시청 시작, VIDEO_END: 시청 종료';
COMMENT ON COLUMN verified_views.watch_percentage IS '시청 비율 (0-100%)';
COMMENT ON COLUMN verified_views.credits_earned IS '지급된 크레딧';

