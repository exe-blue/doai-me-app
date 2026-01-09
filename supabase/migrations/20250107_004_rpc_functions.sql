-- ═══════════════════════════════════════════════════════════════════════════
-- DoAi.Me: WSS Protocol v1.0 - 통합 RPC 함수
-- Migration: 20250107_004_rpc_functions.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. HEARTBEAT 통합 처리 함수
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION process_heartbeat(
    p_node_id TEXT,
    p_status TEXT,
    p_resources JSONB,
    p_device_snapshot JSONB,
    p_active_tasks INTEGER DEFAULT 0,
    p_ws_session_id TEXT DEFAULT NULL,
    p_queue_depth INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_node_uuid UUID;
    v_device_result RECORD;
    v_pending_commands JSONB := '[]'::jsonb;
BEGIN
    -- 1. node_id로 UUID 조회
    SELECT id INTO v_node_uuid
    FROM nodes
    WHERE node_id = p_node_id;
    
    IF v_node_uuid IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Node not found: ' || p_node_id,
            'code', 'NODE_NOT_FOUND'
        );
    END IF;
    
    -- 2. 노드 상태 업데이트
    UPDATE nodes SET
        last_heartbeat_ts = now(),
        status = COALESCE(p_status, status),
        resources_json = COALESCE(p_resources, resources_json),
        active_tasks = COALESCE(p_active_tasks, active_tasks),
        connection_status = 'connected',
        ws_session_id = COALESCE(p_ws_session_id, ws_session_id)
    WHERE id = v_node_uuid;
    
    -- 3. 디바이스 스냅샷 Upsert
    IF p_device_snapshot IS NOT NULL AND jsonb_typeof(p_device_snapshot) = 'array' THEN
        SELECT * INTO v_device_result
        FROM upsert_device_snapshot(v_node_uuid, p_device_snapshot);
    ELSE
        v_device_result := ROW(0, true, 'No device snapshot')::RECORD;
    END IF;
    
    -- 4. Pull-based Push: READY 상태면 대기 명령 조회
    IF p_status = 'READY' THEN
        SELECT jsonb_agg(row_to_json(cmd))
        INTO v_pending_commands
        FROM fetch_and_assign_commands(v_node_uuid, 5) cmd;
        
        -- NULL 방지
        v_pending_commands := COALESCE(v_pending_commands, '[]'::jsonb);
    END IF;
    
    -- 5. 결과 반환
    RETURN jsonb_build_object(
        'success', true,
        'node_uuid', v_node_uuid,
        'devices_updated', COALESCE((v_device_result).affected_count, 0),
        'pending_commands', v_pending_commands,
        'processed_at', now()
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', 'INTERNAL_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_heartbeat IS 
'HEARTBEAT 메시지 통합 처리. 노드 상태 업데이트 + 디바이스 스냅샷 + Pull-based Push 명령 반환.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. 노드 인증 및 시크릿 키 관리
-- ═══════════════════════════════════════════════════════════════════════════

-- 노드 시크릿 키 조회 (인증용)
CREATE OR REPLACE FUNCTION get_node_secret(p_node_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_secret TEXT;
BEGIN
    SELECT secret_key INTO v_secret
    FROM nodes
    WHERE node_id = p_node_id;
    
    RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_node_secret IS 
'노드 인증용 시크릿 키 조회. WSS Hub에서 HMAC-SHA256 검증에 사용.';

-- 노드 시크릿 키 재생성
CREATE OR REPLACE FUNCTION rotate_node_secret(p_node_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_new_secret TEXT;
    v_affected INTEGER;
BEGIN
    v_new_secret := generate_node_secret_key();
    
    UPDATE nodes
    SET 
        secret_key = v_new_secret,
        ws_session_id = NULL,  -- 기존 세션 무효화
        connection_status = 'disconnected'
    WHERE node_id = p_node_id;
    
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    
    IF v_affected = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Node not found'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_secret', v_new_secret,
        'message', 'Secret rotated. Node must reconnect with new key.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rotate_node_secret IS 
'노드 시크릿 키 재생성. 보안 이벤트 발생 시 호출. 기존 세션 무효화됨.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. 노드 연결/해제 관리
-- ═══════════════════════════════════════════════════════════════════════════

-- 노드 연결 등록 (HELLO 핸드셰이크 성공 시)
CREATE OR REPLACE FUNCTION register_node_connection(
    p_node_id TEXT,
    p_ws_session_id TEXT,
    p_hostname TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_runner_version TEXT DEFAULT NULL,
    p_capabilities TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_node_uuid UUID;
BEGIN
    -- 노드 조회 또는 생성
    SELECT id INTO v_node_uuid
    FROM nodes
    WHERE node_id = p_node_id;
    
    IF v_node_uuid IS NULL THEN
        -- 새 노드 생성
        INSERT INTO nodes (
            node_id, 
            hostname, 
            ip_address, 
            secret_key,
            runner_version,
            capabilities,
            ws_session_id,
            connection_status,
            status
        )
        VALUES (
            p_node_id,
            COALESCE(p_hostname, 'unknown'),
            p_ip_address::INET,
            generate_node_secret_key(),
            p_runner_version,
            COALESCE(p_capabilities, '{}'),
            p_ws_session_id,
            'connected',
            'READY'
        )
        RETURNING id INTO v_node_uuid;
        
        RETURN jsonb_build_object(
            'success', true,
            'node_uuid', v_node_uuid,
            'is_new', true,
            'message', 'New node registered'
        );
    ELSE
        -- 기존 노드 업데이트
        UPDATE nodes SET
            hostname = COALESCE(p_hostname, hostname),
            ip_address = COALESCE(p_ip_address::INET, ip_address),
            runner_version = COALESCE(p_runner_version, runner_version),
            capabilities = COALESCE(p_capabilities, capabilities),
            ws_session_id = p_ws_session_id,
            connection_status = 'connected',
            status = 'READY',
            last_heartbeat_ts = now()
        WHERE id = v_node_uuid;
        
        RETURN jsonb_build_object(
            'success', true,
            'node_uuid', v_node_uuid,
            'is_new', false,
            'message', 'Node reconnected'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_node_connection IS 
'노드 연결 등록 (HELLO 핸드셰이크 성공 시). 새 노드면 생성, 기존 노드면 업데이트.';

-- 노드 연결 해제
CREATE OR REPLACE FUNCTION disconnect_node(p_node_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE nodes SET
        connection_status = 'disconnected',
        ws_session_id = NULL,
        status = 'OFFLINE'
    WHERE node_id = p_node_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION disconnect_node IS 
'노드 연결 해제 처리. WebSocket 연결 종료 시 호출.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. 명령 큐 관리
-- ═══════════════════════════════════════════════════════════════════════════

-- 새 명령 추가
CREATE OR REPLACE FUNCTION enqueue_command(
    p_command_type TEXT,
    p_params JSONB,
    p_target_node_id UUID DEFAULT NULL,
    p_target_spec JSONB DEFAULT '{"type": "ALL_DEVICES"}'::jsonb,
    p_priority TEXT DEFAULT 'NORMAL',
    p_scheduled_at TIMESTAMPTZ DEFAULT NULL,
    p_timeout_seconds INTEGER DEFAULT 300,
    p_retry_count INTEGER DEFAULT 1,
    p_source_request_id UUID DEFAULT NULL,
    p_created_by TEXT DEFAULT 'api'
)
RETURNS UUID AS $$
DECLARE
    v_command_id UUID;
BEGIN
    -- 유효성 검사
    IF p_command_type IS NULL OR p_command_type = '' THEN
        RAISE EXCEPTION 'command_type is required';
    END IF;
    
    IF p_priority NOT IN ('LOW', 'NORMAL', 'HIGH', 'URGENT') THEN
        p_priority := 'NORMAL';
    END IF;
    
    INSERT INTO command_queue (
        command_type,
        params,
        target_node_id,
        target_spec,
        priority,
        scheduled_at,
        timeout_seconds,
        retry_count,
        source_request_id,
        created_by
    ) VALUES (
        p_command_type,
        COALESCE(p_params, '{}'::jsonb),
        p_target_node_id,
        p_target_spec,
        p_priority,
        p_scheduled_at,
        COALESCE(p_timeout_seconds, 300),
        COALESCE(p_retry_count, 1),
        p_source_request_id,
        p_created_by
    )
    RETURNING id INTO v_command_id;
    
    RETURN v_command_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_command IS 
'새 명령을 큐에 추가. video_queue 등 외부 시스템 연동용.';

-- 특정 노드에 명령 브로드캐스트
CREATE OR REPLACE FUNCTION broadcast_command_to_all_nodes(
    p_command_type TEXT,
    p_params JSONB,
    p_priority TEXT DEFAULT 'NORMAL'
)
RETURNS INTEGER AS $$
DECLARE
    v_node RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_node IN 
        SELECT id FROM nodes 
        WHERE connection_status = 'connected'
    LOOP
        INSERT INTO command_queue (
            command_type,
            params,
            target_node_id,
            priority,
            created_by
        ) VALUES (
            p_command_type,
            p_params,
            v_node.id,
            p_priority,
            'broadcast'
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION broadcast_command_to_all_nodes IS 
'연결된 모든 노드에 명령 브로드캐스트.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. 모니터링 및 유지보수
-- ═══════════════════════════════════════════════════════════════════════════

-- 비활성 노드 감지 (HEARTBEAT 타임아웃)
CREATE OR REPLACE FUNCTION check_stale_nodes(
    p_timeout INTERVAL DEFAULT INTERVAL '2 minutes'
)
RETURNS TABLE (
    node_id TEXT,
    last_heartbeat TIMESTAMPTZ,
    stale_duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.node_id,
        n.last_heartbeat_ts,
        now() - n.last_heartbeat_ts as stale_duration
    FROM nodes n
    WHERE n.connection_status = 'connected'
      AND (n.last_heartbeat_ts IS NULL OR n.last_heartbeat_ts < now() - p_timeout)
    ORDER BY n.last_heartbeat_ts ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_stale_nodes IS 
'HEARTBEAT 타임아웃된 노드 목록. 모니터링용.';

-- 비활성 노드 자동 연결 해제
CREATE OR REPLACE FUNCTION disconnect_stale_nodes(
    p_timeout INTERVAL DEFAULT INTERVAL '2 minutes'
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE nodes
    SET 
        connection_status = 'disconnected',
        ws_session_id = NULL,
        status = 'OFFLINE'
    WHERE connection_status = 'connected'
      AND (last_heartbeat_ts IS NULL OR last_heartbeat_ts < now() - p_timeout);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION disconnect_stale_nodes IS 
'HEARTBEAT 타임아웃된 노드 자동 연결 해제. 주기적으로 호출.';

-- 큐 정리 (오래된 완료 명령 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_commands(
    p_retention INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM command_queue
    WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT')
      AND completed_at < now() - p_retention;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_commands IS 
'오래된 완료/실패 명령 삭제. 주기적으로 호출.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. 대시보드용 집계 뷰
-- ═══════════════════════════════════════════════════════════════════════════

-- 시스템 전체 상태 요약
CREATE OR REPLACE VIEW system_status_overview AS
SELECT 
    (SELECT COUNT(*) FROM nodes WHERE connection_status = 'connected') as connected_nodes,
    (SELECT COUNT(*) FROM nodes WHERE connection_status = 'disconnected') as disconnected_nodes,
    (SELECT COUNT(*) FROM devices WHERE status = 'idle') as idle_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'busy') as busy_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'error') as error_devices,
    (SELECT COUNT(*) FROM command_queue WHERE status = 'PENDING') as pending_commands,
    (SELECT COUNT(*) FROM command_queue WHERE status = 'IN_PROGRESS') as active_commands,
    (SELECT AVG(EXTRACT(EPOCH FROM (now() - created_at))) 
     FROM command_queue WHERE status = 'PENDING') as avg_queue_wait_seconds;

COMMENT ON VIEW system_status_overview IS 
'시스템 전체 상태 요약 (대시보드 헤더용)';

-- 노드별 상세 현황
CREATE OR REPLACE VIEW node_detail_status AS
SELECT 
    n.node_id,
    n.hostname,
    n.connection_status,
    n.status,
    n.last_heartbeat_ts,
    EXTRACT(EPOCH FROM (now() - n.last_heartbeat_ts)) as seconds_since_heartbeat,
    n.active_tasks,
    n.resources_json,
    n.runner_version,
    (SELECT COUNT(*) FROM devices d WHERE d.node_id = n.id) as total_devices,
    (SELECT COUNT(*) FROM devices d WHERE d.node_id = n.id AND d.status = 'idle') as idle_devices,
    (SELECT COUNT(*) FROM devices d WHERE d.node_id = n.id AND d.status = 'busy') as busy_devices,
    (SELECT COUNT(*) FROM command_queue cq 
     WHERE cq.assigned_node_id = n.id AND cq.status IN ('ASSIGNED', 'IN_PROGRESS')) as assigned_commands
FROM nodes n
ORDER BY n.connection_status DESC, n.node_id;

COMMENT ON VIEW node_detail_status IS 
'노드별 상세 현황 (모니터링용)';

