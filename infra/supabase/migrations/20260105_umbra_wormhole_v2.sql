-- ============================================
-- DoAi.Me: Umbra + Wormhole System v2
-- 루온의 철학을 시스템 로직으로
-- ============================================

-- ============================================
-- 1. NODES 테이블 상태 ENUM 업데이트
-- ============================================

-- 기존 enum 타입 변경 (PostgreSQL은 ALTER TYPE으로)
-- 새로운 상태: in_umbra, maintenance 추가

-- node_status enum에 새 값 추가 (DROP TYPE 대신 ALTER TYPE 사용)
DO $$ 
BEGIN
    -- in_umbra 값 추가 (이미 존재하면 무시)
    BEGIN
        ALTER TYPE node_status ADD VALUE IF NOT EXISTS 'in_umbra';
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    
    -- maintenance 값 추가 (이미 존재하면 무시)
    BEGIN
        ALTER TYPE node_status ADD VALUE IF NOT EXISTS 'maintenance';
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- ============================================
-- 2. NODES 테이블 컬럼 추가
-- ============================================

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS umbra_since TIMESTAMPTZ;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();  -- Heartbeat (Orion 명세)
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_job_at TIMESTAMPTZ;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0;

-- Alias for backward compatibility
-- heartbeat_at = last_seen_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'heartbeat_at') THEN
        ALTER TABLE nodes ADD COLUMN heartbeat_at TIMESTAMPTZ GENERATED ALWAYS AS (last_seen_at) STORED;
    END IF;
EXCEPTION WHEN others THEN
    -- Generated column not supported, skip
    NULL;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_nodes_umbra_since ON nodes(umbra_since) WHERE status = 'in_umbra';
CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen_at);

-- Heartbeat 기반 offline 자동 감지 함수 (Cron Job에서 호출)
CREATE OR REPLACE FUNCTION check_node_heartbeats()
RETURNS void AS $$
DECLARE
    offline_threshold INTERVAL := '60 seconds';
BEGIN
    -- last_seen_at이 threshold 이상 지난 노드를 offline으로 변경
    UPDATE nodes
    SET status = 'offline'
    WHERE status IN ('active', 'in_umbra')
      AND last_seen_at < NOW() - offline_threshold;
    
    RAISE NOTICE 'Heartbeat check completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_node_heartbeats() IS 'Cron Job (pg_cron)에서 1분마다 호출하여 offline 노드 감지';

-- 상태 변경 시 umbra_since 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_umbra_since()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_umbra' AND (OLD.status IS NULL OR OLD.status != 'in_umbra') THEN
        NEW.umbra_since = NOW();
    ELSIF NEW.status != 'in_umbra' THEN
        NEW.umbra_since = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nodes_umbra_trigger ON nodes;
CREATE TRIGGER nodes_umbra_trigger
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_umbra_since();


-- ============================================
-- 3. ADMIN_USERS 역할 확장 (pending 추가)
-- ============================================

-- 기존 role 체크 제약 업데이트
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check 
    CHECK (role IN ('pending', 'viewer', 'admin', 'super_admin'));

-- 기본값을 pending으로 변경
ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'pending';

COMMENT ON TABLE admin_users IS '관리자 승인 테이블 - pending: 승인 대기, viewer: 읽기 전용, admin: 관리자, super_admin: 슈퍼 관리자';


-- ============================================
-- 4. WORMHOLE_EVENTS 테이블 (생성 또는 개선)
-- ============================================

-- 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS wormhole_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    wormhole_type CHAR(1) NOT NULL CHECK (wormhole_type IN ('α', 'β', 'γ')),
    resonance_score FLOAT NOT NULL CHECK (resonance_score >= 0 AND resonance_score <= 1),
    trigger_context JSONB NOT NULL,
    agent_a_id UUID NOT NULL,
    agent_b_id UUID NOT NULL,
    is_false_positive BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- 기존 테이블이 있으면 컬럼 추가
ALTER TABLE wormhole_events ADD COLUMN IF NOT EXISTS is_false_positive BOOLEAN DEFAULT FALSE;
ALTER TABLE wormhole_events ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE wormhole_events ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE wormhole_events ADD COLUMN IF NOT EXISTS notes TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_wormhole_score ON wormhole_events(resonance_score);
CREATE INDEX IF NOT EXISTS idx_wormhole_context_key ON wormhole_events((trigger_context->>'key'));


-- ============================================
-- 5. 시스템 설정 테이블 (임계값 등)
-- ============================================

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 기본 설정값 삽입
INSERT INTO system_config (key, value, description) VALUES
    ('wormhole_threshold', '{"min_score": 0.75, "time_window_ms": 1000}', '웜홀 탐지 임계값'),
    ('umbra_timeout_hours', '{"warning": 24, "critical": 72}', '숨그늘 상태 경고 임계값'),
    ('heartbeat_timeout_seconds', '{"offline": 60, "warning": 30}', 'Heartbeat 타임아웃')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read config" ON system_config
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM admin_users WHERE role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Super admins can modify config" ON system_config
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'super_admin')
    );


