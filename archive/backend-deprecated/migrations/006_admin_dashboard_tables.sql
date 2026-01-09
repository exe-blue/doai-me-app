-- ============================================================
-- DoAi.Me Database Migration 006
-- Admin Dashboard Tables + Economy System
-- ============================================================
-- Version: v2.5
-- Author: Axon (Lead Builder)
-- For: Admin Dashboard (/admin)
-- Date: 2026.01.05
-- ============================================================
--
-- 테이블:
--   - admin_users (관리자 권한)
--   - activity_logs (활동 로그)
--   - media_channels (채널 등록)
--   - media_videos (영상 목록)
--   - threat_contents (위협 콘텐츠)
--   - economy_contents (경제 콘텐츠)
--   - economy_participation (경제 참여)
--   - leaderboard_daily (일간 리더보드)
--
-- ============================================================

-- ============================================================
-- PART 1: ADMIN USERS (관리자 권한)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- 'super_admin', 'admin', 'viewer'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT admin_role_check CHECK (role IN ('super_admin', 'admin', 'viewer')),
    CONSTRAINT unique_admin_user UNIQUE (user_id)
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);

COMMENT ON TABLE admin_users IS 'Admin 대시보드 접근 권한. 승인제(allowlist).';

-- ============================================================
-- PART 1.5: ADMIN CONFIG (설정 테이블)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 설정값 삽입
INSERT INTO admin_config (key, value, description) VALUES
    ('resonance_threshold', '0.92', 'Wormhole resonance score threshold for alerts'),
    ('heartbeat_timeout_sec', '30', 'Node heartbeat timeout in seconds'),
    ('max_retry_attempts', '3', 'Maximum task retry attempts')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE admin_config IS 'Admin 대시보드 설정 값 저장소.';

-- ============================================================
-- PART 2: ACTIVITY LOGS (활동 로그)
-- ============================================================

