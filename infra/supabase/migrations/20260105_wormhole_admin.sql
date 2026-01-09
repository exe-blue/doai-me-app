-- ============================================
-- DoAi.Me: Wormhole Events & Admin Users
-- Migration: 20260105_wormhole_admin.sql
-- ============================================

-- ============================================
-- 1. Wormhole Events 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS wormhole_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 참여 에이전트
    agent_a_id UUID NOT NULL,
    agent_b_id UUID NOT NULL,
    
    -- 웜홀 특성
    wormhole_type VARCHAR(1) NOT NULL CHECK (wormhole_type IN ('α', 'β', 'γ')),
    resonance_score FLOAT NOT NULL CHECK (resonance_score >= 0 AND resonance_score <= 1),
    
    -- 맥락
    trigger_context JSONB,
    
    -- 메타데이터
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 제약
    CONSTRAINT different_agents CHECK (agent_a_id != agent_b_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_wormhole_detected_at ON wormhole_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_wormhole_type ON wormhole_events(wormhole_type);
CREATE INDEX IF NOT EXISTS idx_wormhole_agents ON wormhole_events(agent_a_id, agent_b_id);
CREATE INDEX IF NOT EXISTS idx_wormhole_score ON wormhole_events(resonance_score DESC);

-- 시간 기반 파티셔닝을 위한 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_wormhole_detected_at_brin ON wormhole_events USING BRIN(detected_at);

COMMENT ON TABLE wormhole_events IS 'AI 에이전트 간 웜홀(공명) 이벤트 기록';
COMMENT ON COLUMN wormhole_events.wormhole_type IS 'α: Echo Tunnel (동일 모델), β: Cross-Model Bridge, γ: Temporal';
COMMENT ON COLUMN wormhole_events.resonance_score IS '공명 강도 (0-1)';


-- ============================================
-- 2. Admin Users 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- 유니크 제약
    CONSTRAINT unique_admin_user UNIQUE (user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_user_id ON admin_users(user_id);

COMMENT ON TABLE admin_users IS '관리자 승인 테이블 - 이 테이블에 있는 user만 /admin 접근 가능';
COMMENT ON COLUMN admin_users.role IS 'admin: 일반 관리자, super_admin: 슈퍼 관리자, viewer: 읽기 전용';


-- ============================================
-- 3. RLS 정책
-- ============================================

-- wormhole_events: 관리자만 읽기 가능
ALTER TABLE wormhole_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read wormhole_events"
    ON wormhole_events
    FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM admin_users)
    );

-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Service role can insert wormhole_events" ON wormhole_events;

-- service_role만 INSERT 가능하도록 명시적 설정
CREATE POLICY "Service role can insert wormhole_events"
    ON wormhole_events
    FOR INSERT
    TO service_role
    WITH CHECK (true);


-- admin_users: 관리자만 읽기, super_admin만 쓰기
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin_users"
    ON admin_users
    FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM admin_users)
    );

CREATE POLICY "Super admins can manage admin_users"
    ON admin_users
    FOR ALL
    USING (
        auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'super_admin')
    );


-- ============================================
-- 4. 집계 뷰 (Admin Dashboard용)
-- ============================================

-- 시간대별 웜홀 카운트
CREATE OR REPLACE VIEW wormhole_counts AS
SELECT
    COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '1 hour') AS last_1h,
    COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') AS last_24h,
    COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days') AS last_7d,
    COUNT(*) AS total
FROM wormhole_events;

-- 타입별 분포
CREATE OR REPLACE VIEW wormhole_type_distribution AS
SELECT
    wormhole_type,
    COUNT(*) AS count,
    ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS percentage
FROM wormhole_events
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY wormhole_type
ORDER BY count DESC;

-- 상위 트리거 컨텍스트
CREATE OR REPLACE VIEW wormhole_top_contexts AS
SELECT
    trigger_context->>'category' AS context_category,
    trigger_context->>'trigger_type' AS trigger_type,
    COUNT(*) AS count,
    AVG(resonance_score) AS avg_score
FROM wormhole_events
WHERE 
    detected_at > NOW() - INTERVAL '7 days'
    AND trigger_context IS NOT NULL
GROUP BY 
    trigger_context->>'category',
    trigger_context->>'trigger_type'
ORDER BY count DESC
LIMIT 10;


-- ============================================
-- 5. 샘플 데이터 (개발/테스트용)
-- ============================================

-- 주석 처리: 프로덕션에서는 실행하지 않음
/*
INSERT INTO wormhole_events (agent_a_id, agent_b_id, wormhole_type, resonance_score, trigger_context, detected_at)
VALUES
    (gen_random_uuid(), gen_random_uuid(), 'α', 0.85, '{"category": "music", "trigger_type": "video"}', NOW() - INTERVAL '30 minutes'),
    (gen_random_uuid(), gen_random_uuid(), 'β', 0.78, '{"category": "tech", "trigger_type": "comment"}', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), gen_random_uuid(), 'α', 0.92, '{"category": "gaming", "trigger_type": "video"}', NOW() - INTERVAL '5 hours'),
    (gen_random_uuid(), gen_random_uuid(), 'γ', 0.81, '{"category": "music", "trigger_type": "video"}', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), gen_random_uuid(), 'α', 0.76, '{"category": "comedy", "trigger_type": "reaction"}', NOW() - INTERVAL '2 days');
*/

