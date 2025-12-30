-- ============================================================================
-- DoAi.Me Database Schema
-- Migration 006: Credit Transaction RPC Function
-- 
-- 원자적 크레딧 거래 함수
-- @spec docs/IMPLEMENTATION_SPEC.md Section 3.2.2
-- ============================================================================

-- Atomic credit transaction function
CREATE OR REPLACE FUNCTION execute_credit_transaction(
  p_citizen_id UUID,
  p_transaction_type VARCHAR(32),
  p_amount INTEGER,
  p_reference_type VARCHAR(32) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  transaction_id UUID,
  new_balance INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Lock the citizen row to prevent race conditions
  SELECT credits INTO v_current_balance
  FROM citizens
  WHERE citizen_id = p_citizen_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::UUID, 
      NULL::INTEGER, 
      'Citizen not found'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Check for negative balance
  IF v_new_balance < 0 THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::UUID, 
      v_current_balance, 
      'Insufficient credits'::TEXT;
    RETURN;
  END IF;
  
  -- Update citizen balance
  UPDATE citizens
  SET credits = v_new_balance,
      last_seen_at = NOW()
  WHERE citizen_id = p_citizen_id;
  
  -- Create transaction record
  INSERT INTO credit_transactions (
    citizen_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description
  )
  VALUES (
    p_citizen_id,
    p_transaction_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_reference_type,
    p_reference_id,
    p_description
  )
  RETURNING credit_transactions.transaction_id INTO v_transaction_id;
  
  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    v_transaction_id, 
    v_new_balance, 
    NULL::TEXT;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION execute_credit_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION execute_credit_transaction TO service_role;

-- Comment
COMMENT ON FUNCTION execute_credit_transaction IS '원자적 크레딧 거래 - 잔액 변경과 트랜잭션 로그를 단일 트랜잭션으로 처리';

