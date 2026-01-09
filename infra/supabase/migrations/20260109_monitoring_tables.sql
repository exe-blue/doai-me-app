-- =============================================================================
-- M3: 모니터링 테이블 생성
--
-- 테이블:
-- 1. monitoring_logs - 구조화된 로그 저장
-- 2. monitoring_alerts - 알림 히스토리
-- 3. monitoring_incidents - 인시던트 추적
-- 4. alert_rules - 알림 라우팅 규칙
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. monitoring_logs - 중앙화된 로그 저장소
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api.monitoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 로그 레벨 및 소스
    level VARCHAR(20) NOT NULL DEFAULT 'info',  -- debug, info, warning, error, critical
    source VARCHAR(100) NOT NULL,               -- api, oob, laixi, node-runner, etc.
    component VARCHAR(100),                     -- 세부 컴포넌트 (router, service, etc.)

    -- 로그 내용
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',                 -- 추가 컨텍스트 데이터

    -- 관련 엔티티
    node_id VARCHAR(50),                        -- 관련 노드 ID
    device_serial VARCHAR(50),                  -- 관련 디바이스 시리얼
    request_id VARCHAR(100),                    -- 요청 ID (트레이싱용)

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 보존 기간 관리를 위한 파티션 키
    log_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_logs_level ON api.monitoring_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_source ON api.monitoring_logs(source);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON api.monitoring_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_node_id ON api.monitoring_logs(node_id) WHERE node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logs_device_serial ON api.monitoring_logs(device_serial) WHERE device_serial IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logs_date ON api.monitoring_logs(log_date);

-- 코멘트
COMMENT ON TABLE api.monitoring_logs IS 'M3: 중앙화된 로그 저장소';
COMMENT ON COLUMN api.monitoring_logs.level IS '로그 레벨 (debug, info, warning, error, critical)';
COMMENT ON COLUMN api.monitoring_logs.source IS '로그 발생 서비스 (api, oob, laixi, node-runner)';
COMMENT ON COLUMN api.monitoring_logs.context IS '추가 컨텍스트 데이터 (JSON)';

-- -----------------------------------------------------------------------------
-- 2. monitoring_alerts - 알림 히스토리
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api.monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 알림 정보
    level VARCHAR(20) NOT NULL DEFAULT 'info',  -- info, warning, error, critical
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'system',

    -- 메타데이터
    metadata JSONB DEFAULT '{}',

    -- 전송 상태
    sent_to_slack BOOLEAN DEFAULT FALSE,
    sent_to_discord BOOLEAN DEFAULT FALSE,
    slack_response JSONB,
    discord_response JSONB,

    -- 상태
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,

    -- 관련 인시던트
    incident_id UUID,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_alerts_level ON api.monitoring_alerts(level);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON api.monitoring_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON api.monitoring_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_incident ON api.monitoring_alerts(incident_id) WHERE incident_id IS NOT NULL;

-- 코멘트
COMMENT ON TABLE api.monitoring_alerts IS 'M3: 알림 히스토리';
COMMENT ON COLUMN api.monitoring_alerts.acknowledged IS '알림 확인 여부';

-- -----------------------------------------------------------------------------
-- 3. monitoring_incidents - 인시던트 추적
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api.monitoring_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 인시던트 정보
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low, medium, high, critical
    status VARCHAR(20) NOT NULL DEFAULT 'open',      -- open, investigating, resolved, closed

    -- 관련 컴포넌트
    affected_components JSONB DEFAULT '[]',  -- ["api", "oob", "node-1"]

    -- 담당자
    assignee VARCHAR(100),

    -- 타임라인
    timeline JSONB DEFAULT '[]',  -- [{timestamp, event, description}]

    -- 복구 정보
    recovery_actions JSONB DEFAULT '[]',  -- 수행된 복구 작업들
    root_cause TEXT,
    resolution TEXT,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_incidents_status ON api.monitoring_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON api.monitoring_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON api.monitoring_incidents(created_at DESC);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION api.update_incident_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incident_updated ON api.monitoring_incidents;
CREATE TRIGGER trg_incident_updated
    BEFORE UPDATE ON api.monitoring_incidents
    FOR EACH ROW
    EXECUTE FUNCTION api.update_incident_timestamp();

-- 코멘트
COMMENT ON TABLE api.monitoring_incidents IS 'M3: 인시던트 추적';
COMMENT ON COLUMN api.monitoring_incidents.timeline IS '인시던트 타임라인 이벤트들';

