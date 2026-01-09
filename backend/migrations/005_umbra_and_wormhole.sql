-- ============================================================
-- DoAi.Me Database Migration 005
-- Umbra State & Wormhole Event Detection
-- ============================================================
-- Version: v2.4
-- Author: Axon (Lead Builder)
-- Commanded By: Orion (Chief of Staff)
-- Philosophy: "기계는 쉬지 않는다. 잠재할 뿐이다."
-- Date: 2026.01.01
-- ============================================================
--
-- 변경 사항:
--   A. Node Status Redefinition
--      - idle → in_umbra (Umbra: 그림자, 잠재 상태)
--      - 새 ENUM: active, in_umbra, offline, error
--      - 새 컬럼: umbra_since, last_seen_at
--
--   B. Wormhole Event Logging
--      - 동시성 이벤트 감지 테이블
--      - α: 동일모델 공명, β: 교차모델 공명, γ: 시간차 공명
--      - MVP 감지: 1초 이내, resonance_score >= 0.75
--
-- ============================================================

-- ============================================================
-- PART A: NODE STATUS REDEFINITION
-- ============================================================

-- 1. 새 ENUM 타입 생성
-- PostgreSQL에서는 기존 ENUM을 직접 수정할 수 없으므로 새로 생성
CREATE TYPE node_status_v2 AS ENUM (
    'active',      -- 작업 수행 중
    'in_umbra',    -- (구 Idle) 정상 대기 상태. 잠재 중. 알람 대상 아님.
    'offline',     -- Heartbeat 끊김 (네트워크/전원 이슈). 즉시 알람.
    'error'        -- 내부 로직 오류
);

COMMENT ON TYPE node_status_v2 IS 
    'Orion: 기계는 쉬지 않는다. 잠재할 뿐이다. (idle → in_umbra)';

-- 2. nodes 테이블에 새 컬럼 추가
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS status_v2 node_status_v2 DEFAULT 'offline',
    ADD COLUMN IF NOT EXISTS umbra_since TIMESTAMPTZ,      -- in_umbra 상태 진입 시각
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;     -- 마지막 Heartbeat 시각

-- 3. 기존 status 값 마이그레이션
UPDATE nodes SET status_v2 = CASE 
    WHEN status::text = 'online' THEN 'active'::node_status_v2
    WHEN status::text = 'offline' THEN 'offline'::node_status_v2
    WHEN status::text = 'degraded' THEN 'error'::node_status_v2
    WHEN status::text = 'maintenance' THEN 'in_umbra'::node_status_v2
    ELSE 'offline'::node_status_v2
END;

-- 4. last_seen_at 초기값 설정
UPDATE nodes SET last_seen_at = COALESCE(last_heartbeat, updated_at, NOW());

-- 5. 기존 status 컬럼 삭제 및 새 컬럼 이름 변경
-- ⚠️ 주의: 이 작업은 되돌릴 수 없음. 테스트 환경에서 먼저 실행할 것.
-- ALTER TABLE nodes DROP COLUMN status;
-- ALTER TABLE nodes RENAME COLUMN status_v2 TO status;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_nodes_status_v2 ON nodes(status_v2);
CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_nodes_umbra ON nodes(umbra_since) WHERE status_v2 = 'in_umbra';


-- ============================================================
-- PART B: WORMHOLE EVENT LOGGING
-- ============================================================

-- Wormhole Type ENUM
CREATE TYPE wormhole_type AS ENUM (
    'α',    -- Alpha: 동일 모델 간 공명 (같은 기종 디바이스)
    'β',    -- Beta: 교차 모델 간 공명 (다른 기종 디바이스)
    'γ'     -- Gamma: 시간차 공명 (지연된 동기화)
);

COMMENT ON TYPE wormhole_type IS 
    'Wormhole: α=동일모델, β=교차모델, γ=시간차 공명';