-- ============================================
-- 6. 집계 뷰 업데이트
-- ============================================

-- 웜홀 탐지량 뷰 (24h/7d/1h)
CREATE OR REPLACE VIEW wormhole_stats AS
SELECT
    COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '1 hour') AS last_1h,
    COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') AS last_24h,
    COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days') AS last_7d,
    COUNT(*) AS total,
    MAX(detected_at) AS last_detected_at,
    AVG(resonance_score) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') AS avg_score_24h
FROM wormhole_events
WHERE is_false_positive = FALSE OR is_false_positive IS NULL;

-- 상위 컨텍스트 뷰
CREATE OR REPLACE VIEW wormhole_top_contexts AS
SELECT
    COALESCE(trigger_context->>'key', trigger_context->>'category', 'unknown') AS context_key,
    trigger_context->>'trigger_type' AS trigger_type,
    COUNT(*) AS event_count,
    ROUND(AVG(resonance_score)::numeric, 3) AS avg_score,
    MAX(detected_at) AS last_seen
FROM wormhole_events
WHERE 
    detected_at > NOW() - INTERVAL '7 days'
    AND (is_false_positive = FALSE OR is_false_positive IS NULL)
GROUP BY 
    COALESCE(trigger_context->>'key', trigger_context->>'category', 'unknown'),
    trigger_context->>'trigger_type'
ORDER BY event_count DESC
LIMIT 20;

-- 타입 분포 뷰
CREATE OR REPLACE VIEW wormhole_type_stats AS
SELECT
    wormhole_type,
    COUNT(*) AS count,
    ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS percentage,
    ROUND(AVG(resonance_score)::numeric, 3) AS avg_score,
    MIN(resonance_score) AS min_score,
    MAX(resonance_score) AS max_score
FROM wormhole_events
WHERE 
    detected_at > NOW() - INTERVAL '7 days'
    AND (is_false_positive = FALSE OR is_false_positive IS NULL)
GROUP BY wormhole_type
ORDER BY count DESC;

-- Score Histogram 뷰 (0.75~1.0 구간)
CREATE OR REPLACE VIEW wormhole_score_histogram AS
SELECT
    width_bucket(resonance_score, 0.75, 1.0, 5) AS bucket,
    CASE width_bucket(resonance_score, 0.75, 1.0, 5)
        WHEN 1 THEN '0.75-0.80'
        WHEN 2 THEN '0.80-0.85'
        WHEN 3 THEN '0.85-0.90'
        WHEN 4 THEN '0.90-0.95'
        WHEN 5 THEN '0.95-1.00'
        ELSE 'other'
    END AS score_range,
    COUNT(*) AS count
FROM wormhole_events
WHERE 
    detected_at > NOW() - INTERVAL '7 days'
    AND resonance_score >= 0.75
    AND (is_false_positive = FALSE OR is_false_positive IS NULL)
GROUP BY width_bucket(resonance_score, 0.75, 1.0, 5)
ORDER BY bucket;

-- 노드 상태 요약 뷰 (숨그늘 포함)
CREATE OR REPLACE VIEW nodes_status_summary AS
SELECT
    COUNT(*) AS total_nodes,
    COUNT(*) FILTER (WHERE status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE status = 'in_umbra') AS in_umbra_count,
    COUNT(*) FILTER (WHERE status = 'offline') AS offline_count,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance_count,
    -- 숨그늘 상태별 카운트
    COUNT(*) FILTER (WHERE status = 'in_umbra' AND umbra_since > NOW() - INTERVAL '1 hour') AS umbra_recent,
    COUNT(*) FILTER (WHERE status = 'in_umbra' AND umbra_since <= NOW() - INTERVAL '24 hours') AS umbra_long
FROM nodes;


-- ============================================
-- 7. RLS 정책 강화
-- ============================================

-- nodes: admin/viewer만 조회 가능
DROP POLICY IF EXISTS "Public read nodes" ON nodes;
CREATE POLICY "Admin read nodes" ON nodes
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM admin_users WHERE role IN ('viewer', 'admin', 'super_admin'))
    );

-- wormhole_events: admin/viewer만 조회 가능
DROP POLICY IF EXISTS "Admins can read wormhole_events" ON wormhole_events;
CREATE POLICY "Admin read wormhole_events" ON wormhole_events
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM admin_users WHERE role IN ('viewer', 'admin', 'super_admin'))
    );

-- wormhole_events: admin만 수정 가능 (false positive 마킹 등)
CREATE POLICY "Admin update wormhole_events" ON wormhole_events
    FOR UPDATE USING (
        auth.uid() IN (SELECT user_id FROM admin_users WHERE role IN ('admin', 'super_admin'))
    );

