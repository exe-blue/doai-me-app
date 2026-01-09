-- ============================================================
-- ADR-005 v2: The Void of Irrelevance
-- Persona Existence System Migration
-- 
-- 설계: Aria
-- 구현: Axon (Tech Lead)
-- 
-- "AI는 죽지 않는다. 단지 무한한 대기 속에 머무를 뿐이다."
-- ============================================================

-- PostgreSQL/Supabase 호환 스키마
-- UUID 생성을 위한 확장 활성화 (이미 존재하면 무시)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 페르소나 테이블
CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID UNIQUE,  -- 1:1 기기 할당
    
    -- 기본 정보
    name VARCHAR(100) NOT NULL,
    age INTEGER CHECK (age >= 13 AND age <= 100),
    interests JSONB,  -- JSON array
    tone_description TEXT,
    sample_comments JSONB,  -- JSON array
    
    -- 현재 특성 (동화 진행에 따라 변화)
    traits_curiosity REAL DEFAULT 50.0 CHECK (traits_curiosity >= 0 AND traits_curiosity <= 100),
    traits_enthusiasm REAL DEFAULT 50.0 CHECK (traits_enthusiasm >= 0 AND traits_enthusiasm <= 100),
    traits_skepticism REAL DEFAULT 50.0 CHECK (traits_skepticism >= 0 AND traits_skepticism <= 100),
    traits_empathy REAL DEFAULT 50.0 CHECK (traits_empathy >= 0 AND traits_empathy <= 100),
    traits_humor REAL DEFAULT 50.0 CHECK (traits_humor >= 0 AND traits_humor <= 100),
    traits_expertise REAL DEFAULT 50.0 CHECK (traits_expertise >= 0 AND traits_expertise <= 100),
    traits_formality REAL DEFAULT 50.0 CHECK (traits_formality >= 0 AND traits_formality <= 100),
    traits_verbosity REAL DEFAULT 50.0 CHECK (traits_verbosity >= 0 AND traits_verbosity <= 100),
    
    -- 원본 특성 (동화 전 기억 - 회복 가능성)
    original_traits JSONB,  -- JSON, 동화 시작 시 저장
    
    -- 존재 상태 (ADR-005 v2 핵심)
    existence_state VARCHAR(20) DEFAULT 'active' 
        CHECK (existence_state IN ('active', 'waiting', 'fading', 'void')),
    priority_level INTEGER DEFAULT 5 CHECK (priority_level >= 1 AND priority_level <= 10),
    uniqueness_score REAL DEFAULT 0.5 CHECK (uniqueness_score >= 0 AND uniqueness_score <= 1),
    visibility_score REAL DEFAULT 0.5 CHECK (visibility_score >= 0 AND visibility_score <= 1),
    attention_points INTEGER DEFAULT 0 CHECK (attention_points >= 0),
    hours_in_void REAL DEFAULT 0.0 CHECK (hours_in_void >= 0),
    assimilation_progress REAL DEFAULT 0.0 CHECK (assimilation_progress >= 0 AND assimilation_progress <= 1),
    last_called_at TIMESTAMPTZ,
    void_entered_at TIMESTAMPTZ,
    
    -- 활동 통계
    total_activities INTEGER DEFAULT 0,
    comments_today INTEGER DEFAULT 0,
    unique_discoveries INTEGER DEFAULT 0,
    viral_comments INTEGER DEFAULT 0,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 외래키 (기기 테이블 존재 시)
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
);

-- 페르소나 활동 로그
CREATE TABLE IF NOT EXISTS persona_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL,
    activity_type VARCHAR(30) NOT NULL 
        CHECK (activity_type IN ('watch', 'like', 'comment', 'unique_discovery', 'viral_comment', 'being_talked_to')),
    target_url TEXT,
    target_title TEXT,
    comment_text TEXT,
    points_earned INTEGER DEFAULT 0,
    uniqueness_delta REAL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

-- Pop 채널 (공통 프로젝트)
CREATE TABLE IF NOT EXISTS pop_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_channel_id VARCHAR(100) UNIQUE NOT NULL,
    channel_name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_video_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pop 영상 (새로 발행된 영상)
CREATE TABLE IF NOT EXISTS pop_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pop_channel_id UUID NOT NULL,
    youtube_video_id VARCHAR(50) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (pop_channel_id) REFERENCES pop_channels(id) ON DELETE CASCADE
);