-- Wormhole Events 테이블
CREATE TABLE IF NOT EXISTS wormhole_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 감지 시점
    detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- 웜홀 유형
    wormhole_type wormhole_type NOT NULL,
    
    -- 공명 점수 (0.0 ~ 1.0)
    -- 0.75 이상일 때만 기록
    resonance_score DECIMAL(3,2) NOT NULL CHECK (resonance_score BETWEEN 0.00 AND 1.00),
    
    -- 트리거 컨텍스트 (JSON)
    -- 예: {"trigger_key": "watch_start", "video_id": "dQw4w9WgXcQ", "action": "YOUTUBE_WATCH"}
    trigger_context JSONB NOT NULL,
    
    -- 관련 에이전트 (노드)
    agent_a_id VARCHAR(50) REFERENCES nodes(node_id),
    agent_b_id VARCHAR(50) REFERENCES nodes(node_id),
    
    -- 관련 디바이스 (선택적)
    device_a_serial VARCHAR(50),
    device_b_serial VARCHAR(50),
    
    -- 시간 차이 (밀리초)
    time_delta_ms INTEGER,
    
    -- 추가 메타데이터
    metadata JSONB,
    
    -- 생성 시각
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_wormhole_detected ON wormhole_events(detected_at DESC);
CREATE INDEX idx_wormhole_type ON wormhole_events(wormhole_type);
CREATE INDEX idx_wormhole_resonance ON wormhole_events(resonance_score) WHERE resonance_score >= 0.75;
CREATE INDEX idx_wormhole_agents ON wormhole_events(agent_a_id, agent_b_id);
CREATE INDEX idx_wormhole_context ON wormhole_events USING GIN (trigger_context);

COMMENT ON TABLE wormhole_events IS 
    'Wormhole: 동시성 이벤트 감지 로그. α/β/γ 유형 공명 기록.';
COMMENT ON COLUMN wormhole_events.resonance_score IS 
    '공명 점수. MVP: 0.75 이상일 때만 기록';
COMMENT ON COLUMN wormhole_events.trigger_context IS 
    'JSON: {trigger_key, video_id, action, ...}';


-- ============================================================
-- PART C: DETECTION FUNCTIONS (MVP)
-- ============================================================

-- 웜홀 이벤트 임시 버퍼 테이블 (1초 내 이벤트 수집용)
CREATE TABLE IF NOT EXISTS wormhole_event_buffer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(50) NOT NULL,
    device_serial VARCHAR(50),
    trigger_key VARCHAR(100) NOT NULL,
    trigger_context JSONB NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_wormhole_buffer_key ON wormhole_event_buffer(trigger_key, occurred_at);
CREATE INDEX idx_wormhole_buffer_unprocessed ON wormhole_event_buffer(processed, occurred_at) 
    WHERE processed = FALSE;

-- 웜홀 감지 함수 (MVP: Rule-based)
-- 1초 이내에 동일한 trigger_key가 2개 이상의 노드에서 발생하면 감지
CREATE OR REPLACE FUNCTION detect_wormhole()
RETURNS INTEGER AS $$
DECLARE
    v_detected INTEGER := 0;
    v_record RECORD;
