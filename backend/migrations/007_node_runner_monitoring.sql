-- ============================================================
-- DoAi.Me Database Migration 007
-- Node Runner Monitoring (Orion P0)
-- ============================================================
-- Version: v2.6
-- Author: Axon (Lead Builder)
-- Spec By: Aria (Chief Architect)
-- Commanded By: Orion (Chief of Staff)
-- Date: 2026.01.05
-- ============================================================
--
-- 목표: 600대 기기와 NodeRunner의 생사를 실시간으로 확인하고,
--       명령 수행 가능 상태를 시각화한다.
--
-- 변경 사항:
--   A. node_runners 테이블 (nodes 테이블 확장/별칭)
--   B. devices 테이블에 work_status 추가
--   C. 실시간 상태 조회 뷰
--   D. Heartbeat 기반 자동 offline 감지
--
-- ============================================================

-- ============================================================
-- PART A: NODE_RUNNERS 테이블
-- (기존 nodes 테이블을 확장하거나 뷰로 제공)
-- ============================================================

-- work_status ENUM (디바이스 작업 상태)
DO $$ BEGIN
    CREATE TYPE work_status AS ENUM (
        'idle',       -- 대기 중
        'busy',       -- 작업 수행 중
        'error',      -- 오류 상태
        'in_umbra'    -- 숨그늘 (잠재)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- node_runners 뷰 (nodes 테이블 기반, Aria 스펙 호환)
CREATE OR REPLACE VIEW node_runners AS
SELECT 
    node_id AS id,
    name AS hostname,
    ip_address,
    last_heartbeat AS last_heartbeat_at,
    -- Heartbeat > 1분 전이면 offline
    CASE 
        WHEN last_heartbeat IS NULL THEN 'offline'
        WHEN last_heartbeat < NOW() - INTERVAL '60 seconds' THEN 'offline'
        ELSE 'online'
    END AS status,
    status_v2 AS detailed_status,
    capacity,
    online_device_count,
    health_score,
    created_at,
    updated_at
FROM nodes;

COMMENT ON VIEW node_runners IS 
    'Aria Spec: NodeRunner 상태 뷰. Heartbeat 1분 기준 online/offline 판정.';

-- ============================================================
-- PART B: DEVICES 테이블 확장
-- ============================================================

-- work_status 컬럼 추가
ALTER TABLE devices 
    ADD COLUMN IF NOT EXISTS work_status work_status DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS last_command VARCHAR(200),
    ADD COLUMN IF NOT EXISTS last_command_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) DEFAULT 'disconnected';

-- connection_status 업데이트 (last_seen 기준)
-- 30초 이내면 connected, 아니면 disconnected
CREATE OR REPLACE FUNCTION update_device_connection_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_seen IS NOT NULL THEN
        IF NEW.last_seen >= NOW() - INTERVAL '30 seconds' THEN
            NEW.connection_status := 'connected';
        ELSE
            NEW.connection_status := 'disconnected';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_connection_status ON devices;
CREATE TRIGGER trg_device_connection_status
    BEFORE UPDATE OF last_seen ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_connection_status();

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_devices_work_status ON devices(work_status);
CREATE INDEX IF NOT EXISTS idx_devices_connection ON devices(connection_status);

-- ============================================================
-- PART C: 실시간 상태 조회 뷰
-- ============================================================

-- Device Grid용 뷰 (600개 셀 최적화)
CREATE OR REPLACE VIEW v_device_grid AS
SELECT 
    d.device_id,
    d.node_id AS runner_id,
    d.laixi_id AS device_serial,
    d.slot_number,
    d.model,
    d.connection_status,
    d.work_status,
    d.status AS device_status,
    -- 색상 코딩용 통합 상태
    CASE 
        WHEN d.status IN ('error', 'missing') OR d.connection_status = 'disconnected' THEN 'error'
        WHEN d.work_status = 'in_umbra' THEN 'umbra'
        WHEN d.work_status = 'busy' THEN 'active'
        WHEN d.work_status = 'idle' THEN 'idle'
        ELSE 'offline'
    END AS grid_status,
    d.last_seen,
    d.last_command,
    d.last_error_code,
    d.last_error_message,
    n.name AS runner_name,
    n.status_v2 AS runner_status
FROM devices d
LEFT JOIN nodes n ON d.node_id = n.node_id
ORDER BY d.node_id, d.slot_number;

COMMENT ON VIEW v_device_grid IS 
    'Device Grid UI용 뷰. grid_status: error(Red), umbra(Violet), active(Green), idle(Gray)';

-- Runner Status Bar용 뷰
CREATE OR REPLACE VIEW v_runner_status_bar AS
SELECT 
    node_id AS runner_id,
    name AS hostname,
    ip_address,
    CASE 
        WHEN last_heartbeat IS NULL THEN 'offline'
        WHEN last_heartbeat < NOW() - INTERVAL '60 seconds' THEN 'offline'
        ELSE 'online'
    END AS status,
    status_v2 AS detailed_status,
    online_device_count,
    capacity,
    -- 연결된 디바이스 수
    (SELECT COUNT(*) FROM devices d WHERE d.node_id = n.node_id AND d.connection_status = 'connected') AS connected_devices,
    -- 작업 중인 디바이스 수
    (SELECT COUNT(*) FROM devices d WHERE d.node_id = n.node_id AND d.work_status = 'busy') AS busy_devices,
    -- 에러 디바이스 수
    (SELECT COUNT(*) FROM devices d WHERE d.node_id = n.node_id AND (d.status IN ('error', 'missing') OR d.work_status = 'error')) AS error_devices,
    last_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) AS seconds_since_heartbeat
