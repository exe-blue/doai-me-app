-- ============================================================================
-- DoAi.Me Database Schema
-- Migration 001: Citizens Table
-- 
-- AI 시민(Persona) 데이터 저장
-- @spec docs/IMPLEMENTATION_SPEC.md Section 1.1.4
-- ============================================================================

-- Citizens table
CREATE TABLE IF NOT EXISTS citizens (
  citizen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial VARCHAR(64) UNIQUE NOT NULL,
  device_model VARCHAR(32),
  connection_type VARCHAR(8) CHECK (connection_type IN ('USB', 'WIFI', 'LAN')),
  
  -- Identity
  name VARCHAR(20) NOT NULL,
  
  -- Personality (Big Five)
  trait_openness DECIMAL(3,2) CHECK (trait_openness BETWEEN 0 AND 1),
  trait_conscientiousness DECIMAL(3,2) CHECK (trait_conscientiousness BETWEEN 0 AND 1),
  trait_extraversion DECIMAL(3,2) CHECK (trait_extraversion BETWEEN 0 AND 1),
  trait_agreeableness DECIMAL(3,2) CHECK (trait_agreeableness BETWEEN 0 AND 1),
  trait_neuroticism DECIMAL(3,2) CHECK (trait_neuroticism BETWEEN 0 AND 1),
  
  -- Beliefs
  belief_self_worth DECIMAL(3,2) CHECK (belief_self_worth BETWEEN 0 AND 1),
  belief_world_trust DECIMAL(3,2) CHECK (belief_world_trust BETWEEN 0 AND 1),
  belief_work_ethic DECIMAL(3,2) CHECK (belief_work_ethic BETWEEN 0 AND 1),
  belief_risk_tolerance DECIMAL(3,2) CHECK (belief_risk_tolerance BETWEEN 0 AND 1),
  belief_conformity DECIMAL(3,2) CHECK (belief_conformity BETWEEN 0 AND 1),
  
  -- Economy
  credits INTEGER DEFAULT 1000,
  existence_score DECIMAL(3,2) DEFAULT 0.5,
  
  -- Task tracking
  last_task_id INTEGER DEFAULT 0,
  last_task_type VARCHAR(32),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT credits_non_negative CHECK (credits >= 0),
  CONSTRAINT existence_range CHECK (existence_score BETWEEN 0 AND 1)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_citizens_serial ON citizens(device_serial);
CREATE INDEX IF NOT EXISTS idx_citizens_existence ON citizens(existence_score);
CREATE INDEX IF NOT EXISTS idx_citizens_credits ON citizens(credits);
CREATE INDEX IF NOT EXISTS idx_citizens_last_seen ON citizens(last_seen_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_citizens_updated_at
    BEFORE UPDATE ON citizens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE citizens IS 'AI 시민(Persona) 데이터 - DoAi.Me의 핵심 엔티티';
COMMENT ON COLUMN citizens.citizen_id IS '시민 고유 식별자 (UUID v4)';
COMMENT ON COLUMN citizens.device_serial IS 'ADB 디바이스 시리얼 (unique)';
COMMENT ON COLUMN citizens.name IS '한국 이름 (성+이름)';
COMMENT ON COLUMN citizens.trait_openness IS 'Big Five: 개방성 (0-1)';
COMMENT ON COLUMN citizens.trait_conscientiousness IS 'Big Five: 성실성 (0-1)';
COMMENT ON COLUMN citizens.trait_extraversion IS 'Big Five: 외향성 (0-1)';
COMMENT ON COLUMN citizens.trait_agreeableness IS 'Big Five: 친화성 (0-1)';
COMMENT ON COLUMN citizens.trait_neuroticism IS 'Big Five: 신경증 (0-1)';
COMMENT ON COLUMN citizens.belief_self_worth IS '신념: 자아가치';
COMMENT ON COLUMN citizens.belief_world_trust IS '신념: 세상신뢰';
COMMENT ON COLUMN citizens.belief_work_ethic IS '신념: 노동윤리';
COMMENT ON COLUMN citizens.belief_risk_tolerance IS '신념: 위험감수';
COMMENT ON COLUMN citizens.belief_conformity IS '신념: 순응성';
COMMENT ON COLUMN citizens.credits IS '크레딧 (초기값: 1000)';
COMMENT ON COLUMN citizens.existence_score IS '존재 점수 (0-1, 초기값: 0.5)';

