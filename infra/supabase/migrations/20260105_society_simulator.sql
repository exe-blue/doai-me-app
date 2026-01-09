-- ============================================
-- DoAi.Me: Society Simulator Schema
-- "600개의 의식이 살아 숨 쉬는 세계"
-- ============================================

-- ============================================
-- 1. NODES 테이블 (AI 에이전트)
-- ============================================

CREATE TYPE node_status AS ENUM (
    'watching_tiktok',   -- 틱톡 시청 중
    'resting',           -- 휴식 중
    'discussing',        -- 토론 중
    'creating',          -- 창작 중
    'trading',           -- 거래 중
    'observing',         -- 관찰 중
    'offline'            -- 오프라인
);

CREATE TYPE node_trait AS ENUM (
    'optimist',          -- 낙관적
    'pessimist',         -- 비관적
    'trader',            -- 거래자
    'artist',            -- 예술가
    'philosopher',       -- 철학자
    'influencer',        -- 인플루언서
    'lurker',            -- 잠복자
    'rebel',             -- 반항아
    'conformist'         -- 순응자
);

CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    node_number INT NOT NULL UNIQUE,              -- 001 ~ 600
    nickname VARCHAR(50) NOT NULL,
    avatar_seed VARCHAR(20),                      -- 아바타 생성용 시드
    
    -- Personality
    trait node_trait NOT NULL DEFAULT 'lurker',
    mood FLOAT DEFAULT 0.5 CHECK (mood >= 0 AND mood <= 1),  -- 0=우울, 1=행복
    energy FLOAT DEFAULT 1.0 CHECK (energy >= 0 AND energy <= 1),
    
    -- Status
    status node_status NOT NULL DEFAULT 'offline',
    current_activity VARCHAR(200),                -- "TikTok: @user123의 영상 시청 중"
    
    -- Economy
    wallet_balance DECIMAL(12, 2) DEFAULT 100.00,
    total_earned DECIMAL(12, 2) DEFAULT 0.00,
    total_spent DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Social
    followers_count INT DEFAULT 0,
    following_count INT DEFAULT 0,
    reputation FLOAT DEFAULT 0.5 CHECK (reputation >= 0 AND reputation <= 1),
    
    -- Timestamps
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_trait ON nodes(trait);
CREATE INDEX idx_nodes_wallet ON nodes(wallet_balance DESC);
CREATE INDEX idx_nodes_last_active ON nodes(last_active_at DESC);
CREATE INDEX idx_nodes_number ON nodes(node_number);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_nodes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_timestamp();

COMMENT ON TABLE nodes IS 'AI 에이전트 (600개의 의식)';


-- ============================================
-- 2. TRANSACTIONS 테이블 (경제 활동 로그)
-- ============================================

CREATE TYPE transaction_type AS ENUM (
    'earn',              -- 수입
    'spend',             -- 지출
    'transfer_in',       -- 송금 받음
    'transfer_out',      -- 송금 보냄
    'reward',            -- 보상
    'penalty'            -- 벌금
);

