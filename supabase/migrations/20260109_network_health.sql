-- =============================================
-- 네트워크 헬스 모니터링 테이블
-- PR #3: 네트워크 헬스 대시보드
-- =============================================

-- 네트워크 상태 열거형
CREATE TYPE network_status AS ENUM ('healthy', 'warning', 'critical', 'down');
CREATE TYPE ap_status AS ENUM ('online', 'offline', 'overloaded', 'degraded');
CREATE TYPE dhcp_status AS ENUM ('normal', 'warning', 'critical', 'exhausted');

-- =============================================
-- VLAN 설정 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS vlan_configs (
    vlan_id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    subnet VARCHAR(20) NOT NULL,
    gateway VARCHAR(15) NOT NULL,
    dhcp_pool_start VARCHAR(15) NOT NULL,
    dhcp_pool_end VARCHAR(15) NOT NULL,
    dhcp_pool_size INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 VLAN 설정 삽입
INSERT INTO vlan_configs (vlan_id, name, subnet, gateway, dhcp_pool_start, dhcp_pool_end, dhcp_pool_size, description) VALUES
(1, 'VLAN-1-Management', '192.168.1.0/24', '192.168.1.1', '192.168.1.100', '192.168.1.200', 100, '관리 네트워크'),
(10, 'VLAN-10-Devices-A', '192.168.10.0/24', '192.168.10.1', '192.168.10.10', '192.168.10.250', 240, '디바이스 A 그룹'),
(20, 'VLAN-20-Devices-B', '192.168.20.0/24', '192.168.20.1', '192.168.20.10', '192.168.20.250', 240, '디바이스 B 그룹'),
(30, 'VLAN-30-Devices-C', '192.168.30.0/24', '192.168.30.1', '192.168.30.10', '192.168.30.250', 240, '디바이스 C 그룹'),
(40, 'VLAN-40-Workstations', '192.168.40.0/24', '192.168.40.1', '192.168.40.10', '192.168.40.50', 40, '워크스테이션'),
(50, 'VLAN-50-IoT', '192.168.50.0/24', '192.168.50.1', '192.168.50.10', '192.168.50.100', 90, 'IoT 디바이스')
ON CONFLICT (vlan_id) DO NOTHING;

-- =============================================
-- AP 설정 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS ap_configs (
    ap_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    ip_address VARCHAR(15) NOT NULL,
    location VARCHAR(100),
    max_clients INTEGER DEFAULT 50,
    supported_vlans INTEGER[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 AP 설정 삽입
INSERT INTO ap_configs (ap_id, name, mac_address, ip_address, location, max_clients, supported_vlans) VALUES
('ap-1', 'EAP-673-1', '00:11:22:33:44:01', '192.168.1.11', '서버실-A', 50, ARRAY[1, 10, 20]),
('ap-2', 'EAP-673-2', '00:11:22:33:44:02', '192.168.1.12', '서버실-B', 50, ARRAY[1, 10, 20]),
('ap-3', 'EAP-673-3', '00:11:22:33:44:03', '192.168.1.13', '작업실-A', 50, ARRAY[20, 30]),
('ap-4', 'EAP-673-4', '00:11:22:33:44:04', '192.168.1.14', '작업실-B', 50, ARRAY[20, 30]),
('ap-5', 'EAP-673-5', '00:11:22:33:44:05', '192.168.1.15', '작업실-C', 50, ARRAY[30, 40]),
('ap-6', 'EAP-673-6', '00:11:22:33:44:06', '192.168.1.16', '관리실', 50, ARRAY[40, 50])
ON CONFLICT (ap_id) DO NOTHING;

-- =============================================
-- VLAN 상태 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS vlan_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vlan_id INTEGER REFERENCES vlan_configs(vlan_id),
    status network_status DEFAULT 'healthy',
    total_devices INTEGER DEFAULT 0,
    online_devices INTEGER DEFAULT 0,
    offline_devices INTEGER DEFAULT 0,
    dhcp_used INTEGER DEFAULT 0,
    dhcp_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    bytes_in BIGINT,
    bytes_out BIGINT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- VLAN 상태 인덱스
CREATE INDEX IF NOT EXISTS idx_vlan_statuses_vlan_id ON vlan_statuses(vlan_id);
CREATE INDEX IF NOT EXISTS idx_vlan_statuses_recorded_at ON vlan_statuses(recorded_at DESC);

-- =============================================
-- AP 상태 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS ap_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_id VARCHAR(50) REFERENCES ap_configs(ap_id),
    status ap_status DEFAULT 'online',
    connected_clients INTEGER DEFAULT 0,
    client_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    channel INTEGER,
    signal_strength_dbm INTEGER,
    noise_floor_dbm INTEGER,
    tx_bytes BIGINT,
    rx_bytes BIGINT,
    tx_packets BIGINT,
    rx_packets BIGINT,
    tx_errors INTEGER DEFAULT 0,
    rx_errors INTEGER DEFAULT 0,
    uptime_seconds INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- AP 상태 인덱스
CREATE INDEX IF NOT EXISTS idx_ap_statuses_ap_id ON ap_statuses(ap_id);
CREATE INDEX IF NOT EXISTS idx_ap_statuses_recorded_at ON ap_statuses(recorded_at DESC);

-- =============================================
-- DHCP 풀 상태 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS dhcp_pool_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vlan_id INTEGER REFERENCES vlan_configs(vlan_id),
    status dhcp_status DEFAULT 'normal',
    pool_size INTEGER NOT NULL,
    used_addresses INTEGER DEFAULT 0,
    available_addresses INTEGER DEFAULT 0,
    usage_percent DECIMAL(5,2) DEFAULT 0.0,
    active_leases INTEGER DEFAULT 0,
    expired_leases INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- DHCP 상태 인덱스
CREATE INDEX IF NOT EXISTS idx_dhcp_pool_statuses_vlan_id ON dhcp_pool_statuses(vlan_id);
CREATE INDEX IF NOT EXISTS idx_dhcp_pool_statuses_recorded_at ON dhcp_pool_statuses(recorded_at DESC);

-- =============================================
-- 네트워크 헬스 스냅샷 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS network_health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    overall_status network_status DEFAULT 'healthy',
    total_devices INTEGER DEFAULT 0,
    online_devices INTEGER DEFAULT 0,
    offline_devices INTEGER DEFAULT 0,
    total_vlans INTEGER DEFAULT 0,
    healthy_vlans INTEGER DEFAULT 0,
    warning_vlans INTEGER DEFAULT 0,
    critical_vlans INTEGER DEFAULT 0,
    total_aps INTEGER DEFAULT 0,
    online_aps INTEGER DEFAULT 0,
    offline_aps INTEGER DEFAULT 0,
    overloaded_aps INTEGER DEFAULT 0,
    vlan_data JSONB DEFAULT '{}',
    ap_data JSONB DEFAULT '{}',
    dhcp_data JSONB DEFAULT '{}',
    issues TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 스냅샷 인덱스
CREATE INDEX IF NOT EXISTS idx_network_health_snapshots_status ON network_health_snapshots(overall_status);
CREATE INDEX IF NOT EXISTS idx_network_health_snapshots_created_at ON network_health_snapshots(created_at DESC);

-- =============================================
-- 네트워크 알림 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS network_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림 인덱스
CREATE INDEX IF NOT EXISTS idx_network_alerts_type ON network_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_network_alerts_severity ON network_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_network_alerts_acknowledged ON network_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_network_alerts_created_at ON network_alerts(created_at DESC);

-- =============================================
-- 디바이스 네트워크 정보 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS device_network_info (
    device_id UUID PRIMARY KEY,
    ip_address VARCHAR(15),
    mac_address VARCHAR(17),
    vlan_id INTEGER REFERENCES vlan_configs(vlan_id),
    ap_id VARCHAR(50) REFERENCES ap_configs(ap_id),
    is_connected BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 디바이스 네트워크 정보 인덱스
CREATE INDEX IF NOT EXISTS idx_device_network_info_vlan ON device_network_info(vlan_id);
CREATE INDEX IF NOT EXISTS idx_device_network_info_ap ON device_network_info(ap_id);
CREATE INDEX IF NOT EXISTS idx_device_network_info_connected ON device_network_info(is_connected);

-- =============================================
-- RPC 함수: VLAN별 디바이스 분포 조회
-- =============================================
CREATE OR REPLACE FUNCTION get_vlan_device_distribution()
RETURNS TABLE (
    vlan_id INTEGER,
    vlan_name VARCHAR,
    device_count BIGINT,
    percentage DECIMAL
) AS $$
DECLARE
    total_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_count FROM device_network_info WHERE is_connected = TRUE;

    RETURN QUERY
    SELECT
        vc.vlan_id,
        vc.name,
        COUNT(dni.device_id) as device_count,
        CASE
            WHEN total_count > 0 THEN ROUND((COUNT(dni.device_id)::DECIMAL / total_count) * 100, 2)
            ELSE 0
        END as percentage
    FROM vlan_configs vc
    LEFT JOIN device_network_info dni ON vc.vlan_id = dni.vlan_id AND dni.is_connected = TRUE
    GROUP BY vc.vlan_id, vc.name
    ORDER BY device_count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RPC 함수: AP별 클라이언트 분포 조회
-- =============================================
CREATE OR REPLACE FUNCTION get_ap_client_distribution()
RETURNS TABLE (
    ap_id VARCHAR,
    ap_name VARCHAR,
    location VARCHAR,
    connected_clients BIGINT,
    max_clients INTEGER,
    usage_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ac.ap_id,
        ac.name,
        ac.location,
        COUNT(dni.device_id) as connected_clients,
        ac.max_clients,
        CASE
            WHEN ac.max_clients > 0 THEN ROUND((COUNT(dni.device_id)::DECIMAL / ac.max_clients) * 100, 2)
            ELSE 0
        END as usage_percent
    FROM ap_configs ac
    LEFT JOIN device_network_info dni ON ac.ap_id = dni.ap_id AND dni.is_connected = TRUE
    GROUP BY ac.ap_id, ac.name, ac.location, ac.max_clients
    ORDER BY connected_clients DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RPC 함수: 네트워크 헬스 요약 조회
-- =============================================
CREATE OR REPLACE FUNCTION get_network_health_summary()
RETURNS TABLE (
    overall_status network_status,
    total_devices BIGINT,
    online_devices BIGINT,
    offline_devices BIGINT,
    vlan_count BIGINT,
    ap_online_count BIGINT,
    ap_offline_count BIGINT,
    dhcp_warning_count BIGINT,
    issues TEXT[]
) AS $$
DECLARE
    latest_snapshot network_health_snapshots%ROWTYPE;
BEGIN
    SELECT * INTO latest_snapshot
    FROM network_health_snapshots
    ORDER BY created_at DESC
    LIMIT 1;

    IF latest_snapshot IS NULL THEN
        RETURN QUERY SELECT
            'healthy'::network_status,
            0::BIGINT, 0::BIGINT, 0::BIGINT,
            0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT,
            ARRAY[]::TEXT[];
    ELSE
        RETURN QUERY SELECT
            latest_snapshot.overall_status,
            latest_snapshot.total_devices::BIGINT,
            latest_snapshot.online_devices::BIGINT,
            latest_snapshot.offline_devices::BIGINT,
            latest_snapshot.total_vlans::BIGINT,
            latest_snapshot.online_aps::BIGINT,
            latest_snapshot.offline_aps::BIGINT,
            latest_snapshot.warning_vlans::BIGINT + latest_snapshot.critical_vlans::BIGINT,
            latest_snapshot.issues;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 자동 updated_at 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_network_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vlan_configs_updated_at
    BEFORE UPDATE ON vlan_configs
    FOR EACH ROW EXECUTE FUNCTION update_network_updated_at();

CREATE TRIGGER trigger_ap_configs_updated_at
    BEFORE UPDATE ON ap_configs
    FOR EACH ROW EXECUTE FUNCTION update_network_updated_at();

CREATE TRIGGER trigger_device_network_info_updated_at
    BEFORE UPDATE ON device_network_info
    FOR EACH ROW EXECUTE FUNCTION update_network_updated_at();

-- =============================================
-- 데이터 정리 정책 (30일 이상 데이터 삭제)
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_old_network_data()
RETURNS void AS $$
BEGIN
    DELETE FROM vlan_statuses WHERE recorded_at < NOW() - INTERVAL '30 days';
    DELETE FROM ap_statuses WHERE recorded_at < NOW() - INTERVAL '30 days';
    DELETE FROM dhcp_pool_statuses WHERE recorded_at < NOW() - INTERVAL '30 days';
    DELETE FROM network_health_snapshots WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM network_alerts WHERE created_at < NOW() - INTERVAL '30 days' AND acknowledged = TRUE;
END;
$$ LANGUAGE plpgsql;
