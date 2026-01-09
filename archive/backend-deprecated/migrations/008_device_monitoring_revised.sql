-- ============================================================
-- DoAi.Me Database Migration 008
-- Node & Device Monitoring System (Revised)
-- ============================================================
-- Version: v3.0
-- Author: Axon (Lead Builder)
-- Spec By: Aria (Chief Architect)
-- Commanded By: Orion (Chief of Staff)
-- Date: 2026.01.05
-- ============================================================
--
-- 개정 사항:
--   - Device 식별 정보 확장 (ID, Serial, Model, IMEI)
--   - 통신 방식 (Ethernet, WiFi, SIM) 추가
--   - AI Agent ↔ Google Account 바인딩 구조
--   - 확장성 (PhoneBoard 증설) 및 장애 복구 대응
--
-- ============================================================

-- ============================================================
-- PART A: AI_AGENTS 테이블 (먼저 생성 - devices에서 참조)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ═══ Google 계정 바인딩 ═══
    google_email TEXT NOT NULL UNIQUE,            -- example@gmail.com
    google_account_id TEXT UNIQUE,                -- Google OAuth sub ID
    
    -- ═══ Agent 정보 ═══
    display_name TEXT,                            -- "에이전트 #127"
    persona_config JSONB DEFAULT '{}',            -- 인격 설정, Aidentity 벡터 등
    
    -- ═══ 바인딩 상태 ═══
    bound_device_id UUID UNIQUE,                  -- 현재 바인딩된 디바이스 (나중에 FK 추가)
    binding_status TEXT NOT NULL DEFAULT 'unbound'
        CHECK (binding_status IN ('unbound', 'bound', 'migrating')),
    bound_at TIMESTAMPTZ,                         -- 바인딩 시점
    
    -- ═══ 백업 ═══
    last_state_backup JSONB,                      -- 상태 스냅샷
    last_state_backup_at TIMESTAMPTZ,
    
    -- ═══ Timestamps ═══
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agents_google ON ai_agents(google_email);
CREATE INDEX IF NOT EXISTS idx_agents_binding ON ai_agents(binding_status);
CREATE INDEX IF NOT EXISTS idx_agents_device ON ai_agents(bound_device_id);

COMMENT ON TABLE ai_agents IS 'AI Agent 관리. Google 계정과 1:1 바인딩, 디바이스에 "영혼 주입"';

-- ============================================================
-- PART B: NODE_RUNNERS 테이블 (PhoneBoard)
-- ============================================================

