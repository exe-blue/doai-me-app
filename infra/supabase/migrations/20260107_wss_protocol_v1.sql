-- ═══════════════════════════════════════════════════════════════════════════
-- Vultr-Centric WSS Protocol v1.0 - Database Migration
-- ═══════════════════════════════════════════════════════════════════════════
-- "복잡한 생각은 버려라." - Orion
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- I. NODES 테이블 확장
-- ═══════════════════════════════════════════════════════════════════════════

-- 기존 컬럼 추가 (IF NOT EXISTS로 안전하게)
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_heartbeat_ts TIMESTAMPTZ;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ws_session_id TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS resources_json JSONB DEFAULT '{}';
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS secret_key TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'disconnected';
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS active_tasks INTEGER DEFAULT 0;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}';
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS runner_version TEXT;

-- connection_status 체크 제약 (없으면 추가)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nodes_connection_status_check'
    ) THEN
        ALTER TABLE nodes ADD CONSTRAINT nodes_connection_status_check
        CHECK (connection_status IN ('connected', 'disconnected', 'reconnecting'));
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_nodes_heartbeat ON nodes(last_heartbeat_ts);
CREATE INDEX IF NOT EXISTS idx_nodes_connection ON nodes(connection_status);
CREATE INDEX IF NOT EXISTS idx_nodes_ws_session ON nodes(ws_session_id);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nodes_updated_at ON nodes;
CREATE TRIGGER trigger_nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- II. DEVICES 테이블
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 관계
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 20),
    
    -- 식별
    serial TEXT NOT NULL,
    model TEXT DEFAULT 'Galaxy S9',
    
    -- 상태
    status TEXT DEFAULT 'disconnected'
        CHECK (status IN ('connected', 'disconnected', 'busy', 'idle', 'error', 'in_umbra')),
    current_task_id UUID,
    
    -- 리소스
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    
    -- 페르소나
    persona_id UUID,
    persona_category TEXT,
    
    -- 최근 업데이트
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    last_snapshot_json JSONB DEFAULT '{}',
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- 복합 유니크 제약
    UNIQUE (node_id, slot_number)
);

