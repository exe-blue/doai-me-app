-- =====================================================
-- Migration 001: 디바이스 계층 구조
-- 
-- 목적: 폰보드-슬롯 기반 디바이스 관리 체계 구축
-- 구조: 워크스테이션 → 폰보드 → 디바이스(슬롯)
-- 
-- 명명 규칙:
--   워크스테이션: WS01, WS02, ... WS05
--   폰보드: WS01-PB01, WS01-PB02, WS01-PB03
--   디바이스: WS01-PB01-S01 ~ WS01-PB01-S20
-- 
-- 총 기기 수: 5 워크스테이션 × 3 폰보드 × 20 슬롯 = 300대
-- =====================================================

-- UUID 확장 (이미 존재하면 무시)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 워크스테이션 테이블
-- 워크스테이션 = Laixi가 실행되는 PC
-- =====================================================
CREATE TABLE IF NOT EXISTS workstations (
    id VARCHAR(10) PRIMARY KEY,  -- WS01, WS02...
    name VARCHAR(100) NOT NULL,
    
    -- 네트워크 정보
    ip_address VARCHAR(45),
    tailscale_ip VARCHAR(45),
    vlan_id INTEGER CHECK (vlan_id >= 1 AND vlan_id <= 10),
    
    -- Laixi 연결 정보
    laixi_port INTEGER DEFAULT 22221,
    laixi_connected BOOLEAN DEFAULT FALSE,
    
    -- 상태
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'maintenance')),
    
    -- 용량
    max_phoneboards INTEGER DEFAULT 3,
    connected_phoneboards INTEGER DEFAULT 0,
    total_devices INTEGER DEFAULT 0,
    online_devices INTEGER DEFAULT 0,
    
    -- 타임스탬프
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE workstations IS '워크스테이션 (Laixi 실행 PC)';
COMMENT ON COLUMN workstations.vlan_id IS 'VLAN 그룹 (1-6)';

-- =====================================================
-- 2. 폰보드 테이블
-- 폰보드 = 20대의 Galaxy S9이 장착된 보드
-- =====================================================
CREATE TABLE IF NOT EXISTS phoneboards (
    id VARCHAR(20) PRIMARY KEY,  -- WS01-PB01, WS01-PB02...
    workstation_id VARCHAR(10) NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
    board_number INTEGER NOT NULL CHECK (board_number >= 1 AND board_number <= 10),
    
    -- 용량
    slot_count INTEGER DEFAULT 20 CHECK (slot_count >= 1 AND slot_count <= 30),
    connected_count INTEGER DEFAULT 0,
    
    -- 상태
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'partial', 'error')),
    error_message TEXT,
    
    -- USB 허브 정보
    usb_hub_serial VARCHAR(100),
    usb_port_start INTEGER,
    usb_port_end INTEGER,
    
    -- 타임스탬프
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 워크스테이션 내 고유성
    UNIQUE (workstation_id, board_number)
);

COMMENT ON TABLE phoneboards IS '폰보드 (20대 슬롯 보드)';
COMMENT ON COLUMN phoneboards.status IS 'partial = 일부 슬롯만 연결됨';

-- =====================================================
-- 3. devices 테이블 확장
-- 기존 테이블에 계층 구조 컬럼 추가
-- =====================================================

-- 워크스테이션/폰보드 참조 컬럼 추가
ALTER TABLE devices ADD COLUMN IF NOT EXISTS workstation_id VARCHAR(10) REFERENCES workstations(id) ON DELETE SET NULL;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS phoneboard_id VARCHAR(20) REFERENCES phoneboards(id) ON DELETE SET NULL;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 30);

-- 계층 ID (WS01-PB01-S05 형식)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS hierarchy_id VARCHAR(30) UNIQUE;

-- 디바이스 그룹 (배치 실행 시 그룹 구분용)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_group VARCHAR(10) CHECK (device_group IN ('A', 'B'));

