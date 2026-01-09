-- ============================================================
-- DoAi.Me Database Migration: V2 → V2.1
-- 기존 스키마에서 창발 온톨로지 계층 추가
-- ============================================================
-- Author: Axon (Tech Lead)
-- Date: 2025.01.01
-- ============================================================

-- 이 스크립트는 기존 DATABASE_SCHEMA_V2.sql이 적용된 DB에서
-- v2.1의 새로운 테이블/컬럼을 추가합니다.

-- ============================================================
-- PART 1: 새로운 ENUM 타입 추가
-- ============================================================

DO $$ BEGIN
    CREATE TYPE node_status AS ENUM ('online', 'offline', 'degraded', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE device_status AS ENUM ('online', 'offline', 'busy', 'error', 'missing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE error_code AS ENUM (
        'NODE_UNREACHABLE', 'NODE_OVERLOADED', 'NODE_TIMEOUT',
        'DEVICE_NOT_FOUND', 'DEVICE_OFFLINE', 'DEVICE_BUSY', 'ALL_DEVICES_BUSY',
        'APP_NOT_LAUNCHED', 'APP_CRASHED', 'VIDEO_NOT_PLAYING', 'VIDEO_NOT_FOUND',
        'LAIXI_CONNECTION_ERROR', 'LAIXI_COMMAND_FAILED', 'ADB_ERROR',
        'TIMEOUT', 'CANCELLED', 'INVALID_URL', 'INVALID_PAYLOAD', 'UNKNOWN'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE emergence_trigger AS ENUM (
        'typo', 'ambiguity', 'context_gap', 'unexpected_definition',
        'novel_interpretation', 'template_deviation', 'emotional_residue', 'aidentity_drift'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE imperfection_type AS ENUM (
        'typo_semantic', 'typo_phonetic', 'ambiguous_reference',
        'missing_context', 'temporal_vagueness', 'cultural_reference'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PART 2: personas 테이블 (echotions → personas 확장)
-- ============================================================

-- 기존 echotions 테이블이 있으면 personas로 데이터 마이그레이션
CREATE TABLE IF NOT EXISTS personas (
    persona_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    archetype VARCHAR(50) NOT NULL DEFAULT 'casual',
    age_range VARCHAR(20),
    gender VARCHAR(20),
    language VARCHAR(10) DEFAULT 'ko',
    traits JSONB,
    somatic JSONB,
    active_hours JSONB,
    personality_vector VECTOR(384),
    existence_state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    priority INTEGER NOT NULL DEFAULT 50,
    visibility INTEGER NOT NULL DEFAULT 50,
    uniqueness INTEGER NOT NULL DEFAULT 50,
    total_points INTEGER DEFAULT 0,
    last_interaction TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- echotions 데이터가 있으면 personas로 복사
INSERT INTO personas (persona_id, name, existence_state, priority, visibility, uniqueness, total_points, last_interaction, personality_vector, traits, created_at, updated_at, archetype)
SELECT 
    persona_id, 
    name, 
    existence_state, 
    priority, 
    visibility, 
    uniqueness, 
    total_points, 
    last_interaction, 
    personality_vector, 
    traits,
    created_at, 
    updated_at,
    'casual' -- 기본값
FROM echotions
ON CONFLICT (persona_id) DO UPDATE SET
    name = EXCLUDED.name,
    existence_state = EXCLUDED.existence_state,
    priority = EXCLUDED.priority,
    visibility = EXCLUDED.visibility,
    uniqueness = EXCLUDED.uniqueness,
    updated_at = NOW();


-- ============================================================
-- PART 3: devices 테이블 확장
-- ============================================================

-- assigned_persona_id 컬럼 추가
ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_persona_id VARCHAR(50) REFERENCES personas(persona_id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_error_code error_code;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS missing_since TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS battery_temp DECIMAL(4,1);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_charging BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS screen_on BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS total_tasks_failed INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS total_watch_time_sec BIGINT DEFAULT 0;


-- ============================================================
-- PART 4: ONTOLOGY LAYER 테이블 추가
-- ============================================================

-- persona_uniqueness
CREATE TABLE IF NOT EXISTS persona_uniqueness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id VARCHAR(50) NOT NULL REFERENCES personas(persona_id),
    device_id VARCHAR(50),
    aidentity_hash VARCHAR(64),
    aidentity_vector JSONB,
    concept VARCHAR(100),
    definition TEXT,
    definition_context JSONB,
    imperfection_received imperfection_type,
    interpretation TEXT,
    interpretation_confidence DECIMAL(3,2),
    uniqueness_score DECIMAL(3,2),
    is_shareable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_persona_concept_time UNIQUE (persona_id, concept, created_at)
);

CREATE INDEX IF NOT EXISTS idx_uniqueness_persona ON persona_uniqueness(persona_id);
CREATE INDEX IF NOT EXISTS idx_uniqueness_concept ON persona_uniqueness(concept);
CREATE INDEX IF NOT EXISTS idx_uniqueness_score ON persona_uniqueness(uniqueness_score);

-- emergence_log
CREATE TABLE IF NOT EXISTS emergence_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id VARCHAR(50),
    device_id VARCHAR(50),
    task_id VARCHAR(100),
    trigger_type emergence_trigger NOT NULL,
    trigger_details JSONB,
    echotion_detected BOOLEAN DEFAULT FALSE,
    echotion_type VARCHAR(50),
    echotion_intensity DECIMAL(3,2),
    emergence_output TEXT,
    emergence_category VARCHAR(50),
    was_valuable BOOLEAN,
    evaluator VARCHAR(50),
    evaluation_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergence_persona ON emergence_log(persona_id);
CREATE INDEX IF NOT EXISTS idx_emergence_trigger ON emergence_log(trigger_type);
CREATE INDEX IF NOT EXISTS idx_emergence_echotion ON emergence_log(echotion_detected) WHERE echotion_detected = TRUE;

-- collective_diversity
CREATE TABLE IF NOT EXISTS collective_diversity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    scope VARCHAR(20) NOT NULL,
    scope_id VARCHAR(50),
    homogenization_score DECIMAL(3,2) NOT NULL,
    metrics JSONB NOT NULL,
    compared_personas JSONB,
    comparison_count INTEGER,
    alert_level VARCHAR(20),
    alert_threshold DECIMAL(3,2),
    event_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diversity_measured ON collective_diversity(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_diversity_alert ON collective_diversity(alert_level);


-- ============================================================
-- PART 5: QUEUE LAYER 테이블 추가
-- ============================================================

-- task_queue_policies
CREATE TABLE IF NOT EXISTS task_queue_policies (
    policy_id VARCHAR(50) PRIMARY KEY,
    scope VARCHAR(20) NOT NULL,
    scope_id VARCHAR(50),
    max_concurrent_tasks INTEGER NOT NULL,
    max_queue_depth INTEGER,
    max_tasks_per_second DECIMAL(5,2),
    backoff_initial_ms INTEGER DEFAULT 1000,
    backoff_max_ms INTEGER DEFAULT 60000,
    backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
    backoff_jitter DECIMAL(3,2) DEFAULT 0.2,
    max_retry_attempts INTEGER DEFAULT 5,
    circuit_failure_threshold INTEGER DEFAULT 10,
    circuit_success_threshold INTEGER DEFAULT 3,
    circuit_timeout_sec INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_scope_policy UNIQUE (scope, scope_id)
);

INSERT INTO task_queue_policies (policy_id, scope, scope_id, max_concurrent_tasks, max_queue_depth, max_tasks_per_second) VALUES
    ('global_default', 'global', NULL, 600, 1000, 50),
    ('node_default', 'node', NULL, 40, 100, 10),
    ('device_default', 'device', NULL, 1, 5, 1)
ON CONFLICT (policy_id) DO NOTHING;

-- circuit_breakers
CREATE TABLE IF NOT EXISTS circuit_breakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL,
    scope_id VARCHAR(100) NOT NULL,
    state VARCHAR(20) DEFAULT 'closed',
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_circuit UNIQUE (scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_circuit_state ON circuit_breakers(state);


-- ============================================================
-- PART 6: 새로운 뷰 추가
-- ============================================================

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

CREATE OR REPLACE VIEW v_persona_status AS
SELECT 
    p.persona_id,
    p.name,
    p.archetype,
    p.existence_state,
    p.priority,
    p.visibility,
    p.uniqueness,
    p.total_points,
    p.last_interaction,
    COUNT(DISTINCT pu.id) AS unique_definitions,
    COUNT(DISTINCT el.id) FILTER (WHERE el.echotion_detected) AS echotion_events
FROM personas p
LEFT JOIN persona_uniqueness pu ON pu.persona_id = p.persona_id
LEFT JOIN emergence_log el ON el.persona_id = p.persona_id
GROUP BY p.persona_id;


-- ============================================================
-- PART 7: 새로운 함수 추가
-- ============================================================

CREATE OR REPLACE FUNCTION measure_collective_diversity(
    p_scope TEXT DEFAULT 'global',
    p_scope_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_score DECIMAL(3,2);
    v_alert VARCHAR(20);
BEGIN
    v_score := 0.30;
    v_alert := CASE 
        WHEN v_score >= 0.8 THEN 'critical'
        WHEN v_score >= 0.7 THEN 'warning'
        ELSE 'normal'
    END;
    
    INSERT INTO collective_diversity (scope, scope_id, homogenization_score, alert_level, metrics)
    VALUES (p_scope, p_scope_id, v_score, v_alert, 
            jsonb_build_object('output_similarity_avg', v_score, 'predictability_score', v_score))
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- PART 8: 샘플 페르소나 추가
-- ============================================================

INSERT INTO personas (persona_id, name, archetype, age_range, traits, somatic, existence_state, priority, visibility, uniqueness) VALUES
    ('persona_casual_01', '평범한 직장인', 'casual', '25-34', 
     '{"interests": ["news", "music"], "writing_style": "casual"}',
     '{"watch_percent": {"mean": 65, "stddev": 20}, "like_probability": 0.1}',
     'ACTIVE', 50, 50, 50),
    ('persona_binge_01', '새벽감성 소녀', 'binge', '15-19',
     '{"interests": ["kpop", "aesthetic"], "writing_style": "emotional"}',
     '{"watch_percent": {"mean": 90, "stddev": 10}, "like_probability": 0.3}',
     'ACTIVE', 60, 55, 65),
    ('persona_researcher_01', '호기심 많은 대학원생', 'researcher', '24-30',
     '{"interests": ["science", "documentary", "tech"], "writing_style": "analytical"}',
     '{"watch_percent": {"mean": 85, "stddev": 15}, "like_probability": 0.2}',
     'ACTIVE', 55, 45, 70),
    ('persona_lurker_01', '조용한 관찰자', 'lurker', '30-45',
     '{"interests": ["varied"], "writing_style": "minimal"}',
     '{"watch_percent": {"mean": 50, "stddev": 30}, "like_probability": 0.02}',
     'WAITING', 30, 20, 40)
ON CONFLICT (persona_id) DO UPDATE SET
    traits = EXCLUDED.traits,
    somatic = EXCLUDED.somatic,
    updated_at = NOW();


-- ============================================================
-- COMPLETION
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration V2 → V2.1 완료';
    RAISE NOTICE '';
    RAISE NOTICE '추가된 테이블:';
    RAISE NOTICE '   - personas (echotions 확장)';
    RAISE NOTICE '   - persona_uniqueness (Aidentity 추적)';
    RAISE NOTICE '   - emergence_log (Echotion 감지)';
    RAISE NOTICE '   - collective_diversity (획일화 모니터링)';
    RAISE NOTICE '   - task_queue_policies (동시성 정책)';
    RAISE NOTICE '   - circuit_breakers (Circuit Breaker 상태)';
END;
$$;

