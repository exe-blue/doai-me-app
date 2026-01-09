-- ============================================================
-- DoAi.Me Database Migration 003
-- Task State Machine Extension & Node Agent Support
-- ============================================================
-- Version: v2.3
-- Author: Aria (Chief Architect)
-- Commanded By: Orion (Chief of Staff)
-- Date: 2025.01.01
-- Prerequisite: Migration 002 (topology_observability)
-- ============================================================
--
-- 변경 사항:
--   1. task_status ENUM 확장 (ASSIGNED, RUNNING, RETRY 추가)
--   2. watch_tasks 테이블 확장 (retry 정책, node agent 지원)
--   3. task_state_transitions 테이블 (상태 변경 이력)
--   4. node_auth_tokens 테이블 (X-Node-Token 관리)
--   5. dead_letter_queue 테이블 (실패 작업 격리)
--
-- State Machine (Orion 설계):
--   [*] → PENDING → ASSIGNED → RUNNING → COMPLETED → [*]
--                              ↓
--                           FAILED → RETRY → PENDING
--                              ↓        (max 3회)
--                           [Dead Letter Queue]
--
-- ============================================================

-- ============================================================
-- PART 1: ENUM 확장
-- ============================================================

-- PostgreSQL에서 ENUM에 값 추가
-- Note: ALTER TYPE ... ADD VALUE는 트랜잭션 내에서 실행 불가
-- Supabase에서는 각각 별도 실행 필요

-- 기존: 'PENDING', 'ACTIVE', 'COMPLETED', 'FAILED'
-- 추가: 'ASSIGNED', 'RUNNING', 'RETRY'
-- 'ACTIVE'는 deprecated → 'RUNNING'으로 매핑

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'ASSIGNED' AFTER 'PENDING';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'RUNNING' AFTER 'ASSIGNED';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'RETRY' AFTER 'FAILED';

-- 추가 에러 코드
ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'DEVICE_LOST';
ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'TASK_TIMEOUT';
ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'RETRY_EXHAUSTED';
ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'NODE_CIRCUIT_OPEN';

-- ============================================================
-- PART 2: NODE AUTH TOKENS (X-Node-Token 관리)
-- ============================================================

CREATE TABLE IF NOT EXISTS node_auth_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(50) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,  -- SHA-512 hash
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    
    -- 보안 메타데이터
    issued_by VARCHAR(100),
    revoke_reason TEXT,
    
    CONSTRAINT unique_active_token_per_node 
        UNIQUE (node_id) 
        -- 노드당 활성 토큰 1개만 허용 (revoked_at IS NULL인 경우)
);

CREATE INDEX idx_node_tokens_lookup ON node_auth_tokens(token_hash) 
    WHERE revoked_at IS NULL;

COMMENT ON TABLE node_auth_tokens IS 
    'Node Agent 인증 토큰 관리. Central → Node 통신 시 X-Node-Token 헤더로 검증';

-- ============================================================
-- PART 3: WATCH_TASKS 테이블 확장
-- ============================================================

-- Retry 정책 컬럼 추가
ALTER TABLE watch_tasks 
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS running_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
    ADD COLUMN IF NOT EXISTS retry_backoff_sec INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error_code error_code,
    ADD COLUMN IF NOT EXISTS last_error_message TEXT,
    ADD COLUMN IF NOT EXISTS queue_position INTEGER;

-- Node Agent 관련 컬럼
ALTER TABLE watch_tasks
    ADD COLUMN IF NOT EXISTS target_node_id VARCHAR(50) REFERENCES nodes(node_id),
    ADD COLUMN IF NOT EXISTS assigned_node_id VARCHAR(50) REFERENCES nodes(node_id);