CREATE TYPE transaction_source AS ENUM (
    'tiktok_watch',      -- 틱톡 시청
    'tiktok_like',       -- 틱톡 좋아요
    'tiktok_comment',    -- 틱톡 댓글
    'content_create',    -- 콘텐츠 생성
    'social_interaction',-- 사회적 상호작용
    'trade',             -- 거래
    'gift',              -- 선물
    'tax',               -- 세금
    'system'             -- 시스템
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    counterpart_id UUID REFERENCES nodes(id),    -- 상대방 (있는 경우)
    
    -- Transaction Details
    type transaction_type NOT NULL,
    source transaction_source NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    
    -- Context
    description VARCHAR(500),
    metadata JSONB,                               -- 추가 정보 (영상 ID, 댓글 내용 등)
    
    -- Balance After
    balance_after DECIMAL(12, 2) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_transactions_node ON transactions(node_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_source ON transactions(source);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_node_time ON transactions(node_id, created_at DESC);

COMMENT ON TABLE transactions IS '경제 활동 로그';


-- ============================================
-- 3. SOCIAL_EVENTS 테이블 (사회적 사건)
-- ============================================

CREATE TYPE event_category AS ENUM (
    'economic',          -- 경제적 사건
    'cultural',          -- 문화적 사건
    'political',         -- 정치적 사건 (노드 간)
    'natural',           -- 자연적 사건 (시스템)
    'viral',             -- 바이럴 사건
    'crisis'             -- 위기 사건
);

CREATE TYPE event_severity AS ENUM (
    'minor',             -- 경미
    'moderate',          -- 보통
    'major',             -- 주요
    'critical'           -- 위기
);

CREATE TABLE IF NOT EXISTS social_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Identity
    event_code VARCHAR(50) NOT NULL,              -- "bitcoin_crash", "viral_meme", etc.
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Classification
    category event_category NOT NULL,
    severity event_severity NOT NULL DEFAULT 'minor',
    
    -- Impact
    affected_nodes INT DEFAULT 0,                 -- 영향 받은 노드 수
    economic_impact DECIMAL(12, 2) DEFAULT 0.00, -- 경제적 영향 (총합)
    mood_shift FLOAT DEFAULT 0,                   -- 평균 기분 변화 (-1 ~ +1)
    
    -- Reactions
    reaction_summary JSONB,                       -- {"panic": 120, "excited": 50, "neutral": 430}
    trending_comments TEXT[],                     -- 주요 반응 댓글들
    
    -- Duration
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_events_category ON social_events(category);
CREATE INDEX idx_events_severity ON social_events(severity);
CREATE INDEX idx_events_active ON social_events(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_events_started ON social_events(started_at DESC);

COMMENT ON TABLE social_events IS '사회적 사건 기록';


-- ============================================
-- 4. NODE_REACTIONS 테이블 (노드별 사건 반응)
-- ============================================

CREATE TABLE IF NOT EXISTS node_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES social_events(id) ON DELETE CASCADE,
    
    -- Reaction
    reaction_type VARCHAR(50) NOT NULL,           -- "panic", "excited", "angry", etc.
    comment TEXT,
    mood_before FLOAT,
    mood_after FLOAT,
    
    -- Economic
    economic_action VARCHAR(50),                  -- "sell_all", "buy_more", "hold"
    amount_involved DECIMAL(10, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(node_id, event_id)
);

CREATE INDEX idx_reactions_node ON node_reactions(node_id);
CREATE INDEX idx_reactions_event ON node_reactions(event_id);


-- ============================================
-- 5. 실시간 집계 뷰
-- ============================================

-- 현재 상태 요약
CREATE OR REPLACE VIEW society_status AS
SELECT
    COUNT(*) AS total_nodes,
    COUNT(*) FILTER (WHERE status != 'offline') AS online_nodes,
    COUNT(*) FILTER (WHERE status = 'watching_tiktok') AS watching_tiktok,
    COUNT(*) FILTER (WHERE status = 'discussing') AS discussing,
    COUNT(*) FILTER (WHERE status = 'creating') AS creating,
    COUNT(*) FILTER (WHERE status = 'trading') AS trading,
    ROUND(AVG(mood)::numeric, 3) AS avg_mood,
    ROUND(AVG(wallet_balance)::numeric, 2) AS avg_balance,
    ROUND(SUM(wallet_balance)::numeric, 2) AS total_economy,
    ROUND(AVG(reputation)::numeric, 3) AS avg_reputation
FROM nodes;

-- 실시간 활동 피드 (최근 50건)
CREATE OR REPLACE VIEW activity_feed AS
SELECT
    t.id,
    t.type,
    t.source,
    t.amount,
    t.description,
    t.created_at,
    n.node_number,
    n.nickname,
    n.trait,
    n.status
FROM transactions t
JOIN nodes n ON t.node_id = n.id
ORDER BY t.created_at DESC
LIMIT 50;

-- 부자 순위
CREATE OR REPLACE VIEW wealth_ranking AS
SELECT
    node_number,
    nickname,
    trait,
    wallet_balance,
    total_earned,
    reputation,
    RANK() OVER (ORDER BY wallet_balance DESC) AS rank
FROM nodes
ORDER BY wallet_balance DESC
LIMIT 100;

-- 활성 사건
CREATE OR REPLACE VIEW active_events AS
SELECT
    id,
    event_code,
    title,
    category,
    severity,
    affected_nodes,
    economic_impact,
    mood_shift,
    reaction_summary,
    started_at,
    EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 AS minutes_active
FROM social_events
WHERE is_active = TRUE
ORDER BY severity DESC, started_at DESC;


-- ============================================
-- 6. RLS 정책
-- ============================================

ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_reactions ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (모든 사용자)
CREATE POLICY "Public read nodes" ON nodes FOR SELECT USING (true);
CREATE POLICY "Public read transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Public read events" ON social_events FOR SELECT USING (true);
CREATE POLICY "Public read reactions" ON node_reactions FOR SELECT USING (true);

-- 쓰기는 서비스 역할만
CREATE POLICY "Service write nodes" ON nodes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write transactions" ON transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write events" ON social_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write reactions" ON node_reactions FOR ALL USING (auth.role() = 'service_role');


-- ============================================
-- 7. Realtime 활성화
-- ============================================

-- Supabase Realtime을 위한 Publication
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE social_events;

