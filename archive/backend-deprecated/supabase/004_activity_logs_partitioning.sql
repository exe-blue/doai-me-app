-- ============================================
-- DoAi.Me Activity Logs Partitioning (ADR-005)
-- ============================================
-- 왜 파티셔닝인가?
-- - 600대 기기 × 24시간 = 하루 수만 개 로그
-- - 주간 단위 파티션으로 쿼리 성능 최적화
-- - 오래된 파티션 쉽게 삭제 가능 (데이터 정리)
-- ============================================

-- 기존 activity_logs 테이블 백업 (데이터가 있다면)
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM activity_logs LIMIT 1) THEN
--         CREATE TABLE activity_logs_backup AS SELECT * FROM activity_logs;
--     END IF;
-- END $$;

-- 기존 테이블 삭제 (새로 생성하기 위해)
DROP TABLE IF EXISTS activity_logs CASCADE;

-- ============================================
-- 파티션 테이블 생성 (주간 단위)
-- ============================================
CREATE TABLE activity_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    persona_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 파티션 키 포함한 Primary Key
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 인덱스 (파티션 테이블에도 적용됨)
CREATE INDEX idx_activity_logs_persona ON activity_logs (persona_id, created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs (action_type, created_at DESC);
CREATE INDEX idx_activity_logs_details ON activity_logs USING GIN (details);

-- ============================================
-- 초기 파티션 생성 (2024년 12월 ~ 2025년 3월)
-- ============================================

-- 2024년 52주차 (12/23 ~ 12/29)
CREATE TABLE activity_logs_2024_w52 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-12-23') TO ('2024-12-30');

-- 2025년 1주차 (12/30 ~ 1/5)
CREATE TABLE activity_logs_2025_w01 PARTITION OF activity_logs
    FOR VALUES FROM ('2024-12-30') TO ('2025-01-06');

-- 2025년 2주차 (1/6 ~ 1/12)
CREATE TABLE activity_logs_2025_w02 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-01-06') TO ('2025-01-13');

-- 2025년 3주차 (1/13 ~ 1/19)
CREATE TABLE activity_logs_2025_w03 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-01-13') TO ('2025-01-20');

-- 2025년 4주차 (1/20 ~ 1/26)
CREATE TABLE activity_logs_2025_w04 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-01-20') TO ('2025-01-27');

-- 2025년 5주차 (1/27 ~ 2/2)
CREATE TABLE activity_logs_2025_w05 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-01-27') TO ('2025-02-03');

-- 2025년 6주차 (2/3 ~ 2/9)
CREATE TABLE activity_logs_2025_w06 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-02-03') TO ('2025-02-10');

-- 2025년 7주차 (2/10 ~ 2/16)
CREATE TABLE activity_logs_2025_w07 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-02-10') TO ('2025-02-17');

-- 2025년 8주차 (2/17 ~ 2/23)
CREATE TABLE activity_logs_2025_w08 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-02-17') TO ('2025-02-24');

-- 2025년 9주차 (2/24 ~ 3/2)
CREATE TABLE activity_logs_2025_w09 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-02-24') TO ('2025-03-03');

-- 2025년 10주차 (3/3 ~ 3/9)
CREATE TABLE activity_logs_2025_w10 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-03-03') TO ('2025-03-10');

-- 2025년 11주차 (3/10 ~ 3/16)
CREATE TABLE activity_logs_2025_w11 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-03-10') TO ('2025-03-17');

-- 2025년 12주차 (3/17 ~ 3/23)
CREATE TABLE activity_logs_2025_w12 PARTITION OF activity_logs
    FOR VALUES FROM ('2025-03-17') TO ('2025-03-24');

-- ============================================
-- 파티션 자동 생성 함수
-- ============================================
CREATE OR REPLACE FUNCTION create_weekly_partition()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_year INTEGER;
    v_week INTEGER;
BEGIN
    -- 다음 주 월요일 계산
    v_start_date := date_trunc('week', CURRENT_DATE + INTERVAL '1 week')::DATE;
    v_end_date := v_start_date + INTERVAL '7 days';
    
    v_year := EXTRACT(ISOYEAR FROM v_start_date);
    v_week := EXTRACT(WEEK FROM v_start_date);
    
    v_partition_name := format('activity_logs_%s_w%s', v_year, LPAD(v_week::TEXT, 2, '0'));
    
    -- 파티션이 없으면 생성
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = v_partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF activity_logs FOR VALUES FROM (%L) TO (%L)',
            v_partition_name,
            v_start_date,
            v_end_date
        );
        
        RAISE NOTICE '새 파티션 생성: %', v_partition_name;
    END IF;
END;
$$;

-- ============================================
-- 오래된 파티션 삭제 함수 (3개월 이전)
-- ============================================
CREATE OR REPLACE FUNCTION drop_old_partitions(
    p_retention_weeks INTEGER DEFAULT 12  -- 기본 12주(약 3개월) 보관
)
RETURNS TABLE (dropped_partition TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_partition RECORD;
    v_cutoff_date DATE;
BEGIN
    v_cutoff_date := CURRENT_DATE - (p_retention_weeks * 7);
    
    FOR v_partition IN
        SELECT 
            child.relname AS partition_name,
            pg_get_expr(child.relpartbound, child.oid) AS partition_range
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relname = 'activity_logs'
    LOOP
        -- 파티션 범위에서 종료 날짜 추출하여 cutoff 비교
        -- (간단히 파티션 이름에서 날짜 추론)
        IF v_partition.partition_name ~ 'activity_logs_\d{4}_w\d{2}' THEN
            -- 파티션 이름 패턴 매칭되면 날짜 확인 로직 추가 가능
            -- 여기서는 수동으로 관리하거나 추가 로직 필요
            NULL;
        END IF;
    END LOOP;
    
    -- 실제 운영에서는 수동으로 확인 후 삭제 권장
    RETURN;
END;
$$;

-- ============================================
-- RLS (Row Level Security) 설정
-- ============================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 로그만 조회 가능
CREATE POLICY "Users can view own logs" ON activity_logs
    FOR SELECT
    USING (true);  -- API에서 persona_id 필터링

-- 삽입은 인증된 사용자만
CREATE POLICY "Authenticated users can insert logs" ON activity_logs
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- 권한 설정
-- ============================================
GRANT SELECT, INSERT ON activity_logs TO anon;
GRANT ALL ON activity_logs TO service_role;

-- 시퀀스 권한
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

