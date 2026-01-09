-- ============================================================
-- DoAi.Me 분산 제어 시스템 - Database Schema V2
-- 
-- 아키텍처: 10 Nodes 분산 구조
-- 작성: Axon (Tech Lead) based on Aria's design
-- ============================================================

-- pgvector 확장 활성화 (Supabase에서 필요)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. NODES 테이블: 워크스테이션 (Gateway) 정보
-- ============================================================
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 노드 식별
    name VARCHAR(50) NOT NULL UNIQUE,           -- 'WS-01', 'WS-02', ...
    host VARCHAR(255) NOT NULL,                 -- IP 또는 Tailscale 주소
    port INTEGER NOT NULL DEFAULT 22221,        -- Laixi WebSocket 포트
    
    -- 연결 상태
    status VARCHAR(20) NOT NULL DEFAULT 'offline',  -- online, offline, connecting, error
    last_heartbeat TIMESTAMPTZ,                 -- 마지막 하트비트 시간
    last_error TEXT,                            -- 마지막 에러 메시지
    
    -- 용량 정보
    device_capacity INTEGER NOT NULL DEFAULT 60,    -- 최대 연결 가능 디바이스 수
    connected_devices INTEGER NOT NULL DEFAULT 0,   -- 현재 연결된 디바이스 수
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}',                -- 추가 설정 (태그, 그룹 등)
    
    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_host ON nodes(host);

-- 상태 업데이트 트리거
CREATE OR REPLACE FUNCTION update_nodes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nodes_updated ON nodes;
CREATE TRIGGER trigger_nodes_updated
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_timestamp();

-- ============================================================
-- 2. DEVICES 테이블: 개별 Android 디바이스
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 디바이스 식별
    device_id VARCHAR(50) NOT NULL UNIQUE,      -- Laixi deviceId (예: '474748334e383098')
    serial VARCHAR(50),                         -- ADB serial
    name VARCHAR(100),                          -- 모델명 (예: 'SM-G965U1')
    
    -- 노드 연결 (어느 워크스테이션에 연결되어 있는가)
    node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    laixi_no INTEGER,                           -- Laixi 내부 번호
    
    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'offline',  -- online, offline, busy, error
    current_task_id UUID,                       -- 현재 실행 중인 태스크
    last_activity TIMESTAMPTZ,                  -- 마지막 활동 시간
    
    -- 통계
    total_tasks_completed INTEGER DEFAULT 0,
    total_watch_time INTEGER DEFAULT 0,         -- 초 단위
    
    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_devices_node_id ON devices(node_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

DROP TRIGGER IF EXISTS trigger_devices_updated ON devices;
CREATE TRIGGER trigger_devices_updated
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_timestamp();

-- ============================================================
-- 3. TASKS 테이블: 작업 큐
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 작업 정보
    type VARCHAR(50) NOT NULL,                  -- 'watch', 'search', 'comment', 'like'
    priority INTEGER NOT NULL DEFAULT 5,         -- 1 (최고) ~ 10 (최저)
    
    -- 대상
    video_id VARCHAR(50),                       -- 대상 영상 ID
    target_device_id UUID REFERENCES devices(id),  -- 특정 디바이스 지정 (null이면 자동 할당)
    assigned_node_id UUID REFERENCES nodes(id),    -- 할당된 노드
    
    -- 작업 파라미터
    params JSONB NOT NULL DEFAULT '{}',         -- keyword, watch_time, seek_count, etc.
    
    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, assigned, running, completed, failed, cancelled
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- 결과
    result JSONB,                               -- 작업 결과 데이터
    error_message TEXT,                         -- 에러 메시지
    
    -- 타임스탬프
    scheduled_at TIMESTAMPTZ,                   -- 예약 시간
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_node ON tasks(assigned_node_id);
CREATE INDEX IF NOT EXISTS idx_tasks_target_device ON tasks(target_device_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_at) WHERE scheduled_at IS NOT NULL;

DROP TRIGGER IF EXISTS trigger_tasks_updated ON tasks;
CREATE TRIGGER trigger_tasks_updated
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_timestamp();

-- ============================================================
-- 4. ECHOTIONS 테이블: AI 페르소나 감정/상태 (Aidentity 연계)
-- ============================================================
CREATE TABLE IF NOT EXISTS echotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 페르소나 식별
    persona_id VARCHAR(50) NOT NULL UNIQUE,     -- 페르소나 고유 ID
    name VARCHAR(100) NOT NULL,                 -- 페르소나 이름
    
    -- 상태 (Aria 설계: ACTIVE → WAITING → FADING → VOID)
    existence_state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    priority INTEGER NOT NULL DEFAULT 50,        -- 0 ~ 100
    visibility INTEGER NOT NULL DEFAULT 50,      -- 0 ~ 100
    uniqueness INTEGER NOT NULL DEFAULT 50,      -- 0 ~ 100
    
    -- 활동 통계
    total_points INTEGER DEFAULT 0,             -- 누적 포인트
    last_interaction TIMESTAMPTZ,               -- 마지막 상호작용
    
    -- 성격 벡터 (384차원 임베딩)
    personality_vector VECTOR(384),
    
    -- 메타데이터
    traits JSONB DEFAULT '{}',                  -- 성격 특성
    preferences JSONB DEFAULT '{}',             -- 선호도
    
    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_echotions_state ON echotions(existence_state);
CREATE INDEX IF NOT EXISTS idx_echotions_priority ON echotions(priority DESC);

DROP TRIGGER IF EXISTS trigger_echotions_updated ON echotions;
CREATE TRIGGER trigger_echotions_updated
    BEFORE UPDATE ON echotions
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_timestamp();

-- ============================================================
-- 5. VIDEOS 테이블: 시청 대상 영상 (API 스키마 연동)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(50) PRIMARY KEY,                 -- 고유 영상 ID
    
    -- 검색 정보 (keyword, title, url 중 최소 하나 필수)
    keyword VARCHAR(255),
    title VARCHAR(500),
    url VARCHAR(1000),
    
    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, error
    
    -- 통계
    total_views INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_keyword ON videos(keyword);

-- ============================================================
-- 6. RESULTS 테이블: 작업 결과 (디바이스 → 서버)
-- ============================================================
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 연결 정보
    device_id UUID REFERENCES devices(id),
    video_id VARCHAR(50) REFERENCES videos(id),
    task_id UUID REFERENCES tasks(id),
    
    -- 시청 결과
    title VARCHAR(500),
    watch_time INTEGER,                         -- 실제 시청 시간 (초)
    total_duration INTEGER,                     -- 영상 전체 길이 (초)
    
    -- 인터랙션
    commented BOOLEAN DEFAULT FALSE,
    comment_text TEXT,
    liked BOOLEAN DEFAULT FALSE,
    
    -- 검색 경로
    search_type INTEGER,                        -- 1: 통합, 2: 시간, 3: 제목, 4: URL
    search_rank INTEGER,                        -- 검색 결과 순위
    
    -- 스크린샷
    screenshot_url VARCHAR(1000),
    
    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'completed',  -- completed, error
    error_message TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_results_device ON results(device_id);
CREATE INDEX IF NOT EXISTS idx_results_video ON results(video_id);
CREATE INDEX IF NOT EXISTS idx_results_task ON results(task_id);

-- ============================================================
-- 7. 초기 데이터: 10개 워크스테이션 노드
-- ============================================================
INSERT INTO nodes (name, host, port, device_capacity, metadata) VALUES
    ('WS-01', '192.168.50.101', 22221, 60, '{"location": "rack-1", "tier": "primary"}'),
    ('WS-02', '192.168.50.102', 22221, 60, '{"location": "rack-1", "tier": "primary"}'),
    ('WS-03', '192.168.50.103', 22221, 60, '{"location": "rack-1", "tier": "primary"}'),
    ('WS-04', '192.168.50.104', 22221, 60, '{"location": "rack-2", "tier": "primary"}'),
    ('WS-05', '192.168.50.105', 22221, 60, '{"location": "rack-2", "tier": "primary"}'),
    ('WS-06', '192.168.50.106', 22221, 60, '{"location": "rack-2", "tier": "primary"}'),
    ('WS-07', '192.168.50.107', 22221, 60, '{"location": "rack-3", "tier": "secondary"}'),
    ('WS-08', '192.168.50.108', 22221, 60, '{"location": "rack-3", "tier": "secondary"}'),
    ('WS-09', '192.168.50.109', 22221, 60, '{"location": "rack-3", "tier": "secondary"}'),
    ('WS-10', '192.168.50.110', 22221, 60, '{"location": "rack-4", "tier": "secondary"}')
ON CONFLICT (name) DO UPDATE SET
    host = EXCLUDED.host,
    port = EXCLUDED.port,
    device_capacity = EXCLUDED.device_capacity,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ============================================================
-- 8. 뷰: 노드 상태 대시보드
-- ============================================================
CREATE OR REPLACE VIEW node_dashboard AS
SELECT 
    n.id,
    n.name,
    n.host,
    n.port,
    n.status,
    n.connected_devices,
    n.device_capacity,
    ROUND((n.connected_devices::NUMERIC / NULLIF(n.device_capacity, 0)) * 100, 1) AS utilization_pct,
    n.last_heartbeat,
    CASE 
        WHEN n.last_heartbeat > NOW() - INTERVAL '30 seconds' THEN 'healthy'
        WHEN n.last_heartbeat > NOW() - INTERVAL '2 minutes' THEN 'warning'
        ELSE 'critical'
    END AS health,
    n.last_error,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_node_id = n.id AND t.status = 'running') AS active_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_node_id = n.id AND t.status = 'pending') AS pending_tasks