-- 진행률 및 결과
ALTER TABLE watch_tasks
    ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS actual_watch_sec INTEGER,
    ADD COLUMN IF NOT EXISTS video_title VARCHAR(500),
    ADD COLUMN IF NOT EXISTS channel_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payload JSONB;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON watch_tasks(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_node ON watch_tasks(assigned_node_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_retry ON watch_tasks(status, retry_count) WHERE status = 'RETRY';

-- ============================================================
-- PART 4: TASK STATE TRANSITIONS (상태 변경 이력)
-- ============================================================

CREATE TABLE IF NOT EXISTS task_state_transitions (
    transition_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) NOT NULL,  -- watch_tasks.task_id 참조
    
    from_status task_status,
    to_status task_status NOT NULL,
    
    transitioned_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_by VARCHAR(50),  -- 'central', 'node_agent', 'system', 'manual'
    node_id VARCHAR(50),
    
    -- 전환 사유
    reason TEXT,
    error_code error_code,
    metadata JSONB,
    
    CONSTRAINT valid_transition CHECK (from_status IS NULL OR from_status != to_status)
);

CREATE INDEX idx_transitions_task ON task_state_transitions(task_id, transitioned_at);
CREATE INDEX idx_transitions_time ON task_state_transitions(transitioned_at);

COMMENT ON TABLE task_state_transitions IS 
    'Task 상태 변경 이력. 디버깅 및 감사 로그 용도';

-- ============================================================
-- PART 5: DEAD LETTER QUEUE (실패 작업 격리)
-- ============================================================

CREATE TABLE IF NOT EXISTS dead_letter_queue (
    dlq_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    original_task_id VARCHAR(100) NOT NULL,
    device_id VARCHAR(50),
    node_id VARCHAR(50),
    
    -- 원본 작업 정보 스냅샷
    action_type VARCHAR(50),
    payload JSONB,
    
    -- 실패 정보
    failed_at TIMESTAMPTZ DEFAULT NOW(),
    final_error_code error_code,
    final_error_message TEXT,
    retry_count INTEGER,
    
    -- 상태 이력
    transition_history JSONB,  -- [{from, to, at, reason}, ...]
    
    -- 처리 상태
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(100),
    resolution TEXT,  -- 'requeued', 'discarded', 'manual_resolved'
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dlq_device ON dead_letter_queue(device_id);
CREATE INDEX idx_dlq_node ON dead_letter_queue(node_id);
CREATE INDEX idx_dlq_pending ON dead_letter_queue(reviewed_at) WHERE reviewed_at IS NULL;

COMMENT ON TABLE dead_letter_queue IS 
    '재시도 횟수 초과로 최종 실패한 작업. 관리자 검토 대기';

-- ============================================================
-- PART 6: FUNCTIONS (상태 전이 함수)
-- ============================================================

-- 상태 전이 기록 함수
CREATE OR REPLACE FUNCTION record_task_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO task_state_transitions (
            task_id, from_status, to_status, 
            triggered_by, node_id, reason
        ) VALUES (
            NEW.task_id, 
            OLD.status, 
            NEW.status,
            COALESCE(current_setting('app.triggered_by', true), 'system'),
            COALESCE(current_setting('app.node_id', true), NEW.assigned_node_id),
            current_setting('app.transition_reason', true)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 연결
DROP TRIGGER IF EXISTS trg_task_state_transition ON watch_tasks;
CREATE TRIGGER trg_task_state_transition
    AFTER UPDATE OF status ON watch_tasks
    FOR EACH ROW
    EXECUTE FUNCTION record_task_transition();

-- ============================================================
-- PART 7: RETRY 처리 함수
-- ============================================================

-- Task 실패 시 Retry 또는 DLQ 이동 판단
CREATE OR REPLACE FUNCTION handle_task_failure(
    p_task_id VARCHAR(100),
    p_error_code error_code,
    p_error_message TEXT
)
RETURNS TABLE(action VARCHAR, new_status task_status) AS $$
DECLARE
    v_task RECORD;
    v_new_status task_status;
    v_action VARCHAR;
BEGIN
    SELECT * INTO v_task FROM watch_tasks WHERE task_id = p_task_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found: %', p_task_id;
    END IF;
    
    IF v_task.retry_count < v_task.max_retries THEN
        -- Retry 가능
        v_new_status := 'RETRY';
        v_action := 'retry';
        
        UPDATE watch_tasks SET
            status = 'RETRY',
            retry_count = retry_count + 1,
            last_retry_at = NOW(),
            last_error_code = p_error_code,
            last_error_message = p_error_message,
            updated_at = NOW()
        WHERE task_id = p_task_id;
        
    ELSE
        -- Retry 초과 → Dead Letter Queue
        v_new_status := 'FAILED';
        v_action := 'dead_letter';
        
        -- DLQ에 삽입
        INSERT INTO dead_letter_queue (
            original_task_id, device_id, node_id,
            action_type, payload,
            final_error_code, final_error_message, retry_count,
            transition_history
        )
        SELECT 
            task_id, device_id, assigned_node_id,
            action_type, payload,
            p_error_code, p_error_message, retry_count + 1,
            (SELECT jsonb_agg(row_to_json(t)) 
             FROM task_state_transitions t 
             WHERE t.task_id = p_task_id)
        FROM watch_tasks
        WHERE task_id = p_task_id;
        
        -- 원본 Task 상태 갱신
        UPDATE watch_tasks SET
            status = 'FAILED',
            last_error_code = 'RETRY_EXHAUSTED',
            last_error_message = format('Max retries (%s) exceeded. Final error: %s', 
                                        v_task.max_retries, p_error_message),
            updated_at = NOW()
        WHERE task_id = p_task_id;
    END IF;
    
    RETURN QUERY SELECT v_action, v_new_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 8: RETRY 재진입 처리
-- ============================================================

-- Backoff 시간 경과한 RETRY 작업을 PENDING으로 전환
CREATE OR REPLACE FUNCTION process_retry_queue()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH ready_retries AS (
        SELECT task_id
        FROM watch_tasks
        WHERE status = 'RETRY'
          AND last_retry_at + (retry_backoff_sec * POWER(2, retry_count - 1) * INTERVAL '1 second') <= NOW()
        LIMIT 100  -- 배치 처리
        FOR UPDATE SKIP LOCKED
    )
    UPDATE watch_tasks t
    SET status = 'PENDING',
        updated_at = NOW()
    FROM ready_retries r
    WHERE t.task_id = r.task_id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_retry_queue IS 
    'Exponential Backoff 시간이 경과한 RETRY 작업을 PENDING으로 재진입. Cron Job (1분 간격)';

-- ============================================================
-- PART 9: CIRCUIT BREAKER 상태 갱신
-- ============================================================

-- circuit_breakers 테이블에 half_open_at, reason 컬럼 추가 (없을 경우)
ALTER TABLE circuit_breakers
    ADD COLUMN IF NOT EXISTS half_open_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reason TEXT;

-- Node가 OFFLINE이 되면 해당 노드로 가는 PENDING/ASSIGNED 작업 처리
CREATE OR REPLACE FUNCTION handle_node_offline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'offline' AND OLD.status != 'offline' THEN
        -- 해당 노드의 모든 ASSIGNED/RUNNING 작업을 FAILED 처리
        UPDATE watch_tasks SET
            status = 'FAILED',
            last_error_code = 'NODE_UNREACHABLE',
            last_error_message = format('Node %s went offline', NEW.node_id),
            updated_at = NOW()
        WHERE assigned_node_id = NEW.node_id
          AND status IN ('ASSIGNED', 'RUNNING');
        
        -- Circuit Breaker에 기록
        INSERT INTO circuit_breakers (scope, scope_id, opened_at, reason)
        VALUES ('node', NEW.node_id, NOW(), 'Node went offline')
        ON CONFLICT (scope, scope_id) 
        DO UPDATE SET 
            state = 'open',
            opened_at = NOW(),
            failure_count = circuit_breakers.failure_count + 1,
            reason = 'Node went offline',
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_node_offline_handler ON nodes;
CREATE TRIGGER trg_node_offline_handler
    AFTER UPDATE OF status ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION handle_node_offline();

-- ============================================================
-- PART 10: VIEWS (대시보드용)
-- ============================================================

-- Task 상태 분포 뷰
CREATE OR REPLACE VIEW v_task_status_summary AS
SELECT 
    status,
    COUNT(*) as count,
    AVG(CASE WHEN status = 'RETRY' THEN retry_count END)::DECIMAL(3,1) as avg_retry_count,
    COUNT(*) FILTER (WHERE priority >= 8) as high_priority_count
FROM watch_tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Node별 작업 현황 뷰
CREATE OR REPLACE VIEW v_node_task_load AS
SELECT 
    n.node_id,
    n.name,
    n.status as node_status,
    n.health_score,
    COUNT(t.task_id) FILTER (WHERE t.status = 'RUNNING') as running_tasks,
    COUNT(t.task_id) FILTER (WHERE t.status = 'ASSIGNED') as queued_tasks,
    COUNT(t.task_id) FILTER (WHERE t.status = 'FAILED' AND t.updated_at > NOW() - INTERVAL '1 hour') as recent_failures,
    COALESCE(cb.failure_count, 0) as circuit_failure_count,
    cb.opened_at IS NOT NULL AND cb.half_open_at IS NULL as circuit_open
FROM nodes n
LEFT JOIN watch_tasks t ON t.assigned_node_id = n.node_id 
    AND t.status IN ('RUNNING', 'ASSIGNED', 'FAILED')
LEFT JOIN circuit_breakers cb ON cb.scope = 'node' AND cb.scope_id = n.node_id
GROUP BY n.node_id, n.name, n.status, n.health_score, cb.failure_count, cb.opened_at, cb.half_open_at;

-- Dead Letter Queue 대기 현황
CREATE OR REPLACE VIEW v_dlq_pending AS
SELECT 
    dlq_id,
    original_task_id,
    device_id,
    node_id,
    action_type,
    final_error_code,
    retry_count,
    failed_at,
    NOW() - failed_at as waiting_duration
FROM dead_letter_queue
WHERE reviewed_at IS NULL
ORDER BY failed_at ASC;

-- ============================================================
-- PART 11: MIGRATION DATA (기존 데이터 정합성)
-- ============================================================

-- 기존 'ACTIVE' 상태를 'RUNNING'으로 매핑
-- (Supabase에서는 실행 전 확인 필요)
-- UPDATE watch_tasks SET status = 'RUNNING' WHERE status = 'ACTIVE';

-- 기존 작업에 기본값 설정
UPDATE watch_tasks SET
    max_retries = 3,
    retry_backoff_sec = 5,
    priority = 5
WHERE max_retries IS NULL;

-- ============================================================
-- PART 12: 완료 메시지
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 003: Task State Machine Extension 완료';
    RAISE NOTICE '   - task_status ENUM: ASSIGNED, RUNNING, RETRY 추가';
    RAISE NOTICE '   - error_code ENUM: DEVICE_LOST, TASK_TIMEOUT, RETRY_EXHAUSTED, NODE_CIRCUIT_OPEN 추가';
    RAISE NOTICE '   - node_auth_tokens 테이블 생성 (X-Node-Token 관리)';
    RAISE NOTICE '   - watch_tasks 확장 (retry 정책, node agent 지원)';
    RAISE NOTICE '   - task_state_transitions 테이블 생성 (상태 변경 이력)';
    RAISE NOTICE '   - dead_letter_queue 테이블 생성 (실패 작업 격리)';
    RAISE NOTICE '   - handle_task_failure() 함수 생성';
    RAISE NOTICE '   - process_retry_queue() 함수 생성 (Cron: 1분 간격)';
    RAISE NOTICE '   - v_task_status_summary, v_node_task_load, v_dlq_pending 뷰 생성';
END;
$$;

-- ============================================================
-- EXECUTION NOTES FOR AXON
-- ============================================================
-- 
-- 1. ALTER TYPE ... ADD VALUE는 각각 별도 트랜잭션에서 실행
--    Supabase SQL Editor에서 하나씩 실행:
--    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'ASSIGNED' AFTER 'PENDING';
--    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'RUNNING' AFTER 'ASSIGNED';
--    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'RETRY' AFTER 'FAILED';
--    ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'DEVICE_LOST';
--    ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'TASK_TIMEOUT';
--    ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'RETRY_EXHAUSTED';
--    ALTER TYPE error_code ADD VALUE IF NOT EXISTS 'NODE_CIRCUIT_OPEN';
--
-- 2. Cron Job 설정 (Supabase pg_cron 또는 n8n):
--    - process_retry_queue(): 매 1분
--    - detect_missing_devices(): 매 1분
--    - detect_missing_nodes(): 매 30초
--
-- 3. State Machine Flow:
--    PENDING → ASSIGNED (Central 할당)
--    ASSIGNED → RUNNING (Node Agent 시작)
--    RUNNING → COMPLETED | FAILED
--    FAILED → RETRY (retry_count < max_retries)
--    RETRY → PENDING (backoff 경과 후)
--    FAILED → DLQ (retry_count >= max_retries)
-- 
-- ============================================================