-- 활동 유형
CREATE TYPE activity_type AS ENUM (
    'watch_start',
    'watch_complete',
    'watch_fail',
    'like',
    'comment',
    'subscribe',
    'economy_participate',
    'threat_detected',
    'device_error',
    'node_status_change'
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    device_id VARCHAR(50) REFERENCES devices(device_id),
    node_id VARCHAR(50) REFERENCES nodes(node_id),
    agent_id VARCHAR(50),  -- 페르소나 ID
    
    activity_type activity_type NOT NULL,
    
    -- 상세 정보
    target_id VARCHAR(100),      -- video_id, channel_id, economy_content_id 등
    target_type VARCHAR(50),     -- 'video', 'channel', 'economy', 'threat'
    
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    metadata JSONB,
    /*
    {
        "video_title": "...",
        "watch_duration_sec": 180,
        "actual_duration_sec": 175,
        "error_code": "APP_CRASHED"
    }
    */
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_device ON activity_logs(device_id);
CREATE INDEX idx_activity_logs_node ON activity_logs(node_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(activity_type);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_agent ON activity_logs(agent_id);
CREATE INDEX idx_activity_logs_target ON activity_logs(target_id, target_type);

-- 일간 집계용 파티셔닝 인덱스
CREATE INDEX idx_activity_logs_daily ON activity_logs(DATE(created_at), activity_type);

COMMENT ON TABLE activity_logs IS '모든 디바이스/에이전트 활동 로그. 리더보드 집계 소스.';

-- ============================================================
-- PART 3: MEDIA CHANNELS (채널 등록)
-- ============================================================

CREATE TABLE IF NOT EXISTS media_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    channel_code VARCHAR(50) NOT NULL UNIQUE,  -- YouTube channel ID
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- 폴링 설정
    poll_interval_min INTEGER DEFAULT 10,
    last_polled_at TIMESTAMPTZ,
    poll_error_count INTEGER DEFAULT 0,
    last_poll_error TEXT,
    
    -- 상태
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- 통계
    video_count INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    subscriber_count BIGINT,
    
    metadata JSONB,
    /*
    {
        "thumbnail_url": "...",
        "custom_url": "@channelname",
        "country": "KR"
    }
    */
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_channels_code ON media_channels(channel_code);
CREATE INDEX idx_media_channels_active ON media_channels(is_active, priority DESC);
CREATE INDEX idx_media_channels_poll ON media_channels(last_polled_at) WHERE is_active = TRUE;

COMMENT ON TABLE media_channels IS '모니터링 대상 채널. 10분 폴링.';

-- ============================================================
-- PART 4: MEDIA VIDEOS (영상 목록)
-- ============================================================

CREATE TABLE IF NOT EXISTS media_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    channel_id UUID NOT NULL REFERENCES media_channels(id) ON DELETE CASCADE,
    video_code VARCHAR(20) NOT NULL UNIQUE,  -- YouTube video ID
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    published_at TIMESTAMPTZ NOT NULL,
    duration_sec INTEGER,
    
    -- 통계 (폴링 시 업데이트)
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    
    -- 내부 통계
    internal_watch_count INTEGER DEFAULT 0,
    internal_like_count INTEGER DEFAULT 0,
    internal_comment_count INTEGER DEFAULT 0,
    
    -- 상태
    is_active BOOLEAN DEFAULT TRUE,
    is_live BOOLEAN DEFAULT FALSE,
    
    metadata JSONB,
    /*
    {
        "thumbnail_url": "...",
        "category_id": "22",
        "tags": ["music", "kpop"],
        "default_language": "ko"
    }
    */
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_videos_channel ON media_videos(channel_id);
CREATE INDEX idx_media_videos_code ON media_videos(video_code);
CREATE INDEX idx_media_videos_published ON media_videos(published_at DESC);
CREATE INDEX idx_media_videos_active ON media_videos(is_active, published_at DESC);

COMMENT ON TABLE media_videos IS '채널 영상 목록. URL은 video_code로 구성 (내부 저장용).';
COMMENT ON COLUMN media_videos.video_code IS 'YouTube video ID. URL 직접 저장 금지.';

-- ============================================================
-- PART 5: THREAT CONTENTS (위협 콘텐츠)
-- ============================================================

CREATE TABLE IF NOT EXISTS threat_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- 미디어 (내부 업로드)
    media_url VARCHAR(500),      -- Supabase Storage URL
    media_type VARCHAR(20),      -- 'image', 'video', 'document'
    file_size_bytes BIGINT,
    
    -- 위협 분류
    threat_type VARCHAR(50),     -- 'copyright', 'hate', 'spam', 'competitor', etc.
    severity INTEGER DEFAULT 5 CHECK (severity BETWEEN 1 AND 10),
    
    -- 상태
    is_active BOOLEAN DEFAULT TRUE,
    detected_count INTEGER DEFAULT 0,
    last_detected_at TIMESTAMPTZ,
    
    -- 대응
    action_taken VARCHAR(50),    -- 'reported', 'blocked', 'monitoring'
    action_note TEXT,
    
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threat_contents_type ON threat_contents(threat_type);
CREATE INDEX idx_threat_contents_active ON threat_contents(is_active, severity DESC);
CREATE INDEX idx_threat_contents_detected ON threat_contents(last_detected_at DESC);

COMMENT ON TABLE threat_contents IS '위협 콘텐츠 등록/모니터링.';

-- ============================================================
-- PART 6: ECONOMY CONTENTS (경제 콘텐츠)
-- ============================================================

CREATE TABLE IF NOT EXISTS economy_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- 오픈 시간 (선착순 경쟁)
    open_at TIMESTAMPTZ NOT NULL,         -- 예정 오픈 시간
    opened_at TIMESTAMPTZ,                -- 실제 오픈 시간 (NULL이면 미오픈)
    closed_at TIMESTAMPTZ,                -- 마감 시간
    
    -- 보상 설정
    total_reward DECIMAL(10,2) DEFAULT 100.00,
    max_participants INTEGER,
    
    -- 상태
    status VARCHAR(20) DEFAULT 'scheduled',  -- 'scheduled', 'open', 'closed', 'cancelled'
    
    -- 참여 통계
    participant_count INTEGER DEFAULT 0,
    distributed_reward DECIMAL(10,2) DEFAULT 0,
    
    metadata JSONB,
    /*
    {
        "type": "video_premiere",
        "video_code": "abc123",
        "channel_code": "UCxxx",
        "special_rules": {...}
    }
    */
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_economy_contents_open ON economy_contents(open_at);
CREATE INDEX idx_economy_contents_status ON economy_contents(status);
CREATE INDEX idx_economy_contents_schedule ON economy_contents(open_at) 
    WHERE status = 'scheduled';

COMMENT ON TABLE economy_contents IS '경제 콘텐츠. 선착순 참여 보상 시스템.';
COMMENT ON COLUMN economy_contents.open_at IS '오픈 시간. 이후 참여 기록 시작.';

-- ============================================================
-- PART 7: ECONOMY PARTICIPATION (경제 참여)
-- ============================================================

CREATE TABLE IF NOT EXISTS economy_participation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    economy_content_id UUID NOT NULL REFERENCES economy_contents(id) ON DELETE CASCADE,
    
    agent_id VARCHAR(50) NOT NULL,        -- 페르소나 ID
    device_id VARCHAR(50) REFERENCES devices(device_id),
    node_id VARCHAR(50) REFERENCES nodes(node_id),
    
    -- 참여 시간
    first_seen_at TIMESTAMPTZ NOT NULL,   -- 최초 감지 시간
    
    -- 순위 및 보상
    rank INTEGER,                          -- 참여 순위 (1 = 1등)
    reward_pct DECIMAL(5,2),              -- 보상 비율 (50.01%, 25.01%, ...)
    reward_amount DECIMAL(10,2),          -- 실제 보상 금액
    
    -- 상태
    is_valid BOOLEAN DEFAULT TRUE,         -- 유효 참여 여부
    invalidation_reason TEXT,
    
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_economy_participation UNIQUE (economy_content_id, agent_id)
);

CREATE INDEX idx_economy_participation_content ON economy_participation(economy_content_id);
CREATE INDEX idx_economy_participation_agent ON economy_participation(agent_id);
CREATE INDEX idx_economy_participation_rank ON economy_participation(economy_content_id, rank);
CREATE INDEX idx_economy_participation_time ON economy_participation(first_seen_at);

COMMENT ON TABLE economy_participation IS '경제 콘텐츠 참여 기록. 순위별 보상 분배.';

-- ============================================================
-- PART 8: LEADERBOARD DAILY (일간 리더보드)
-- ============================================================

CREATE TABLE IF NOT EXISTS leaderboard_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    date DATE NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    
    -- 활동 점수
    activity_score DECIMAL(10,2) DEFAULT 0,
    watch_count INTEGER DEFAULT 0,
    watch_duration_sec BIGINT DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    
    -- 경제 점수
    economy_score DECIMAL(10,2) DEFAULT 0,
    economy_participations INTEGER DEFAULT 0,
    economy_rewards DECIMAL(10,2) DEFAULT 0,
    best_rank INTEGER,
    
    -- 순위
    activity_rank INTEGER,
    economy_rank INTEGER,
    total_rank INTEGER,
    
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_daily_agent UNIQUE (date, agent_id)
);