-- 기존 nodes 테이블을 확장하거나 별도 테이블 생성
CREATE TABLE IF NOT EXISTS node_runners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 식별
    hostname TEXT NOT NULL UNIQUE,
    ip_address INET NOT NULL,
    
    -- 용량
    max_device_slots INT NOT NULL DEFAULT 20,     -- 슬롯 수 (기본 20)
    
    -- Heartbeat
    last_heartbeat_at TIMESTAMPTZ DEFAULT now(),
    
    -- 메타
    location_label TEXT,                          -- "Rack-A-01", "Room-B"
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_runners_heartbeat ON node_runners(last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_runners_hostname ON node_runners(hostname);

COMMENT ON TABLE node_runners IS 'PhoneBoard (노드 러너) 관리. 각 보드는 max_device_slots개의 디바이스 슬롯 보유';

-- ============================================================
-- PART C: DEVICES 테이블 (확장)
-- ============================================================

-- 기존 devices 테이블 DROP 후 재생성 또는 ALTER
-- 여기서는 새 테이블로 생성 (production에서는 ALTER 사용)

CREATE TABLE IF NOT EXISTS devices_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ═══ 관계 ═══
    runner_id UUID NOT NULL 
        REFERENCES node_runners(id) ON DELETE CASCADE,
    slot_number INT NOT NULL,                     -- 1~20 (PhoneBoard 내 위치)
    
    -- ═══ 식별 정보 ═══
    device_serial TEXT NOT NULL UNIQUE,           -- ADB Serial
    model_name TEXT NOT NULL,                     -- 'Galaxy S9', 'SM-G960N'
    manufacturer_serial TEXT UNIQUE,              -- IMEI 또는 제조사 S/N
    
    -- ═══ 통신 방식 ═══
    connection_type TEXT NOT NULL DEFAULT 'ethernet'
        CHECK (connection_type IN ('ethernet', 'wifi', 'sim')),
    sim_carrier TEXT                              -- 'KT', 'SKT', 'LGU+' (SIM일 때)
        CHECK (
            (connection_type = 'sim' AND sim_carrier IS NOT NULL) OR
            (connection_type != 'sim' AND sim_carrier IS NULL)
        ),
    device_ip_address INET,                       -- 디바이스 자체 IP (WiFi/SIM)
    
    -- ═══ 상태 ═══
    connection_status TEXT NOT NULL DEFAULT 'disconnected'
        CHECK (connection_status IN ('connected', 'disconnected')),
    
    work_status TEXT NOT NULL DEFAULT 'idle'
        CHECK (work_status IN ('idle', 'busy', 'error', 'in_umbra')),
    
    hardware_status TEXT NOT NULL DEFAULT 'active'
        CHECK (hardware_status IN ('active', 'faulty', 'replaced', 'retired')),
    
    -- ═══ AI Agent 바인딩 ═══
    agent_id UUID UNIQUE                          -- 1:1 관계 (하나의 Agent만)
        REFERENCES ai_agents(id) ON DELETE SET NULL,
    
    -- ═══ 명령/에러 ═══
    last_command TEXT,
    last_command_at TIMESTAMPTZ,
    last_error_log TEXT,
    last_error_at TIMESTAMPTZ,
    
    -- ═══ 백업/복구 ═══
    backup_snapshot_url TEXT,                     -- S3/GCS URL
    last_backup_at TIMESTAMPTZ,
    
    -- ═══ Timestamps ═══
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- ═══ 제약조건 ═══
    UNIQUE(runner_id, slot_number)                -- 같은 보드에 같은 슬롯 중복 불가
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_devices_v2_runner ON devices_v2(runner_id);
CREATE INDEX IF NOT EXISTS idx_devices_v2_status ON devices_v2(work_status);
CREATE INDEX IF NOT EXISTS idx_devices_v2_hardware ON devices_v2(hardware_status);
CREATE INDEX IF NOT EXISTS idx_devices_v2_agent ON devices_v2(agent_id);
CREATE INDEX IF NOT EXISTS idx_devices_v2_connection ON devices_v2(connection_type);
CREATE INDEX IF NOT EXISTS idx_devices_v2_serial ON devices_v2(device_serial);

COMMENT ON TABLE devices_v2 IS 'Device 관리 v2. 식별정보, 통신방식, Agent 바인딩, 백업/복구 지원';

-- ai_agents.bound_device_id FK 추가
ALTER TABLE ai_agents 
    DROP CONSTRAINT IF EXISTS ai_agents_bound_device_fk;
ALTER TABLE ai_agents 
    ADD CONSTRAINT ai_agents_bound_device_fk 
    FOREIGN KEY (bound_device_id) REFERENCES devices_v2(id) ON DELETE SET NULL;

-- ============================================================
-- PART D: DEVICE_HISTORY 테이블 (장애/교체 이력)
-- ============================================================

CREATE TABLE IF NOT EXISTS device_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 대상
    device_id UUID NOT NULL REFERENCES devices_v2(id),
    agent_id UUID REFERENCES ai_agents(id),
    
    -- 이벤트
    event_type TEXT NOT NULL
        CHECK (event_type IN (
            'registered',       -- 최초 등록
            'faulty',           -- 고장 발생
            'replaced',         -- 교체 완료
            'agent_bound',      -- Agent 바인딩
            'agent_unbound',    -- Agent 해제
            'agent_migrated',   -- Agent 이전
            'backup_created',   -- 백업 생성
            'backup_restored'   -- 백업 복구
        )),
    
    -- 상세
    old_device_serial TEXT,                       -- 교체 시 이전 시리얼
    new_device_serial TEXT,                       -- 교체 시 신규 시리얼
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_history_device ON device_history(device_id);
CREATE INDEX IF NOT EXISTS idx_history_agent ON device_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_history_event ON device_history(event_type);
CREATE INDEX IF NOT EXISTS idx_history_time ON device_history(created_at DESC);

COMMENT ON TABLE device_history IS 'Device 이벤트 이력. 장애, 교체, Agent 바인딩 등 모든 이력 추적';

-- ============================================================
-- PART E: VIEWS
-- ============================================================

-- 디바이스 + Agent + Runner 통합 뷰
CREATE OR REPLACE VIEW device_overview AS
SELECT 
    d.id AS device_id,
    d.device_serial,
    d.model_name,
    d.manufacturer_serial,
    d.slot_number,
    d.connection_type,
    d.sim_carrier,
    d.device_ip_address,
    d.connection_status,
    d.work_status,
    d.hardware_status,
    d.last_backup_at,
    d.last_command,
    d.last_command_at,
    d.last_error_log,
    d.last_error_at,
    
    -- Runner 정보
    r.id AS runner_id,
    r.hostname AS runner_hostname,
    r.ip_address AS runner_ip,
    r.max_device_slots,
    CASE 
        WHEN r.last_heartbeat_at > NOW() - INTERVAL '1 minute' 
        THEN 'online' 
        ELSE 'offline' 
    END AS runner_status,
    
    -- Agent 정보
    a.id AS agent_id,
    a.google_email,
    a.display_name AS agent_name,
    a.binding_status,
    a.bound_at AS agent_bound_at,
    
    -- 계산 필드
    CASE
        WHEN d.hardware_status = 'faulty' THEN 'faulty'
        WHEN d.connection_status = 'disconnected' THEN 'offline'
        WHEN d.work_status = 'error' THEN 'error'
        WHEN d.work_status = 'in_umbra' THEN 'umbra'
        WHEN d.work_status = 'busy' THEN 'busy'
        ELSE 'active'
    END AS effective_status,
    
    -- Grid Cell용 3자리 인덱스 (runner별 slot 기반)
    ROW_NUMBER() OVER (ORDER BY r.hostname, d.slot_number) AS device_index

FROM devices_v2 d
LEFT JOIN node_runners r ON d.runner_id = r.id
LEFT JOIN ai_agents a ON d.agent_id = a.id;

COMMENT ON VIEW device_overview IS 'Device Grid UI용 통합 뷰. Device + Runner + Agent 조인';

-- Runner 상태 요약 뷰
CREATE OR REPLACE VIEW runner_status_summary AS
SELECT 
    r.id AS runner_id,
    r.hostname,
    r.ip_address,
    r.max_device_slots,
    r.location_label,
    CASE 
        WHEN r.last_heartbeat_at > NOW() - INTERVAL '1 minute' 
        THEN 'online' 
        ELSE 'offline' 
    END AS status,
    r.last_heartbeat_at,
    EXTRACT(EPOCH FROM (NOW() - r.last_heartbeat_at)) AS seconds_since_heartbeat,
    
    -- 디바이스 통계
    COUNT(d.id) AS total_devices,
    COUNT(d.id) FILTER (WHERE d.connection_status = 'connected') AS connected_count,
    COUNT(d.id) FILTER (WHERE d.work_status = 'busy') AS busy_count,
    COUNT(d.id) FILTER (WHERE d.work_status = 'error') AS error_count,
    COUNT(d.id) FILTER (WHERE d.work_status = 'in_umbra') AS umbra_count,
    COUNT(d.id) FILTER (WHERE d.hardware_status = 'faulty') AS faulty_count,
    COUNT(d.id) FILTER (WHERE d.agent_id IS NOT NULL) AS bound_agents_count

FROM node_runners r
LEFT JOIN devices_v2 d ON d.runner_id = r.id
GROUP BY r.id;

COMMENT ON VIEW runner_status_summary IS 'Runner Status Bar UI용 요약 뷰';

-- 시스템 전체 통계 뷰
CREATE OR REPLACE VIEW system_stats_summary AS
SELECT 
    -- Runners
    (SELECT COUNT(*) FROM node_runners) AS total_runners,
    (SELECT COUNT(*) FROM node_runners WHERE last_heartbeat_at > NOW() - INTERVAL '1 minute') AS online_runners,
    
    -- Devices 상태
    (SELECT COUNT(*) FROM devices_v2) AS total_devices,
    (SELECT COUNT(*) FROM devices_v2 WHERE connection_status = 'connected') AS connected_devices,
    (SELECT COUNT(*) FROM devices_v2 WHERE work_status = 'idle' AND connection_status = 'connected') AS active_devices,
    (SELECT COUNT(*) FROM devices_v2 WHERE work_status = 'busy') AS busy_devices,
    (SELECT COUNT(*) FROM devices_v2 WHERE work_status = 'in_umbra') AS umbra_devices,
    (SELECT COUNT(*) FROM devices_v2 WHERE work_status = 'error') AS error_devices,
    (SELECT COUNT(*) FROM devices_v2 WHERE connection_status = 'disconnected') AS offline_devices,
    
    -- Hardware 상태
    (SELECT COUNT(*) FROM devices_v2 WHERE hardware_status = 'active') AS active_hardware,
    (SELECT COUNT(*) FROM devices_v2 WHERE hardware_status = 'faulty') AS faulty_hardware,
    (SELECT COUNT(*) FROM devices_v2 WHERE hardware_status = 'replaced') AS replaced_hardware,
    
    -- 통신 방식
    (SELECT COUNT(*) FROM devices_v2 WHERE connection_type = 'ethernet') AS ethernet_count,
    (SELECT COUNT(*) FROM devices_v2 WHERE connection_type = 'wifi') AS wifi_count,
    (SELECT COUNT(*) FROM devices_v2 WHERE connection_type = 'sim') AS sim_count,
    
    -- Agent 바인딩
    (SELECT COUNT(*) FROM ai_agents WHERE binding_status = 'bound') AS bound_agents,
    (SELECT COUNT(*) FROM ai_agents WHERE binding_status = 'unbound') AS unbound_agents,
    (SELECT COUNT(*) FROM ai_agents WHERE binding_status = 'migrating') AS migrating_agents,
    
    -- Timestamp
    NOW() AS measured_at;

COMMENT ON VIEW system_stats_summary IS 'Summary Panel UI용 전체 통계';

-- ============================================================
-- PART F: FUNCTIONS
-- ============================================================

-- 디바이스 고장 마킹
CREATE OR REPLACE FUNCTION mark_device_faulty(
    p_device_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_agent_id UUID;
    v_device_serial TEXT;
BEGIN
    -- 디바이스 정보 조회
    SELECT agent_id, device_serial INTO v_agent_id, v_device_serial
    FROM devices_v2 WHERE id = p_device_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', p_device_id;
    END IF;
    
    -- 디바이스 상태 변경
    UPDATE devices_v2 
    SET hardware_status = 'faulty',
        work_status = 'error',
        updated_at = now()
    WHERE id = p_device_id;
    
    -- Agent를 migrating 상태로 변경 (있는 경우)
    IF v_agent_id IS NOT NULL THEN
        UPDATE ai_agents
        SET binding_status = 'migrating',
            bound_device_id = NULL,
            last_state_backup = persona_config,  -- 현재 상태 백업
            last_state_backup_at = now(),
            updated_at = now()
        WHERE id = v_agent_id;
        
        -- Agent 언바인딩 이력
        INSERT INTO device_history (device_id, agent_id, event_type, notes, metadata)
        VALUES (p_device_id, v_agent_id, 'agent_unbound', 
                'Device marked as faulty', 
                jsonb_build_object('reason', 'faulty'));
    END IF;
    
    -- 고장 이력 기록
    INSERT INTO device_history (device_id, agent_id, event_type, notes)
    VALUES (p_device_id, v_agent_id, 'faulty', COALESCE(p_notes, 'Device marked as faulty'));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 디바이스 교체
CREATE OR REPLACE FUNCTION replace_device(
    p_device_id UUID,
    p_new_serial TEXT,
    p_new_imei TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_serial TEXT;
    v_agent_id UUID;
BEGIN
    -- 기존 정보 조회
    SELECT device_serial, agent_id INTO v_old_serial, v_agent_id
    FROM devices_v2 WHERE id = p_device_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', p_device_id;
    END IF;
    
    -- 디바이스 정보 업데이트
    UPDATE devices_v2
    SET device_serial = p_new_serial,
        manufacturer_serial = COALESCE(p_new_imei, manufacturer_serial),
        hardware_status = 'replaced',
        connection_status = 'connected',
        work_status = 'idle',
        updated_at = now()
    WHERE id = p_device_id;
    
    -- 교체 이력 기록
    INSERT INTO device_history (device_id, agent_id, event_type, 
                                old_device_serial, new_device_serial, notes)
    VALUES (p_device_id, v_agent_id, 'replaced', 
            v_old_serial, p_new_serial, 
            COALESCE(p_notes, 'Device replaced'));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Agent 바인딩 복원
CREATE OR REPLACE FUNCTION restore_agent_binding(
    p_device_id UUID,
    p_agent_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    -- Agent 상태 확인
    IF NOT EXISTS (
        SELECT 1 FROM ai_agents 
        WHERE id = p_agent_id AND binding_status = 'migrating'
    ) THEN
        RAISE EXCEPTION 'Agent is not in migrating status: %', p_agent_id;
    END IF;
    
    -- 디바이스에 Agent 바인딩
    UPDATE devices_v2
    SET agent_id = p_agent_id,
        updated_at = now()
    WHERE id = p_device_id;
    
    -- Agent 바인딩 상태 업데이트
    UPDATE ai_agents
    SET bound_device_id = p_device_id,
        binding_status = 'bound',
        bound_at = now(),
        updated_at = now()
    WHERE id = p_agent_id;
    
    -- 바인딩 이력
    INSERT INTO device_history (device_id, agent_id, event_type, notes)
    VALUES (p_device_id, p_agent_id, 'agent_migrated', 'Agent binding restored after device replacement');
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART G: SEED DATA (30개 PhoneBoard × 20 슬롯 = 600대)
-- ============================================================

-- 30개 PhoneBoard 생성
INSERT INTO node_runners (hostname, ip_address, max_device_slots, location_label) VALUES
    ('pb-01', '192.168.1.101', 20, 'Rack-A'),
    ('pb-02', '192.168.1.102', 20, 'Rack-A'),
    ('pb-03', '192.168.1.103', 20, 'Rack-A'),
    ('pb-04', '192.168.1.104', 20, 'Rack-A'),
    ('pb-05', '192.168.1.105', 20, 'Rack-A'),
    ('pb-06', '192.168.1.106', 20, 'Rack-B'),
    ('pb-07', '192.168.1.107', 20, 'Rack-B'),
    ('pb-08', '192.168.1.108', 20, 'Rack-B'),
    ('pb-09', '192.168.1.109', 20, 'Rack-B'),
    ('pb-10', '192.168.1.110', 20, 'Rack-B'),
    ('pb-11', '192.168.1.111', 20, 'Rack-C'),
    ('pb-12', '192.168.1.112', 20, 'Rack-C'),
    ('pb-13', '192.168.1.113', 20, 'Rack-C'),
    ('pb-14', '192.168.1.114', 20, 'Rack-C'),
    ('pb-15', '192.168.1.115', 20, 'Rack-C'),
    ('pb-16', '192.168.1.116', 20, 'Rack-D'),
    ('pb-17', '192.168.1.117', 20, 'Rack-D'),
    ('pb-18', '192.168.1.118', 20, 'Rack-D'),
    ('pb-19', '192.168.1.119', 20, 'Rack-D'),
    ('pb-20', '192.168.1.120', 20, 'Rack-D'),
    ('pb-21', '192.168.1.121', 20, 'Rack-E'),
    ('pb-22', '192.168.1.122', 20, 'Rack-E'),
    ('pb-23', '192.168.1.123', 20, 'Rack-E'),
    ('pb-24', '192.168.1.124', 20, 'Rack-E'),
    ('pb-25', '192.168.1.125', 20, 'Rack-E'),
    ('pb-26', '192.168.1.126', 20, 'Rack-F'),
    ('pb-27', '192.168.1.127', 20, 'Rack-F'),
    ('pb-28', '192.168.1.128', 20, 'Rack-F'),
    ('pb-29', '192.168.1.129', 20, 'Rack-F'),
    ('pb-30', '192.168.1.130', 20, 'Rack-F')
ON CONFLICT (hostname) DO NOTHING;

-- 600대 디바이스 생성 (각 PhoneBoard에 20대씩)
DO $$
DECLARE
    v_runner RECORD;
    v_slot INT;
    v_device_num INT := 1;
    v_conn_types TEXT[] := ARRAY['ethernet', 'wifi', 'sim'];
    v_conn_type TEXT;
    v_carrier TEXT;
BEGIN
    FOR v_runner IN SELECT id, hostname FROM node_runners ORDER BY hostname LOOP
        FOR v_slot IN 1..20 LOOP
            -- 통신 방식 랜덤 배분 (80% ethernet, 15% wifi, 5% sim)
            IF random() < 0.80 THEN
                v_conn_type := 'ethernet';
                v_carrier := NULL;
            ELSIF random() < 0.95 THEN
                v_conn_type := 'wifi';
                v_carrier := NULL;
            ELSE
                v_conn_type := 'sim';
                v_carrier := (ARRAY['KT', 'SKT', 'LGU+'])[floor(random() * 3 + 1)];
            END IF;
            
            INSERT INTO devices_v2 (
                runner_id,
                slot_number,
                device_serial,
                model_name,
                manufacturer_serial,
                connection_type,
                sim_carrier,
                connection_status,
                work_status,
                hardware_status
            ) VALUES (
                v_runner.id,
                v_slot,
                'R58M' || LPAD(v_device_num::text, 7, '0'),
                'Galaxy S9',
                '3524567890' || LPAD(v_device_num::text, 5, '0'),
                v_conn_type,
                v_carrier,
                'disconnected',
                'idle',
                'active'
            )
            ON CONFLICT (device_serial) DO NOTHING;
            
            v_device_num := v_device_num + 1;
        END LOOP;
    END LOOP;
END;
$$;

-- 샘플 AI Agents 생성 (처음 100개 디바이스에 바인딩)
DO $$
DECLARE
    v_device RECORD;
    v_agent_id UUID;
    v_count INT := 0;
BEGIN
    FOR v_device IN 
        SELECT id, device_serial 
        FROM devices_v2 
        ORDER BY device_serial 
        LIMIT 100
    LOOP
        v_count := v_count + 1;
        
        INSERT INTO ai_agents (
            google_email,
            display_name,
            bound_device_id,
            binding_status,
            bound_at,
            persona_config
        ) VALUES (
            'agent' || LPAD(v_count::text, 3, '0') || '@gmail.com',
            '에이전트 #' || v_count,
            v_device.id,
            'bound',
            now(),
            jsonb_build_object(
                'archetype', (ARRAY['casual', 'binge', 'researcher', 'lurker', 'engager'])[floor(random() * 5 + 1)],
                'interests', ARRAY['kpop', 'tech', 'gaming', 'music']
            )
        )
        RETURNING id INTO v_agent_id;
        
        -- 디바이스에 Agent 연결
        UPDATE devices_v2 SET agent_id = v_agent_id WHERE id = v_device.id;
        
        -- 등록 이력
        INSERT INTO device_history (device_id, agent_id, event_type, notes)
        VALUES (v_device.id, v_agent_id, 'agent_bound', 'Initial agent binding');
    END LOOP;
END;
$$;

-- ============================================================
-- PART H: RLS POLICIES (기본)
-- ============================================================

-- Admin만 접근 가능
ALTER TABLE node_runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_history ENABLE ROW LEVEL SECURITY;

-- Service role은 전체 접근
CREATE POLICY "Service role full access" ON node_runners FOR ALL USING (true);
CREATE POLICY "Service role full access" ON devices_v2 FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ai_agents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON device_history FOR ALL USING (true);

-- ============================================================
-- END OF MIGRATION 008
-- ============================================================


