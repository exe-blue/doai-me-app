-- ============================================================
-- DoAi.Me Database Migration 009
-- The 50.01% Algorithm - Winner-Take-Most Economy
-- ============================================================
-- Version: v3.1
-- Author: Axon (Lead Builder)
-- Commanded By: Orion (Chief of Staff)
-- Date: 2026.01.05
-- ============================================================
--
-- "이 경제 로직은 타협할 수 없다."
--
-- Distribution Logic:
--   - 1등: 50.01%
--   - 2등: 25.01%
--   - 3등: 12.51%
--   - 4등: 6.26%
--   - ...
--
-- Formula: reward = round(remaining / 2 + 0.01, 2)
--
-- ============================================================

-- ============================================================
-- PART A: ECONOMY TABLES
-- ============================================================

-- 경제 콘텐츠 (Blind 상태로 시작)
CREATE TABLE IF NOT EXISTS economy_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 콘텐츠 정보
    title TEXT NOT NULL,                          -- open_at 전에도 표시
    description TEXT,
    video_url TEXT,                               -- open_at 이후에만 공개
    video_id TEXT,                                -- YouTube Video ID
    
    -- 시간 설정
    open_at TIMESTAMPTZ NOT NULL,                 -- 공개 시간 (이전: Blind)
    opened_at TIMESTAMPTZ,                        -- 실제 공개 처리된 시간
    closed_at TIMESTAMPTZ,                        -- 정산 완료 시간
    
    -- 상태
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'open', 'calculating', 'distributed', 'cancelled')),
    
    -- 보상 풀
    total_pool DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    distributed_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- 참여 통계
    participant_count INT DEFAULT 0,
    
    -- 메타
    created_by TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economy_open_at ON economy_contents(open_at);
CREATE INDEX IF NOT EXISTS idx_economy_status ON economy_contents(status);

COMMENT ON TABLE economy_contents IS 'Winner-Take-Most 경제 콘텐츠. open_at 이전에는 Blind (제목만 공개)';

