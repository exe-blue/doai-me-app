-- ============================================================
-- DoAi.Me: Channels + Videos Schema
-- YouTube 채널 관리 및 영상 자동 실행
-- ============================================================

-- ============================================================
-- 1. Channels 테이블 (YouTube 채널)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- YouTube 채널 정보
    channel_id VARCHAR(50) UNIQUE NOT NULL,  -- YouTube Channel ID (UC...)
    channel_name VARCHAR(255) NOT NULL,
    channel_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    description TEXT,
    
    -- 구독 설정
    subscriber_count BIGINT DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    
    -- 모니터링 설정
    is_active BOOLEAN DEFAULT true,                -- 모니터링 활성화
    check_interval_minutes INTEGER DEFAULT 30,     -- 체크 주기 (분)
    auto_execute BOOLEAN DEFAULT false,            -- 새 영상 자동 실행
    
    -- 실행 설정
    default_watch_min_seconds INTEGER DEFAULT 60,   -- 기본 최소 시청 시간
    default_watch_max_seconds INTEGER DEFAULT 300,  -- 기본 최대 시청 시간
    default_like BOOLEAN DEFAULT false,             -- 기본 좋아요
    default_node_count INTEGER DEFAULT 10,          -- 기본 투입 노드 수
    priority INTEGER DEFAULT 5,                     -- 우선순위 (1-10)
    
    -- 통계
    total_videos_executed INTEGER DEFAULT 0,
    total_watch_time_seconds BIGINT DEFAULT 0,
    last_video_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    
    -- 메타데이터
    tags TEXT[],
    category VARCHAR(100),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON public.channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_is_active ON public.channels(is_active);
CREATE INDEX IF NOT EXISTS idx_channels_auto_execute ON public.channels(auto_execute);
CREATE INDEX IF NOT EXISTS idx_channels_category ON public.channels(category);

-- ============================================================
-- 2. Videos 테이블 (영상)
-- ============================================================

CREATE TYPE video_status AS ENUM (
    'pending',      -- 대기 (실행 전)
    'queued',       -- 큐에 추가됨
    'executing',    -- 실행 중
    'completed',    -- 완료
    'failed',       -- 실패
    'skipped',      -- 건너뜀
    'cancelled'     -- 취소됨
);

CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 채널 연관
    channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
    
    -- YouTube 영상 정보
    video_id VARCHAR(20) UNIQUE NOT NULL,    -- YouTube Video ID
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    video_url VARCHAR(500) GENERATED ALWAYS AS ('https://www.youtube.com/watch?v=' || video_id) STORED,
    
    -- 영상 메타데이터
    duration_seconds INTEGER,                -- 영상 길이
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    published_at TIMESTAMPTZ,
    
    -- 실행 설정 (채널 기본값 오버라이드 가능)
    watch_min_seconds INTEGER,
    watch_max_seconds INTEGER,
    should_like BOOLEAN,
    target_node_count INTEGER,
    
    -- 실행 상태
    status video_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    
    -- 실행 결과
    execution_count INTEGER DEFAULT 0,       -- 총 실행 횟수
    success_count INTEGER DEFAULT 0,         -- 성공 노드 수
    failed_count INTEGER DEFAULT 0,          -- 실패 노드 수
    total_watch_seconds BIGINT DEFAULT 0,    -- 총 시청 시간
    
    -- 실행 시간
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- 에러 정보
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- 메타데이터
    tags TEXT[],
    category VARCHAR(100),
    is_short BOOLEAN DEFAULT false,          -- YouTube Shorts 여부
    is_live BOOLEAN DEFAULT false,           -- 라이브 여부
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    discovered_at TIMESTAMPTZ DEFAULT NOW(), -- API로 발견된 시간
    created_by UUID REFERENCES auth.users(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON public.videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON public.videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_priority ON public.videos(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_channel_status ON public.videos(channel_id, status);

-- ============================================================
-- 3. Video Executions 테이블 (실행 이력)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.video_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 연관
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
    node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
    
    -- 실행 정보
    command_id VARCHAR(50),
    device_serial VARCHAR(50),
    
    -- 결과
    status VARCHAR(20) NOT NULL,             -- SUCCESS, FAILED, TIMEOUT
    watch_duration_seconds INTEGER,
    liked BOOLEAN DEFAULT false,
    error_message TEXT,
    
    -- 시간
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}'
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_video_executions_video_id ON public.video_executions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_executions_node_id ON public.video_executions(node_id);
CREATE INDEX IF NOT EXISTS idx_video_executions_started_at ON public.video_executions(started_at DESC);

-- ============================================================
-- 4. Channel Check Log 테이블 (API 체크 이력)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channel_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    
    -- 체크 결과
    videos_found INTEGER DEFAULT 0,
    new_videos INTEGER DEFAULT 0,
    api_quota_used INTEGER DEFAULT 0,
    
    -- 상태
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- 시간
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_check_logs_channel_id ON public.channel_check_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_check_logs_checked_at ON public.channel_check_logs(checked_at DESC);

-- ============================================================
-- 5. Views
-- ============================================================

-- 채널별 통계 뷰
CREATE OR REPLACE VIEW public.channel_stats AS
SELECT 
    c.id,
    c.channel_id,
    c.channel_name,
    c.is_active,
    c.auto_execute,
    c.category,
    COUNT(v.id) AS total_videos,
    COUNT(CASE WHEN v.status = 'pending' THEN 1 END) AS pending_videos,
    COUNT(CASE WHEN v.status = 'completed' THEN 1 END) AS completed_videos,
    COUNT(CASE WHEN v.status = 'failed' THEN 1 END) AS failed_videos,
    COALESCE(SUM(v.total_watch_seconds), 0) AS total_watch_seconds,
    MAX(v.published_at) AS latest_video_at,
    c.last_checked_at,
    c.created_at
FROM public.channels c
LEFT JOIN public.videos v ON v.channel_id = c.id
GROUP BY c.id;

-- 대기 중인 영상 뷰
CREATE OR REPLACE VIEW public.pending_videos AS
SELECT 
    v.*,
    c.channel_name,
    c.channel_id AS youtube_channel_id,
    c.auto_execute,
    COALESCE(v.watch_min_seconds, c.default_watch_min_seconds, 60) AS effective_watch_min,
    COALESCE(v.watch_max_seconds, c.default_watch_max_seconds, 300) AS effective_watch_max,
    COALESCE(v.should_like, c.default_like, false) AS effective_like,
    COALESCE(v.target_node_count, c.default_node_count, 10) AS effective_node_count
FROM public.videos v
LEFT JOIN public.channels c ON v.channel_id = c.id
WHERE v.status IN ('pending', 'queued')
ORDER BY v.priority DESC, v.published_at DESC;

-- 최근 실행 영상 뷰
CREATE OR REPLACE VIEW public.recent_executions AS
SELECT 
    ve.id,
    ve.video_id,
    v.title AS video_title,
    v.video_url,
    c.channel_name,
    ve.node_id,
    n.nickname AS node_nickname,
    ve.status,
    ve.watch_duration_seconds,
    ve.liked,
    ve.error_message,
    ve.started_at,
    ve.completed_at
FROM public.video_executions ve
LEFT JOIN public.videos v ON ve.video_id = v.id
LEFT JOIN public.channels c ON ve.channel_id = c.id
LEFT JOIN public.nodes n ON ve.node_id = n.id
ORDER BY ve.started_at DESC
LIMIT 100;

-- ============================================================
-- 6. Functions
-- ============================================================

-- 새 영상 발견 시 자동 큐 추가
CREATE OR REPLACE FUNCTION public.auto_queue_new_video()
RETURNS TRIGGER AS $$
BEGIN
    -- 채널이 auto_execute가 true이면 자동으로 queued 상태로 변경
    IF EXISTS (
        SELECT 1 FROM public.channels 
        WHERE id = NEW.channel_id AND auto_execute = true
    ) THEN
        NEW.status = 'queued';
        NEW.queued_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 새 영상 자동 큐
DROP TRIGGER IF EXISTS trigger_auto_queue_video ON public.videos;
CREATE TRIGGER trigger_auto_queue_video
    BEFORE INSERT ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_queue_new_video();

-- 영상 실행 후 통계 업데이트 (동시 실행 시 레이스 컨디션 방지를 위해 FOR UPDATE 사용)
CREATE OR REPLACE FUNCTION public.update_video_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- videos 테이블 잠금 후 업데이트 (레이스 컨디션 방지)
    PERFORM 1 FROM public.videos WHERE id = NEW.video_id FOR UPDATE;
    
    UPDATE public.videos SET
        execution_count = execution_count + 1,
        success_count = success_count + CASE WHEN NEW.status = 'SUCCESS' THEN 1 ELSE 0 END,
        failed_count = failed_count + CASE WHEN NEW.status = 'FAILED' THEN 1 ELSE 0 END,
        total_watch_seconds = total_watch_seconds + COALESCE(NEW.watch_duration_seconds, 0),
        updated_at = NOW()
    WHERE id = NEW.video_id;
    
    -- channels 테이블 잠금 후 업데이트 (레이스 컨디션 방지)
    IF NEW.status = 'SUCCESS' THEN
        PERFORM 1 FROM public.channels WHERE id = NEW.channel_id FOR UPDATE;
        
        UPDATE public.channels SET
            total_videos_executed = total_videos_executed + 1,
            total_watch_time_seconds = total_watch_time_seconds + COALESCE(NEW.watch_duration_seconds, 0),
            updated_at = NOW()
        WHERE id = NEW.channel_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 실행 후 통계 업데이트
DROP TRIGGER IF EXISTS trigger_update_video_stats ON public.video_executions;
CREATE TRIGGER trigger_update_video_stats
    AFTER INSERT ON public.video_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_video_stats();

-- 대기 중인 영상 가져오기 (노드에 할당)
CREATE OR REPLACE FUNCTION public.fetch_next_video(
    p_node_count INTEGER DEFAULT 1
)
RETURNS TABLE(
    video_id UUID,
    youtube_video_id VARCHAR(20),
    title VARCHAR(500),
    video_url VARCHAR(500),
    watch_min INTEGER,
    watch_max INTEGER,
    should_like BOOLEAN
) AS $$
DECLARE
    v_video RECORD;
    v_channel RECORD;
BEGIN
    -- 가장 높은 우선순위의 queued 영상 가져오기
    SELECT v.* INTO v_video
    FROM public.videos v
    WHERE v.status = 'queued'
    ORDER BY v.priority DESC, v.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF v_video IS NULL THEN
        RETURN;
    END IF;
    
    -- 상태를 executing으로 변경
    UPDATE public.videos SET
        status = 'executing',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = v_video.id;
    
    -- 채널 정보 조회 (별도 SELECT로 FOUND 상태 명확히 확인)
    SELECT * INTO v_channel
    FROM public.channels c
    WHERE c.id = v_video.channel_id;
    
    -- 채널 유무에 관계없이 COALESCE로 기본값 적용하여 단일 RETURN QUERY 사용
    RETURN QUERY
    SELECT 
        v_video.id,
        v_video.video_id,
        v_video.title,
        v_video.video_url,
        COALESCE(v_video.watch_min_seconds, v_channel.default_watch_min_seconds, 60)::INTEGER,
        COALESCE(v_video.watch_max_seconds, v_channel.default_watch_max_seconds, 300)::INTEGER,
        COALESCE(v_video.should_like, v_channel.default_like, false)::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. RLS Policies
-- ============================================================

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_check_logs ENABLE ROW LEVEL SECURITY;

-- Admin만 접근 가능
CREATE POLICY "Admin can manage channels" ON public.channels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin can manage videos" ON public.videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin can view executions" ON public.video_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'viewer')
        )
    );

CREATE POLICY "Admin can view check logs" ON public.channel_check_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'viewer')
        )
    );

-- ============================================================
-- 8. Initial Data (테스트용)
-- ============================================================

-- 예시 채널 (주석 처리됨, 필요시 활성화)
/*
INSERT INTO public.channels (channel_id, channel_name, channel_url, category, is_active, auto_execute)
VALUES 
    ('UCxxxxxxxxxxxxxx', '테스트 채널', 'https://www.youtube.com/@test', 'entertainment', true, true);
*/

COMMENT ON TABLE public.channels IS 'YouTube 채널 관리 - 자동 모니터링 및 실행 설정';
COMMENT ON TABLE public.videos IS '영상 관리 - 채널과 연관, 실행 상태 추적';
COMMENT ON TABLE public.video_executions IS '영상 실행 이력 - 노드별 시청 기록';
COMMENT ON TABLE public.channel_check_logs IS 'YouTube API 체크 이력';