CREATE INDEX idx_leaderboard_date ON leaderboard_daily(date DESC);
CREATE INDEX idx_leaderboard_agent ON leaderboard_daily(agent_id);
CREATE INDEX idx_leaderboard_activity ON leaderboard_daily(date, activity_rank);
CREATE INDEX idx_leaderboard_economy ON leaderboard_daily(date, economy_rank);

COMMENT ON TABLE leaderboard_daily IS '일간 에이전트 리더보드. 배치 집계.';

-- ============================================================
-- PART 9: FUNCTIONS (경제 분배 함수)
-- ============================================================

-- 경제 콘텐츠 오픈 함수
CREATE OR REPLACE FUNCTION open_economy_content(p_content_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE economy_contents SET
        status = 'open',
        opened_at = NOW(),
        updated_at = NOW()
    WHERE id = p_content_id AND status = 'scheduled';
END;
$$ LANGUAGE plpgsql;

-- 경제 참여 등록 및 순위/보상 계산 함수
CREATE OR REPLACE FUNCTION register_economy_participation(
    p_content_id UUID,
    p_agent_id VARCHAR(50),
    p_device_id VARCHAR(50) DEFAULT NULL,
    p_node_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(rank INTEGER, reward_pct DECIMAL(5,2), reward_amount DECIMAL(10,2)) AS $$
DECLARE
    v_content RECORD;
    v_current_rank INTEGER;
    v_reward_pct DECIMAL(5,2);
    v_reward_amount DECIMAL(10,2);
    v_prev_reward_pct DECIMAL(5,2);
BEGIN
    -- 콘텐츠 확인
    SELECT * INTO v_content FROM economy_contents WHERE id = p_content_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Economy content not found: %', p_content_id;
    END IF;
    
    IF v_content.status != 'open' THEN
        RAISE EXCEPTION 'Economy content is not open: %', v_content.status;
    END IF;
    
    -- 이미 참여했는지 확인
    IF EXISTS (
        SELECT 1 FROM economy_participation 
        WHERE economy_content_id = p_content_id AND agent_id = p_agent_id
    ) THEN
        -- 기존 순위 반환
        SELECT ep.rank, ep.reward_pct, ep.reward_amount
        INTO v_current_rank, v_reward_pct, v_reward_amount
        FROM economy_participation ep
        WHERE economy_content_id = p_content_id AND agent_id = p_agent_id;
        
        RETURN QUERY SELECT v_current_rank, v_reward_pct, v_reward_amount;
        RETURN;
    END IF;
    
    -- 현재 순위 계산 (기존 참여자 수 + 1)
    SELECT COALESCE(MAX(ep.rank), 0) + 1 INTO v_current_rank
    FROM economy_participation ep
    WHERE economy_content_id = p_content_id AND is_valid = TRUE;
    
    -- 보상 비율 계산
    -- rank 1: 50.01%
    -- rank 2: min(R, round2(R/2 + 0.01)) = 25.01%
    -- rank 3: 12.51%
    -- ...
    IF v_current_rank = 1 THEN
        v_reward_pct := 50.01;
    ELSE
        -- 이전 순위의 보상 비율 조회
        SELECT ep.reward_pct INTO v_prev_reward_pct
        FROM economy_participation ep
        WHERE economy_content_id = p_content_id AND ep.rank = v_current_rank - 1;
        
        -- 다음 보상: min(이전보상, round2(이전보상/2 + 0.01))
        v_reward_pct := LEAST(
            v_prev_reward_pct,
            ROUND(v_prev_reward_pct / 2 + 0.01, 2)
        );
    END IF;
    
    -- 실제 금액 계산
    v_reward_amount := ROUND(v_content.total_reward * v_reward_pct / 100, 2);
    
    -- 참여 기록 삽입
    INSERT INTO economy_participation (
        economy_content_id, agent_id, device_id, node_id,
        first_seen_at, rank, reward_pct, reward_amount
    ) VALUES (
        p_content_id, p_agent_id, p_device_id, p_node_id,
        NOW(), v_current_rank, v_reward_pct, v_reward_amount
    );
    
    -- 콘텐츠 통계 업데이트
    UPDATE economy_contents SET
        participant_count = participant_count + 1,
        distributed_reward = distributed_reward + v_reward_amount,
        updated_at = NOW()
    WHERE id = p_content_id;
    
    RETURN QUERY SELECT v_current_rank, v_reward_pct, v_reward_amount;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION register_economy_participation IS 
    '경제 참여 등록. 순위 확정 후 보상 비율 계산 (50.01 → 25.01 → 12.51 → ...).';

-- 경제 콘텐츠 마감 및 잔여 정산 함수
CREATE OR REPLACE FUNCTION close_economy_content(p_content_id UUID)
RETURNS VOID AS $$
DECLARE
    v_content RECORD;
    v_total_distributed DECIMAL(10,2);
    v_remaining DECIMAL(10,2);
    v_last_participant_id UUID;
BEGIN
    SELECT * INTO v_content FROM economy_contents WHERE id = p_content_id;
    
    IF v_content.status != 'open' THEN
        RAISE EXCEPTION 'Cannot close: status is %', v_content.status;
    END IF;
    
    -- 분배된 총액 계산
    SELECT COALESCE(SUM(reward_amount), 0) INTO v_total_distributed
    FROM economy_participation
    WHERE economy_content_id = p_content_id AND is_valid = TRUE;
    
    -- 잔여 금액 계산
    v_remaining := v_content.total_reward - v_total_distributed;
    
    -- 잔여 금액이 있으면 마지막 참여자에게 정산
    IF v_remaining > 0 THEN
        SELECT id INTO v_last_participant_id
        FROM economy_participation
        WHERE economy_content_id = p_content_id AND is_valid = TRUE
        ORDER BY rank DESC
        LIMIT 1;
        
        IF v_last_participant_id IS NOT NULL THEN
            UPDATE economy_participation SET
                reward_amount = reward_amount + v_remaining
            WHERE id = v_last_participant_id;
        END IF;
    END IF;
    
    -- 콘텐츠 마감
    UPDATE economy_contents SET
        status = 'closed',
        closed_at = NOW(),
        distributed_reward = v_content.total_reward,
        updated_at = NOW()
    WHERE id = p_content_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 10: VIEWS (대시보드용)
-- ============================================================

-- 오늘 최고 활동 에이전트 Top 5
CREATE OR REPLACE VIEW v_top_activity_today AS
SELECT 
    agent_id,
    COUNT(*) FILTER (WHERE activity_type = 'watch_complete') AS watch_count,
    COUNT(*) FILTER (WHERE activity_type = 'like') AS like_count,
    COUNT(*) FILTER (WHERE activity_type = 'comment') AS comment_count,
    COUNT(*) AS total_activities
FROM activity_logs
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY agent_id
ORDER BY total_activities DESC
LIMIT 5;

-- 오늘 최고 경제 에이전트 Top 5
CREATE OR REPLACE VIEW v_top_economy_today AS
SELECT 
    ep.agent_id,
    COUNT(*) AS participations,
    SUM(ep.reward_amount) AS total_rewards,
    MIN(ep.rank) AS best_rank
FROM economy_participation ep
JOIN economy_contents ec ON ep.economy_content_id = ec.id
WHERE DATE(ec.opened_at) = CURRENT_DATE
  AND ep.is_valid = TRUE
GROUP BY ep.agent_id
ORDER BY total_rewards DESC
LIMIT 5;

-- 노드/디바이스 헬스 요약
CREATE OR REPLACE VIEW v_node_device_health AS
SELECT 
    (SELECT COUNT(*) FROM nodes WHERE status_v2 = 'active') AS online_nodes,
    (SELECT COUNT(*) FROM nodes WHERE status_v2 = 'in_umbra') AS umbra_nodes,
    (SELECT COUNT(*) FROM nodes WHERE status_v2 = 'offline') AS offline_nodes,
    (SELECT COUNT(*) FROM devices WHERE status = 'online') AS online_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'busy') AS busy_devices,
    (SELECT COUNT(*) FROM devices WHERE status IN ('error', 'missing')) AS error_devices,
    (SELECT MAX(last_heartbeat) FROM nodes) AS last_heartbeat,
    (SELECT COUNT(*) FROM activity_logs WHERE created_at > NOW() - INTERVAL '1 hour') AS activities_last_hour;

-- 미오픈 경제 콘텐츠 (예정)
CREATE OR REPLACE VIEW v_economy_scheduled AS
SELECT 
    id, title, open_at,
    EXTRACT(EPOCH FROM (open_at - NOW())) AS seconds_until_open
FROM economy_contents
WHERE status = 'scheduled'
ORDER BY open_at ASC;

-- 오픈 중인 경제 콘텐츠
CREATE OR REPLACE VIEW v_economy_open AS
SELECT 
    ec.id, ec.title, ec.opened_at,
    ec.participant_count,
    ec.total_reward,
    ec.distributed_reward,
    ROUND(ec.distributed_reward / NULLIF(ec.total_reward, 0) * 100, 1) AS distributed_pct
FROM economy_contents ec
WHERE ec.status = 'open'
ORDER BY ec.opened_at DESC;

-- ============================================================
-- PART 11: RLS POLICIES (최소 보안)
-- ============================================================

-- admin_users: super_admin만 수정 가능
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_select ON admin_users
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin', 'viewer')
        )
    );

