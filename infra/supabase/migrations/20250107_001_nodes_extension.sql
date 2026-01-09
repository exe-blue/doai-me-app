-- ═══════════════════════════════════════════════════════════════════════════
-- DoAi.Me: WSS Protocol v1.0 - nodes 테이블 확장
-- Migration: 20250107_001_nodes_extension.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. 새 컬럼 추가 (WSS 프로토콜 지원)
ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS last_heartbeat_ts TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ws_session_id TEXT,
ADD COLUMN IF NOT EXISTS resources_json JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS secret_key TEXT,
ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS active_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS runner_version TEXT,
ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}';

-- 2. connection_status CHECK 제약조건 (안전하게 추가)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'chk_connection_status'
    ) THEN
        ALTER TABLE nodes 
        ADD CONSTRAINT chk_connection_status 
        CHECK (connection_status IN ('connected', 'disconnected', 'reconnecting'));
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- 이미 존재하면 무시
END $$;

-- 3. status 컬럼 확장 (WSS 프로토콜 상태 추가)
DO $$
BEGIN
    -- status 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'nodes' AND column_name = 'status'
    ) THEN
        ALTER TABLE nodes ADD COLUMN status TEXT DEFAULT 'OFFLINE';
    END IF;
END $$;

-- 기존 status 값들을 새 형식으로 매핑 (필요시)
UPDATE nodes SET status = 'OFFLINE' 
WHERE status IS NULL OR status NOT IN ('READY', 'BUSY', 'DEGRADED', 'MAINTENANCE', 'OFFLINE');

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_nodes_heartbeat ON nodes(last_heartbeat_ts);
CREATE INDEX IF NOT EXISTS idx_nodes_connection ON nodes(connection_status);
CREATE INDEX IF NOT EXISTS idx_nodes_ws_session ON nodes(ws_session_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- 연결된 노드 빠른 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_nodes_connected 
ON nodes(last_heartbeat_ts DESC) 
WHERE connection_status = 'connected';

-- 5. secret_key 생성 함수
CREATE OR REPLACE FUNCTION generate_node_secret_key()
RETURNS TEXT AS $$
BEGIN
    -- 256-bit (32 bytes) 랜덤 키를 Base64로 인코딩
    RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_node_secret_key IS 
'HMAC-SHA256 인증용 256-bit Base64 인코딩 시크릿 키 생성';

-- 6. 기존 노드에 secret_key 부여 (없는 경우만)
UPDATE nodes 
SET secret_key = generate_node_secret_key()
WHERE secret_key IS NULL;

-- 7. updated_at 자동 갱신 트리거 (없으면 생성)
CREATE OR REPLACE FUNCTION update_nodes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nodes_updated ON nodes;
CREATE TRIGGER trigger_nodes_updated
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_nodes_timestamp();

-- 8. 컬럼 코멘트
COMMENT ON COLUMN nodes.last_heartbeat_ts IS 'WSS HEARTBEAT 마지막 수신 시간';
COMMENT ON COLUMN nodes.ws_session_id IS '현재 WebSocket 세션 ID';
COMMENT ON COLUMN nodes.resources_json IS 'CPU/Memory/Disk/Network 리소스 JSON';
COMMENT ON COLUMN nodes.secret_key IS 'HMAC-SHA256 인증용 Base64 인코딩 키 (256-bit)';
COMMENT ON COLUMN nodes.connection_status IS 'WebSocket 연결 상태 (connected/disconnected/reconnecting)';
COMMENT ON COLUMN nodes.active_tasks IS '현재 진행 중인 태스크 수';
COMMENT ON COLUMN nodes.runner_version IS 'NodeRunner 소프트웨어 버전';
COMMENT ON COLUMN nodes.capabilities IS '지원 기능 배열 (youtube, tiktok, adb_control 등)';

-- 9. 뷰: 노드 연결 상태 요약
CREATE OR REPLACE VIEW node_connection_summary AS
SELECT 
    connection_status,
    status,
    COUNT(*) as count,
    ROUND(AVG(active_tasks), 1) as avg_active_tasks,
    MAX(last_heartbeat_ts) as latest_heartbeat
FROM nodes
GROUP BY connection_status, status
ORDER BY connection_status, status;

COMMENT ON VIEW node_connection_summary IS 
'노드 연결/상태별 집계 뷰';