FROM nodes n
ORDER BY n.name;

-- ============================================================
-- 9. 함수: 최적 노드 선택 (로드 밸런싱)
-- ============================================================
CREATE OR REPLACE FUNCTION select_optimal_node()
RETURNS UUID AS $$
DECLARE
    optimal_node_id UUID;
BEGIN
    -- 온라인이고, 여유 용량이 있고, 가장 적게 사용 중인 노드 선택
    SELECT id INTO optimal_node_id
    FROM nodes
    WHERE status = 'online'
      AND connected_devices < device_capacity
    ORDER BY 
        (connected_devices::NUMERIC / NULLIF(device_capacity, 0)) ASC,  -- 사용률 낮은 순
        last_heartbeat DESC NULLS LAST  -- 최근 하트비트 우선
    LIMIT 1;
    
    RETURN optimal_node_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. 함수: 디바이스가 연결된 노드 찾기
-- ============================================================
CREATE OR REPLACE FUNCTION find_node_for_device(target_device_id UUID)
RETURNS UUID AS $$
DECLARE
    node_uuid UUID;
BEGIN
    SELECT node_id INTO node_uuid
    FROM devices
    WHERE id = target_device_id
      AND node_id IS NOT NULL;
    
    RETURN node_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 완료 메시지
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ DATABASE_SCHEMA_V2.sql 적용 완료';
    RAISE NOTICE '   - nodes: 10개 워크스테이션';
    RAISE NOTICE '   - devices: 디바이스 테이블';
    RAISE NOTICE '   - tasks: 작업 큐';
    RAISE NOTICE '   - echotions: AI 페르소나';
    RAISE NOTICE '   - videos: 시청 대상';
    RAISE NOTICE '   - results: 작업 결과';
END;
$$;