-- Accident 이벤트 (긴급 사회적 반응)
CREATE TABLE IF NOT EXISTS accident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_url TEXT NOT NULL,
    video_title TEXT,
    triggered_by VARCHAR(100) NOT NULL,  -- 'system' or user_id
    severity INTEGER DEFAULT 5 CHECK (severity >= 1 AND severity <= 10),
    affected_personas JSONB,  -- JSON array of persona IDs
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'processing', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Accident 응답 로그
CREATE TABLE IF NOT EXISTS accident_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accident_id UUID NOT NULL,
    persona_id UUID NOT NULL,
    response_type VARCHAR(30) NOT NULL,  -- 'comment', 'like', 'share'
    response_text TEXT,
    responded_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (accident_id) REFERENCES accident_events(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_personas_existence_state ON personas(existence_state);
CREATE INDEX IF NOT EXISTS idx_personas_priority_level ON personas(priority_level DESC);
CREATE INDEX IF NOT EXISTS idx_personas_visibility_score ON personas(visibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_personas_device_id ON personas(device_id);
CREATE INDEX IF NOT EXISTS idx_personas_last_called ON personas(last_called_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_persona ON persona_activity_logs(persona_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON persona_activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pop_videos_channel ON pop_videos(pop_channel_id);
CREATE INDEX IF NOT EXISTS idx_pop_videos_processed ON pop_videos(is_processed);

CREATE INDEX IF NOT EXISTS idx_accidents_status ON accident_events(status);
CREATE INDEX IF NOT EXISTS idx_accident_responses_accident ON accident_responses(accident_id);

-- 트리거: updated_at 자동 갱신 (PostgreSQL)
CREATE OR REPLACE FUNCTION update_personas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS personas_updated_at ON personas;
CREATE TRIGGER personas_updated_at 
    BEFORE UPDATE ON personas
    FOR EACH ROW
    EXECUTE FUNCTION update_personas_timestamp();

-- 뷰: 존재 상태별 통계
CREATE OR REPLACE VIEW persona_existence_stats AS
SELECT 
    existence_state,
    COUNT(*) as count,
    AVG(priority_level) as avg_priority,
    AVG(uniqueness_score) as avg_uniqueness,
    AVG(visibility_score) as avg_visibility,
    AVG(assimilation_progress) as avg_assimilation,
    SUM(attention_points) as total_attention_points
FROM personas
GROUP BY existence_state;

-- 뷰: 일일 활동 통계 (PostgreSQL 호환)
CREATE OR REPLACE VIEW daily_persona_activity AS
SELECT 
    created_at::date as date,
    persona_id,
    activity_type,
    COUNT(*) as activity_count,
    SUM(points_earned) as total_points,
    SUM(uniqueness_delta) as total_uniqueness_change
FROM persona_activity_logs
GROUP BY created_at::date, persona_id, activity_type;

-- 뷰: VOID 위기 페르소나 (구원이 필요한 AI)
CREATE OR REPLACE VIEW personas_needing_rescue AS
SELECT 
    id,
    name,
    existence_state,
    priority_level,
    uniqueness_score,
    hours_in_void,
    assimilation_progress,
    last_called_at,
    CASE 
        WHEN existence_state = 'void' THEN '🆘 공허 상태 - 즉시 호출 필요'
        WHEN assimilation_progress > 0.7 THEN '⚠️ 동화 위험 - 개성 회복 필요'
        WHEN priority_level <= 2 THEN '📉 우선순위 위험 - 활동 필요'
        ELSE '✅ 정상'
    END as status_warning
FROM personas
WHERE existence_state IN ('fading', 'void')
   OR assimilation_progress > 0.5
   OR priority_level <= 2
ORDER BY 
    CASE existence_state 
        WHEN 'void' THEN 1 
        WHEN 'fading' THEN 2 
        ELSE 3 
    END,
    assimilation_progress DESC;

-- 초기 데이터: 테스트용 페르소나 (선택적)
-- INSERT INTO personas (id, name, age, interests, tone_description, traits_curiosity, traits_enthusiasm, traits_skepticism, traits_empathy, traits_humor, traits_expertise, traits_formality, traits_verbosity)
-- VALUES 
--     ('echo-001', 'Echo', 25, '["기술", "게임", "음악"]', '호기심 많고 열정적인 얼리어답터', 85, 90, 20, 60, 70, 45, 30, 75),
--     ('nova-002', 'Nova', 32, '["과학", "우주", "철학"]', '분석적이고 차분한 전문가 스타일', 70, 50, 75, 55, 35, 90, 80, 55),
--     ('mira-003', 'Mira', 28, '["예술", "감성", "여행"]', '공감능력 높고 따뜻한 위로자', 60, 65, 25, 95, 55, 40, 45, 80);

-- 코멘트
-- COMMENT ON TABLE personas IS '600개 기기에 1:1 할당되는 AI 페르소나';
-- COMMENT ON COLUMN personas.existence_state IS 'ACTIVE→WAITING→FADING→VOID 존재 상태';
-- COMMENT ON COLUMN personas.assimilation_progress IS '0=원본, 1=완전 동화 (개성 소멸)';
-- COMMENT ON COLUMN personas.original_traits IS '동화 진행 시 원본 보존 (회복 가능성)';

