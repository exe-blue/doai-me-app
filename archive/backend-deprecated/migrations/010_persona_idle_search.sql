-- ============================================================
-- Persona IDLE Search System Migration
-- P1: 검색어 생성 및 고유성 형성 시스템
--
-- 설계: Aria
-- 구현: Axon (Tech Lead)
--
-- "인간의 유아기처럼, AI의 초기 검색 활동은
--  성격 형성에 결정적인 영향을 미친다."
-- ============================================================

-- persona_activity_logs 테이블 확장
-- 검색어와 고유성 형성 영향도 추가
ALTER TABLE persona_activity_logs
ADD COLUMN IF NOT EXISTS search_keyword VARCHAR(100),
ADD COLUMN IF NOT EXISTS search_source VARCHAR(30) DEFAULT 'ai_generated',
ADD COLUMN IF NOT EXISTS formative_impact REAL DEFAULT 0.0;

-- search_source 제약조건 (선택적)
-- CHECK 제약조건은 이미 데이터가 있을 경우를 고려하여 조건부 적용
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'persona_activity_logs_search_source_check'
    ) THEN
        ALTER TABLE persona_activity_logs
        ADD CONSTRAINT persona_activity_logs_search_source_check
        CHECK (search_source IN ('ai_generated', 'trait_based', 'history_based', 'fallback'));
    END IF;
END $$;

-- activity_type 제약조건 갱신 (idle_search, keyword_generated 추가)
-- 기존 제약조건 삭제 후 재생성
ALTER TABLE persona_activity_logs
DROP CONSTRAINT IF EXISTS persona_activity_logs_activity_type_check;

ALTER TABLE persona_activity_logs
ADD CONSTRAINT persona_activity_logs_activity_type_check
CHECK (activity_type IN (
    'watch', 'like', 'comment', 'unique_discovery',
    'viral_comment', 'being_talked_to',
    'idle_search', 'keyword_generated'
));

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_activity_logs_search_keyword
ON persona_activity_logs(search_keyword)
WHERE search_keyword IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type
ON persona_activity_logs(activity_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_formative
ON persona_activity_logs(formative_impact DESC)
WHERE formative_impact > 0;

-- 뷰: 페르소나별 검색 프로필 (고유성 형성 분석)
CREATE OR REPLACE VIEW persona_search_profiles AS
SELECT
    p.id as persona_id,
    p.name,
    p.created_at as persona_created_at,
    COUNT(DISTINCT al.search_keyword) as unique_keywords,
    COUNT(al.id) as total_searches,
    AVG(al.formative_impact) as avg_formative_impact,
    SUM(CASE WHEN al.formative_impact > 0.5 THEN 1 ELSE 0 END) as formative_period_searches,
    MAX(al.created_at) as last_search_at,
    array_agg(DISTINCT al.search_keyword ORDER BY al.search_keyword)
        FILTER (WHERE al.search_keyword IS NOT NULL) as all_keywords
FROM personas p
LEFT JOIN persona_activity_logs al ON p.id = al.persona_id
    AND al.activity_type = 'idle_search'
GROUP BY p.id, p.name, p.created_at;

-- 뷰: 최근 검색 활동 (실시간 모니터링용)
CREATE OR REPLACE VIEW recent_idle_searches AS
SELECT
    al.id,
    al.persona_id,
    p.name as persona_name,
    al.search_keyword,
    al.search_source,
    al.formative_impact,
    al.target_url,
    al.target_title,
    al.created_at,
    EXTRACT(EPOCH FROM (NOW() - al.created_at))/60 as minutes_ago
FROM persona_activity_logs al
JOIN personas p ON al.persona_id = p.id
WHERE al.activity_type = 'idle_search'
ORDER BY al.created_at DESC
LIMIT 100;

-- 코멘트
COMMENT ON COLUMN persona_activity_logs.search_keyword IS 'IDLE 검색 시 생성된 검색어';
COMMENT ON COLUMN persona_activity_logs.search_source IS 'ai_generated|trait_based|history_based|fallback';
COMMENT ON COLUMN persona_activity_logs.formative_impact IS '고유성 형성 영향도 (0-1), 초기일수록 높음';
