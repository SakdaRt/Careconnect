-- ============================================================================
-- Careconnect Initial Schema Migration
-- Version: 1.0.0
-- Description: Complete initial schema for Careconnect platform
--
-- Key Principles:
-- 1. Immutable Ledger (append-only, NO UPDATE/DELETE on ledger_transactions)
-- 2. Trust Level is Derived State (calculated by system worker)
-- 3. One Active Assignment per Job (constraint enforced)
-- 4. No Negative Balance (constraint enforced)
-- 5. GPS + Photo Evidence for Proof of Work
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- All CREATE TYPE wrapped in DO blocks for idempotent re-runs
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('hirer', 'caregiver', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE trust_level AS ENUM ('L0', 'L1', 'L2', 'L3'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE job_status AS ENUM ('draft', 'posted', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE job_type AS ENUM ('companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE risk_level AS ENUM ('low_risk', 'high_risk'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE assignment_status AS ENUM ('active', 'replaced', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'hold', 'release', 'reversal'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE transaction_reference_type AS ENUM ('topup', 'job', 'dispute', 'withdrawal', 'fee', 'refund', 'penalty'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (core authentication and profile)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'caregiver',
    status user_status NOT NULL DEFAULT 'active',
    trust_level trust_level NOT NULL DEFAULT 'L0',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    phone_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Wallets table (financial accounts)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    available_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    held_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Patient profiles (care recipients)
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hirer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    medical_conditions TEXT,
    special_needs TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Caregiver profiles
CREATE TABLE IF NOT EXISTS caregiver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    experience_years INTEGER CHECK (experience_years >= 0),
    hourly_rate NUMERIC(8, 2) CHECK (hourly_rate >= 0),
    profile_photo_url VARCHAR(500),
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================================
-- JOB MANAGEMENT
-- ============================================================================

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hirer_id UUID NOT NULL REFERENCES users(id),
    patient_id UUID NOT NULL REFERENCES patient_profiles(id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    job_type job_type NOT NULL,
    risk_level risk_level NOT NULL DEFAULT 'low_risk',
    status job_status NOT NULL DEFAULT 'draft',
    hourly_rate NUMERIC(8, 2) NOT NULL CHECK (hourly_rate >= 0),
    estimated_duration_hours INTEGER CHECK (estimated_duration_hours > 0),
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    scheduled_end_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    location_address TEXT NOT NULL,
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    special_requirements TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Job assignments
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES users(id),
    status assignment_status NOT NULL DEFAULT 'active',
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    replaced_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(job_id, caregiver_id)
);

-- ============================================================================
-- LEDGER SYSTEM (Immutable)
-- ============================================================================

-- Ledger transactions (append-only, NO UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    transaction_type transaction_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    reference_type transaction_reference_type,
    reference_id UUID,
    description TEXT,
    balance_after NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ADDITIONAL FEATURES
-- ============================================================================

-- KYC submissions
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status kyc_status NOT NULL DEFAULT 'pending',
    provider_reference_id VARCHAR(255),
    verification_data JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payments table (already exists in previous migration, but including for completeness)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount NUMERIC(12, 2) NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    provider_reference_id VARCHAR(255),
    provider_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_trust_level ON users(trust_level);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_hirer_id ON jobs(hirer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_patient_id ON jobs(patient_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_risk_level ON jobs(risk_level);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(scheduled_start_time);

-- Ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id ON ledger_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_transactions(created_at);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- No negative balances (idempotent: only add if not exists)
DO $$ BEGIN
    ALTER TABLE wallets ADD CONSTRAINT chk_wallet_balance_non_negative
        CHECK (balance >= 0 AND available_balance >= 0 AND held_balance >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- One active assignment per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_assignment_per_job 
    ON job_assignments(job_id) WHERE status = 'active';

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at (DROP IF EXISTS for idempotency)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER update_patient_profiles_updated_at BEFORE UPDATE ON patient_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_caregiver_profiles_updated_at ON caregiver_profiles;
CREATE TRIGGER update_caregiver_profiles_updated_at BEFORE UPDATE ON caregiver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kyc_submissions_updated_at ON kyc_submissions;
CREATE TRIGGER update_kyc_submissions_updated_at BEFORE UPDATE ON kyc_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- NOTE: Bare COMMIT removed — the migration runner wraps each file in its own BEGIN/COMMIT.