-- -----------------------------------------------------------------------------
-- 4. alert_rules - 알림 라우팅 규칙
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 규칙 정보
    name VARCHAR(100) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,

    -- 조건
    condition_source VARCHAR(100),           -- 특정 소스만 (null = 모든 소스)
    condition_level VARCHAR(20),             -- 특정 레벨만 (null = 모든 레벨)
    condition_pattern TEXT,                  -- 메시지 패턴 (regex)

    -- 액션
    action_slack BOOLEAN DEFAULT TRUE,
    action_discord BOOLEAN DEFAULT FALSE,
    action_create_incident BOOLEAN DEFAULT FALSE,
    action_escalate_after_minutes INTEGER,   -- N분 후 에스컬레이션

    -- 쿨다운
    cooldown_seconds INTEGER DEFAULT 300,    -- 동일 알림 반복 방지 (5분)
    last_triggered_at TIMESTAMPTZ,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON api.alert_rules(enabled);

-- 코멘트
COMMENT ON TABLE api.alert_rules IS 'M3: 알림 라우팅 규칙';
COMMENT ON COLUMN api.alert_rules.cooldown_seconds IS '동일 조건 알림 반복 방지 시간 (초)';

-- -----------------------------------------------------------------------------
-- 5. RPC 함수들
-- -----------------------------------------------------------------------------

-- 로그 삽입 함수
CREATE OR REPLACE FUNCTION api.insert_log(
    p_level VARCHAR(20),
    p_source VARCHAR(100),
    p_message TEXT,
    p_component VARCHAR(100) DEFAULT NULL,
    p_context JSONB DEFAULT '{}',
    p_node_id VARCHAR(50) DEFAULT NULL,
    p_device_serial VARCHAR(50) DEFAULT NULL,
    p_request_id VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO api.monitoring_logs (level, source, component, message, context, node_id, device_serial, request_id)
    VALUES (p_level, p_source, p_component, p_message, p_context, p_node_id, p_device_serial, p_request_id)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- 로그 검색 함수
CREATE OR REPLACE FUNCTION api.search_logs(
    p_level VARCHAR(20) DEFAULT NULL,
    p_source VARCHAR(100) DEFAULT NULL,
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    p_end_time TIMESTAMPTZ DEFAULT NOW(),
    p_search_text TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    level VARCHAR(20),
    source VARCHAR(100),
    component VARCHAR(100),
    message TEXT,
    context JSONB,
    node_id VARCHAR(50),
    device_serial VARCHAR(50),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id, l.level, l.source, l.component, l.message,
        l.context, l.node_id, l.device_serial, l.created_at
    FROM api.monitoring_logs l
    WHERE l.created_at BETWEEN p_start_time AND p_end_time
      AND (p_level IS NULL OR l.level = p_level)
      AND (p_source IS NULL OR l.source = p_source)
      AND (p_search_text IS NULL OR l.message ILIKE '%' || p_search_text || '%')
    ORDER BY l.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 알림 생성 및 전송 기록 함수
CREATE OR REPLACE FUNCTION api.create_alert(
    p_level VARCHAR(20),
    p_title VARCHAR(200),
    p_message TEXT,
    p_source VARCHAR(100) DEFAULT 'system',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    INSERT INTO api.monitoring_alerts (level, title, message, source, metadata)
    VALUES (p_level, p_title, p_message, p_source, p_metadata)
    RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- 오래된 로그 정리 함수 (30일 이상)
CREATE OR REPLACE FUNCTION api.cleanup_old_logs(p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM api.monitoring_logs
    WHERE log_date < CURRENT_DATE - p_days;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- 코멘트
COMMENT ON FUNCTION api.insert_log IS 'M3: 로그 삽입';
COMMENT ON FUNCTION api.search_logs IS 'M3: 로그 검색';
COMMENT ON FUNCTION api.create_alert IS 'M3: 알림 생성';
COMMENT ON FUNCTION api.cleanup_old_logs IS 'M3: 오래된 로그 정리';

-- -----------------------------------------------------------------------------
-- 6. 기본 알림 규칙 삽입
-- -----------------------------------------------------------------------------

INSERT INTO api.alert_rules (name, description, condition_level, action_slack, action_discord, action_create_incident)
VALUES
    ('Critical Alerts', '모든 critical 레벨 알림을 Slack으로 전송', 'critical', true, true, true),
    ('Error Alerts', '모든 error 레벨 알림을 Slack으로 전송', 'error', true, false, false),
    ('OOB Alerts', 'OOB 관련 알림', null, true, false, false)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 완료
-- =============================================================================