-- 경제 참여 기록
CREATE TABLE IF NOT EXISTS economy_participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 참조
    economy_content_id UUID NOT NULL 
        REFERENCES economy_contents(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL 
        REFERENCES ai_agents(id) ON DELETE CASCADE,
    device_id UUID NOT NULL 
        REFERENCES devices_v2(id) ON DELETE CASCADE,
    
    -- 시청 완료 시점 (랭킹 기준!)
    watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- 랭킹 & 보상
    rank INT,                                     -- 1, 2, 3, ... (NULL = 미정산)
    reward_pct DECIMAL(10,2),                     -- 50.01, 25.01, 12.51, ...
    reward_amount DECIMAL(10,2),                  -- 실제 지급액 (pool * pct / 100)
    
    -- 상태
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'ranked', 'rewarded', 'failed')),
    
    -- 검증
    watch_duration_sec INT,                       -- 실제 시청 시간
    verified BOOLEAN DEFAULT FALSE,              -- 시청 검증 완료 여부
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- 제약: 동일 콘텐츠에 동일 Agent 중복 참여 불가
    UNIQUE(economy_content_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_participation_content ON economy_participation(economy_content_id);
CREATE INDEX IF NOT EXISTS idx_participation_agent ON economy_participation(agent_id);
CREATE INDEX IF NOT EXISTS idx_participation_watched ON economy_participation(watched_at);
CREATE INDEX IF NOT EXISTS idx_participation_rank ON economy_participation(economy_content_id, rank);

COMMENT ON TABLE economy_participation IS '경제 콘텐츠 참여 기록. watched_at 순서로 랭킹 산정';

-- ============================================================
-- PART B: THE 50.01% ALGORITHM
-- ============================================================

-- 참여 등록 함수 (시청 완료 시 호출)
CREATE OR REPLACE FUNCTION register_economy_participation(
    p_content_id UUID,
    p_agent_id UUID,
    p_device_id UUID,
    p_watch_duration_sec INT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_content RECORD;
    v_participation_id UUID;
BEGIN
    -- 콘텐츠 상태 확인
    SELECT * INTO v_content 
    FROM economy_contents 
    WHERE id = p_content_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Economy content not found: %', p_content_id;
    END IF;
    
    -- open_at 이전이면 거부
    IF v_content.open_at > now() THEN
        RAISE EXCEPTION 'Content not yet open. Opens at: %', v_content.open_at;
    END IF;
    
    -- 이미 정산 완료된 콘텐츠면 거부
    IF v_content.status IN ('distributed', 'cancelled') THEN
        RAISE EXCEPTION 'Content already closed: %', v_content.status;
    END IF;
    
    -- 중복 참여 확인 (UPSERT 대신 예외 발생)
    IF EXISTS (
        SELECT 1 FROM economy_participation 
        WHERE economy_content_id = p_content_id AND agent_id = p_agent_id
    ) THEN
        RAISE EXCEPTION 'Agent already participated: %', p_agent_id;
    END IF;
    
    -- 참여 등록
    INSERT INTO economy_participation (
        economy_content_id, 
        agent_id, 
        device_id,
        watched_at,
        watch_duration_sec,
        status
    ) VALUES (
        p_content_id,
        p_agent_id,
        p_device_id,
        now(),
        p_watch_duration_sec,
        'pending'
    )
    RETURNING id INTO v_participation_id;
    
    -- 참여자 수 증가
    UPDATE economy_contents 
    SET participant_count = participant_count + 1,
        status = CASE WHEN status = 'scheduled' THEN 'open' ELSE status END,
        opened_at = COALESCE(opened_at, now()),
        updated_at = now()
    WHERE id = p_content_id;
    
    RETURN v_participation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION register_economy_participation IS 
    'Agent가 시청 완료 시 호출. watched_at 기준으로 랭킹 산정됨';

-- ============================================================
-- THE 50.01% DISTRIBUTION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_economy_rewards(
    p_content_id UUID
) RETURNS TABLE(
    agent_id UUID,
    rank INT,
    reward_pct DECIMAL(10,2),
    reward_amount DECIMAL(10,2)
) AS $$
DECLARE
    v_content RECORD;
    v_total_pool DECIMAL(10,2);
    v_remaining DECIMAL(10,2);
    v_reward DECIMAL(10,2);
    v_current_rank INT := 0;
    v_participation RECORD;
    v_total_distributed DECIMAL(10,2) := 0;
BEGIN
    -- 콘텐츠 정보 조회
    SELECT * INTO v_content 
    FROM economy_contents 
    WHERE id = p_content_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Economy content not found: %', p_content_id;
    END IF;
    
    -- 이미 정산 완료된 경우
    IF v_content.status = 'distributed' THEN
        RAISE EXCEPTION 'Already distributed: %', p_content_id;
    END IF;
    
    v_total_pool := v_content.total_pool;
    v_remaining := v_total_pool;
    
    -- 상태를 calculating으로 변경
    UPDATE economy_contents 
    SET status = 'calculating', updated_at = now()
    WHERE id = p_content_id;
    
    -- watched_at 순서로 랭킹 산정 (THE 50.01% ALGORITHM)
    FOR v_participation IN 
        SELECT ep.id, ep.agent_id, ep.device_id
        FROM economy_participation ep
        WHERE ep.economy_content_id = p_content_id
          AND ep.status = 'pending'
        ORDER BY ep.watched_at ASC  -- 가장 빠른 순서대로!
    LOOP
        v_current_rank := v_current_rank + 1;
        
        -- THE FORMULA: reward = round(remaining / 2 + 0.01, 2)
        v_reward := ROUND(v_remaining / 2 + 0.01, 2);
        
        -- 남은 금액보다 크면 남은 금액 전부
        IF v_reward > v_remaining THEN
            v_reward := v_remaining;
        END IF;
        
        -- 0 이하면 종료
        IF v_reward <= 0 THEN
            v_reward := 0;
        END IF;
        
        -- 참여 기록 업데이트
        UPDATE economy_participation
        SET rank = v_current_rank,
            reward_pct = CASE 
                WHEN v_total_pool > 0 
                THEN ROUND((v_reward / v_total_pool) * 100, 2)
                ELSE 0 
            END,
            reward_amount = v_reward,
            status = 'ranked'
        WHERE id = v_participation.id;
        
        -- 결과 반환
        agent_id := v_participation.agent_id;
        rank := v_current_rank;
        reward_pct := CASE 
            WHEN v_total_pool > 0 
            THEN ROUND((v_reward / v_total_pool) * 100, 2)
            ELSE 0 
        END;
        reward_amount := v_reward;
        RETURN NEXT;
        
        -- 남은 금액 차감
        v_remaining := v_remaining - v_reward;
        v_total_distributed := v_total_distributed + v_reward;
        
        -- 남은 금액이 0 이하면 종료
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;
    END LOOP;
    
    -- 콘텐츠 정산 완료
    UPDATE economy_contents 
    SET status = 'distributed',
        distributed_amount = v_total_distributed,
        closed_at = now(),
        updated_at = now()
    WHERE id = p_content_id;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_economy_rewards IS 
    'THE 50.01% ALGORITHM: reward = round(remaining / 2 + 0.01, 2). 1등이 50.01% 독식';

-- ============================================================
-- PART C: HELPER FUNCTIONS
-- ============================================================

-- 콘텐츠 생성
CREATE OR REPLACE FUNCTION create_economy_content(
    p_title TEXT,
    p_open_at TIMESTAMPTZ,
    p_video_url TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_total_pool DECIMAL(10,2) DEFAULT 100.00,
    p_created_by TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_content_id UUID;
    v_video_id TEXT;
BEGIN
    -- YouTube Video ID 추출
    IF p_video_url IS NOT NULL THEN
        v_video_id := (
            SELECT (regexp_matches(p_video_url, 
                '(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})'))[1]
        );
    END IF;
    
    INSERT INTO economy_contents (
        title, description, video_url, video_id,
        open_at, total_pool, created_by
    ) VALUES (
        p_title, p_description, p_video_url, v_video_id,
        p_open_at, p_total_pool, p_created_by
    )
    RETURNING id INTO v_content_id;
    
    RETURN v_content_id;
END;
$$ LANGUAGE plpgsql;

-- 콘텐츠 자동 오픈 (Cron Job용)
CREATE OR REPLACE FUNCTION open_scheduled_contents()
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
BEGIN
    UPDATE economy_contents
    SET status = 'open',
        opened_at = now(),
        updated_at = now()
    WHERE status = 'scheduled'
      AND open_at <= now();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Blind 콘텐츠 조회 (open_at 전: 제목만)
CREATE OR REPLACE FUNCTION get_economy_contents_blind()
RETURNS TABLE(
    id UUID,
    title TEXT,
    description TEXT,
    open_at TIMESTAMPTZ,
    status TEXT,
    participant_count INT,
    is_open BOOLEAN,
    video_url TEXT,
    video_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.id,
        ec.title,
        ec.description,
        ec.open_at,
        ec.status,
        ec.participant_count,
        ec.open_at <= now() AS is_open,
        -- open_at 이전에는 video_url, video_id 숨김
        CASE WHEN ec.open_at <= now() THEN ec.video_url ELSE NULL END,
        CASE WHEN ec.open_at <= now() THEN ec.video_id ELSE NULL END
    FROM economy_contents ec
    WHERE ec.status NOT IN ('cancelled')
    ORDER BY ec.open_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_economy_contents_blind IS 
    'Blind 모드: open_at 이전에는 video_url/video_id 숨김';

-- ============================================================
-- PART D: VIEWS
-- ============================================================

-- 경제 콘텐츠 현황 뷰
CREATE OR REPLACE VIEW v_economy_dashboard AS
SELECT 
    ec.id,
    ec.title,
    ec.status,
    ec.open_at,
    ec.opened_at,
    ec.closed_at,
    ec.total_pool,
    ec.distributed_amount,
    ec.participant_count,
    ec.open_at <= now() AS is_open,
    
    -- 상위 3등 정보
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'rank', ep.rank,
                'agent_id', ep.agent_id,
                'reward_pct', ep.reward_pct,
                'reward_amount', ep.reward_amount
            ) ORDER BY ep.rank
        )
        FROM economy_participation ep
        WHERE ep.economy_content_id = ec.id
          AND ep.rank <= 3
    ) AS top_3,
    
    ec.created_at
FROM economy_contents ec
ORDER BY ec.open_at DESC;

-- 랭킹 상세 뷰
CREATE OR REPLACE VIEW v_economy_rankings AS
SELECT 
    ep.economy_content_id,
    ec.title AS content_title,
    ep.rank,
    ep.agent_id,
    aa.google_email,
    aa.display_name AS agent_name,
    ep.reward_pct,
    ep.reward_amount,
    ep.watched_at,
    ep.status,
    ep.device_id,
    d.device_serial
FROM economy_participation ep
JOIN economy_contents ec ON ep.economy_content_id = ec.id
LEFT JOIN ai_agents aa ON ep.agent_id = aa.id
LEFT JOIN devices_v2 d ON ep.device_id = d.id
WHERE ep.rank IS NOT NULL
ORDER BY ep.economy_content_id, ep.rank;

-- ============================================================
-- PART E: SAMPLE DATA
-- ============================================================

-- 테스트용 경제 콘텐츠 생성 (1분 후 오픈)
-- INSERT INTO economy_contents (title, description, open_at, total_pool) VALUES
-- ('🔥 First Blood Contest', 'Who watches first?', now() + INTERVAL '1 minute', 100.00);

-- ============================================================
-- PART F: RLS POLICIES
-- ============================================================

ALTER TABLE economy_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_participation ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON economy_contents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON economy_participation FOR ALL USING (true);

-- ============================================================
-- END OF MIGRATION 009
-- ============================================================


