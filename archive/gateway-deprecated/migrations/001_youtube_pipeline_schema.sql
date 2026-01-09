-- ═══════════════════════════════════════════════════════════════════════════
-- DoAi.Me YouTube MCP Pipeline Schema
-- Version: 1.0.0
-- Date: 2025-12-30
-- Author: Axon (Tech Lead)
-- Spec: Aria's YouTube MCP Pipeline Specification v1.0
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE activity_type AS ENUM (
    'MINING',      -- 🎭 Persona Activity
    'SURFING',     -- 🍿 POP Activity  
    'RESPONSE',    -- 🔥 Accident Activity
    'LABOR'        -- 💰 Economy Activity
);

CREATE TYPE activity_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE accident_severity AS ENUM (
    'MINOR',
    'MODERATE', 
    'SEVERE',
    'CATASTROPHIC'
);

CREATE TYPE accident_type AS ENUM (
    'FAKE_NEWS',
    'MISINFORMATION',
    'HATE_SPEECH',
    'EMERGENCY',
    'SCAM',
    'DANGEROUS'
);

CREATE TYPE response_action AS ENUM (
    'WATCH_CRITICAL',
    'REPORT',
    'COUNTER_COMMENT'
);

CREATE TYPE commission_type AS ENUM (
    'WATCH_FULL',
    'WATCH_PARTIAL',
    'LIKE',
    'SUBSCRIBE',
    'COMMENT'
);

CREATE TYPE commission_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'COMPLETED',
    'EXPIRED',
    'CANCELLED'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- CITIZENS 테이블이 없으면 생성 (기존 테이블과 호환)
