-- ============================================================================
-- DoAi.Me Database Schema
-- Migration 004: Commissions (POP)
-- 
-- 커미션(POP) 시스템
-- @spec docs/IMPLEMENTATION_SPEC.md Section 4.2
-- ============================================================================

-- Commissions table
CREATE TABLE IF NOT EXISTS commissions (
  commission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Video info
  video_id VARCHAR(11) NOT NULL,
  title VARCHAR(256) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  thumbnail_url TEXT,
  channel_name VARCHAR(128),
  
  -- Commission settings
  commission_type VARCHAR(16) CHECK (commission_type IN (
    'WATCH_FULL',    -- 전체 시청 (90%+)
    'WATCH_PARTIAL', -- 부분 시청 (30초+)
    'LIKE',          -- 좋아요
    'SUBSCRIBE',     -- 구독
    'COMMENT'        -- 댓글
  )),
  priority INTEGER CHECK (priority IN (2, 3, 4)), -- URGENT=2, NORMAL=3, LOW=4
  credits_reward INTEGER CHECK (credits_reward BETWEEN 1 AND 100),
  target_count INTEGER CHECK (target_count BETWEEN 1 AND 600),
  
  -- Status
  status VARCHAR(16) DEFAULT 'ACTIVE' CHECK (status IN (
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'EXPIRED',
    'CANCELLED'
  )),
  completed_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Admin info
  created_by VARCHAR(64),
  memo TEXT
);

-- Commission completions
CREATE TABLE IF NOT EXISTS commission_completions (
  completion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID REFERENCES commissions(commission_id) ON DELETE CASCADE,
  citizen_id UUID REFERENCES citizens(citizen_id) ON DELETE CASCADE,
  
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  credits_earned INTEGER,
  transaction_id UUID REFERENCES credit_transactions(transaction_id),
  
  CONSTRAINT unique_completion UNIQUE (commission_id, citizen_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_video ON commissions(video_id);
CREATE INDEX IF NOT EXISTS idx_commissions_priority ON commissions(priority);
CREATE INDEX IF NOT EXISTS idx_completions_citizen ON commission_completions(citizen_id);
CREATE INDEX IF NOT EXISTS idx_completions_commission ON commission_completions(commission_id);

-- Comments
COMMENT ON TABLE commissions IS '커미션(POP) - 관리자가 등록한 시청 미션';
COMMENT ON TABLE commission_completions IS '커미션 완료 기록';
COMMENT ON COLUMN commissions.priority IS '우선순위 (2=URGENT, 3=NORMAL, 4=LOW)';

