-- ═══════════════════════════════════════════════════════════════════════════
-- YouTube 채널 모니터링 시스템 마이그레이션
-- ═══════════════════════════════════════════════════════════════════════════
-- N8N 대신 Python Backend에서 직접 처리
-- RSS 피드 기반 가벼운 모니터링
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- I. YouTube 채널 관리 테이블
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS youtube_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 채널 식별
    channel_id TEXT NOT NULL UNIQUE,  -- UC로 시작하는 YouTube 채널 ID
    channel_name TEXT,                 -- 표시용 채널 이름
    
    -- 활성화 상태
    is_active BOOLEAN DEFAULT true,
    
    -- 시청 설정
    watch_priority TEXT DEFAULT 'NORMAL'
        CHECK (watch_priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    min_watch_seconds INTEGER DEFAULT 30 CHECK (min_watch_seconds >= 10),
    max_watch_seconds INTEGER DEFAULT 180 CHECK (max_watch_seconds >= 30),
    
    -- 액션 설정
    enable_like BOOLEAN DEFAULT false,
    enable_comment BOOLEAN DEFAULT false,
    enable_subscribe BOOLEAN DEFAULT false,
    default_comment_text TEXT,  -- 댓글 템플릿 (NULL이면 AI 생성)
    
    -- 통계
    total_videos_queued INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMPTZ,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_youtube_channels_active ON youtube_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_priority ON youtube_channels(watch_priority);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_youtube_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_youtube_channels_updated_at ON youtube_channels;
CREATE TRIGGER trigger_youtube_channels_updated_at
    BEFORE UPDATE ON youtube_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_youtube_channels_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- II. 시청 대기열 테이블
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 영상 정보
    video_id TEXT NOT NULL UNIQUE,  -- YouTube video ID (11자)
    video_url TEXT NOT NULL,         -- 전체 URL
    title TEXT,
    channel_id TEXT,                 -- 소속 채널 ID
    
    -- 상태
    status TEXT DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ASSIGNED', 'WATCHING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    priority TEXT DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    
    -- 시청 설정
    watch_count INTEGER DEFAULT 1,           -- 목표 시청 횟수
    watched_count INTEGER DEFAULT 0,         -- 완료된 시청 횟수
    min_watch_seconds INTEGER DEFAULT 30,
    max_watch_seconds INTEGER DEFAULT 180,
    
    -- 액션 설정
    enable_like BOOLEAN DEFAULT false,
    enable_comment BOOLEAN DEFAULT false,
    enable_subscribe BOOLEAN DEFAULT false,
    comment_text TEXT,  -- 작성할 댓글 (NULL이면 AI 생성)
    
    -- 실행 정보
    assigned_device_id UUID,
    assigned_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- 결과
    result_json JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_video_queue_status ON video_queue(status);
CREATE INDEX IF NOT EXISTS idx_video_queue_priority ON video_queue(priority);
CREATE INDEX IF NOT EXISTS idx_video_queue_channel ON video_queue(channel_id);
CREATE INDEX IF NOT EXISTS idx_video_queue_created ON video_queue(created_at);

-- 복합 인덱스: PENDING 상태 + 우선순위 (작업 할당 최적화)
CREATE INDEX IF NOT EXISTS idx_video_queue_pending_priority 
ON video_queue(priority DESC, created_at ASC) 
WHERE status = 'PENDING';


-- ═══════════════════════════════════════════════════════════════════════════
-- III. 시청 결과 테이블 (히스토리)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 참조
    video_queue_id UUID REFERENCES video_queue(id) ON DELETE SET NULL,
    video_id TEXT NOT NULL,
    device_id UUID,
    
    -- 결과
    success BOOLEAN NOT NULL,
    watch_duration_seconds INTEGER,
    liked BOOLEAN DEFAULT false,
    commented BOOLEAN DEFAULT false,
    subscribed BOOLEAN DEFAULT false,
    comment_posted TEXT,
    
    -- 에러 정보
    error_code TEXT,
    error_message TEXT,
    
    -- 타임스탬프
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_watch_history_video ON video_watch_history(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_device ON video_watch_history(device_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_completed ON video_watch_history(completed_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- IV. 유용한 함수들
-- ═══════════════════════════════════════════════════════════════════════════

-- 다음 시청할 영상 가져오기 (원자적 할당)
CREATE OR REPLACE FUNCTION get_next_video_for_device(p_device_id UUID)
RETURNS video_queue AS $$
DECLARE
    v_video video_queue;
BEGIN
    -- PENDING 상태의 가장 높은 우선순위 영상 선택 및 할당
    UPDATE video_queue
    SET 
        status = 'ASSIGNED',
        assigned_device_id = p_device_id,
        assigned_at = now()
    WHERE id = (
        SELECT id FROM video_queue
        WHERE status = 'PENDING'
        ORDER BY 
            CASE priority
                WHEN 'URGENT' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'LOW' THEN 4
            END,
            created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO v_video;
    
    RETURN v_video;
END;
$$ LANGUAGE plpgsql;


-- 시청 완료 처리
CREATE OR REPLACE FUNCTION complete_video_watch(
    p_queue_id UUID,
    p_success BOOLEAN,
    p_watch_seconds INTEGER,
    p_liked BOOLEAN DEFAULT false,
    p_commented BOOLEAN DEFAULT false,
    p_subscribed BOOLEAN DEFAULT false,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_video video_queue;
BEGIN
    -- 영상 정보 가져오기
    SELECT * INTO v_video FROM video_queue WHERE id = p_queue_id;
    
    IF v_video IS NULL THEN
        RETURN false;
    END IF;
    
    -- 히스토리 기록
    INSERT INTO video_watch_history (
        video_queue_id, video_id, device_id,
        success, watch_duration_seconds,
        liked, commented, subscribed,
        error_message, started_at, completed_at
    ) VALUES (
        p_queue_id, v_video.video_id, v_video.assigned_device_id,
        p_success, p_watch_seconds,
        p_liked, p_commented, p_subscribed,
        p_error_message, v_video.assigned_at, now()
    );
    
    -- 성공 시
    IF p_success THEN
        UPDATE video_queue
        SET 
            status = 'COMPLETED',
            watched_count = watched_count + 1,
            processed_at = now(),
            result_json = jsonb_build_object(
                'watch_seconds', p_watch_seconds,
                'liked', p_liked,
                'commented', p_commented,
                'subscribed', p_subscribed
            )
        WHERE id = p_queue_id;
    ELSE
        -- 실패 시 재시도 가능 여부 확인
        IF v_video.retry_count < v_video.max_retries THEN
            UPDATE video_queue
            SET 
                status = 'PENDING',
                assigned_device_id = NULL,
                assigned_at = NULL,
                retry_count = retry_count + 1,
                last_attempt_at = now(),
                error_message = p_error_message
            WHERE id = p_queue_id;
        ELSE
            UPDATE video_queue
            SET 
                status = 'FAILED',
                processed_at = now(),
                error_message = p_error_message
            WHERE id = p_queue_id;
        END IF;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;


-- 오래된 ASSIGNED 상태 복구 (타임아웃)
CREATE OR REPLACE FUNCTION recover_stale_assignments(p_timeout_minutes INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE video_queue
    SET 
        status = 'PENDING',
        assigned_device_id = NULL,
        assigned_at = NULL,
        retry_count = retry_count + 1
    WHERE status = 'ASSIGNED'
      AND assigned_at < now() - (p_timeout_minutes || ' minutes')::INTERVAL
      AND retry_count < max_retries;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- V. 샘플 데이터 (테스트용)
-- ═══════════════════════════════════════════════════════════════════════════

-- 테스트용 채널 추가 (실제 채널 ID)
INSERT INTO youtube_channels (channel_id, channel_name, is_active, watch_priority)
VALUES 
    ('UC_x5XG1OV2P6uZZ5FSM9Ttw', 'Google Developers', true, 'NORMAL'),
    ('UCAuUUnT6oDeKwE6v1NGQxug', 'TED', true, 'HIGH')
ON CONFLICT (channel_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════


