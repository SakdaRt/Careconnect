-- ============================================================================
-- Migration: Create missing tables (audit_events, job_deposits, password_reset_tokens)
-- Date: 2026-04-05
-- Description: Tables defined in database/schema.sql but missing from DB
--              because they were added after initial Docker volume creation
-- ============================================================================

-- deposit_status enum (required by job_deposits)
DO $$ BEGIN
  CREATE TYPE deposit_status AS ENUM ('pending', 'held', 'released', 'forfeited', 'disputed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE: audit_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    action VARCHAR(100),
    old_level trust_level,
    new_level trust_level,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- ============================================================================
-- TABLE: job_deposits
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    party VARCHAR(20) NOT NULL CHECK (party IN ('hirer', 'caregiver')),
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
DO $$ BEGIN
  CREATE UNIQUE INDEX idx_job_deposits_one_per_party ON job_deposits(job_id, party);
EXCEPTION WHEN duplicate_table THEN null;
END $$;

-- ============================================================================
-- TABLE: password_reset_tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
