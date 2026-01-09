-- ═══════════════════════════════════════════════════════════════════════════
-- DoAi.Me: WSS Protocol v1.0 - command_queue 테이블 및 Pull-based Push
-- Migration: 20250107_003_command_queue.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. command_queue 테이블 생성
CREATE TABLE IF NOT EXISTS command_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 대상 노드 (NULL = 특정 노드 지정 없음, 조건에 맞는 노드가 가져감)
    target_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- 명령 정보
    command_type TEXT NOT NULL,
    priority TEXT DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 타겟팅 상세 (디바이스 레벨)
    target_spec JSONB DEFAULT '{"type": "ALL_DEVICES"}'::jsonb,
    /*
    target_spec 예시:
    {"type": "ALL_DEVICES"}
    {"type": "SPECIFIC_DEVICES", "device_slots": [1, 2, 3]}
    {"type": "PERSONA_CATEGORY", "category": "gaming"}
    {"type": "IDLE_DEVICES", "max_count": 10}
    */
    
    -- 상태
    status TEXT DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT')),
    
    -- 실행 제어
    scheduled_at TIMESTAMPTZ,           -- 예약 실행 (NULL = 즉시)
    timeout_seconds INTEGER DEFAULT 300,
    retry_count INTEGER DEFAULT 1,
    current_retry INTEGER DEFAULT 0,
    
    -- 할당 정보
    assigned_node_id UUID REFERENCES nodes(id),
    assigned_at TIMESTAMPTZ,
    
    -- 결과
    result JSONB,
    error_message TEXT,
    
    -- 메타데이터
    created_by TEXT DEFAULT 'system',   -- 'system', 'api', 'admin', 'scheduler'
    source_request_id UUID,             -- 외부 요청 ID (video_queue 등 연동)
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_cq_status ON command_queue(status);
CREATE INDEX IF NOT EXISTS idx_cq_priority ON command_queue(priority);
CREATE INDEX IF NOT EXISTS idx_cq_target_node ON command_queue(target_node_id);
CREATE INDEX IF NOT EXISTS idx_cq_assigned ON command_queue(assigned_node_id);
CREATE INDEX IF NOT EXISTS idx_cq_scheduled ON command_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_cq_created ON command_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cq_source ON command_queue(source_request_id);

-- 복합 인덱스: PENDING 상태 폴링 최적화 (우선순위 → 생성시간)
CREATE INDEX IF NOT EXISTS idx_cq_pending_poll 
ON command_queue(priority DESC, created_at ASC) 
WHERE status = 'PENDING';

-- IN_PROGRESS 상태 타임아웃 체크용
CREATE INDEX IF NOT EXISTS idx_cq_in_progress
ON command_queue(started_at)
WHERE status = 'IN_PROGRESS';

-- 3. Pull-based Push: 명령 조회 및 할당
-- NodeRunner가 READY 상태일 때 호출하여 대기 중인 명령을 가져감
CREATE OR REPLACE FUNCTION fetch_and_assign_commands(
    p_node_id UUID,
    p_max_tasks INTEGER DEFAULT 5
)
RETURNS SETOF command_queue AS $$
DECLARE
    v_current_tasks INTEGER;
    v_available_slots INTEGER;
BEGIN
    -- 현재 노드에 할당된 진행 중 태스크 수 확인
    SELECT COUNT(*) INTO v_current_tasks
    FROM command_queue
    WHERE assigned_node_id = p_node_id
      AND status IN ('ASSIGNED', 'IN_PROGRESS');
    
    -- 할당 가능한 슬롯 계산
    v_available_slots := GREATEST(0, p_max_tasks - v_current_tasks);
    
    IF v_available_slots <= 0 THEN
        RETURN; -- 빈 결과 반환
    END IF;
    
    -- PENDING 명령 선택 및 할당
    -- FOR UPDATE SKIP LOCKED: 동시성 안전, 이미 락된 행 건너뜀
    RETURN QUERY
    WITH selected AS (
        SELECT id
        FROM command_queue
        WHERE status = 'PENDING'
          AND (target_node_id IS NULL OR target_node_id = p_node_id)
          AND (scheduled_at IS NULL OR scheduled_at <= now())
        ORDER BY
            CASE priority
                WHEN 'URGENT' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'NORMAL' THEN 3
                WHEN 'LOW' THEN 4
            END,
            created_at ASC
        LIMIT v_available_slots
        FOR UPDATE SKIP LOCKED
    )
    UPDATE command_queue c
    SET 
        status = 'ASSIGNED',
        assigned_node_id = p_node_id,
        assigned_at = now()
    FROM selected s
    WHERE c.id = s.id
    RETURNING c.*;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fetch_and_assign_commands IS 
'Pull-based Push: READY 상태 노드가 호출하여 PENDING 명령을 할당받음. 우선순위 순, 동시성 안전.';