-- serial 유니크 인덱스 (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_serial_unique ON devices(serial);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_devices_node ON devices(node_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_persona ON devices(persona_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- III. COMMAND_QUEUE 테이블
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS command_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 대상 노드 (NULL = 모든 노드)
    target_node_id UUID REFERENCES nodes(id),
    
    -- 명령 정보
    command_type TEXT NOT NULL,
    priority TEXT DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    params JSONB NOT NULL DEFAULT '{}',
    
    -- 타겟팅
    target_spec JSONB DEFAULT '{"type": "ALL_DEVICES"}'::jsonb,
    
    -- 상태
    status TEXT DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')),
    
    -- 실행 제어
    scheduled_at TIMESTAMPTZ,               -- 예약 실행 시간 (NULL = 즉시)
    timeout_seconds INTEGER DEFAULT 300,
    retry_count INTEGER DEFAULT 1,
    current_retry INTEGER DEFAULT 0,
    
    -- 할당 정보
    assigned_node_id UUID REFERENCES nodes(id),
    assigned_at TIMESTAMPTZ,
    
    -- 결과
    result JSONB,
    error_message TEXT,
    
    -- 메타
    created_by TEXT,                        -- 'system', 'api', 'admin'
    source_request_id UUID,                 -- 외부 요청 ID (video_queue 등)
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_queue_status ON command_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON command_queue(priority);
CREATE INDEX IF NOT EXISTS idx_queue_target_node ON command_queue(target_node_id);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON command_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_assigned ON command_queue(assigned_node_id);

-- 복합 인덱스: PENDING 상태 + 우선순위 + 생성시간 (폴링 최적화)
CREATE INDEX IF NOT EXISTS idx_queue_pending_priority 
ON command_queue(priority DESC, created_at ASC) 
WHERE status = 'PENDING';


-- ═══════════════════════════════════════════════════════════════════════════
-- IV. UPSERT 함수: 디바이스 스냅샷 일괄 업데이트
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_device_snapshot(
    p_node_id UUID,
    p_snapshot JSONB
)
RETURNS INTEGER AS $$
DECLARE
    device_record JSONB;
    affected_count INTEGER := 0;
BEGIN
    -- snapshot 배열 순회
    FOR device_record IN SELECT * FROM jsonb_array_elements(p_snapshot)
    LOOP
        INSERT INTO devices (
            node_id,
            slot_number,
            serial,
            status,
            current_task_id,
            battery_level,
            persona_id,
            last_seen_at,
            last_snapshot_json
        )
        VALUES (
            p_node_id,
            (device_record->>'slot')::INTEGER,
            device_record->>'serial',
            COALESCE(device_record->>'status', 'disconnected'),
            CASE 
                WHEN device_record->>'current_task' IS NOT NULL 
                     AND device_record->>'current_task' != ''
                     AND device_record->>'current_task' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN (device_record->>'current_task')::UUID 
                ELSE NULL 
            END,
            (device_record->>'battery_level')::INTEGER,
            CASE 
                WHEN device_record->>'persona_id' IS NOT NULL 
                     AND device_record->>'persona_id' != ''
                     AND device_record->>'persona_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN (device_record->>'persona_id')::UUID 
                ELSE NULL 
            END,
            now(),
            device_record
        )
        ON CONFLICT (node_id, slot_number) DO UPDATE SET
            serial = EXCLUDED.serial,
            status = EXCLUDED.status,
            current_task_id = EXCLUDED.current_task_id,
            battery_level = EXCLUDED.battery_level,
            persona_id = EXCLUDED.persona_id,
            last_seen_at = now(),
            last_snapshot_json = EXCLUDED.last_snapshot_json,
            updated_at = now();
        
        affected_count := affected_count + 1;
    END LOOP;
    
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- V. HEARTBEAT 처리 통합 함수
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION process_heartbeat(
    p_node_id TEXT,
    p_status TEXT,
    p_resources JSONB,
    p_device_snapshot JSONB,
    p_active_tasks INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_node_uuid UUID;
    v_device_count INTEGER;
BEGIN
    -- 노드 UUID 조회 (node_id 컬럼 또는 id)
    SELECT id INTO v_node_uuid
    FROM nodes
    WHERE node_id = p_node_id OR id::text = p_node_id;
    
    IF v_node_uuid IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Node not found'
        );
    END IF;
    
    -- 노드 상태 업데이트
    UPDATE nodes SET
        last_heartbeat_ts = now(),
        status = p_status,
        resources_json = p_resources,
        active_tasks = p_active_tasks,
        connection_status = 'connected'
    WHERE id = v_node_uuid;
    
    -- 디바이스 스냅샷 Upsert (있는 경우)
    IF p_device_snapshot IS NOT NULL AND jsonb_array_length(p_device_snapshot) > 0 THEN
        SELECT upsert_device_snapshot(v_node_uuid, p_device_snapshot)
        INTO v_device_count;
    ELSE
        v_device_count := 0;
    END IF;
    
    -- 결과 반환
    RETURN jsonb_build_object(
        'success', true,
        'node_uuid', v_node_uuid,
        'devices_updated', v_device_count,
        'processed_at', now()
    );
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- VI. FETCH AND ASSIGN COMMAND (Pull-based Push)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fetch_and_assign_command(
    p_node_id UUID,
    p_max_tasks INTEGER DEFAULT 5
)
RETURNS SETOF command_queue AS $$
DECLARE
    v_current_tasks INTEGER;
    v_available_slots INTEGER;
BEGIN
    -- 현재 노드의 진행 중인 태스크 수 확인
    SELECT COUNT(*) INTO v_current_tasks
    FROM command_queue
    WHERE assigned_node_id = p_node_id
      AND status IN ('ASSIGNED', 'IN_PROGRESS');
    
    -- 할당 가능한 슬롯 수
    v_available_slots := p_max_tasks - v_current_tasks;
    
    IF v_available_slots <= 0 THEN
        RETURN;  -- 빈 결과
    END IF;
    
    -- PENDING 명령 조회 및 할당 (FOR UPDATE SKIP LOCKED으로 동시성 처리)
    RETURN QUERY
    WITH selected_commands AS (
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
    UPDATE command_queue
    SET 
        status = 'ASSIGNED',
        assigned_node_id = p_node_id,
        assigned_at = now()
    WHERE id IN (SELECT id FROM selected_commands)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- VII. 명령 완료 처리
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION complete_command(
    p_command_id UUID,
    p_status TEXT,
    p_result JSONB,
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE command_queue
    SET 
        status = p_status,
        result = p_result,
        error_message = p_error,
        completed_at = now()
    WHERE id = p_command_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- VIII. 명령 재시도 처리
-- ═══════════════════════════════════════════════════════════════════════════

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
        current_retry = current_retry + 1,
        error_message = NULL
    WHERE id IN (SELECT id FROM retriable);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- IX. 노드 연결 해제 처리
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION disconnect_node(p_node_id UUID)
RETURNS BOOLEAN AS $
DECLARE
    v_node_found BOOLEAN;
BEGIN
    -- 노드 상태 업데이트
    UPDATE nodes
    SET 
        connection_status = 'disconnected',
        ws_session_id = NULL
    WHERE id = p_node_id;
    
    v_node_found := FOUND;
    
    -- 할당된 명령 다시 PENDING으로
    UPDATE command_queue
    SET 
        status = 'PENDING',
        assigned_node_id = NULL,
        assigned_at = NULL
    WHERE assigned_node_id = p_node_id
      AND status IN ('ASSIGNED');
    
    RETURN v_node_found;
END;
$ LANGUAGE plpgsql;      AND status IN ('ASSIGNED');
    
    -- 노드가 존재하고 업데이트되었는지 반환
    RETURN (node_rows > 0);
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- X. RLS 정책
-- ═══════════════════════════════════════════════════════════════════════════

-- devices RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- viewer는 SELECT만 허용
CREATE POLICY "Viewer can read devices" ON devices
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'viewer')
        )
    );

-- admin만 INSERT, UPDATE, DELETE 허용
CREATE POLICY "Admin can manage devices" ON devices
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- command_queue RLS
ALTER TABLE command_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage command_queue" ON command_queue
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('admin')
        )
    );

CREATE POLICY "Service role full access to command_queue" ON command_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════

