-- ============================================================================
-- Migration: Financial MVP — Platform Fee (deduct from wage) + Hirer Deposit
-- Date: 2026-03-19
-- Description:
--   1. New ENUMs: deposit_status, cancellation_reason
--   2. Extend ENUMs: transaction_type, transaction_reference_type
--   3. ALTER job_posts: add deposit columns
--   4. ALTER jobs: add settlement/fault/admin columns
--   5. CREATE job_deposits table
-- ============================================================================

-- ============================================================================
-- 1A. New ENUMs
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE deposit_status AS ENUM ('pending','held','released','forfeited','disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cancellation_reason AS ENUM (
    'hirer_voluntary_early',
    'hirer_voluntary_late',
    'caregiver_cancel',
    'caregiver_no_show',
    'caregiver_abandon',
    'hirer_misrepresentation',
    'mutual',
    'force_majeure',
    'admin_override',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 1B. Extend existing ENUMs
-- ============================================================================

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'forfeit';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'compensation';

ALTER TYPE transaction_reference_type ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE transaction_reference_type ADD VALUE IF NOT EXISTS 'compensation';
ALTER TYPE transaction_reference_type ADD VALUE IF NOT EXISTS 'platform_penalty_revenue';

-- ============================================================================
-- 1C. ALTER TABLE job_posts — deposit columns
-- ============================================================================

ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS hirer_deposit_amount INT NOT NULL DEFAULT 0
  CHECK (hirer_deposit_amount >= 0);
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS caregiver_deposit_amount INT NOT NULL DEFAULT 0
  CHECK (caregiver_deposit_amount >= 0);

-- ============================================================================
-- 1D. ALTER TABLE jobs — settlement / fault / admin columns
-- ============================================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cancellation_reason cancellation_reason;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fault_party VARCHAR(20)
  CHECK (fault_party IN ('hirer','caregiver','shared','none','unresolved'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fault_severity VARCHAR(10)
  CHECK (fault_severity IN ('mild','severe'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS settlement_mode VARCHAR(30)
  CHECK (settlement_mode IN ('normal','penalty','admin_override'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS settlement_completed_at TIMESTAMPTZ;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_caregiver_payout BIGINT DEFAULT 0
  CHECK (final_caregiver_payout >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_hirer_refund BIGINT DEFAULT 0
  CHECK (final_hirer_refund >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_platform_fee BIGINT DEFAULT 0
  CHECK (final_platform_fee >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_platform_penalty_revenue BIGINT DEFAULT 0
  CHECK (final_platform_penalty_revenue >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS compensation_amount BIGINT DEFAULT 0
  CHECK (compensation_amount >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS compensation_recipient UUID REFERENCES users(id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_settlement_by UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_settlement_note TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_settlement_at TIMESTAMPTZ;

-- ============================================================================
-- 1E. CREATE TABLE job_deposits
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  party VARCHAR(20) NOT NULL CHECK (party IN ('hirer','caregiver')),
  amount BIGINT NOT NULL CHECK (amount > 0),

  status deposit_status NOT NULL DEFAULT 'held',

  forfeited_amount BIGINT NOT NULL DEFAULT 0 CHECK (forfeited_amount >= 0),
  released_amount BIGINT NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
  compensation_to_user_id UUID REFERENCES users(id),
  compensation_amount BIGINT NOT NULL DEFAULT 0 CHECK (compensation_amount >= 0),
  platform_revenue_amount BIGINT NOT NULL DEFAULT 0 CHECK (platform_revenue_amount >= 0),

  settlement_reason TEXT,
  settled_by UUID REFERENCES users(id),
  settled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT job_deposits_amounts_check CHECK (forfeited_amount + released_amount <= amount),
  CONSTRAINT job_deposits_forfeit_split CHECK (compensation_amount + platform_revenue_amount <= forfeited_amount)
);

CREATE INDEX IF NOT EXISTS idx_job_deposits_job_id ON job_deposits(job_id);
CREATE INDEX IF NOT EXISTS idx_job_deposits_user_id ON job_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_job_deposits_status ON job_deposits(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_deposits_one_per_party ON job_deposits(job_id, party);

COMMENT ON TABLE job_deposits IS 'Job deposit records (hirer/caregiver security deposits)';

-- ============================================================================
-- End of Migration
-- ============================================================================
