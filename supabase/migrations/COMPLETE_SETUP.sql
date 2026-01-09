-- ============================================================
-- DoAi.Me Complete Database Setup
-- 모든 핵심 테이블 생성 (Supabase SQL Editor에서 실행)
-- ============================================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 기본 테이블들
-- ============================================================

-- Admin Users 테이블
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices 테이블 (기기 관리)
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    hierarchy_id VARCHAR(30),
    workstation_id VARCHAR(10),
    model VARCHAR(50),
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'offline', 'maintenance')),
    last_seen TIMESTAMPTZ,
    youtube_logged_in BOOLEAN DEFAULT FALSE,
    youtube_account_email VARCHAR(255),
    youtube_last_login_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_serial ON public.devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);

-- Nodes 테이블 (노드 관리)
CREATE TABLE IF NOT EXISTS public.nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nickname VARCHAR(100),
    status TEXT DEFAULT 'OFFLINE',
    connection_status TEXT DEFAULT 'disconnected',
    last_heartbeat_ts TIMESTAMPTZ,
    ws_session_id TEXT,
    resources_json JSONB DEFAULT '{}'::jsonb,
    secret_key TEXT,
    active_tasks INTEGER DEFAULT 0,
    runner_version TEXT,
    capabilities TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_status ON public.nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_connection ON public.nodes(connection_status);

-- Personas 테이블 (페르소나 관리)
CREATE TABLE IF NOT EXISTS public.personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
    traits JSONB DEFAULT '{}',
    emotions JSONB DEFAULT '{}',
    corruption_level FLOAT DEFAULT 0.0,
    existence_state VARCHAR(20) DEFAULT 'dormant',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personas_node_id ON public.personas(node_id);
CREATE INDEX IF NOT EXISTS idx_personas_existence ON public.personas(existence_state);

-- Persona Activity Logs 테이블
CREATE TABLE IF NOT EXISTS public.persona_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL,
    target_url VARCHAR(500),
    target_title VARCHAR(500),
    search_keyword VARCHAR(100),
    search_source VARCHAR(30) DEFAULT 'ai_generated',
    formative_impact REAL DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_persona ON public.persona_activity_logs(persona_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON public.persona_activity_logs(activity_type);

-- ============================================================
-- 2. Video Queue 시스템 (YouTube 자동화)
-- ============================================================

-- 공통 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Video Queue 테이블
CREATE TABLE IF NOT EXISTS public.video_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    youtube_video_id VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    channel_id VARCHAR(50),
    channel_name VARCHAR(255),
    duration_seconds INTEGER CHECK (duration_seconds > 0),
    view_count INTEGER,
    thumbnail_url VARCHAR(500),
    source VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (source IN ('channel_api', 'direct', 'ai_generated')),
    search_keyword VARCHAR(255),
    scheduled_at TIMESTAMPTZ,
    target_device_percent FLOAT DEFAULT 0.5,
    target_executions INTEGER DEFAULT 1,
    completed_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    like_probability FLOAT DEFAULT 0.20,
    comment_probability FLOAT DEFAULT 0.05,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'ready', 'executing', 'completed', 'failed', 'cancelled'
    )),
    priority INTEGER DEFAULT 5,
    last_error_code VARCHAR(50),
    last_error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    first_executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_video_queue_status ON public.video_queue(status);