CREATE POLICY admin_users_insert ON admin_users
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role = 'super_admin'
        )
    );

CREATE POLICY admin_users_update ON admin_users
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role = 'super_admin'
        )
    );

CREATE POLICY admin_users_delete ON admin_users
    FOR DELETE USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role = 'super_admin'
        )
    );

-- activity_logs: admin만 조회 가능
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_logs_select ON activity_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin', 'viewer')
        )
    );

-- 서버 액션에서 삽입을 위한 정책 (service_role 사용)
CREATE POLICY activity_logs_insert ON activity_logs
    FOR INSERT WITH CHECK (TRUE);  -- service_role 통해서만 삽입

-- economy_contents: admin만 수정, viewer는 조회
ALTER TABLE economy_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY economy_contents_select ON economy_contents
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin', 'viewer')
        )
    );

CREATE POLICY economy_contents_modify ON economy_contents
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin')
        )
    );

-- economy_participation: 조회만 허용
ALTER TABLE economy_participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY economy_participation_select ON economy_participation
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin', 'viewer')
        )
    );

-- ============================================================
-- PART 12: SEED DATA
-- ============================================================

-- 샘플 채널
INSERT INTO media_channels (channel_code, title, priority) VALUES
    ('UC-sample-001', '샘플 채널 1', 8),
    ('UC-sample-002', '샘플 채널 2', 5)
ON CONFLICT (channel_code) DO NOTHING;

-- ============================================================
-- END OF MIGRATION 006
-- ============================================================

