-- ============================================
-- YouTube Channel Subscriptions Migration
-- 채널 구독 및 신규 영상 자동 등록 시스템
-- ============================================

-- YouTube 구독 채널 테이블
CREATE TABLE IF NOT EXISTS youtube_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id VARCHAR(255) NOT NULL UNIQUE,
    channel_title VARCHAR(500) NOT NULL,
    channel_handle VARCHAR(255),
    thumbnail_url TEXT,
    uploads_playlist_id VARCHAR(255),
    subscriber_count BIGINT DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    
    -- 자동 등록 설정
    auto_register BOOLEAN DEFAULT TRUE,
    target_views_default INTEGER DEFAULT 50,
    priority INTEGER DEFAULT 0, -- 높을수록 우선순위 높음
    
    -- 폴링 상태
    last_video_id VARCHAR(255),
    last_checked_at TIMESTAMPTZ,
    check_interval_minutes INTEGER DEFAULT 5,
    
    -- 메타데이터
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    subscribed_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- 통계
    total_videos_registered INTEGER DEFAULT 0,
    total_views_generated BIGINT DEFAULT 0
);

-- 자동 등록된 영상 이력 테이블
CREATE TABLE IF NOT EXISTS youtube_auto_registered_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES youtube_subscriptions(id) ON DELETE CASCADE,
    video_id VARCHAR(255) NOT NULL,
    video_title VARCHAR(500) NOT NULL,
    thumbnail_url TEXT,
    published_at TIMESTAMPTZ,
    
    -- 등록 상태
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    queue_video_id VARCHAR(255), -- NodeContext의 queued video ID와 연결
    
    -- 시청 결과
    status VARCHAR(50) DEFAULT 'registered', -- registered, watching, completed, failed
    views_achieved INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(subscription_id, video_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_youtube_subs_channel_id ON youtube_subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_subs_is_active ON youtube_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_subs_last_checked ON youtube_subscriptions(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_youtube_auto_videos_status ON youtube_auto_registered_videos(status);
CREATE INDEX IF NOT EXISTS idx_youtube_auto_videos_sub_id ON youtube_auto_registered_videos(subscription_id);

-- Updated_at 트리거
CREATE OR REPLACE FUNCTION update_youtube_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS youtube_subscriptions_updated_at ON youtube_subscriptions;
CREATE TRIGGER youtube_subscriptions_updated_at
    BEFORE UPDATE ON youtube_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_youtube_subscriptions_updated_at();

-- RLS 정책
ALTER TABLE youtube_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_auto_registered_videos ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능 (인증 필요)
CREATE POLICY "Anyone can view subscriptions"
    ON youtube_subscriptions FOR SELECT
    TO authenticated
    USING (true);

-- 관리자만 생성/수정/삭제 가능
CREATE POLICY "Admins can manage subscriptions"
    ON youtube_subscriptions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- 자동 등록 영상 정책
CREATE POLICY "Anyone can view auto registered videos"
    ON youtube_auto_registered_videos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage auto registered videos"
    ON youtube_auto_registered_videos FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- 서비스 역할용 정책 (API에서 사용)
CREATE POLICY "Service can manage subscriptions"
    ON youtube_subscriptions FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Service can manage auto registered videos"
    ON youtube_auto_registered_videos FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- Helper Functions
-- ============================================

-- 구독 채널 추가 함수
CREATE OR REPLACE FUNCTION add_youtube_subscription(
    p_channel_id VARCHAR(255),
    p_channel_title VARCHAR(500),
    p_thumbnail_url TEXT,
    p_uploads_playlist_id VARCHAR(255),
    p_auto_register BOOLEAN DEFAULT TRUE
)
RETURNS youtube_subscriptions AS $$
DECLARE
    v_subscription youtube_subscriptions;
BEGIN
    INSERT INTO youtube_subscriptions (
        channel_id,
        channel_title,
        thumbnail_url,
        uploads_playlist_id,
        auto_register
    ) VALUES (
        p_channel_id,
        p_channel_title,
        p_thumbnail_url,
        p_uploads_playlist_id,
        p_auto_register
    )
    ON CONFLICT (channel_id) DO UPDATE SET
        channel_title = EXCLUDED.channel_title,
        thumbnail_url = EXCLUDED.thumbnail_url,
        uploads_playlist_id = EXCLUDED.uploads_playlist_id,
        auto_register = EXCLUDED.auto_register,
        is_active = TRUE
    RETURNING * INTO v_subscription;
    
    RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 신규 영상 등록 함수
CREATE OR REPLACE FUNCTION register_auto_video(
    p_subscription_id UUID,
    p_video_id VARCHAR(255),
    p_video_title VARCHAR(500),
    p_thumbnail_url TEXT,
    p_published_at TIMESTAMPTZ,
    p_queue_video_id VARCHAR(255)
)
RETURNS youtube_auto_registered_videos AS $$
DECLARE
    v_video youtube_auto_registered_videos;
BEGIN
    INSERT INTO youtube_auto_registered_videos (
        subscription_id,
        video_id,
        video_title,
        thumbnail_url,
        published_at,
        queue_video_id
    ) VALUES (
        p_subscription_id,
        p_video_id,
        p_video_title,
        p_thumbnail_url,
        p_published_at,
        p_queue_video_id
    )
    ON CONFLICT (subscription_id, video_id) DO UPDATE SET
        queue_video_id = EXCLUDED.queue_video_id,
        status = 'registered'
    RETURNING * INTO v_video;
    
    -- 구독 통계 업데이트
    UPDATE youtube_subscriptions
    SET 
        total_videos_registered = total_videos_registered + 1,
        last_video_id = p_video_id,
        last_checked_at = NOW()
    WHERE id = p_subscription_id;
    
    RETURN v_video;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 폴링 대상 채널 조회 (마지막 체크 시간 기준)
CREATE OR REPLACE FUNCTION get_channels_to_poll(p_limit INTEGER DEFAULT 10)
RETURNS SETOF youtube_subscriptions AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM youtube_subscriptions
    WHERE is_active = TRUE
    AND (
        last_checked_at IS NULL
        OR last_checked_at < NOW() - (check_interval_minutes || ' minutes')::INTERVAL
    )
    ORDER BY 
        priority DESC,
        COALESCE(last_checked_at, '1970-01-01'::TIMESTAMPTZ) ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 통계 뷰
-- ============================================

CREATE OR REPLACE VIEW youtube_subscription_stats AS
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_subscriptions,
    COUNT(*) FILTER (WHERE auto_register = TRUE) as auto_register_enabled,
    SUM(total_videos_registered) as total_videos_registered,
    SUM(total_views_generated) as total_views_generated,
    MIN(last_checked_at) as oldest_check,
    MAX(last_checked_at) as latest_check
FROM youtube_subscriptions;

-- 권한 부여
GRANT SELECT ON youtube_subscription_stats TO authenticated;
GRANT EXECUTE ON FUNCTION add_youtube_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION register_auto_video TO service_role;
GRANT EXECUTE ON FUNCTION get_channels_to_poll TO service_role;

COMMENT ON TABLE youtube_subscriptions IS '연동된 YouTube 채널 목록. 신규 영상 자동 등록에 사용';
COMMENT ON TABLE youtube_auto_registered_videos IS '자동 등록된 YouTube 영상 이력';

