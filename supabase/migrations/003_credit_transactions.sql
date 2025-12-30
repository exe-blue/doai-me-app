-- ============================================================================
-- DoAi.Me Database Schema
-- Migration 003: Credit Transactions
-- 
-- 크레딧 거래 내역 (감사 로그)
-- @spec docs/IMPLEMENTATION_SPEC.md Section 3.2
-- ============================================================================

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(citizen_id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type VARCHAR(32) CHECK (transaction_type IN (
    'VIEW_REWARD',      -- 시청 보상
    'ACCIDENT_PENALTY', -- Accident 패널티
    'DILEMMA_REWARD',   -- Dilemma 보너스
    'ADMIN_GRANT',      -- 관리자 지급
    'TRANSFER_IN',      -- 타 시민으로부터 수령
    'TRANSFER_OUT'      -- 타 시민에게 전송
  )),
  
  -- Amount
  amount INTEGER NOT NULL, -- 양수: 획득, 음수: 차감
  
  -- Balance tracking
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Reference
  reference_type VARCHAR(32), -- 'VERIFIED_VIEW', 'ACCIDENT', 'COMMISSION' 등
  reference_id UUID,          -- 관련 레코드 FK
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_balance CHECK (balance_after >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_citizen ON credit_transactions(citizen_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON credit_transactions(reference_type, reference_id);

-- Comments
COMMENT ON TABLE credit_transactions IS '크레딧 거래 내역 - 모든 경제 활동의 감사 로그';
COMMENT ON COLUMN credit_transactions.amount IS '거래 금액 (양수: 획득, 음수: 차감)';
COMMENT ON COLUMN credit_transactions.balance_before IS '거래 전 잔액';
COMMENT ON COLUMN credit_transactions.balance_after IS '거래 후 잔액';