-- 마지막 명령 정보
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_command VARCHAR(100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_command_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_command_result VARCHAR(20);

-- =====================================================
-- 4. 워크로드 테이블
-- 영상 리스팅 → 명령 → 결과 기록 → 대기 사이클 관리
-- =====================================================
CREATE TABLE IF NOT EXISTS workloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200),
    
    -- 대상 영상들
    video_ids UUID[] NOT NULL,
    current_video_index INTEGER DEFAULT 0,
    
    -- 배치 설정
    batch_size_percent INTEGER DEFAULT 50 CHECK (batch_size_percent > 0 AND batch_size_percent <= 100),
    batch_interval_seconds INTEGER DEFAULT 60,  -- 배치 간 대기 시간
    cycle_interval_seconds INTEGER DEFAULT 300, -- 사이클 간 대기 시간
    
    -- 대상 워크스테이션 (null = 전체)
    target_workstations VARCHAR(10)[],
    
    -- 상태
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',    -- 대기
        'listing',    -- 영상 리스팅 중
        'executing',  -- 명령 실행 중
        'recording',  -- 결과 기록 중
        'waiting',    -- 다음 사이클 대기
        'paused',     -- 일시 정지
        'completed',  -- 완료
        'cancelled',  -- 취소
        'error'       -- 오류
    )),
    
    -- 진행률
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    current_batch INTEGER DEFAULT 0,
    total_batches INTEGER DEFAULT 0,
    
    -- 타임스탬프
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_cycle_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타
    created_by UUID REFERENCES api_keys(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE workloads IS '워크로드 (영상 시청 작업 배치)';
COMMENT ON COLUMN workloads.batch_size_percent IS '한 번에 실행할 기기 비율 (50% = 절반씩 2회)';

-- =====================================================
-- 5. 워크로드 실행 로그 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS workload_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workload_id UUID NOT NULL REFERENCES workloads(id) ON DELETE CASCADE,
    
    -- 로그 정보
    level VARCHAR(10) DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    
    -- 컨텍스트
    video_id UUID,
    device_id UUID,
    batch_number INTEGER,
    
    -- 메타
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE workload_logs IS '워크로드 실행 로그';

-- =====================================================
-- 6. 명령 히스토리 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS command_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 대상
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    device_hierarchy_id VARCHAR(30),  -- 디바이스 삭제 후에도 기록 유지
    workstation_id VARCHAR(10),
    
    -- 명령 정보
    command_type VARCHAR(50) NOT NULL,  -- watch, tap, swipe, adb, etc.
    command_data JSONB NOT NULL,
    
    -- 결과
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'success', 'failed', 'timeout')),
    result_data JSONB,
    error_message TEXT,
    
    -- 워크로드 연결 (있는 경우)
    workload_id UUID REFERENCES workloads(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- 타임스탬프
    sent_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE command_history IS '명령 실행 히스토리';

-- =====================================================
-- 인덱스
-- =====================================================

-- workstations
CREATE INDEX IF NOT EXISTS idx_workstations_status ON workstations(status);
CREATE INDEX IF NOT EXISTS idx_workstations_vlan ON workstations(vlan_id);

-- phoneboards
CREATE INDEX IF NOT EXISTS idx_phoneboards_workstation ON phoneboards(workstation_id);
CREATE INDEX IF NOT EXISTS idx_phoneboards_status ON phoneboards(status);

-- devices (새 컬럼)
CREATE INDEX IF NOT EXISTS idx_devices_workstation ON devices(workstation_id);
CREATE INDEX IF NOT EXISTS idx_devices_phoneboard ON devices(phoneboard_id);
CREATE INDEX IF NOT EXISTS idx_devices_hierarchy ON devices(hierarchy_id);
CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(device_group);

-- workloads
CREATE INDEX IF NOT EXISTS idx_workloads_status ON workloads(status);
CREATE INDEX IF NOT EXISTS idx_workloads_scheduled ON workloads(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workloads_active ON workloads(status) WHERE status IN ('listing', 'executing', 'recording', 'waiting');

-- workload_logs
CREATE INDEX IF NOT EXISTS idx_workload_logs_workload ON workload_logs(workload_id);
CREATE INDEX IF NOT EXISTS idx_workload_logs_created ON workload_logs(created_at DESC);

-- command_history
CREATE INDEX IF NOT EXISTS idx_command_history_device ON command_history(device_id);
CREATE INDEX IF NOT EXISTS idx_command_history_workload ON command_history(workload_id);
CREATE INDEX IF NOT EXISTS idx_command_history_created ON command_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_type_status ON command_history(command_type, status);

-- =====================================================
-- 트리거
-- =====================================================

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS workstations_updated_at ON workstations;
CREATE TRIGGER workstations_updated_at
    BEFORE UPDATE ON workstations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS phoneboards_updated_at ON phoneboards;
CREATE TRIGGER phoneboards_updated_at
    BEFORE UPDATE ON phoneboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS workloads_updated_at ON workloads;
CREATE TRIGGER workloads_updated_at
    BEFORE UPDATE ON workloads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 뷰
-- =====================================================

-- 워크스테이션 상태 요약
CREATE OR REPLACE VIEW workstation_status AS
SELECT 
    w.id,
    w.name,
    w.ip_address,
    w.vlan_id,
    w.status,
    w.laixi_connected,
    w.total_devices,
    w.online_devices,
    COUNT(DISTINCT pb.id) as phoneboard_count,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'idle') as idle_devices,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'busy') as busy_devices,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'error') as error_devices,
    w.last_heartbeat
