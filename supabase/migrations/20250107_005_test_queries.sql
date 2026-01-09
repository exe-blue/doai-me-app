-- ═══════════════════════════════════════════════════════════════════════════
-- DoAi.Me: WSS Protocol v1.0 - 테스트 쿼리
-- Migration: 20250107_005_test_queries.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 이 파일은 마이그레이션 적용 후 테스트용입니다.
-- 실제 프로덕션에서는 실행하지 마세요.
-- ═══════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 1: 테스트 노드 생성                                                 │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- 새 노드 등록
SELECT register_node_connection(
    'node_test_001',                    -- p_node_id
    'session_test_abc123',              -- p_ws_session_id
    'test-runner-local',                -- p_hostname
    '192.168.1.100',                    -- p_ip_address
    '1.0.0',                            -- p_runner_version
    ARRAY['youtube', 'tiktok', 'adb']   -- p_capabilities
);

-- 결과 확인
SELECT node_id, hostname, secret_key, connection_status, status
FROM nodes WHERE node_id = 'node_test_001';
*/

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 2: HEARTBEAT 처리                                                   │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- HEARTBEAT 전송 시뮬레이션
SELECT process_heartbeat(
    'node_test_001',                    -- p_node_id
    'READY',                            -- p_status
    '{
        "cpu_percent": 45.2,
        "memory_percent": 62.8,
        "disk_free_gb": 128.5,
        "network_ok": true
    }'::jsonb,                          -- p_resources
    '[
        {"slot": 1, "serial": "R58K10TEST1", "status": "idle", "battery_level": 85},
        {"slot": 2, "serial": "R58K10TEST2", "status": "busy", "battery_level": 72},
        {"slot": 3, "serial": "R58K10TEST3", "status": "idle", "battery_level": 90}
    ]'::jsonb,                          -- p_device_snapshot
    1,                                  -- p_active_tasks
    'session_test_abc123'               -- p_ws_session_id
);

-- 결과 확인
SELECT * FROM node_detail_status WHERE node_id = 'node_test_001';
SELECT * FROM devices WHERE node_id = (SELECT id FROM nodes WHERE node_id = 'node_test_001');
*/

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 3: 명령 추가 및 Pull-based Push                                     │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- 명령 추가
SELECT enqueue_command(
    'WATCH_VIDEO',                      -- p_command_type
    '{
        "video_url": "https://youtube.com/watch?v=test123",
        "min_watch_seconds": 30,
        "max_watch_seconds": 60
    }'::jsonb,                          -- p_params
    NULL,                               -- p_target_node_id (모든 노드 대상)
    '{"type": "IDLE_DEVICES", "max_count": 5}'::jsonb,  -- p_target_spec
    'HIGH'                              -- p_priority
);

-- URGENT 명령 추가
SELECT enqueue_command(
    'RESTART_ADB',
    '{"reason": "디바이스 응답 없음"}'::jsonb,
    NULL,
    '{"type": "ALL_DEVICES"}'::jsonb,
    'URGENT'
);

-- 대기 명령 확인
SELECT id, command_type, priority, status, created_at 
FROM command_queue WHERE status = 'PENDING' ORDER BY priority DESC, created_at;

-- Pull-based Push 테스트 (노드가 명령 가져가기)
SELECT * FROM fetch_and_assign_commands(
    (SELECT id FROM nodes WHERE node_id = 'node_test_001'),
    5  -- 최대 5개
);

-- 할당된 명령 확인
SELECT id, command_type, status, assigned_node_id, assigned_at
FROM command_queue WHERE status = 'ASSIGNED';
*/

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 4: 명령 실행 및 완료                                                │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- 명령 시작 (ASSIGNED → IN_PROGRESS)
SELECT start_command(
    (SELECT id FROM command_queue WHERE status = 'ASSIGNED' LIMIT 1)
);

-- 명령 완료
SELECT complete_command(
    (SELECT id FROM command_queue WHERE status = 'IN_PROGRESS' LIMIT 1),
    'COMPLETED',
    '{"watched_seconds": 45, "devices_affected": 3}'::jsonb,
    NULL  -- 에러 없음
);

-- 실패 시뮬레이션
SELECT complete_command(
    (SELECT id FROM command_queue WHERE status = 'IN_PROGRESS' LIMIT 1),
    'FAILED',
    NULL,
    '디바이스 연결 끊김'
);

-- 결과 확인
SELECT * FROM recent_commands LIMIT 10;
*/

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 5: 유지보수 함수 테스트                                             │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- 비활성 노드 확인
SELECT * FROM check_stale_nodes(INTERVAL '30 seconds');

-- 타임아웃 명령 처리
SELECT timeout_stale_commands(
    INTERVAL '1 minute',  -- ASSIGNED 타임아웃
    INTERVAL '5 minutes'  -- IN_PROGRESS 타임아웃
);

-- 실패 명령 재시도
SELECT retry_failed_commands();

-- 오래된 명령 정리 (7일 이상)
SELECT cleanup_old_commands(INTERVAL '7 days');
*/

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 6: 모니터링 뷰 확인                                                 │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- 시스템 전체 상태
SELECT * FROM system_status_overview;

-- 노드 연결 요약
SELECT * FROM node_connection_summary;

-- 노드별 상세 현황
SELECT * FROM node_detail_status;

-- 디바이스 상태 집계
SELECT * FROM device_status_summary;

-- 명령 큐 통계
SELECT * FROM command_queue_stats;

-- 최근 명령 히스토리
SELECT * FROM recent_commands;
*/

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TEST 7: 정리 (테스트 데이터 삭제)                                        │
-- └─────────────────────────────────────────────────────────────────────────┘
/*
-- 테스트 노드 및 관련 데이터 삭제 (CASCADE로 devices, command_queue도 삭제됨)
DELETE FROM nodes WHERE node_id LIKE 'node_test_%';

-- 확인
SELECT COUNT(*) as remaining_test_nodes FROM nodes WHERE node_id LIKE 'node_test_%';
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- 실행 순서: 각 TEST 섹션의 주석을 해제하고 순서대로 실행
-- ═══════════════════════════════════════════════════════════════════════════