FROM nodes n
ORDER BY 
    CASE 
        WHEN last_heartbeat >= NOW() - INTERVAL '60 seconds' THEN 0
        ELSE 1
    END,
    name;

COMMENT ON VIEW v_runner_status_bar IS 
    'Runner Status Bar UI용 뷰. 상단 신호등 표시용.';

-- ============================================================
-- PART D: 집계 통계 뷰
-- ============================================================

-- 전체 상태 요약
CREATE OR REPLACE VIEW v_system_status_summary AS
SELECT 
    -- Runners
    (SELECT COUNT(*) FROM nodes) AS total_runners,
    (SELECT COUNT(*) FROM nodes WHERE last_heartbeat >= NOW() - INTERVAL '60 seconds') AS online_runners,
    (SELECT COUNT(*) FROM nodes WHERE last_heartbeat < NOW() - INTERVAL '60 seconds' OR last_heartbeat IS NULL) AS offline_runners,
    
    -- Devices
    (SELECT COUNT(*) FROM devices) AS total_devices,
    (SELECT COUNT(*) FROM devices WHERE connection_status = 'connected') AS connected_devices,
    (SELECT COUNT(*) FROM devices WHERE work_status = 'busy') AS busy_devices,
    (SELECT COUNT(*) FROM devices WHERE work_status = 'in_umbra') AS umbra_devices,
    (SELECT COUNT(*) FROM devices WHERE status IN ('error', 'missing') OR work_status = 'error') AS error_devices,
    (SELECT COUNT(*) FROM devices WHERE work_status = 'idle' AND connection_status = 'connected') AS idle_devices,
    
    -- Timestamp
    NOW() AS measured_at;

-- ============================================================
-- PART E: 자동 offline 감지 함수
-- ============================================================

-- 주기적으로 실행할 함수 (Cron: 30초마다)
CREATE OR REPLACE FUNCTION check_runner_heartbeats()
RETURNS TABLE(
    runner_id VARCHAR(50),
    status TEXT,
    seconds_offline BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.node_id,
        CASE 
            WHEN n.last_heartbeat < NOW() - INTERVAL '60 seconds' THEN 'offline'
            ELSE 'online'
        END,
        EXTRACT(EPOCH FROM (NOW() - n.last_heartbeat))::BIGINT
    FROM nodes n
    WHERE n.last_heartbeat < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql;

-- 디바이스 connection_status 일괄 업데이트 함수
CREATE OR REPLACE FUNCTION refresh_device_connections()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE devices SET
        connection_status = CASE 
            WHEN last_seen >= NOW() - INTERVAL '30 seconds' THEN 'connected'
            ELSE 'disconnected'
        END
    WHERE connection_status != CASE 
        WHEN last_seen >= NOW() - INTERVAL '30 seconds' THEN 'connected'
        ELSE 'disconnected'
    END;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART F: SEED DATA (테스트용 600대 디바이스)
-- ============================================================

-- 기존 device_001 ~ device_040을 유지하고, 추가 디바이스는 필요 시 생성
-- 600대 = 5개 노드 × 120대/노드

-- 노드 5개 생성 (Phase 2용)
INSERT INTO nodes (node_id, name, base_url, status, capacity, ip_address) VALUES
    ('node_02', 'WorkStation-Beta', 'http://192.168.1.102:8080', 'offline', 120, '192.168.1.102'),
    ('node_03', 'WorkStation-Gamma', 'http://192.168.1.103:8080', 'offline', 120, '192.168.1.103'),
    ('node_04', 'WorkStation-Delta', 'http://192.168.1.104:8080', 'offline', 120, '192.168.1.104'),
    ('node_05', 'WorkStation-Epsilon', 'http://192.168.1.105:8080', 'offline', 120, '192.168.1.105')
ON CONFLICT (node_id) DO NOTHING;

-- 각 노드에 120대 디바이스 생성 (총 600대)
DO $$
DECLARE
    node_ids TEXT[] := ARRAY['node_01', 'node_02', 'node_03', 'node_04', 'node_05'];
    node_id TEXT;
    i INTEGER;
    device_num INTEGER := 1;
BEGIN
    FOREACH node_id IN ARRAY node_ids LOOP
        FOR i IN 1..120 LOOP
            INSERT INTO devices (
                device_id, 
                laixi_id, 
                node_id, 
                slot_number, 
                model, 
                status,
                work_status,
                connection_status
            )
            VALUES (
                'device_' || LPAD(device_num::text, 3, '0'),
                'laixi_' || LPAD(device_num::text, 3, '0'),
                node_id,
                i,
                'Galaxy S9',
                'offline',
                'idle',
                'disconnected'
            )
            ON CONFLICT (device_id) DO NOTHING;
            
            device_num := device_num + 1;
        END LOOP;
    END LOOP;
END;
$$;

-- ============================================================
-- END OF MIGRATION 007
-- ============================================================


