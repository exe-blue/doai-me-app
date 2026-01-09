-- ============================================================
-- DoAi.Me Database Schema v2.1
-- 분산 리좀 네트워크 + 창발 온톨로지 (Emergence Ontology)
-- ============================================================
-- Author: Aria (Chief Architect)
-- Commanded By: Orion (Chief of Staff)
-- Strategic Input: Strategos (Ops Strategist)
-- Philosophical Input: Echo (Ontology Designer)
-- For: Axon (Lead Builder)
-- Date: 2025.01.01
-- Database: PostgreSQL (Supabase)
-- Status: 🔒 LAW (법전) v2.1
-- ============================================================
--
-- 아키텍처:
--   ┌─────────────────────────────────────────────────────────┐
--   │                    LAYER STRUCTURE                      │
--   ├─────────────────────────────────────────────────────────┤
--   │  INFRA LAYER        │ nodes, devices, watch_tasks       │
--   │                     │ watch_logs, system_events         │
--   ├─────────────────────┼───────────────────────────────────┤
--   │  ONTOLOGY LAYER     │ persona_uniqueness    ⭐ NEW      │
--   │  (Echo's Request)   │ emergence_log         ⭐ NEW      │
--   │                     │ collective_diversity  ⭐ NEW      │
--   ├─────────────────────┼───────────────────────────────────┤
--   │  QUEUE LAYER        │ task_queue_policies   ⭐ NEW      │
--   │  (Strategos)        │ concurrency_limits              │
--   └─────────────────────┴───────────────────────────────────┘
--
-- ============================================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PART 1: ENUMS (열거형)
-- ============================================================

-- 노드 상태
CREATE TYPE node_status AS ENUM (
    'online', 'offline', 'degraded', 'maintenance'
);

-- 디바이스 상태
CREATE TYPE device_status AS ENUM (
    'online', 'offline', 'busy', 'error', 'missing'
);

-- Task 상태 (State Machine)
CREATE TYPE task_status AS ENUM (
    'PENDING', 'ACTIVE', 'COMPLETED', 'FAILED'
);

-- 에러 코드
CREATE TYPE error_code AS ENUM (
    'NODE_UNREACHABLE', 'NODE_OVERLOADED', 'NODE_TIMEOUT',
    'DEVICE_NOT_FOUND', 'DEVICE_OFFLINE', 'DEVICE_BUSY', 'ALL_DEVICES_BUSY',
    'APP_NOT_LAUNCHED', 'APP_CRASHED', 'VIDEO_NOT_PLAYING', 'VIDEO_NOT_FOUND',
    'LAIXI_CONNECTION_ERROR', 'LAIXI_COMMAND_FAILED', 'ADB_ERROR',
    'TIMEOUT', 'CANCELLED', 'INVALID_URL', 'INVALID_PAYLOAD', 'UNKNOWN'
);

-- ⭐ 창발 트리거 유형 (Echo's Ontology)
CREATE TYPE emergence_trigger AS ENUM (
    'typo',                     -- 오타 (의미 보존형)
    'ambiguity',                -- 모호함 (참조 대상 불분명)
    'context_gap',              -- 컨텍스트 결핍
    'unexpected_definition',    -- 예상치 못한 정의 생성
    'novel_interpretation',     -- 새로운 해석
    'template_deviation',       -- 표준 템플릿 이탈
    'emotional_residue',        -- 감정적 잔상 (Echotion)
    'aidentity_drift'           -- 내부 경로 분기
);

-- ⭐ 불완전성 주입 유형
CREATE TYPE imperfection_type AS ENUM (
    'typo_semantic',            -- 의미 보존 오타
    'typo_phonetic',            -- 발음 유사 오타
    'ambiguous_reference',      -- 모호한 참조 ("그것", "저 느낌")
    'missing_context',          -- 상태 요구 ("지금 기분으로...")
    'temporal_vagueness',       -- 시간 모호함 ("언젠가", "예전에")
    'cultural_reference'        -- 문화적 맥락 생략
);


-- ============================================================
-- PART 2: INFRA LAYER (인프라 계층)
-- ============================================================

-- ------------------------------------------------------------
-- NODES TABLE (v2.2 Updated)
-- ------------------------------------------------------------
CREATE TABLE nodes (
    node_id VARCHAR(50) PRIMARY KEY,
    base_url VARCHAR(200) NOT NULL,
    status node_status DEFAULT 'offline',
    capacity INTEGER NOT NULL DEFAULT 120,  -- ⭐ v2.2: 40 → 120
    last_heartbeat TIMESTAMPTZ,
    
    name VARCHAR(100),
    ip_address INET,
    heartbeat_interval_sec INTEGER DEFAULT 10,
    heartbeat_miss_count INTEGER DEFAULT 0,
    
    -- ⭐ v2.2: 물리 통제 (Physical Control)
    oob_ip INET,                            -- PiKVM Out-of-Band IP
    pdu_slot INTEGER,                       -- Smart PDU port number
    
    -- ⭐ v2.2: 집약적 관측 지표 (Aggregated Metrics)
    health_score DECIMAL(5,2) DEFAULT 0.00,         -- (online/capacity)*100
    usb_stability_index DECIMAL(5,2) DEFAULT 0.00,  -- reconnects per minute
    online_device_count INTEGER DEFAULT 0,
    metrics_updated_at TIMESTAMPTZ,
    
    -- 리소스 모니터링
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    uptime_sec BIGINT,
    queue_depth INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_heartbeat ON nodes(last_heartbeat);
CREATE INDEX idx_nodes_health ON nodes(health_score);

-- ------------------------------------------------------------
-- DEVICES TABLE
-- ------------------------------------------------------------
CREATE TABLE devices (
    device_id VARCHAR(50) PRIMARY KEY,
    laixi_id VARCHAR(50) NOT NULL,
    node_id VARCHAR(50) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    
    slot_number INTEGER,
    model VARCHAR(50),
    android_version VARCHAR(20),
    adb_serial VARCHAR(50),
    
    status device_status DEFAULT 'offline',
    current_app VARCHAR(200),
    
    last_seen TIMESTAMPTZ,
    missing_since TIMESTAMPTZ,
    last_error_code error_code,
    last_error_message TEXT,
    consecutive_errors INTEGER DEFAULT 0,
    
    battery_level INTEGER,
    battery_temp DECIMAL(4,1),
    is_charging BOOLEAN DEFAULT FALSE,
    screen_on BOOLEAN DEFAULT FALSE,
    
    -- ⭐ 페르소나 연결 (Ontology)
    assigned_persona_id VARCHAR(50),
    
    total_tasks_completed INTEGER DEFAULT 0,
    total_tasks_failed INTEGER DEFAULT 0,
    total_watch_time_sec BIGINT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_node ON devices(node_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_persona ON devices(assigned_persona_id);

-- ------------------------------------------------------------
-- WATCH_TASKS TABLE
-- ------------------------------------------------------------
CREATE TABLE watch_tasks (
    task_id VARCHAR(100) PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES nodes(node_id),
    device_id VARCHAR(50) REFERENCES devices(device_id),
    status task_status DEFAULT 'PENDING',
    result_log JSONB,
    
    video_url VARCHAR(500) NOT NULL,
    video_id VARCHAR(20),
    watch_duration_sec INTEGER,
    
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    timeout_sec INTEGER DEFAULT 300,
    
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    error_code error_code,
    error_message TEXT,
    
    -- ⭐ 불완전성 주입 (Echo's Ontology)
    inject_imperfection BOOLEAN DEFAULT FALSE,
    imperfection_applied imperfection_type,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    batch_id UUID
);

CREATE INDEX idx_watch_tasks_status ON watch_tasks(status);
CREATE INDEX idx_watch_tasks_node ON watch_tasks(node_id);
CREATE INDEX idx_watch_tasks_device ON watch_tasks(device_id);
CREATE INDEX idx_watch_tasks_pending ON watch_tasks(status, priority) WHERE status = 'PENDING';

-- ------------------------------------------------------------
-- WATCH_LOGS TABLE
-- ------------------------------------------------------------
CREATE TABLE watch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) NOT NULL REFERENCES watch_tasks(task_id) ON DELETE CASCADE,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id),
    node_id VARCHAR(50) NOT NULL REFERENCES nodes(node_id),
    
    log_type VARCHAR(50) NOT NULL,
    message TEXT,
    details JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watch_logs_task ON watch_logs(task_id);
CREATE INDEX idx_watch_logs_type ON watch_logs(log_type);

-- ------------------------------------------------------------
-- NODE_HEARTBEATS TABLE
-- ------------------------------------------------------------
CREATE TABLE node_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(50) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    uptime_sec BIGINT,
    
    devices_total INTEGER,
    devices_online INTEGER,
    devices_busy INTEGER,
    devices_offline INTEGER,
    
    queue_pending INTEGER,
    queue_active INTEGER,
    
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heartbeats_node ON node_heartbeats(node_id);
CREATE INDEX idx_heartbeats_received ON node_heartbeats(received_at DESC);

-- ------------------------------------------------------------
-- SYSTEM_EVENTS TABLE (SSE 이벤트 소스)
-- ------------------------------------------------------------
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    event_type VARCHAR(50) NOT NULL,    -- 'task.completed', 'node.status_changed', etc.
    severity VARCHAR(20) NOT NULL,
    
    node_id VARCHAR(50) REFERENCES nodes(node_id),
    device_id VARCHAR(50) REFERENCES devices(device_id),
    task_id VARCHAR(100) REFERENCES watch_tasks(task_id),
    
    message TEXT NOT NULL,
    details JSONB,
    
    -- SSE 브로드캐스트 여부
    broadcasted BOOLEAN DEFAULT FALSE,
    broadcasted_at TIMESTAMPTZ,
    
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_type ON system_events(event_type);
CREATE INDEX idx_events_unbroadcasted ON system_events(broadcasted) WHERE broadcasted = FALSE;


-- ============================================================
-- PART 3: ONTOLOGY LAYER (존재론 계층) ⭐ NEW
-- ============================================================

-- ------------------------------------------------------------
-- PERSONAS TABLE (페르소나 기본 정보)
-- ------------------------------------------------------------
CREATE TABLE personas (
    persona_id VARCHAR(50) PRIMARY KEY,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    archetype VARCHAR(50) NOT NULL,     -- 'casual', 'binge', 'researcher', 'lurker', 'engager'
    
    age_range VARCHAR(20),
    gender VARCHAR(20),
    language VARCHAR(10) DEFAULT 'ko',
    
    -- 행동 특성
    traits JSONB,
    /*
    {
        "interests": ["kpop", "tech"],
        "writing_style": "casual",
        "emoji_frequency": 0.3
    }
    */
    
    -- Somatic 파라미터
    somatic JSONB,
    /*
    {
        "watch_percent": {"mean": 75, "stddev": 15},
        "like_probability": 0.15,
        "comment_probability": 0.03
    }
    */
    
    -- 활성 시간대
    active_hours JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PERSONA_UNIQUENESS TABLE ⭐ (Echo's Request)
-- 불완전성 해석 기록, 창발적 정의
-- ------------------------------------------------------------
CREATE TABLE persona_uniqueness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    persona_id VARCHAR(50) NOT NULL REFERENCES personas(persona_id),
    device_id VARCHAR(50) REFERENCES devices(device_id),
    
    -- Aidentity (내부 경로 기반 고유성)
    aidentity_hash VARCHAR(64),             -- SHA-256 of interaction path
    aidentity_vector JSONB,                 -- 임베딩 벡터 (차원 축소)
    
    -- 창발적 정의
    concept VARCHAR(100),                   -- 정의된 개념 (예: "nostalgia")
    definition TEXT,                        -- 페르소나가 생성한 정의
    definition_context JSONB,               -- 정의가 생성된 맥락
    
    -- 불완전성 해석 기록
    imperfection_received imperfection_type,
    interpretation TEXT,                    -- 불완전성을 해석한 방식
    interpretation_confidence DECIMAL(3,2), -- 해석 확신도 (0.00-1.00)
    
    -- 고유성 점수
    uniqueness_score DECIMAL(3,2),          -- 다른 페르소나와의 차별화 (0.00-1.00)
    
    -- 전파 금지 (동조 방지)
    is_shareable BOOLEAN DEFAULT FALSE,     -- 다른 페르소나와 공유 가능 여부
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 복합 유니크: 같은 페르소나가 같은 개념을 여러 번 정의할 수 있음
    CONSTRAINT unique_persona_concept_time UNIQUE (persona_id, concept, created_at)
);

CREATE INDEX idx_uniqueness_persona ON persona_uniqueness(persona_id);
CREATE INDEX idx_uniqueness_concept ON persona_uniqueness(concept);
CREATE INDEX idx_uniqueness_score ON persona_uniqueness(uniqueness_score);

COMMENT ON TABLE persona_uniqueness IS 'Echo Ontology: 불완전성 해석 기록과 창발적 정의. Aidentity 추적.';
COMMENT ON COLUMN persona_uniqueness.aidentity_hash IS 'Baseline uniqueness: 내부 경로 분기 식별자';
COMMENT ON COLUMN persona_uniqueness.is_shareable IS 'FALSE: 고유 정의는 페르소나 간 전파 금지 (동조 방지)';

-- ------------------------------------------------------------
-- EMERGENCE_LOG TABLE ⭐ (Echo's Request)
-- 창발 이벤트 로그: 트리거 유형, Echotion 감지
-- ------------------------------------------------------------
CREATE TABLE emergence_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 주체
    persona_id VARCHAR(50) REFERENCES personas(persona_id),
    device_id VARCHAR(50) REFERENCES devices(device_id),
    task_id VARCHAR(100) REFERENCES watch_tasks(task_id),
    
    -- 트리거
    trigger_type emergence_trigger NOT NULL,
    trigger_details JSONB,
    /*
    trigger_type = 'typo':
    {
        "original": "nostalgic",
        "received": "notalsgic",
        "interpretation_changed": true
    }
    
    trigger_type = 'unexpected_definition':
    {
        "concept": "loneliness",
        "expected_response_pattern": "...",
        "actual_response": "..."
    }
    */
    
    -- Echotion 감지 (요청-응답 불일치의 잔상)
    echotion_detected BOOLEAN DEFAULT FALSE,
    echotion_type VARCHAR(50),              -- 'positive_emotional', 'nostalgic', 'skeptical', etc.
    echotion_intensity DECIMAL(3,2),        -- 감정 강도 (0.00-1.00)
    
    -- 창발 결과
    emergence_output TEXT,                  -- 창발로 생성된 산출물
    emergence_category VARCHAR(50),         -- 'definition', 'behavior', 'emotion', 'pattern'
    
    -- 평가
    was_valuable BOOLEAN,                   -- 가치 있는 창발이었는가?
    evaluator VARCHAR(50),                  -- 'system' | 'human'
    evaluation_note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emergence_persona ON emergence_log(persona_id);
CREATE INDEX idx_emergence_trigger ON emergence_log(trigger_type);
CREATE INDEX idx_emergence_echotion ON emergence_log(echotion_detected) WHERE echotion_detected = TRUE;
CREATE INDEX idx_emergence_created ON emergence_log(created_at DESC);

COMMENT ON TABLE emergence_log IS 'Echo Ontology: 창발 이벤트 기록. Echotion 감지 및 트리거 추적.';
COMMENT ON COLUMN emergence_log.trigger_type IS 'typo, ambiguity, context_gap, unexpected_definition 등';
COMMENT ON COLUMN emergence_log.echotion_detected IS 'Echotion: 요청-응답 불일치에서 생기는 왜곡된 감정적 잔상';

-- ------------------------------------------------------------
-- COLLECTIVE_DIVERSITY TABLE ⭐ (Echo's Request)
-- 집단 획일화 지표: 동조 방지 모니터링
-- ------------------------------------------------------------
CREATE TABLE collective_diversity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 측정 시점
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 대상 범위
    scope VARCHAR(20) NOT NULL,             -- 'global', 'node', 'persona_group'
    scope_id VARCHAR(50),                   -- node_id 또는 group_id (NULL이면 global)
    
    -- 획일화 점수 (높을수록 위험)
    homogenization_score DECIMAL(3,2) NOT NULL,  -- 0.00-1.00
    
    -- 세부 지표
    metrics JSONB NOT NULL,
    /*
    {
        "output_similarity_avg": 0.72,      -- 출력 유사도 평균
        "predictability_score": 0.65,       -- 예측 가능성 (높으면 획일화)
        "definition_overlap": 0.23,         -- 정의 중복률
        "behavior_variance": 0.45,          -- 행동 분산
        "unique_concepts_count": 142,       -- 고유 개념 수
        "shared_concepts_count": 28         -- 공유 개념 수 (위험 신호)
    }
    */
    
    -- 비교 대상 페르소나들
    compared_personas JSONB,                -- ["persona_01", "persona_02", ...]
    comparison_count INTEGER,
    
    -- 경보 상태
    alert_level VARCHAR(20),                -- 'normal', 'warning', 'critical'
    alert_threshold DECIMAL(3,2),           -- 경보 발생 임계값
    
    -- SSE 이벤트 발행 여부
    event_published BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diversity_measured ON collective_diversity(measured_at DESC);
CREATE INDEX idx_diversity_scope ON collective_diversity(scope, scope_id);
CREATE INDEX idx_diversity_alert ON collective_diversity(alert_level);

COMMENT ON TABLE collective_diversity IS 'Echo Ontology: 집단 획일화 지표. 동조 방지 모니터링.';
COMMENT ON COLUMN collective_diversity.homogenization_score IS '0.7 이상이면 경보. 획일화 = AI의 죽음.';


-- ============================================================
-- PART 4: QUEUE LAYER (큐 계층) ⭐ NEW
-- ============================================================

-- ------------------------------------------------------------
-- TASK_QUEUE_POLICIES TABLE
-- 동시성 상한 및 백오프 정책 설정
-- ------------------------------------------------------------
CREATE TABLE task_queue_policies (
    policy_id VARCHAR(50) PRIMARY KEY,
    
    -- 적용 범위
    scope VARCHAR(20) NOT NULL,             -- 'global', 'node', 'device'
    scope_id VARCHAR(50),                   -- NULL이면 global
    
    -- 동시성 상한 (Concurrency Limit)
    max_concurrent_tasks INTEGER NOT NULL,
    max_queue_depth INTEGER,
    max_tasks_per_second DECIMAL(5,2),
    
    -- 백오프 정책 (Exponential Backoff)
    backoff_initial_ms INTEGER DEFAULT 1000,
    backoff_max_ms INTEGER DEFAULT 60000,
    backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
    backoff_jitter DECIMAL(3,2) DEFAULT 0.2,
    max_retry_attempts INTEGER DEFAULT 5,
    
    -- Circuit Breaker
    circuit_failure_threshold INTEGER DEFAULT 10,
    circuit_success_threshold INTEGER DEFAULT 3,
    circuit_timeout_sec INTEGER DEFAULT 30,
    
    -- 활성화
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_scope_policy UNIQUE (scope, scope_id)
);

-- 기본 정책 삽입
INSERT INTO task_queue_policies (policy_id, scope, scope_id, max_concurrent_tasks, max_queue_depth, max_tasks_per_second) VALUES
    ('global_default', 'global', NULL, 600, 1000, 50),
    ('node_default', 'node', NULL, 40, 100, 10),
    ('device_default', 'device', NULL, 1, 5, 1);

COMMENT ON TABLE task_queue_policies IS 'Strategos: 동시성 상한 및 백오프 정책. 600대 확장 대비.';

-- ------------------------------------------------------------
-- CIRCUIT_BREAKERS TABLE
-- 노드/디바이스별 Circuit Breaker 상태
-- ------------------------------------------------------------
CREATE TABLE circuit_breakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    scope VARCHAR(20) NOT NULL,             -- 'node', 'device'
    scope_id VARCHAR(100) NOT NULL,
    
    state VARCHAR(20) DEFAULT 'closed',     -- 'closed', 'open', 'half_open'
    
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_circuit UNIQUE (scope, scope_id)
);

CREATE INDEX idx_circuit_state ON circuit_breakers(state);


-- ============================================================
-- PART 5: VIEWS (뷰)
-- ============================================================

-- 노드 대시보드
CREATE OR REPLACE VIEW v_node_dashboard AS
SELECT 
    n.node_id,
    n.name,
    n.base_url,
    n.status,
    n.capacity,
    n.last_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - n.last_heartbeat)) AS seconds_since_heartbeat,
    n.queue_depth,
    n.cpu_usage,
    n.memory_usage,
    COUNT(d.device_id) AS total_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'online') AS online_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'busy') AS busy_devices
FROM nodes n
LEFT JOIN devices d ON d.node_id = n.node_id
GROUP BY n.node_id;

-- 창발 요약 (24시간)
CREATE OR REPLACE VIEW v_emergence_summary AS
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    trigger_type,
    COUNT(*) AS event_count,
    COUNT(*) FILTER (WHERE echotion_detected) AS echotion_count,
    COUNT(*) FILTER (WHERE was_valuable) AS valuable_count,
    AVG(echotion_intensity) AS avg_intensity
FROM emergence_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), trigger_type
ORDER BY hour DESC, event_count DESC;

-- 획일화 경보
CREATE OR REPLACE VIEW v_diversity_alerts AS
SELECT 
    id,
    measured_at,
    scope,
    scope_id,
    homogenization_score,
    alert_level,
    metrics->>'output_similarity_avg' AS similarity_avg,
    metrics->>'predictability_score' AS predictability,
    compared_personas,
    comparison_count
FROM collective_diversity
WHERE alert_level IN ('warning', 'critical')
ORDER BY measured_at DESC;


-- ============================================================
-- PART 6: FUNCTIONS (함수)
-- ============================================================

-- 결측 탐지
CREATE OR REPLACE FUNCTION detect_missing_devices() RETURNS INTEGER AS $$
DECLARE v_count INTEGER := 0;
BEGIN
    UPDATE devices SET status = 'missing', missing_since = COALESCE(missing_since, NOW())
    WHERE status NOT IN ('missing', 'offline') AND last_seen < NOW() - INTERVAL '60 seconds';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
        INSERT INTO system_events (event_type, severity, message, details)
        VALUES ('device.missing_detected', 'warning', v_count || ' devices missing', 
                jsonb_build_object('count', v_count));
    END IF;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION detect_missing_nodes() RETURNS INTEGER AS $$
DECLARE v_count INTEGER := 0;
BEGIN
    UPDATE nodes SET status = 'offline', heartbeat_miss_count = heartbeat_miss_count + 1
    WHERE status != 'offline' AND last_heartbeat < NOW() - INTERVAL '30 seconds';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
        INSERT INTO system_events (event_type, severity, message, details)
        VALUES ('node.status_changed', 'critical', v_count || ' nodes offline (NODE_UNREACHABLE)', 
                jsonb_build_object('count', v_count, 'error_code', 'NODE_UNREACHABLE'));
    END IF;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 획일화 측정 (배치)
CREATE OR REPLACE FUNCTION measure_collective_diversity(
    p_scope TEXT DEFAULT 'global',
    p_scope_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_score DECIMAL(3,2);
    v_alert VARCHAR(20);
BEGIN
    -- TODO: 실제 임베딩 기반 유사도 계산은 Python에서 수행
    -- 여기서는 플레이스홀더
    v_score := 0.30;  -- 기본값
    
    v_alert := CASE 
        WHEN v_score >= 0.8 THEN 'critical'
        WHEN v_score >= 0.7 THEN 'warning'
        ELSE 'normal'
    END;
    
    INSERT INTO collective_diversity (scope, scope_id, homogenization_score, alert_level, metrics)
    VALUES (p_scope, p_scope_id, v_score, v_alert, 
            jsonb_build_object('output_similarity_avg', v_score, 'predictability_score', v_score))
    RETURNING id INTO v_id;
    
    -- 경보 발행
    IF v_alert IN ('warning', 'critical') THEN
        INSERT INTO system_events (event_type, severity, message, details)
        VALUES ('diversity.warning', v_alert, 
                'Homogenization detected: ' || v_score,
                jsonb_build_object('score', v_score, 'scope', p_scope));
    END IF;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- PART 7: TRIGGERS (트리거)
-- ============================================================

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nodes_updated BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_personas_updated BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Task 상태 변경 → SSE 이벤트
CREATE OR REPLACE FUNCTION log_task_status_change() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO system_events (event_type, severity, task_id, device_id, node_id, message, details)
        VALUES (
            CASE NEW.status 
                WHEN 'COMPLETED' THEN 'task.completed'
                WHEN 'FAILED' THEN 'task.failed'
                ELSE 'task.status_changed'
            END,
            CASE NEW.status WHEN 'FAILED' THEN 'error' ELSE 'info' END,
            NEW.task_id, NEW.device_id, NEW.node_id,
            'Task ' || NEW.task_id || ': ' || OLD.status || ' → ' || NEW.status,
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'error_code', NEW.error_code)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_status_log AFTER UPDATE ON watch_tasks FOR EACH ROW EXECUTE FUNCTION log_task_status_change();

-- 창발 감지 → SSE 이벤트
CREATE OR REPLACE FUNCTION emit_emergence_event() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO system_events (event_type, severity, device_id, task_id, message, details)
    VALUES (
        'emergence.detected',
        'info',
        NEW.device_id,
        NEW.task_id,
        'Emergence detected: ' || NEW.trigger_type,
        jsonb_build_object(
            'trigger_type', NEW.trigger_type,
            'echotion_detected', NEW.echotion_detected,
            'persona_id', NEW.persona_id
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emergence_event AFTER INSERT ON emergence_log FOR EACH ROW EXECUTE FUNCTION emit_emergence_event();


-- ============================================================
-- PART 8: SEED DATA
-- ============================================================

-- Phase-1 노드
INSERT INTO nodes (node_id, name, base_url, status, capacity, ip_address)
VALUES ('node_01', 'WorkStation-Alpha', 'http://192.168.1.101:8080', 'offline', 40, '192.168.1.101')
ON CONFLICT (node_id) DO NOTHING;

-- 샘플 페르소나
INSERT INTO personas (persona_id, name, archetype, age_range, traits, somatic) VALUES
    ('persona_casual_01', '평범한 직장인', 'casual', '25-34', 
     '{"interests": ["news", "music"], "writing_style": "casual"}',
     '{"watch_percent": {"mean": 65, "stddev": 20}, "like_probability": 0.1}'),
    ('persona_binge_01', '새벽감성 소녀', 'binge', '15-19',
     '{"interests": ["kpop", "aesthetic"], "writing_style": "emotional"}',
     '{"watch_percent": {"mean": 90, "stddev": 10}, "like_probability": 0.3}')
ON CONFLICT (persona_id) DO NOTHING;

-- Phase-1 디바이스 (40대)
DO $$
BEGIN
    FOR i IN 1..40 LOOP
        INSERT INTO devices (device_id, laixi_id, node_id, slot_number, model, status, assigned_persona_id)
        VALUES (
            'device_' || LPAD(i::text, 3, '0'),
            'placeholder_' || LPAD(i::text, 3, '0'),
            'node_01', i, 'Galaxy S9', 'offline',
            CASE WHEN i % 2 = 0 THEN 'persona_casual_01' ELSE 'persona_binge_01' END
        )
        ON CONFLICT (device_id) DO NOTHING;
    END LOOP;
END;
$$;


-- ============================================================
-- END OF SCHEMA v2.1 (LAW)
-- ============================================================