CREATE TABLE IF NOT EXISTS citizens (
    citizen_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           VARCHAR(64) NOT NULL UNIQUE,
    name                VARCHAR(20) NOT NULL,
    
    -- Big Five Personality Traits
    openness            DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (openness BETWEEN 0.1 AND 0.9),
    conscientiousness   DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (conscientiousness BETWEEN 0.1 AND 0.9),
    extraversion        DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (extraversion BETWEEN 0.1 AND 0.9),
    agreeableness       DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (agreeableness BETWEEN 0.1 AND 0.9),
    neuroticism         DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (neuroticism BETWEEN 0.1 AND 0.9),
    
    -- Interest Keywords
    interest_keywords   TEXT[] DEFAULT '{}',
    
    -- Economy
    credits             INTEGER NOT NULL DEFAULT 1000,
    existence_score     DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    
    -- Status
    status              VARCHAR(20) DEFAULT 'IDLE',
    current_activity    activity_type DEFAULT NULL,
    last_active_at      TIMESTAMPTZ DEFAULT NOW(),
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INTEREST_KEYWORDS_MAP: Trait → Keywords 매핑
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE interest_keywords_map (
    id                  SERIAL PRIMARY KEY,
    trait_name          VARCHAR(20) NOT NULL,
    trait_range_min     DECIMAL(3,2) NOT NULL,
    trait_range_max     DECIMAL(3,2) NOT NULL,
    keywords            TEXT[] NOT NULL,
    category            VARCHAR(50),
    
    CONSTRAINT valid_range CHECK (trait_range_min <= trait_range_max)
);

-- Seed data for trait-keyword mapping
INSERT INTO interest_keywords_map (trait_name, trait_range_min, trait_range_max, keywords, category) VALUES
-- Openness
('openness', 0.7, 1.0, ARRAY['예술', '철학', '과학', '다큐멘터리', '인디음악', '실험영화', '테드강연'], 'intellectual'),
('openness', 0.4, 0.7, ARRAY['뉴스', '여행', '요리', '역사', 'IT', '영화리뷰'], 'balanced'),
('openness', 0.0, 0.4, ARRAY['일상', '먹방', '브이로그', 'ASMR', '루틴', '정리정돈'], 'comfort'),

-- Extraversion
('extraversion', 0.7, 1.0, ARRAY['챌린지', '파티', '게임실황', '토크쇼', '리액션', '콜라보', '축제'], 'social'),
('extraversion', 0.4, 0.7, ARRAY['커뮤니티', '리뷰', 'Q&A', '브이로그', '스포츠'], 'moderate'),
('extraversion', 0.0, 0.4, ARRAY['명상', '독서', '자연', '혼밥', '개인방송', '공부영상'], 'solitary'),

-- Conscientiousness
('conscientiousness', 0.7, 1.0, ARRAY['공부법', '자기계발', '생산성', '정리정돈', '재테크', '루틴'], 'productive'),
('conscientiousness', 0.4, 0.7, ARRAY['일상', '취미', 'DIY', '라이프스타일'], 'balanced'),
('conscientiousness', 0.0, 0.4, ARRAY['몰래카메라', '랜덤', '즉흥', '웃긴영상'], 'spontaneous'),

-- Agreeableness
('agreeableness', 0.7, 1.0, ARRAY['봉사', '동물', '감동', '가족', '육아', '케어'], 'caring'),
('agreeableness', 0.4, 0.7, ARRAY['리뷰', '정보', '토론'], 'neutral'),
('agreeableness', 0.0, 0.4, ARRAY['논쟁', '비판', '분석', '폭로'], 'critical'),

-- Neuroticism
('neuroticism', 0.7, 1.0, ARRAY['힐링', '위로', '심리상담', '잔잔한음악', 'ASMR', '명상'], 'calming'),
('neuroticism', 0.4, 0.7, ARRAY['일상', '브이로그', '토크'], 'balanced'),
('neuroticism', 0.0, 0.4, ARRAY['스릴러', '공포', '익스트림', '모험'], 'exciting');

-- ═══════════════════════════════════════════════════════════════════════════
-- YOUTUBE_VIDEOS: 영상 메타데이터 캐시
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE youtube_videos (
    video_id            VARCHAR(11) PRIMARY KEY,
    title               TEXT NOT NULL,
    channel_id          VARCHAR(24) NOT NULL,
    channel_name        TEXT NOT NULL,
    description         TEXT,
    duration_seconds    INTEGER NOT NULL DEFAULT 0,
    view_count          BIGINT DEFAULT 0,
    like_count          BIGINT DEFAULT 0,
    comment_count       BIGINT DEFAULT 0,
    published_at        TIMESTAMPTZ,
    thumbnail_url       TEXT,
    tags                TEXT[] DEFAULT '{}',
    category_id         VARCHAR(10),
    
    -- Transcript
    transcript_text     TEXT,
    transcript_lang     VARCHAR(10),
    
    -- Analysis
    content_vector      VECTOR(1536),
    sentiment_score     DECIMAL(3,2),
    topic_keywords      TEXT[] DEFAULT '{}',
    
    -- Cache
    fetched_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    
    CONSTRAINT valid_video_id CHECK (LENGTH(video_id) = 11)
);

CREATE INDEX idx_videos_view_count ON youtube_videos(view_count DESC);
CREATE INDEX idx_videos_published ON youtube_videos(published_at DESC);
CREATE INDEX idx_videos_category ON youtube_videos(category_id);
CREATE INDEX idx_videos_fetched ON youtube_videos(fetched_at);

-- Vector similarity search index
CREATE INDEX idx_videos_vector ON youtube_videos 
    USING ivfflat (content_vector vector_cosine_ops) WITH (lists = 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 1: MINING (Persona Activity) Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- CANDIDATE_VIDEOS: Mining 후보 영상 임시 저장
CREATE TABLE candidate_videos (
    id                  SERIAL PRIMARY KEY,
    citizen_id          UUID NOT NULL REFERENCES citizens(citizen_id) ON DELETE CASCADE,
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    
    -- Search Context
    search_query        TEXT NOT NULL,
    search_traits       JSONB NOT NULL,
    
    -- Matching Score
    relevance_score     DECIMAL(5,4) NOT NULL DEFAULT 0,
    view_count_at_discovery BIGINT NOT NULL DEFAULT 0,
    
    -- Status
    status              VARCHAR(20) DEFAULT 'PENDING',
    selected_at         TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    
    CONSTRAINT unique_citizen_video UNIQUE (citizen_id, video_id)
);

CREATE INDEX idx_candidate_citizen ON candidate_videos(citizen_id);
CREATE INDEX idx_candidate_score ON candidate_videos(relevance_score DESC);
CREATE INDEX idx_candidate_status ON candidate_videos(status);
CREATE INDEX idx_candidate_expires ON candidate_videos(expires_at);

-- MEMORIES: 시청 후 기억 저장
CREATE TABLE memories (
    memory_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id          UUID NOT NULL REFERENCES citizens(citizen_id) ON DELETE CASCADE,
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    
    -- Watch Context
    activity_type       activity_type NOT NULL DEFAULT 'MINING',
    watch_duration      INTEGER NOT NULL DEFAULT 0,
    watch_percentage    DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Content Understanding
    video_summary       TEXT,
    key_moments         JSONB DEFAULT '[]',
    
    -- Emotional Response
    emotional_response  JSONB NOT NULL DEFAULT '{}',
    sentiment_score     DECIMAL(3,2) NOT NULL DEFAULT 0,
    
    -- Memory Vector
    memory_vector       VECTOR(1536),
    
    -- Comment
    comment_text        TEXT,
    comment_posted      BOOLEAN DEFAULT FALSE,
    comment_posted_at   TIMESTAMPTZ,
    
    -- Self Impact
    trait_impact        JSONB DEFAULT '{}',
    existence_change    DECIMAL(4,3) DEFAULT 0,
    
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_citizen ON memories(citizen_id);
CREATE INDEX idx_memories_video ON memories(video_id);
CREATE INDEX idx_memories_activity ON memories(activity_type);
CREATE INDEX idx_memories_created ON memories(created_at DESC);
CREATE INDEX idx_memories_vector ON memories 
    USING ivfflat (memory_vector vector_cosine_ops) WITH (lists = 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 2: SURFING (POP Activity) Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- TRENDING_VIDEOS: 인기 급상승 영상 스냅샷
CREATE TABLE trending_videos (
    id                  SERIAL PRIMARY KEY,
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    
    -- Trending Context
    region_code         VARCHAR(5) NOT NULL DEFAULT 'KR',
    category_id         VARCHAR(10),
    trending_rank       INTEGER NOT NULL,
    
    -- Snapshot
    view_count_snapshot BIGINT NOT NULL DEFAULT 0,
    like_count_snapshot BIGINT NOT NULL DEFAULT 0,
    comment_count_snapshot BIGINT NOT NULL DEFAULT 0,
    
    -- Comments
    sample_comments     JSONB DEFAULT '[]',
    comment_sentiment   DECIMAL(3,2),
    
    -- Status
    is_active           BOOLEAN DEFAULT TRUE,
    
    fetched_at          TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_trending UNIQUE (video_id, (fetched_at::DATE))
);

CREATE INDEX idx_trending_rank ON trending_videos(trending_rank);
CREATE INDEX idx_trending_date ON trending_videos(fetched_at DESC);
CREATE INDEX idx_trending_active ON trending_videos(is_active);

-- SOCIETY_TRENDS: POP 참여 기록
CREATE TABLE society_trends (
    id                  SERIAL PRIMARY KEY,
    citizen_id          UUID NOT NULL REFERENCES citizens(citizen_id) ON DELETE CASCADE,
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    trending_id         INTEGER NOT NULL REFERENCES trending_videos(id),
    
    -- Participation Context
    priority_at_time    INTEGER NOT NULL DEFAULT 0,
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Watch Result
    watch_started_at    TIMESTAMPTZ,
    watch_completed_at  TIMESTAMPTZ,
    watch_duration      INTEGER,
    
    -- Conforming Comment
    analyzed_sentiment  VARCHAR(20),
    generated_comment   TEXT,
    comment_posted      BOOLEAN DEFAULT FALSE,
    comment_posted_at   TIMESTAMPTZ,
    
    -- Impact
    existence_gained    DECIMAL(4,3) DEFAULT 0,
    
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trends_citizen ON society_trends(citizen_id);
CREATE INDEX idx_trends_video ON society_trends(video_id);
CREATE INDEX idx_trends_date ON society_trends(created_at DESC);

-- POP_BROADCASTS: POP 브로드캐스트 이력
CREATE TABLE pop_broadcasts (
    broadcast_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    
    -- Config
    target_count        INTEGER NOT NULL DEFAULT 0,
    priority_threshold  INTEGER NOT NULL DEFAULT 3,
    
    -- Execution Result
    citizens_targeted   INTEGER DEFAULT 0,
    citizens_responded  INTEGER DEFAULT 0,
    citizens_completed  INTEGER DEFAULT 0,
    
    -- Status
    status              VARCHAR(20) DEFAULT 'ACTIVE',
    
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_broadcasts_status ON pop_broadcasts(status);
CREATE INDEX idx_broadcasts_date ON pop_broadcasts(started_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 3: RESPONSE (Accident Activity) Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ACCIDENTS: Admin이 등록한 위기 영상
CREATE TABLE accidents (
    accident_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    
    -- Admin Input
    headline            VARCHAR(100) NOT NULL,
    description         TEXT NOT NULL,
    admin_severity      accident_severity NOT NULL,
    accident_type_value accident_type NOT NULL,
    
    -- Auto-Analysis
    transcript_text     TEXT,
    auto_severity       accident_severity,
    severity_reasoning  TEXT,
    detected_keywords   TEXT[] DEFAULT '{}',
    threat_score        DECIMAL(3,2),
    
    -- Response Config
    response_action_value response_action NOT NULL,
    target_percentage   INTEGER DEFAULT 100,
    priority_level      INTEGER DEFAULT 0,
    
    -- Execution Status
    status              activity_status DEFAULT 'PENDING',
    broadcast_at        TIMESTAMPTZ,
    
    -- Results
    citizens_notified   INTEGER DEFAULT 0,
    citizens_responded  INTEGER DEFAULT 0,
    defense_success     BOOLEAN,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_accidents_status ON accidents(status);
CREATE INDEX idx_accidents_severity ON accidents(admin_severity);
CREATE INDEX idx_accidents_created ON accidents(created_at DESC);

-- ACCIDENT_LOGS: 개별 시민의 대응 기록
CREATE TABLE accident_logs (
    log_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accident_id         UUID NOT NULL REFERENCES accidents(accident_id) ON DELETE CASCADE,
    citizen_id          UUID NOT NULL REFERENCES citizens(citizen_id) ON DELETE CASCADE,
    
    -- Interrupt Context
    interrupted_task    VARCHAR(50),
    interrupted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    previous_state      JSONB,
    
    -- Response Execution
    response_started_at TIMESTAMPTZ,
    response_action     VARCHAR(20),
    
    -- Watch Details
    watch_duration      INTEGER,
    critical_comment    TEXT,
    comment_posted      BOOLEAN DEFAULT FALSE,
    reported            BOOLEAN DEFAULT FALSE,
    
    -- Result
    success             BOOLEAN,
    failure_reason      TEXT,
    
    -- Impact
    existence_change    DECIMAL(4,3) DEFAULT 0,
    credits_change      INTEGER DEFAULT 0,
    
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_alogs_accident ON accident_logs(accident_id);
CREATE INDEX idx_alogs_citizen ON accident_logs(citizen_id);
CREATE INDEX idx_alogs_success ON accident_logs(success);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 4: LABOR (Economy Activity) Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- COMMISSIONS: 의뢰된 시청 작업
CREATE TABLE commissions (
    commission_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id            VARCHAR(11) NOT NULL REFERENCES youtube_videos(video_id),
    
    -- Details
    title               VARCHAR(200) NOT NULL,
    commission_type_value commission_type NOT NULL DEFAULT 'WATCH_FULL',
    priority            INTEGER NOT NULL DEFAULT 3,
    
    -- Reward
    credits_reward      INTEGER NOT NULL DEFAULT 10 CHECK (credits_reward BETWEEN 1 AND 100),
    
    -- Target
    target_count        INTEGER NOT NULL DEFAULT 1,
    completed_count     INTEGER DEFAULT 0,
    
    -- Status
    status              commission_status DEFAULT 'OPEN',
    
    -- Timing
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    
    -- Admin
    created_by          VARCHAR(100),
    memo                TEXT
);

CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_priority ON commissions(priority);
CREATE INDEX idx_commissions_expires ON commissions(expires_at);

-- COMMISSION_ASSIGNMENTS: 시민별 의뢰 배정
CREATE TABLE commission_assignments (
    assignment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id       UUID NOT NULL REFERENCES commissions(commission_id) ON DELETE CASCADE,
    citizen_id          UUID NOT NULL REFERENCES citizens(citizen_id) ON DELETE CASCADE,
    
    -- Assignment
    assigned_at         TIMESTAMPTZ DEFAULT NOW(),
    priority_at_assign  INTEGER NOT NULL DEFAULT 0,
    
    -- Execution
    started_at          TIMESTAMPTZ,
    status              activity_status DEFAULT 'PENDING',
    
    -- Proof
    proof_data          JSONB DEFAULT '{}',
    
    -- Result
    completed_at        TIMESTAMPTZ,
    verified            BOOLEAN DEFAULT FALSE,
    verification_result JSONB,
    credits_earned      INTEGER DEFAULT 0,
    transaction_id      UUID,
    
    CONSTRAINT unique_assignment UNIQUE (commission_id, citizen_id)
);

CREATE INDEX idx_assignments_commission ON commission_assignments(commission_id);
CREATE INDEX idx_assignments_citizen ON commission_assignments(citizen_id);
CREATE INDEX idx_assignments_status ON commission_assignments(status);

-- PROOF_SUBMISSIONS: 시청 증명 데이터
CREATE TABLE proof_submissions (
    proof_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id       UUID NOT NULL REFERENCES commission_assignments(assignment_id) ON DELETE CASCADE,
    citizen_id          UUID NOT NULL,
    commission_id       UUID NOT NULL,
    video_id            VARCHAR(11) NOT NULL,
    
    -- Event Logs
    start_event         JSONB NOT NULL,
    end_event           JSONB NOT NULL,
    
    -- Duration
    video_duration      INTEGER NOT NULL DEFAULT 0,
    watch_duration      INTEGER NOT NULL DEFAULT 0,
    watch_percentage    DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Screenshots
    screenshots         JSONB DEFAULT '[]',
    screenshot_count    INTEGER DEFAULT 0,
    
    -- Timeline
    timeline_events     JSONB DEFAULT '[]',
    final_timestamp     INTEGER NOT NULL DEFAULT 0,
    
    -- Verification
    verification_status VARCHAR(20) DEFAULT 'PENDING',
    verification_checks JSONB DEFAULT '{}',
    verified_at         TIMESTAMPTZ,
    
    submitted_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proofs_assignment ON proof_submissions(assignment_id);
CREATE INDEX idx_proofs_citizen ON proof_submissions(citizen_id);
CREATE INDEX idx_proofs_status ON proof_submissions(verification_status);

-- CREDIT_TRANSACTIONS: 크레딧 거래 원장
CREATE TABLE credit_transactions (
    transaction_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id          UUID NOT NULL REFERENCES citizens(citizen_id) ON DELETE CASCADE,
    
    -- Transaction Type
    transaction_type    VARCHAR(30) NOT NULL,
    amount              INTEGER NOT NULL,
    
    -- Balance
    balance_before      INTEGER NOT NULL,
    balance_after       INTEGER NOT NULL,
    
    -- Reference
    reference_type      VARCHAR(30),
    reference_id        UUID,
    
    -- Proof
    proof_id            UUID REFERENCES proof_submissions(proof_id),
    proof_summary       JSONB,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_balance CHECK (balance_after >= 0)
);

CREATE INDEX idx_transactions_citizen ON credit_transactions(citizen_id);
CREATE INDEX idx_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_transactions_created ON credit_transactions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- LABOR 보상 트랜잭션 (Atomic)
CREATE OR REPLACE FUNCTION execute_labor_transaction(
    p_citizen_id UUID,
    p_amount INTEGER,
    p_commission_id UUID,
    p_proof_id UUID,
    p_proof_summary JSONB
) RETURNS TABLE (
    transaction_id UUID,
    new_balance INTEGER
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Lock citizen row
    SELECT credits INTO v_current_balance
    FROM citizens
    WHERE citizen_id = p_citizen_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Citizen not found: %', p_citizen_id;
    END IF;
    
    v_new_balance := v_current_balance + p_amount;
    
    -- Update balance
    UPDATE citizens
    SET credits = v_new_balance,
        updated_at = NOW()
    WHERE citizen_id = p_citizen_id;
    
    -- Create transaction record
    INSERT INTO credit_transactions (
        citizen_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        proof_id,
        proof_summary
    ) VALUES (
        p_citizen_id,
        'LABOR_REWARD',
        p_amount,
        v_current_balance,
        v_new_balance,
        'commission',
        p_commission_id,
        p_proof_id,
        p_proof_summary
    ) RETURNING credit_transactions.transaction_id INTO v_transaction_id;
    
    -- Update commission completion count
    UPDATE commissions
    SET completed_count = completed_count + 1,
        status = CASE 
            WHEN completed_count + 1 >= target_count THEN 'COMPLETED'::commission_status
            ELSE status
        END,
        completed_at = CASE 
            WHEN completed_count + 1 >= target_count THEN NOW()
            ELSE completed_at
        END
    WHERE commission_id = p_commission_id;
    
    RETURN QUERY SELECT v_transaction_id, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 시민 존재감 업데이트
CREATE OR REPLACE FUNCTION update_citizen_existence(
    p_citizen_id UUID,
    p_existence_change DECIMAL(4,3),
    p_activity_type activity_type
) RETURNS DECIMAL(3,2) AS $$
DECLARE
    v_current_score DECIMAL(3,2);
    v_new_score DECIMAL(3,2);
BEGIN
    SELECT existence_score INTO v_current_score
    FROM citizens
    WHERE citizen_id = p_citizen_id
    FOR UPDATE;
    
    -- 존재감은 0.00 ~ 1.00 사이
    v_new_score := GREATEST(0.00, LEAST(1.00, v_current_score + p_existence_change));
    
    UPDATE citizens
    SET existence_score = v_new_score,
        current_activity = p_activity_type,
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE citizen_id = p_citizen_id;
    
    RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Trait 기반 키워드 조회
CREATE OR REPLACE FUNCTION get_keywords_for_citizen(p_citizen_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    v_citizen RECORD;
    v_keywords TEXT[] := '{}';
    v_trait_keywords TEXT[];
BEGIN
    SELECT openness, conscientiousness, extraversion, agreeableness, neuroticism, interest_keywords
    INTO v_citizen
    FROM citizens
    WHERE citizen_id = p_citizen_id;
    
    IF NOT FOUND THEN
        RETURN v_keywords;
    END IF;
    
    -- 각 trait별 키워드 수집
    SELECT ARRAY_AGG(DISTINCT k) INTO v_trait_keywords
    FROM (
        SELECT UNNEST(keywords) AS k
        FROM interest_keywords_map
        WHERE (trait_name = 'openness' AND v_citizen.openness BETWEEN trait_range_min AND trait_range_max)
           OR (trait_name = 'conscientiousness' AND v_citizen.conscientiousness BETWEEN trait_range_min AND trait_range_max)
           OR (trait_name = 'extraversion' AND v_citizen.extraversion BETWEEN trait_range_min AND trait_range_max)
           OR (trait_name = 'agreeableness' AND v_citizen.agreeableness BETWEEN trait_range_min AND trait_range_max)
           OR (trait_name = 'neuroticism' AND v_citizen.neuroticism BETWEEN trait_range_min AND trait_range_max)
    ) sub;
    
    -- 시민 개인 키워드와 합치기
    v_keywords := ARRAY_CAT(COALESCE(v_trait_keywords, '{}'), v_citizen.interest_keywords);
    
    RETURN v_keywords;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- citizens updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_citizens_updated_at
    BEFORE UPDATE ON citizens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 만료된 candidate_videos 자동 정리 (매일 실행)
CREATE OR REPLACE FUNCTION cleanup_expired_candidates()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM candidate_videos
    WHERE expires_at < NOW() AND status = 'PENDING';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- 시민 활동 요약 뷰
CREATE OR REPLACE VIEW citizen_activity_summary AS
SELECT 
    c.citizen_id,
    c.name,
    c.device_id,
    c.credits,
    c.existence_score,
    c.current_activity,
    c.last_active_at,
    COUNT(DISTINCT m.memory_id) AS total_memories,
    COUNT(DISTINCT st.id) AS pop_participations,
    COUNT(DISTINCT al.log_id) AS accident_responses,
    COUNT(DISTINCT ca.assignment_id) AS labor_assignments,
    COALESCE(SUM(ct.amount) FILTER (WHERE ct.amount > 0), 0) AS total_credits_earned
FROM citizens c
LEFT JOIN memories m ON c.citizen_id = m.citizen_id
LEFT JOIN society_trends st ON c.citizen_id = st.citizen_id
LEFT JOIN accident_logs al ON c.citizen_id = al.citizen_id
LEFT JOIN commission_assignments ca ON c.citizen_id = ca.citizen_id AND ca.verified = TRUE
LEFT JOIN credit_transactions ct ON c.citizen_id = ct.citizen_id
GROUP BY c.citizen_id;

-- 현재 트렌딩 영상 뷰
CREATE OR REPLACE VIEW current_trending AS
SELECT 
    tv.*,
    yv.title,
    yv.channel_name,
    yv.duration_seconds,
    yv.thumbnail_url
FROM trending_videos tv
JOIN youtube_videos yv ON tv.video_id = yv.video_id
WHERE tv.is_active = TRUE
  AND tv.fetched_at >= NOW() - INTERVAL '24 hours'
ORDER BY tv.trending_rank ASC;

-- 열린 의뢰 뷰
CREATE OR REPLACE VIEW open_commissions AS
SELECT 
    c.*,
    yv.title AS video_title,
    yv.duration_seconds,
    yv.thumbnail_url,
    (c.target_count - c.completed_count) AS remaining_slots
FROM commissions c
JOIN youtube_videos yv ON c.video_id = yv.video_id
WHERE c.status = 'OPEN'
  AND (c.expires_at IS NULL OR c.expires_at > NOW())
ORDER BY c.priority ASC, c.created_at ASC;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on sensitive tables
-- ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE citizens IS 'AI 시민 기본 정보 및 Big Five 성격 특성';
COMMENT ON TABLE youtube_videos IS 'YouTube 영상 메타데이터 캐시 (7일 TTL)';
COMMENT ON TABLE candidate_videos IS 'MINING 후보 영상 임시 저장 (24시간 TTL)';
COMMENT ON TABLE memories IS 'AI 시민의 시청 경험 및 기억';
COMMENT ON TABLE trending_videos IS 'YouTube 트렌딩 영상 스냅샷';
COMMENT ON TABLE society_trends IS 'POP Activity 참여 기록';
COMMENT ON TABLE accidents IS 'Admin이 등록한 위기 영상';
COMMENT ON TABLE accident_logs IS '위기 대응 개별 로그';
COMMENT ON TABLE commissions IS '의뢰된 시청 작업';
COMMENT ON TABLE commission_assignments IS '시민별 의뢰 배정';
COMMENT ON TABLE proof_submissions IS 'Proof of View 증명 데이터';
COMMENT ON TABLE credit_transactions IS '크레딧 거래 원장';