FROM workstations w
LEFT JOIN phoneboards pb ON w.id = pb.workstation_id
LEFT JOIN devices d ON pb.id = d.phoneboard_id
GROUP BY w.id, w.name, w.ip_address, w.vlan_id, w.status, 
         w.laixi_connected, w.total_devices, w.online_devices, w.last_heartbeat;

-- 폰보드 상태 요약
CREATE OR REPLACE VIEW phoneboard_status AS
SELECT 
    pb.id,
    pb.workstation_id,
    pb.board_number,
    pb.slot_count,
    pb.status,
    COUNT(d.id) as total_devices,
    COUNT(d.id) FILTER (WHERE d.status = 'idle') as idle_devices,
    COUNT(d.id) FILTER (WHERE d.status = 'busy') as busy_devices,
    COUNT(d.id) FILTER (WHERE d.status = 'offline') as offline_devices,
    COUNT(d.id) FILTER (WHERE d.status = 'error') as error_devices,
    pb.last_heartbeat
FROM phoneboards pb
LEFT JOIN devices d ON pb.id = d.phoneboard_id
GROUP BY pb.id, pb.workstation_id, pb.board_number, pb.slot_count, pb.status, pb.last_heartbeat;

-- 워크로드 상태 요약
CREATE OR REPLACE VIEW workload_summary AS
SELECT 
    wl.id,
    wl.name,
    wl.status,
    array_length(wl.video_ids, 1) as video_count,
    wl.current_video_index,
    wl.batch_size_percent,
    wl.total_tasks,
    wl.completed_tasks,
    wl.failed_tasks,
    ROUND((wl.completed_tasks::float / NULLIF(wl.total_tasks, 0) * 100)::numeric, 1) as progress_percent,
    wl.current_batch,
    wl.total_batches,
    wl.started_at,
    wl.next_cycle_at,
    wl.created_at
FROM workloads wl;

-- =====================================================
-- 초기 데이터 (5개 워크스테이션, 각 3개 폰보드)
-- =====================================================

-- 워크스테이션 초기화
INSERT INTO workstations (id, name, vlan_id) VALUES
    ('WS01', '워크스테이션 01', 1),
    ('WS02', '워크스테이션 02', 2),
    ('WS03', '워크스테이션 03', 3),
    ('WS04', '워크스테이션 04', 4),
    ('WS05', '워크스테이션 05', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 폰보드 초기화 (워크스테이션당 3개)
INSERT INTO phoneboards (id, workstation_id, board_number) VALUES
    -- WS01
    ('WS01-PB01', 'WS01', 1),
    ('WS01-PB02', 'WS01', 2),
    ('WS01-PB03', 'WS01', 3),
    -- WS02
    ('WS02-PB01', 'WS02', 1),
    ('WS02-PB02', 'WS02', 2),
    ('WS02-PB03', 'WS02', 3),
    -- WS03
    ('WS03-PB01', 'WS03', 1),
    ('WS03-PB02', 'WS03', 2),
    ('WS03-PB03', 'WS03', 3),
    -- WS04
    ('WS04-PB01', 'WS04', 1),
    ('WS04-PB02', 'WS04', 2),
    ('WS04-PB03', 'WS04', 3),
    -- WS05
    ('WS05-PB01', 'WS05', 1),
    ('WS05-PB02', 'WS05', 2),
    ('WS05-PB03', 'WS05', 3)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 함수: 디바이스 hierarchy_id 자동 생성
-- =====================================================
CREATE OR REPLACE FUNCTION generate_device_hierarchy_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phoneboard_id IS NOT NULL AND NEW.slot_number IS NOT NULL THEN
        NEW.hierarchy_id := NEW.phoneboard_id || '-S' || LPAD(NEW.slot_number::text, 2, '0');
        NEW.workstation_id := SPLIT_PART(NEW.phoneboard_id, '-', 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS devices_hierarchy_id ON devices;
CREATE TRIGGER devices_hierarchy_id
    BEFORE INSERT OR UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION generate_device_hierarchy_id();

-- =====================================================
-- 함수: 디바이스 그룹 자동 할당 (A/B 교대)
-- =====================================================
CREATE OR REPLACE FUNCTION assign_device_group()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    IF NEW.device_group IS NULL AND NEW.phoneboard_id IS NOT NULL THEN
        -- 해당 폰보드의 기기 수 확인
        SELECT COUNT(*) INTO current_count 
        FROM devices 
        WHERE phoneboard_id = NEW.phoneboard_id;
        
        -- 홀수/짝수로 A/B 그룹 할당
        IF current_count % 2 = 0 THEN
            NEW.device_group := 'A';
        ELSE
            NEW.device_group := 'B';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS devices_group_assignment ON devices;
CREATE TRIGGER devices_group_assignment
    BEFORE INSERT ON devices
    FOR EACH ROW EXECUTE FUNCTION assign_device_group();