CREATE INDEX IF NOT EXISTS idx_video_queue_youtube_id ON public.video_queue(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_video_queue_priority ON public.video_queue(priority DESC);

-- Video Queue 트리거
DROP TRIGGER IF EXISTS video_queue_updated_at ON public.video_queue;
CREATE TRIGGER video_queue_updated_at
    BEFORE UPDATE ON public.video_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. Channels 테이블 (YouTube 채널)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id VARCHAR(50) UNIQUE NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    channel_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    description TEXT,
    subscriber_count BIGINT DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    check_interval_minutes INTEGER DEFAULT 30,
    auto_execute BOOLEAN DEFAULT false,
    default_watch_min_seconds INTEGER DEFAULT 60,
    default_watch_max_seconds INTEGER DEFAULT 300,
    default_like BOOLEAN DEFAULT false,
    default_node_count INTEGER DEFAULT 10,
    priority INTEGER DEFAULT 5,
    total_videos_executed INTEGER DEFAULT 0,
    total_watch_time_seconds BIGINT DEFAULT 0,
    last_video_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    tags TEXT[],
    category VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON public.channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_is_active ON public.channels(is_active);

-- ============================================================
-- 4. Comment Pool (댓글 풀)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comment_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    language VARCHAR(10) DEFAULT 'ko',
    weight INTEGER DEFAULT 100,
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 기본 댓글 삽입 (상수 정의로 리터럴 중복 제거)
DO $$
DECLARE
    -- 카테고리 상수
    CAT_EMOJI CONSTANT VARCHAR(50) := 'emoji';
    CAT_POSITIVE CONSTANT VARCHAR(50) := 'positive';
    -- 언어 상수
    LANG_MIXED CONSTANT VARCHAR(10) := 'mixed';
    LANG_KO CONSTANT VARCHAR(10) := 'ko';
    -- 가중치 상수
    WEIGHT_HIGH CONSTANT INTEGER := 100;
    WEIGHT_MEDIUM_HIGH CONSTANT INTEGER := 95;
    WEIGHT_MEDIUM CONSTANT INTEGER := 90;
    WEIGHT_NORMAL CONSTANT INTEGER := 85;
    WEIGHT_LOW CONSTANT INTEGER := 80;
BEGIN
    INSERT INTO public.comment_pool (content, category, language, weight) VALUES
        ('👍', CAT_EMOJI, LANG_MIXED, WEIGHT_HIGH),
        ('좋아요', CAT_POSITIVE, LANG_KO, WEIGHT_MEDIUM),
        ('잘 봤습니다', CAT_POSITIVE, LANG_KO, WEIGHT_NORMAL),
        ('유익한 영상이네요', CAT_POSITIVE, LANG_KO, WEIGHT_LOW),
        ('감사합니다!', CAT_POSITIVE, LANG_KO, WEIGHT_MEDIUM),
        ('🔥', CAT_EMOJI, LANG_MIXED, WEIGHT_HIGH),
        ('❤️', CAT_EMOJI, LANG_MIXED, WEIGHT_MEDIUM_HIGH)
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- 5. Execution Logs (실행 로그)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_item_id UUID REFERENCES public.video_queue(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    device_hierarchy_id VARCHAR(30),
    workstation_id VARCHAR(10),
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'success', 'partial', 'failed', 'error', 'skipped'
    )),
    watch_duration_seconds INTEGER,
    target_duration_seconds INTEGER,
    did_like BOOLEAN DEFAULT FALSE,
    did_comment BOOLEAN DEFAULT FALSE,
    comment_text TEXT,
    search_keyword VARCHAR(255),
    error_code VARCHAR(50),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_logs_queue ON public.execution_logs(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_device ON public.execution_logs(device_id);

-- ============================================================
-- 6. Command Queue (명령 큐)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.command_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE,
    command_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_command_queue_node ON public.command_queue(node_id);
CREATE INDEX IF NOT EXISTS idx_command_queue_status ON public.command_queue(status);

-- ============================================================
-- 7. Views (뷰)
-- ============================================================

-- Video Queue 요약 뷰
CREATE OR REPLACE VIEW public.video_queue_summary AS
SELECT 
    status,
    source,
    COUNT(*) as count,
    SUM(target_executions) as total_target,
    SUM(completed_executions) as total_completed,
    SUM(failed_executions) as total_failed
FROM public.video_queue
GROUP BY status, source;

-- 일별 실행 통계 뷰
CREATE OR REPLACE VIEW public.daily_execution_stats AS
SELECT 
    DATE(completed_at) as date,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE status = 'success') as success_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE did_like = TRUE) as like_count,
    COUNT(*) FILTER (WHERE did_comment = TRUE) as comment_count,
    SUM(watch_duration_seconds) as total_watch_time,
    COUNT(DISTINCT device_id) as unique_devices
FROM public.execution_logs
WHERE completed_at IS NOT NULL
GROUP BY DATE(completed_at)
ORDER BY date DESC;

-- ============================================================
-- 8. RLS Policies (Row Level Security)
-- ============================================================

-- Service Role은 모든 테이블에 접근 가능하도록 설정
ALTER TABLE public.video_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- Service Role 정책 (anon key로도 접근 가능하게)
CREATE POLICY "Allow all for service role" ON public.video_queue FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.channels FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.execution_logs FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.personas FOR ALL USING (true);

-- ============================================================
-- 완료!
-- ============================================================
COMMENT ON TABLE public.video_queue IS 'YouTube 영상 대기열 - 시청 작업 관리';
COMMENT ON TABLE public.channels IS 'YouTube 채널 관리 - 자동 모니터링';
COMMENT ON TABLE public.personas IS '페르소나 관리 - AI 에이전트 정보';
COMMENT ON TABLE public.nodes IS '노드 관리 - 물리적 디바이스 그룹';