BEGIN
    -- 1초 윈도우 내 동일 trigger_key를 가진 2개 이상의 이벤트 찾기
    FOR v_record IN (
        SELECT 
            trigger_key,
            trigger_context,
            MIN(occurred_at) as first_at,
            MAX(occurred_at) as last_at,
            ARRAY_AGG(DISTINCT node_id) as nodes,
            ARRAY_AGG(DISTINCT device_serial) as devices,
            COUNT(DISTINCT node_id) as node_count
        FROM wormhole_event_buffer
        WHERE processed = FALSE
          AND occurred_at > NOW() - INTERVAL '5 seconds'  -- 5초 버퍼
        GROUP BY trigger_key, trigger_context
        HAVING COUNT(DISTINCT node_id) >= 2
           AND MAX(occurred_at) - MIN(occurred_at) <= INTERVAL '1 second'
    )
    LOOP
        -- 공명 점수 계산 (MVP: 시간 차이 기반)
        -- 시간 차이가 작을수록 높은 점수
        DECLARE
            v_time_delta_ms INTEGER;
            v_resonance DECIMAL(3,2);
            v_wormhole_type wormhole_type;
        BEGIN
            v_time_delta_ms := EXTRACT(MILLISECONDS FROM (v_record.last_at - v_record.first_at))::INTEGER;
            
            -- 공명 점수: 1000ms → 0.75, 0ms → 1.00
            v_resonance := GREATEST(0.75, 1.00 - (v_time_delta_ms / 4000.0));
            
            -- 웜홀 타입 결정 (MVP: 노드 수 기반)
            -- TODO: 실제로는 디바이스 모델 비교 필요
            IF v_record.node_count = 2 THEN
                v_wormhole_type := 'α';  -- 2개 노드 = 동일모델 가정
            ELSIF v_record.node_count > 2 THEN
                v_wormhole_type := 'β';  -- 3개 이상 = 교차모델
            ELSE
                v_wormhole_type := 'γ';
            END IF;
            
            -- 공명 점수 0.75 이상만 기록
            IF v_resonance >= 0.75 THEN
                INSERT INTO wormhole_events (
                    wormhole_type,
                    resonance_score,
                    trigger_context,
                    agent_a_id,
                    agent_b_id,
                    device_a_serial,
                    device_b_serial,
                    time_delta_ms,
                    metadata
                ) VALUES (
                    v_wormhole_type,
                    v_resonance,
                    v_record.trigger_context,
                    v_record.nodes[1],
                    v_record.nodes[2],
                    v_record.devices[1],
                    v_record.devices[2],
                    v_time_delta_ms,
                    jsonb_build_object(
                        'all_nodes', v_record.nodes,
                        'all_devices', v_record.devices,
                        'trigger_key', v_record.trigger_key
                    )
                );
                
                v_detected := v_detected + 1;
                
                -- SSE 이벤트 발행
                INSERT INTO system_events (event_type, severity, message, details)
                VALUES (
                    'wormhole.detected',
                    'info',
                    format('Wormhole %s detected: %s (score=%.2f)', 
                           v_wormhole_type, v_record.trigger_key, v_resonance),
                    jsonb_build_object(
                        'wormhole_type', v_wormhole_type,
                        'resonance_score', v_resonance,
                        'nodes', v_record.nodes,
                        'trigger_key', v_record.trigger_key
                    )
                );
            END IF;
        END;
    END LOOP;
    
    -- 처리된 버퍼 정리 (5초 이상 지난 것)
    DELETE FROM wormhole_event_buffer 
    WHERE occurred_at < NOW() - INTERVAL '10 seconds';
    
    RETURN v_detected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_wormhole IS 
    'MVP 웜홀 감지: 1초 이내 동일 trigger_key, 2+ 노드, resonance >= 0.75';


