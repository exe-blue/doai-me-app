-- ═══════════════════════════════════════════════════════════════════════════
-- DoAi.Me: WSS Protocol v1.0 - devices 테이블 + Upsert 함수
-- Migration: 20250107_002_devices_upsert.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. devices 테이블 생성
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 관계: 노드와 1:N (노드당 최대 20대 디바이스)
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 20),
    
    -- 디바이스 식별
    serial TEXT NOT NULL,
    model TEXT DEFAULT 'Galaxy S9',
    
    -- 상태
    status TEXT DEFAULT 'disconnected'
        CHECK (status IN ('connected', 'disconnected', 'busy', 'idle', 'error', 'in_umbra')),
    current_task_id UUID,
    
    -- 리소스
    battery_level INTEGER CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100)),
    
    -- 페르소나 연결
    persona_id UUID,
    persona_category TEXT,
    
    -- 스냅샷 (HEARTBEAT에서 받은 원본 데이터)
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    last_snapshot_json JSONB DEFAULT '{}'::jsonb,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- 복합 유니크 제약: 노드 내 슬롯 번호 유일
    UNIQUE (node_id, slot_number)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_devices_node ON devices(node_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_persona ON devices(persona_id);
CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at DESC);

-- idle 상태 디바이스 빠른 조회용
CREATE INDEX IF NOT EXISTS idx_devices_idle 
ON devices(node_id) 
WHERE status = 'idle';

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_devices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_devices_updated ON devices;
CREATE TRIGGER trigger_devices_updated
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_devices_timestamp();

-- 4. Upsert 함수: 디바이스 스냅샷 일괄 업데이트
CREATE OR REPLACE FUNCTION upsert_device_snapshot(
    p_node_id UUID,
    p_snapshot JSONB
)
RETURNS TABLE (
    affected_count INTEGER,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    device_record JSONB;
    v_count INTEGER := 0;
    v_slot INTEGER;
    v_serial TEXT;
BEGIN
    -- 유효성 검사: NULL 또는 빈 배열 처리
    IF p_snapshot IS NULL THEN
        RETURN QUERY SELECT 0, TRUE, 'Empty snapshot (null)'::TEXT;
        RETURN;
    END IF;
    
    IF jsonb_typeof(p_snapshot) != 'array' THEN
        RETURN QUERY SELECT 0, FALSE, 'Invalid snapshot: must be JSON array'::TEXT;
        RETURN;
    END IF;
    
    IF jsonb_array_length(p_snapshot) = 0 THEN
        RETURN QUERY SELECT 0, TRUE, 'Empty snapshot (zero devices)'::TEXT;
        RETURN;
    END IF;
    
    -- snapshot 배열 순회
    FOR device_record IN SELECT * FROM jsonb_array_elements(p_snapshot)
    LOOP
        BEGIN
            -- 슬롯 번호 추출 및 검증
            v_slot := (device_record->>'slot')::INTEGER;
            IF v_slot IS NULL OR v_slot < 1 OR v_slot > 20 THEN
                RAISE WARNING 'Invalid slot number: %, skipping', device_record->>'slot';
                CONTINUE;
            END IF;
            
            -- 시리얼 추출
            v_serial := COALESCE(NULLIF(device_record->>'serial', ''), 'SLOT_' || v_slot);
            
            -- Upsert 실행
            INSERT INTO devices (
                node_id,
                slot_number,
                serial,
                status,
                current_task_id,
                battery_level,
                persona_id,
                persona_category,
                last_seen_at,
                last_snapshot_json
            )
            VALUES (
                p_node_id,
                v_slot,
                v_serial,
                COALESCE(device_record->>'status', 'disconnected'),
                CASE 
                    WHEN device_record->>'current_task' IS NOT NULL 
                         AND device_record->>'current_task' != ''
                         AND device_record->>'current_task' ~ '^[0-9a-f-]{36}$'
                    THEN (device_record->>'current_task')::UUID 
                    ELSE NULL 
                END,
                NULLIF(device_record->>'battery_level', '')::INTEGER,
                CASE 
                    WHEN device_record->>'persona_id' IS NOT NULL 
                         AND device_record->>'persona_id' != ''
                         AND device_record->>'persona_id' ~ '^[0-9a-f-]{36}$'
                    THEN (device_record->>'persona_id')::UUID 
                    ELSE NULL 
                END,
                NULLIF(device_record->>'persona_category', ''),
                now(),
                device_record
            )
            ON CONFLICT (node_id, slot_number) DO UPDATE SET
                serial = EXCLUDED.serial,
                status = EXCLUDED.status,
                current_task_id = EXCLUDED.current_task_id,
                battery_level = COALESCE(EXCLUDED.battery_level, devices.battery_level),
                persona_id = COALESCE(EXCLUDED.persona_id, devices.persona_id),
                persona_category = COALESCE(EXCLUDED.persona_category, devices.persona_category),
                last_seen_at = now(),
                last_snapshot_json = EXCLUDED.last_snapshot_json;
            
            v_count := v_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to upsert device slot %: %', 
                device_record->>'slot', SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_count, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_device_snapshot IS 
'NodeRunner HEARTBEAT의 device_snapshot 배열을 일괄 Upsert. 슬롯 기준으로 기존 레코드 업데이트 또는 신규 생성.';

-- 5. 디바이스 상태 집계 뷰
CREATE OR REPLACE VIEW device_status_summary AS
SELECT 
    n.node_id,
    n.hostname,
    n.connection_status as node_connection,
    COUNT(d.id) as total_devices,
    COUNT(d.id) FILTER (WHERE d.status = 'idle') as idle_count,
    COUNT(d.id) FILTER (WHERE d.status = 'busy') as busy_count,
    COUNT(d.id) FILTER (WHERE d.status = 'connected') as connected_count,
    COUNT(d.id) FILTER (WHERE d.status = 'disconnected') as disconnected_count,
    COUNT(d.id) FILTER (WHERE d.status = 'error') as error_count,
    ROUND(AVG(d.battery_level), 0) as avg_battery,
    MAX(d.last_seen_at) as latest_device_update
FROM nodes n
LEFT JOIN devices d ON n.id = d.node_id
GROUP BY n.id, n.node_id, n.hostname, n.connection_status;

COMMENT ON VIEW device_status_summary IS 
'노드별 디바이스 상태 집계 뷰 (대시보드용)';

-- 6. RLS 정책
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- service_role 전체 접근
CREATE POLICY "service_role_devices_all" ON devices
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- authenticated 읽기 전용 (대시보드)
CREATE POLICY "authenticated_devices_read" ON devices
    FOR SELECT
    TO authenticated
    USING (true);

-- 7. 테이블 코멘트
COMMENT ON TABLE devices IS 
'NodeRunner 연결 디바이스 (Galaxy S9). 노드당 최대 20대, HEARTBEAT로 상태 동기화.';
COMMENT ON COLUMN devices.slot_number IS '물리적 슬롯 번호 (1-20)';
COMMENT ON COLUMN devices.status IS 'connected/disconnected/busy/idle/error/in_umbra';
COMMENT ON COLUMN devices.persona_id IS '할당된 페르소나 UUID';
COMMENT ON COLUMN devices.last_snapshot_json IS 'HEARTBEAT에서 받은 원본 디바이스 데이터';

