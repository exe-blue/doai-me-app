-- ============================================================================
-- DoAi.Me Database Schema
-- Migration 005: Accidents
-- 
-- Accident 시스템 (사회적 이벤트)
-- @spec docs/IMPLEMENTATION_SPEC.md Section 4.1
-- ============================================================================

-- Accidents table
CREATE TABLE IF NOT EXISTS accidents (
  accident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  headline VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Classification
  severity VARCHAR(16) CHECK (severity IN (
    'MINOR',       -- 경미 (existence -0.05)
    'MODERATE',    -- 보통 (existence -0.1)
    'SEVERE',      -- 심각 (existence -0.2)
    'CATASTROPHIC' -- 재앙 (existence -0.3)
  )),
  accident_type VARCHAR(32) CHECK (accident_type IN (
    'NATURAL_DISASTER', -- 자연재해
    'ECONOMIC_CRISIS',  -- 경제위기
    'SOCIAL_UNREST',    -- 사회불안
    'TECHNOLOGICAL',    -- 기술사고
    'PANDEMIC',         -- 전염병
    'WAR'               -- 전쟁/분쟁
  )),
  
  -- Impact
  affected_belief VARCHAR(16) CHECK (affected_belief IN (
    'SELF_WORTH',
    'WORLD_TRUST',
    'WORK_ETHIC',
    'RISK_TOLERANCE',
    'CONFORMITY'
  )),
  credits_impact INTEGER CHECK (credits_impact BETWEEN -1000 AND 0),
  existence_impact DECIMAL(3,2) CHECK (existence_impact BETWEEN -0.3 AND 0),
  duration_minutes INTEGER CHECK (duration_minutes BETWEEN 1 AND 60),
  
  -- Dilemma (optional)
  has_dilemma BOOLEAN DEFAULT false,
  dilemma_question VARCHAR(200),
  dilemma_options JSONB, -- [{id, text, belief_impact}]
  
  -- Status
  status VARCHAR(16) DEFAULT 'ACTIVE' CHECK (status IN (
    'PENDING',   -- 예약됨
    'ACTIVE',    -- 진행 중
    'ENDED',     -- 종료됨
    'CANCELLED'  -- 취소됨
  )),
  affected_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Admin info
  created_by VARCHAR(64)
);

-- Accident impacts (영향 받은 시민 기록)
CREATE TABLE IF NOT EXISTS accident_impacts (
  impact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(accident_id) ON DELETE CASCADE,
  citizen_id UUID REFERENCES citizens(citizen_id) ON DELETE CASCADE,
  
  -- Impact applied
  credits_before INTEGER,
  credits_after INTEGER,
  existence_before DECIMAL(3,2),
  existence_after DECIMAL(3,2),
  
  -- Dilemma response (if applicable)
  dilemma_choice_id VARCHAR(32),
  dilemma_choice_text VARCHAR(100),
  
  -- Timestamp
  impacted_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_accident_impact UNIQUE (accident_id, citizen_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accidents_status ON accidents(status);
CREATE INDEX IF NOT EXISTS idx_accidents_severity ON accidents(severity);
CREATE INDEX IF NOT EXISTS idx_accidents_type ON accidents(accident_type);
CREATE INDEX IF NOT EXISTS idx_accident_impacts_citizen ON accident_impacts(citizen_id);
CREATE INDEX IF NOT EXISTS idx_accident_impacts_accident ON accident_impacts(accident_id);

-- Comments
COMMENT ON TABLE accidents IS 'Accident - 사회적 이벤트 (재난, 위기 등)';
COMMENT ON TABLE accident_impacts IS 'Accident 영향 기록';
COMMENT ON COLUMN accidents.dilemma_options IS 'JSON 배열: [{id, text, belief_impact: {belief: delta}}]';

