-- ============================================
-- DoAi.Me Database Functions (ADR-005 Final)
-- ============================================
-- 역할: 단순한 경제 계산은 DB에서 원자적으로 처리
-- 복잡한 확률 계산(타락)은 Python Backend에서 처리
-- ============================================

-- ============================================
-- 1. 유지비 차감 함수
-- ============================================
-- 왜 DB Function인가?
-- - 동시성 문제 방지 (600대 기기가 동시에 요청해도 안전)
-- - 원자성 보장 (차감 중 에러 발생 시 롤백)
-- - 네트워크 왕복 최소화

CREATE OR REPLACE FUNCTION deduct_maintenance_fee(
    p_persona_id UUID,
    p_amount DECIMAL(10, 2)
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance DECIMAL(10, 2),
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_balance DECIMAL(10, 2);
    v_new_balance DECIMAL(10, 2);
BEGIN
    -- 현재 잔액 조회 (FOR UPDATE로 락 획득)
    SELECT credit INTO v_current_balance
    FROM personas
    WHERE id = p_persona_id
    FOR UPDATE;

    -- 페르소나 없음
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            0::DECIMAL(10, 2),
            '페르소나를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 잔액 부족
    IF v_current_balance < p_amount THEN
        -- 잔액 부족해도 0으로 차감 (생존 위기 상태)
        UPDATE personas 
        SET credit = 0, updated_at = NOW()
        WHERE id = p_persona_id;

        -- 크레딧 트랜잭션 기록
        INSERT INTO credit_transactions (
            persona_id, 
            transaction_type, 
            amount, 
            balance_after,
            description
        ) VALUES (
            p_persona_id,
            'maintenance',
            -v_current_balance,
            0,
            '유지비 차감 (잔액 부족으로 생존 위기)'
        );

        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            0::DECIMAL(10, 2),
            '⚠️ 잔액 부족: 생존 위기 상태 진입'::TEXT;
        RETURN;
    END IF;

    -- 정상 차감
    v_new_balance := v_current_balance - p_amount;
    
    UPDATE personas 
    SET credit = v_new_balance, updated_at = NOW()
    WHERE id = p_persona_id;

    -- 크레딧 트랜잭션 기록
    INSERT INTO credit_transactions (
        persona_id, 
        transaction_type, 
        amount, 
        balance_after,
        description
    ) VALUES (
        p_persona_id,
        'maintenance',
        -p_amount,
        v_new_balance,
        '일일 유지비 차감'
    );

    RETURN QUERY SELECT 
        TRUE::BOOLEAN,
        v_new_balance,
        '유지비 차감 완료'::TEXT;
END;
$$;

-- ============================================
-- 2. 크레딧 지급 함수 (의뢰 완료 보상)
-- ============================================
CREATE OR REPLACE FUNCTION grant_credit(
    p_persona_id UUID,
    p_amount DECIMAL(10, 2),
    p_reason TEXT DEFAULT '의뢰 완료 보상'
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance DECIMAL(10, 2),
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_balance DECIMAL(10, 2);
    v_new_balance DECIMAL(10, 2);
BEGIN
    -- 현재 잔액 조회
    SELECT credit INTO v_current_balance
    FROM personas
    WHERE id = p_persona_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            0::DECIMAL(10, 2),
            '페르소나를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 크레딧 지급
    v_new_balance := v_current_balance + p_amount;
    
    UPDATE personas 
    SET credit = v_new_balance, updated_at = NOW()
    WHERE id = p_persona_id;

    -- 트랜잭션 기록
    INSERT INTO credit_transactions (
        persona_id, 
        transaction_type, 
        amount, 
        balance_after,
        description
    ) VALUES (
        p_persona_id,
        'reward',
        p_amount,
        v_new_balance,
        p_reason
    );

    RETURN QUERY SELECT 
        TRUE::BOOLEAN,
        v_new_balance,
        format('크레딧 %s 지급 완료', p_amount)::TEXT;
END;
$$;

-- ============================================
-- 3. 일괄 유지비 차감 (Cron Job용)
-- ============================================
-- n8n 또는 Supabase Cron에서 매일 호출
CREATE OR REPLACE FUNCTION run_daily_maintenance()
RETURNS TABLE (
    total_personas INTEGER,
    success_count INTEGER,
    crisis_count INTEGER,
    total_deducted DECIMAL(10, 2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_persona RECORD;
    v_result RECORD;
    v_total INTEGER := 0;
    v_success INTEGER := 0;
    v_crisis INTEGER := 0;
    v_deducted DECIMAL(10, 2) := 0;
    v_daily_cost DECIMAL(10, 2);
BEGIN
    FOR v_persona IN 
        SELECT id, corruption_level FROM personas WHERE status = 'active'
    LOOP
        v_total := v_total + 1;
        
        -- 타락 레벨에 따른 유지비 계산
        -- Base: 10, 타락 레벨당 +5%
        v_daily_cost := 10.00 * (1 + (v_persona.corruption_level * 0.05));
        
        -- 유지비 차감 실행
        SELECT * INTO v_result FROM deduct_maintenance_fee(v_persona.id, v_daily_cost);
        
        IF v_result.success THEN
            v_success := v_success + 1;
            v_deducted := v_deducted + v_daily_cost;
            
            IF v_result.new_balance = 0 THEN
                v_crisis := v_crisis + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_total, v_success, v_crisis, v_deducted;
END;
$$;

-- ============================================
-- 4. 타락도 업데이트 함수
-- ============================================
-- 복잡한 계산은 Python에서 하고, 결과만 이 함수로 저장
CREATE OR REPLACE FUNCTION update_corruption_level(
    p_persona_id UUID,
    p_new_level INTEGER,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- 범위 검증 (0-100)
    IF p_new_level < 0 THEN p_new_level := 0; END IF;
    IF p_new_level > 100 THEN p_new_level := 100; END IF;

    UPDATE personas
    SET 
        corruption_level = p_new_level,
        updated_at = NOW()
    WHERE id = p_persona_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 타락 변경 로그
    INSERT INTO activity_logs (
        persona_id,
        action_type,
        details
    ) VALUES (
        p_persona_id,
        'corruption_change',
        jsonb_build_object(
            'new_level', p_new_level,
            'reason', p_reason
        )
    );

    RETURN TRUE;
END;
$$;

-- ============================================
-- 5. 페르소나 상태 조회 함수 (대시보드용)
-- ============================================
CREATE OR REPLACE FUNCTION get_persona_stats()
RETURNS TABLE (
    total_personas BIGINT,
    active_count BIGINT,
    crisis_count BIGINT,
    total_credit DECIMAL(12, 2),
    avg_corruption DECIMAL(5, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE status = 'active')::BIGINT,
        COUNT(*) FILTER (WHERE credit <= 0)::BIGINT,
        COALESCE(SUM(credit), 0)::DECIMAL(12, 2),
        COALESCE(AVG(corruption_level), 0)::DECIMAL(5, 2)
    FROM personas;
END;
$$;

-- ============================================
-- 권한 설정
-- ============================================
-- anon 역할에 함수 실행 권한 부여 (API 호출용)
GRANT EXECUTE ON FUNCTION deduct_maintenance_fee TO anon;
GRANT EXECUTE ON FUNCTION grant_credit TO anon;
GRANT EXECUTE ON FUNCTION run_daily_maintenance TO service_role;
GRANT EXECUTE ON FUNCTION update_corruption_level TO anon;
GRANT EXECUTE ON FUNCTION get_persona_stats TO anon;

