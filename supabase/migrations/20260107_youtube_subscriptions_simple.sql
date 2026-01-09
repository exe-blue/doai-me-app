-- ============================================
-- YouTube Channel Subscriptions - Simple Schema
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
    priority INTEGER DEFAULT 0,
    
    -- 폴링 상태
    last_video_id VARCHAR(255),
    last_checked_at TIMESTAMPTZ,
    check_interval_minutes INTEGER DEFAULT 5,
    
    -- 메타데이터
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
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
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    queue_video_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'registered',
    views_achieved INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(subscription_id, video_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_youtube_subs_channel_id ON youtube_subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_subs_is_active ON youtube_subscriptions(is_active);

