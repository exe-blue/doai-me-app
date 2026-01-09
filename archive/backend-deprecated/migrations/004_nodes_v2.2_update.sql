-- ============================================================
-- DoAi.Me Database Migration: Nodes v2.2 Update
-- ============================================================
-- Author: Axon (Lead Builder)
-- Date: 2025.01.01
-- Description: 노드 테이블 v2.2 업데이트 - 물리 통제 및 집약적 관측 지표 추가
-- ============================================================

-- ⭐ v2.2: capacity 기본값 변경 (40 → 120)
ALTER TABLE nodes 
    ALTER COLUMN capacity SET DEFAULT 120;

-- ⭐ v2.2: 물리 통제 (Physical Control) 필드 추가
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS oob_ip INET,              -- PiKVM Out-of-Band IP
    ADD COLUMN IF NOT EXISTS pdu_slot INTEGER;         -- Smart PDU port number

COMMENT ON COLUMN nodes.oob_ip IS 'PiKVM Out-of-Band IP for remote KVM access';
COMMENT ON COLUMN nodes.pdu_slot IS 'Smart PDU port number for remote power control';

-- ⭐ v2.2: 집약적 관측 지표 (Aggregated Metrics) 필드 추가
ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS health_score DECIMAL(5,2) DEFAULT 0.00,         -- (online/capacity)*100
    ADD COLUMN IF NOT EXISTS usb_stability_index DECIMAL(5,2) DEFAULT 0.00,  -- reconnects per minute
    ADD COLUMN IF NOT EXISTS online_device_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN nodes.health_score IS '노드 건강도: (online_devices/capacity)*100';
COMMENT ON COLUMN nodes.usb_stability_index IS 'USB 안정성 지수: 분당 재연결 횟수 (낮을수록 좋음)';
COMMENT ON COLUMN nodes.online_device_count IS '온라인 디바이스 수 (캐시)';
COMMENT ON COLUMN nodes.metrics_updated_at IS '지표 마지막 업데이트 시각';

-- ⭐ v2.2: health_score 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_nodes_health ON nodes(health_score);

-- ============================================================
-- 노드 건강도 계산 함수
-- ============================================================
CREATE OR REPLACE FUNCTION update_node_health_score(p_node_id VARCHAR(50)) 
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_online INTEGER;
    v_capacity INTEGER;
    v_score DECIMAL(5,2);
BEGIN
    SELECT 
        COUNT(device_id) FILTER (WHERE status = 'online'),
        COALESCE(n.capacity, 120)
    INTO v_online, v_capacity
    FROM nodes n
    LEFT JOIN devices d ON d.node_id = n.node_id
    WHERE n.node_id = p_node_id
    GROUP BY n.node_id, n.capacity;
    
    IF v_capacity > 0 THEN
        v_score := (v_online::DECIMAL / v_capacity) * 100;
    ELSE
        v_score := 0.00;
    END IF;
    
    UPDATE nodes 
    SET 
        health_score = v_score,
        online_device_count = v_online,
        metrics_updated_at = NOW()
    WHERE node_id = p_node_id;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_node_health_score IS '노드의 health_score 및 online_device_count 업데이트';

-- ============================================================
-- 디바이스 상태 변경 시 노드 건강도 자동 업데이트 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_update_node_health() RETURNS TRIGGER AS $$
BEGIN
    -- 디바이스 상태가 변경되면 해당 노드의 건강도 재계산
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM update_node_health_score(NEW.node_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_status_health ON devices;
CREATE TRIGGER trg_device_status_health 
    AFTER UPDATE OF status ON devices 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_update_node_health();

-- ============================================================
-- v_node_dashboard 뷰 업데이트 (v2.2 필드 포함)
-- ============================================================
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
    -- ⭐ v2.2 필드
    n.health_score,
    n.usb_stability_index,
    n.online_device_count,
    n.oob_ip,
    n.pdu_slot,
    -- 계산된 디바이스 통계
    COUNT(d.device_id) AS total_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'online') AS online_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'busy') AS busy_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'offline') AS offline_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'error') AS error_devices,
    COUNT(d.device_id) FILTER (WHERE d.status = 'missing') AS missing_devices
FROM nodes n
LEFT JOIN devices d ON d.node_id = n.node_id
GROUP BY n.node_id;

-- ============================================================
-- 완료 메시지
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ 003_nodes_v2.2_update.sql 적용 완료';
    RAISE NOTICE '   - nodes.capacity 기본값: 120';
    RAISE NOTICE '   - nodes.oob_ip, pdu_slot 추가 (물리 통제)';
    RAISE NOTICE '   - nodes.health_score, usb_stability_index, online_device_count 추가';
    RAISE NOTICE '   - update_node_health_score() 함수 추가';
    RAISE NOTICE '   - trg_device_status_health 트리거 추가';
    RAISE NOTICE '   - v_node_dashboard 뷰 업데이트';
END;
$$;