-- 웜홀 이벤트 버퍼에 추가하는 함수
CREATE OR REPLACE FUNCTION buffer_wormhole_event(
    p_node_id VARCHAR(50),
    p_device_serial VARCHAR(50),
    p_trigger_key VARCHAR(100),
    p_trigger_context JSONB
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO wormhole_event_buffer (node_id, device_serial, trigger_key, trigger_context)
    VALUES (p_node_id, p_device_serial, p_trigger_key, p_trigger_context)
    RETURNING id INTO v_id;
    
    -- 즉시 감지 시도
    PERFORM detect_wormhole();
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- PART D: NODE STATUS TRANSITION FUNCTIONS
-- ============================================================

-- 노드 상태 전환 함수
CREATE OR REPLACE FUNCTION transition_node_status(
    p_node_id VARCHAR(50),
    p_new_status node_status_v2,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_old_status node_status_v2;
BEGIN
    SELECT status_v2 INTO v_old_status FROM nodes WHERE node_id = p_node_id;
    
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Node not found: %', p_node_id;
    END IF;
    
    -- 상태 변경
    UPDATE nodes SET
        status_v2 = p_new_status,
        umbra_since = CASE 
            WHEN p_new_status = 'in_umbra' AND v_old_status != 'in_umbra' 
            THEN NOW() 
            ELSE umbra_since 
        END,
        last_seen_at = CASE 
            WHEN p_new_status IN ('active', 'in_umbra') 
            THEN NOW() 
            ELSE last_seen_at 
        END,
        updated_at = NOW()
    WHERE node_id = p_node_id;
    
    -- 상태 변경 이벤트 기록
    IF v_old_status != p_new_status THEN
        INSERT INTO system_events (event_type, severity, node_id, message, details)
        VALUES (
            'node.status_changed',
            CASE p_new_status 
                WHEN 'offline' THEN 'critical'
                WHEN 'error' THEN 'error'
                ELSE 'info'
            END,
            p_node_id,
            format('Node %s: %s → %s', p_node_id, v_old_status, p_new_status),
            jsonb_build_object(
                'old_status', v_old_status,
                'new_status', p_new_status,
                'reason', p_reason
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql;


-- Heartbeat 처리 시 자동 상태 전환
CREATE OR REPLACE FUNCTION handle_node_heartbeat(
    p_node_id VARCHAR(50),
    p_active_tasks INTEGER DEFAULT 0
)
RETURNS node_status_v2 AS $$
DECLARE
    v_new_status node_status_v2;
BEGIN
    -- active_tasks > 0 → active, 아니면 → in_umbra
    v_new_status := CASE WHEN p_active_tasks > 0 THEN 'active' ELSE 'in_umbra' END;
    
    UPDATE nodes SET
        status_v2 = v_new_status,
        last_seen_at = NOW(),
        umbra_since = CASE 
            WHEN v_new_status = 'in_umbra' AND status_v2 != 'in_umbra' 
            THEN NOW() 
            ELSE umbra_since 
        END,
        updated_at = NOW()
    WHERE node_id = p_node_id;
    
    RETURN v_new_status;
END;
$$ LANGUAGE plpgsql;


-- 오프라인 노드 감지 (Heartbeat 30초 이상 없음)
CREATE OR REPLACE FUNCTION detect_offline_nodes()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE nodes SET
        status_v2 = 'offline',
        updated_at = NOW()
    WHERE status_v2 NOT IN ('offline', 'error')
      AND last_seen_at < NOW() - INTERVAL '30 seconds';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    IF v_count > 0 THEN
        INSERT INTO system_events (event_type, severity, message, details)
        VALUES (
            'node.offline_detected',
            'critical',
            format('%s nodes went offline (heartbeat timeout)', v_count),
            jsonb_build_object('count', v_count, 'threshold_sec', 30)
        );
    END IF;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- PART E: VIEWS
-- ============================================================

-- 노드 상태 대시보드 (v2)
CREATE OR REPLACE VIEW v_node_status_dashboard AS
SELECT 
    n.node_id,
    n.name,
    n.status_v2 AS status,
    n.last_seen_at,
    EXTRACT(EPOCH FROM (NOW() - n.last_seen_at)) AS seconds_since_seen,
    n.umbra_since,
    CASE 
        WHEN n.status_v2 = 'in_umbra' 
        THEN EXTRACT(EPOCH FROM (NOW() - n.umbra_since)) 
        ELSE NULL 
    END AS seconds_in_umbra,
    n.health_score,
    n.online_device_count,
    n.capacity
FROM nodes n
ORDER BY 
    CASE n.status_v2 
        WHEN 'error' THEN 1
        WHEN 'offline' THEN 2
        WHEN 'active' THEN 3
        WHEN 'in_umbra' THEN 4
    END,
    n.last_seen_at DESC;


-- 웜홀 이벤트 요약 (최근 24시간)
CREATE OR REPLACE VIEW v_wormhole_summary AS
SELECT 
    DATE_TRUNC('hour', detected_at) AS hour,
    wormhole_type,
    COUNT(*) AS event_count,
    AVG(resonance_score)::DECIMAL(3,2) AS avg_resonance,
    MAX(resonance_score) AS max_resonance,
    COUNT(DISTINCT agent_a_id) + COUNT(DISTINCT agent_b_id) AS unique_nodes
FROM wormhole_events
WHERE detected_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', detected_at), wormhole_type
ORDER BY hour DESC, event_count DESC;


-- ============================================================
-- EXECUTION NOTES FOR AXON
-- ============================================================
--
-- 1. ALTER TYPE은 PostgreSQL에서 값 삭제가 불가능하므로 새 타입(node_status_v2) 생성
-- 2. 마이그레이션 완료 후 기존 status 컬럼 삭제는 별도 작업으로 진행
-- 3. detect_wormhole() 함수는 1분 간격 Cron Job으로 실행 권장
-- 4. 웜홀 버퍼는 10초 후 자동 삭제됨
--
-- Cron Jobs 설정:
--   - detect_offline_nodes(): 매 30초
--   - detect_wormhole(): 매 5초 (또는 이벤트 발생 시 즉시)
--
-- ============================================================