-- 4. 명령 시작 표시
CREATE OR REPLACE FUNCTION start_command(p_command_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE command_queue
    SET 
        status = 'IN_PROGRESS',
        started_at = now()
    WHERE id = p_command_id
      AND status = 'ASSIGNED';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION start_command IS 
'명령 실행 시작 표시. ASSIGNED → IN_PROGRESS 전이.';

-- 5. 명령 완료 처리
CREATE OR REPLACE FUNCTION complete_command(
    p_command_id UUID,
    p_status TEXT,
    p_result JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 유효한 완료 상태인지 확인
    IF p_status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid completion status: %', p_status;
    END IF;
    
    UPDATE command_queue
    SET 
        status = p_status,
        result = COALESCE(p_result, result),
        error_message = p_error,
        completed_at = now()
    WHERE id = p_command_id
      AND status IN ('ASSIGNED', 'IN_PROGRESS');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_command IS 
'명령 완료 처리. 상태 업데이트 + 결과/에러 저장.';

-- 6. 실패한 명령 재시도
CREATE OR REPLACE FUNCTION retry_failed_commands()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH retriable AS (
        SELECT id
        FROM command_queue
        WHERE status = 'FAILED'
          AND current_retry < retry_count
        FOR UPDATE SKIP LOCKED
    )
    UPDATE command_queue
    SET 
        status = 'PENDING',
        assigned_node_id = NULL,
        assigned_at = NULL,
        started_at = NULL,
        completed_at = NULL,
        current_retry = current_retry + 1,
        error_message = 'Retrying (attempt ' || (current_retry + 1) || '/' || retry_count || '): ' || COALESCE(error_message, '')
    WHERE id IN (SELECT id FROM retriable);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION retry_failed_commands IS 
'재시도 가능한 FAILED 명령을 PENDING으로 되돌림. 주기적으로 호출.';

-- 7. 타임아웃 명령 처리
CREATE OR REPLACE FUNCTION timeout_stale_commands(
    p_assigned_timeout INTERVAL DEFAULT INTERVAL '5 minutes',
    p_progress_timeout INTERVAL DEFAULT INTERVAL '10 minutes'
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE command_queue
    SET 
        status = 'TIMEOUT',
        error_message = CASE
            WHEN status = 'ASSIGNED' THEN 'Timeout: not started within ' || p_assigned_timeout
            ELSE 'Timeout: not completed within ' || p_progress_timeout
        END,
        completed_at = now()
    WHERE (
        -- ASSIGNED 상태에서 시작 안 됨
        (status = 'ASSIGNED' AND assigned_at < now() - p_assigned_timeout)
        OR
        -- IN_PROGRESS 상태에서 완료 안 됨
        (status = 'IN_PROGRESS' AND started_at < now() - p_progress_timeout)
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION timeout_stale_commands IS 
'지정 시간 내 시작/완료되지 않은 명령을 TIMEOUT 처리. 주기적으로 호출.';

-- 8. 명령 취소
CREATE OR REPLACE FUNCTION cancel_command(
    p_command_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by user'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE command_queue
    SET 
        status = 'CANCELLED',
        error_message = p_reason,
        completed_at = now()
    WHERE id = p_command_id
      AND status IN ('PENDING', 'ASSIGNED');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_command IS 
'대기/할당 중인 명령 취소. 실행 중인 명령은 취소 불가.';

-- 9. 큐 상태 통계 뷰
CREATE OR REPLACE VIEW command_queue_stats AS
SELECT 
    status,
    priority,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest,
    AVG(EXTRACT(EPOCH FROM (
        CASE 
            WHEN completed_at IS NOT NULL THEN completed_at - created_at
            ELSE now() - created_at
        END
    ))) as avg_age_seconds
FROM command_queue
GROUP BY status, priority
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'ASSIGNED' THEN 2
        WHEN 'IN_PROGRESS' THEN 3
        ELSE 4
    END,
    priority DESC;

COMMENT ON VIEW command_queue_stats IS 
'명령 큐 상태/우선순위별 통계';

-- 10. 최근 명령 히스토리 뷰
CREATE OR REPLACE VIEW recent_commands AS
SELECT 
    cq.id,
    cq.command_type,
    cq.priority,
    cq.status,
    n_target.node_id as target_node,
    n_assigned.node_id as assigned_node,
    cq.created_at,
    cq.assigned_at,
    cq.started_at,
    cq.completed_at,
    EXTRACT(EPOCH FROM (cq.completed_at - cq.created_at)) as total_duration_sec,
    cq.error_message
FROM command_queue cq
LEFT JOIN nodes n_target ON cq.target_node_id = n_target.id
LEFT JOIN nodes n_assigned ON cq.assigned_node_id = n_assigned.id
ORDER BY cq.created_at DESC
LIMIT 100;

COMMENT ON VIEW recent_commands IS 
'최근 100개 명령 히스토리 (대시보드용)';

-- 11. RLS 정책
ALTER TABLE command_queue ENABLE ROW LEVEL SECURITY;

-- service_role 전체 접근
CREATE POLICY "service_role_cq_all" ON command_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- authenticated 읽기 전용
CREATE POLICY "authenticated_cq_read" ON command_queue
    FOR SELECT
    TO authenticated
    USING (true);

-- 12. 테이블 코멘트
COMMENT ON TABLE command_queue IS 
'명령 큐. Vultr → NodeRunner 명령 전달, Pull-based Push 방식.';
COMMENT ON COLUMN command_queue.target_node_id IS 
'특정 노드 지정 (NULL = 조건 맞는 아무 노드)';
COMMENT ON COLUMN command_queue.target_spec IS 
'디바이스 레벨 타겟팅 JSON (ALL_DEVICES/SPECIFIC_DEVICES/PERSONA_CATEGORY)';
COMMENT ON COLUMN command_queue.priority IS 
'URGENT > HIGH > NORMAL > LOW 순으로 처리';
COMMENT ON COLUMN command_queue.source_request_id IS 
'원본 요청 ID (video_queue 등 외부 시스템 연동용)';

