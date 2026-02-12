-- ============================================================================
-- Careconnect Database Schema
-- Version: 1.0.0
-- Description: Complete schema for Careconnect platform
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

-- User roles
CREATE TYPE user_role AS ENUM ('hirer', 'caregiver', 'admin');

-- User status
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');

-- Trust levels (L0-L3) - DERIVED STATE, do NOT update directly
CREATE TYPE trust_level AS ENUM ('L0', 'L1', 'L2', 'L3');

-- Job status (7 canonical states only)
CREATE TYPE job_status AS ENUM ('draft', 'posted', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired');

-- Job type
CREATE TYPE job_type AS ENUM ('companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency');

-- Risk level
CREATE TYPE risk_level AS ENUM ('low_risk', 'high_risk');

-- Assignment status
CREATE TYPE assignment_status AS ENUM ('active', 'replaced', 'completed', 'cancelled');

-- Transaction types
CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'hold', 'release', 'reversal');

-- Transaction reference types
CREATE TYPE transaction_reference_type AS ENUM ('topup', 'job', 'dispute', 'withdrawal', 'fee', 'refund', 'penalty');

-- KYC status
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- Withdrawal status
CREATE TYPE withdrawal_status AS ENUM ('queued', 'review', 'approved', 'paid', 'rejected', 'cancelled');

-- Dispute status
CREATE TYPE dispute_status AS ENUM ('open', 'in_review', 'resolved', 'rejected');

-- Notification channel
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push', 'in_app');

-- Notification status
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- Chat message type
CREATE TYPE chat_message_type AS ENUM ('text', 'image', 'file', 'system');

-- GPS event type
CREATE TYPE gps_event_type AS ENUM ('check_in', 'check_out', 'ping');

-- Photo phase
CREATE TYPE photo_phase AS ENUM ('before', 'after');

-- ============================================================================
-- TABLE: users (Main user table)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Auth credentials
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- Account type
    account_type VARCHAR(10) NOT NULL CHECK (account_type IN ('guest', 'member')),
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'active',

    -- Verification
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified_at TIMESTAMPTZ,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Trust Level (DERIVED STATE - updated by system worker only)
    trust_level trust_level NOT NULL DEFAULT 'L0',
    trust_score INT NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),

    -- Stats (for quick reference)
    completed_jobs_count INT NOT NULL DEFAULT 0 CHECK (completed_jobs_count >= 0),
    first_job_waiver_used BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone_number IS NOT NULL),
    CONSTRAINT guest_must_have_email CHECK (account_type != 'guest' OR email IS NOT NULL),
    CONSTRAINT member_must_have_phone CHECK (account_type != 'member' OR phone_number IS NOT NULL)
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_trust_level ON users(trust_level);
CREATE INDEX idx_users_status ON users(status);

COMMENT ON TABLE users IS 'Main user table with auth credentials and trust level';
COMMENT ON COLUMN users.trust_level IS 'DERIVED STATE - calculated by system worker, do NOT update directly';
COMMENT ON COLUMN users.trust_score IS 'Score 0-100, calculated from job completion, reviews, GPS compliance, etc.';

-- ============================================================================
-- TABLE: user_policy_acceptances
-- ============================================================================

CREATE TABLE user_policy_acceptances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('hirer', 'caregiver')),
    policy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version_policy_accepted VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, role)
);

CREATE INDEX idx_user_policy_acceptances_user_id ON user_policy_acceptances(user_id);
CREATE INDEX idx_user_policy_acceptances_role ON user_policy_acceptances(role);

COMMENT ON TABLE user_policy_acceptances IS 'Policy acceptance records per user role';

-- ============================================================================
-- TABLE: user_kyc_info (KYC verification)
-- ============================================================================

CREATE TABLE user_kyc_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Provider info (store reference only, NOT raw data)
    provider_name VARCHAR(100) NOT NULL,
    provider_session_id VARCHAR(255),
    provider_reference_id VARCHAR(255),

    -- Status
    status kyc_status NOT NULL DEFAULT 'pending',
    result VARCHAR(50), -- approved, rejected, pending

    -- National ID (for duplicate check) - hashed for privacy
    national_id_hash VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT user_kyc_info_user_id_unique UNIQUE (user_id)
);

CREATE INDEX idx_user_kyc_info_user_id ON user_kyc_info(user_id);
CREATE INDEX idx_user_kyc_info_national_id_hash ON user_kyc_info(national_id_hash) WHERE national_id_hash IS NOT NULL;

COMMENT ON TABLE user_kyc_info IS 'KYC verification status - stores provider reference only, NOT raw documents';
COMMENT ON COLUMN user_kyc_info.national_id_hash IS 'Hashed national ID for duplicate account detection';

-- ============================================================================
-- TABLE: caregiver_profiles (Caregiver-specific data)
-- ============================================================================

CREATE TABLE caregiver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile info
    display_name VARCHAR(255) NOT NULL,
    bio TEXT,
    experience_years INT CHECK (experience_years >= 0),
    certifications TEXT[], -- Array of certification names
    specializations TEXT[], -- Array of specializations

    -- Availability
    available_from TIME,
    available_to TIME,
    available_days INT[], -- 0=Sun, 1=Mon, ..., 6=Sat

    -- Stats
    total_jobs_completed INT NOT NULL DEFAULT 0 CHECK (total_jobs_completed >= 0),
    average_rating NUMERIC(3,2) CHECK (average_rating >= 0 AND average_rating <= 5),
    total_reviews INT NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT caregiver_profiles_user_id_unique UNIQUE (user_id)
);

CREATE INDEX idx_caregiver_profiles_user_id ON caregiver_profiles(user_id);

COMMENT ON TABLE caregiver_profiles IS 'Caregiver-specific profile information';

-- ============================================================================
-- TABLE: hirer_profiles (Hirer-specific data)
-- ============================================================================

CREATE TABLE hirer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile info
    display_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    district VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),

    -- Stats
    total_jobs_posted INT NOT NULL DEFAULT 0 CHECK (total_jobs_posted >= 0),
    total_jobs_completed INT NOT NULL DEFAULT 0 CHECK (total_jobs_completed >= 0),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT hirer_profiles_user_id_unique UNIQUE (user_id)
);

CREATE INDEX idx_hirer_profiles_user_id ON hirer_profiles(user_id);

COMMENT ON TABLE hirer_profiles IS 'Hirer-specific profile information';

-- ============================================================================
-- TABLE: patient_profiles (Persistent patient data)
-- ============================================================================

CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hirer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Basic info (non-sensitive)
    patient_display_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255),
    district VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    age_band VARCHAR(20), -- e.g., "60-70", "70-80"
    gender VARCHAR(20),

    -- General health (summary level)
    mobility_level VARCHAR(50), -- e.g., "independent", "needs_assistance", "wheelchair"
    communication_style VARCHAR(50), -- e.g., "verbal", "non_verbal", "limited"
    general_health_summary TEXT,
    chronic_conditions_flags TEXT[], -- e.g., ["diabetes", "hypertension"]
    cognitive_status VARCHAR(30),
    symptoms_flags TEXT[],
    medical_devices_flags TEXT[],
    care_needs_flags TEXT[],
    behavior_risks_flags TEXT[],
    allergies_flags TEXT[],

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_profiles_hirer_id ON patient_profiles(hirer_id);
CREATE INDEX idx_patient_profiles_is_active ON patient_profiles(is_active);

COMMENT ON TABLE patient_profiles IS 'Persistent patient profiles (Care Recipient) - non-sensitive data';

-- ============================================================================
-- TABLE: job_posts (Job posting/draft)
-- ============================================================================

CREATE TABLE job_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hirer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Job details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    job_type job_type NOT NULL,
    risk_level risk_level NOT NULL,
    risk_reason_codes TEXT[],
    risk_reason_detail JSONB,

    -- Schedule
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    scheduled_end_at TIMESTAMPTZ NOT NULL,

    -- Location
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    district VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    geofence_radius_m INT NOT NULL DEFAULT 100 CHECK (geofence_radius_m > 0),

    -- Payment
    hourly_rate INT NOT NULL CHECK (hourly_rate > 0),
    total_hours NUMERIC(5,2) NOT NULL CHECK (total_hours > 0),
    total_amount INT NOT NULL CHECK (total_amount > 0), -- hourly_rate * total_hours
    platform_fee_percent INT NOT NULL DEFAULT 10 CHECK (platform_fee_percent >= 0),
    platform_fee_amount INT NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),

    -- Requirements
    min_trust_level trust_level NOT NULL DEFAULT 'L1',
    required_certifications TEXT[],
    job_tasks_flags TEXT[],
    required_skills_flags TEXT[],
    equipment_available_flags TEXT[],
    precautions_flags TEXT[],

    -- Status
    status job_status NOT NULL DEFAULT 'draft',
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,

    -- Replacement tracking
    replacement_chain_count INT NOT NULL DEFAULT 0 CHECK (replacement_chain_count >= 0),
    original_job_post_id UUID REFERENCES job_posts(id), -- NULL for original, set for replacements

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT job_posts_scheduled_end_after_start CHECK (scheduled_end_at > scheduled_start_at),
    CONSTRAINT job_posts_replacement_limit CHECK (replacement_chain_count <= 3)
);

CREATE INDEX idx_job_posts_hirer_id ON job_posts(hirer_id);
CREATE INDEX idx_job_posts_status ON job_posts(status);
CREATE INDEX idx_job_posts_is_urgent ON job_posts(is_urgent);
CREATE INDEX idx_job_posts_scheduled_start ON job_posts(scheduled_start_at);
CREATE INDEX idx_job_posts_original_job ON job_posts(original_job_post_id) WHERE original_job_post_id IS NOT NULL;

COMMENT ON TABLE job_posts IS 'Job postings (can be draft or posted)';
COMMENT ON COLUMN job_posts.replacement_chain_count IS 'Track replacement depth: 0=original, max=3';

-- ============================================================================
-- TABLE: jobs (Actual job instances)
-- ============================================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    hirer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Current status
    status job_status NOT NULL DEFAULT 'assigned',

    -- Timestamps for state transitions
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ, -- Check-in time
    completed_at TIMESTAMPTZ, -- Check-out time
    cancelled_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,

    -- Closure
    job_closed_at TIMESTAMPTZ, -- Job fully closed (after dispute window)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT jobs_status_valid CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled', 'expired'))
);

CREATE INDEX idx_jobs_job_post_id ON jobs(job_post_id);
CREATE INDEX idx_jobs_hirer_id ON jobs(hirer_id);
CREATE INDEX idx_jobs_status ON jobs(status);

COMMENT ON TABLE jobs IS 'Actual job instances (created when job is assigned)';
COMMENT ON COLUMN jobs.status IS 'Only assigned, in_progress, completed, cancelled, expired are valid';

-- ============================================================================
-- TABLE: job_assignments (Assignment history)
-- CRITICAL: One active assignment per job_id
-- ============================================================================

CREATE TABLE job_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Assignment status
    status assignment_status NOT NULL DEFAULT 'active',

    -- Timestamps
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_confirmed_at TIMESTAMPTZ, -- Check-in
    end_confirmed_at TIMESTAMPTZ, -- Check-out
    replaced_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX idx_job_assignments_caregiver_id ON job_assignments(caregiver_id);
CREATE INDEX idx_job_assignments_status ON job_assignments(status);

-- CRITICAL: One active assignment per job
CREATE UNIQUE INDEX idx_job_assignments_one_active_per_job
ON job_assignments(job_id)
WHERE status = 'active';

COMMENT ON TABLE job_assignments IS 'Job assignment history (supports replacement tracking)';
COMMENT ON INDEX idx_job_assignments_one_active_per_job IS 'INVARIANT: One active assignment per job_id';

-- ============================================================================
-- TABLE: job_patient_requirements (Job-specific care requirements)
-- ============================================================================

CREATE TABLE job_patient_requirements (
    job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

    -- Job-specific care details
    job_care_scope TEXT NOT NULL,
    personal_care_tasks TEXT[], -- e.g., ["bathing", "feeding", "medication"]
    monitoring_focus TEXT[], -- e.g., ["blood_pressure", "glucose", "falls"]
    environment_notes TEXT, -- e.g., "2nd floor, no elevator"
    temporary_restrictions TEXT, -- e.g., "avoid solid food until tomorrow"

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_patient_requirements_patient_id ON job_patient_requirements(patient_id);

COMMENT ON TABLE job_patient_requirements IS 'Job-specific care requirements (visible post-assignment)';

-- ============================================================================
-- TABLE: job_patient_sensitive_data (High-risk job sensitive data)
-- ============================================================================

CREATE TABLE job_patient_sensitive_data (
    job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,

    -- Sensitive health data (L2+ only)
    diagnosis_summary TEXT,
    chronic_conditions_flags TEXT[],
    medication_brief TEXT,
    behavioural_risk_notes TEXT,
    emergency_protocol TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_patient_sensitive_data_patient_id ON job_patient_sensitive_data(patient_id);

COMMENT ON TABLE job_patient_sensitive_data IS 'Sensitive patient data (high-risk jobs, L2+ access only)';

-- ============================================================================
-- TABLE: job_gps_events (GPS tracking for proof of work)
-- ============================================================================

CREATE TABLE job_gps_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- GPS data
    event_type gps_event_type NOT NULL,
    lat NUMERIC(10,7) NOT NULL,
    lng NUMERIC(10,7) NOT NULL,
    accuracy_m NUMERIC(8,2) NOT NULL,

    -- Anti-spoofing data
    confidence_score INT CHECK (confidence_score >= 0 AND confidence_score <= 100),
    cell_tower_lat NUMERIC(10,7),
    cell_tower_lng NUMERIC(10,7),
    device_integrity_flags JSONB,
    fraud_indicators TEXT[],

    -- Timestamp
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_gps_events_job_id ON job_gps_events(job_id);
CREATE INDEX idx_job_gps_events_caregiver_id ON job_gps_events(caregiver_id);
CREATE INDEX idx_job_gps_events_recorded_at ON job_gps_events(recorded_at);

COMMENT ON TABLE job_gps_events IS 'GPS tracking events (check-in, check-out, pings every 15min)';

-- ============================================================================
-- TABLE: job_photo_evidence (Photo proof)
-- ============================================================================

CREATE TABLE job_photo_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Photo data
    phase photo_phase NOT NULL,
    storage_key VARCHAR(500) NOT NULL, -- S3 key or local path

    -- Metadata
    taken_at TIMESTAMPTZ NOT NULL,
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    exif_metadata JSONB,

    -- Validation
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    perceptual_hash VARCHAR(255), -- For duplicate detection
    tampering_flags TEXT[],

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_photo_evidence_job_id ON job_photo_evidence(job_id);
CREATE INDEX idx_job_photo_evidence_caregiver_id ON job_photo_evidence(caregiver_id);
CREATE INDEX idx_job_photo_evidence_phase ON job_photo_evidence(phase);

COMMENT ON TABLE job_photo_evidence IS 'Photo evidence (before/after work) with anti-manipulation checks';

-- ============================================================================
-- TABLE: chat_threads (One thread per job)
-- ============================================================================

CREATE TABLE chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),

    -- Pre-confirmation chat tracking
    pre_confirmation_chat_opened_at TIMESTAMPTZ,
    confirmed_agreement_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_chat_threads_job_id ON chat_threads(job_id);
CREATE INDEX idx_chat_threads_status ON chat_threads(status);

COMMENT ON TABLE chat_threads IS 'Chat threads (one per job) - Chat-centric Job Room';

-- ============================================================================
-- TABLE: chat_messages (Messages in threads)
-- ============================================================================

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system messages

    -- Message data
    type chat_message_type NOT NULL DEFAULT 'text',
    content TEXT,
    attachment_key VARCHAR(500),

    -- Metadata
    is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB, -- For proposal data, etc.

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

COMMENT ON TABLE chat_messages IS 'Chat messages (text, image, file, system)';

-- ============================================================================
-- TABLE: disputes (Dispute tickets for jobs)
-- ============================================================================

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    opened_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status dispute_status NOT NULL DEFAULT 'open',
    reason TEXT NOT NULL,

    assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    settlement_idempotency_key VARCHAR(255),
    settlement_refund_amount BIGINT NOT NULL DEFAULT 0 CHECK (settlement_refund_amount >= 0),
    settlement_payout_amount BIGINT NOT NULL DEFAULT 0 CHECK (settlement_payout_amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_job_post_id ON disputes(job_post_id);
CREATE INDEX idx_disputes_job_id ON disputes(job_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_opened_by_user_id ON disputes(opened_by_user_id);
CREATE UNIQUE INDEX idx_disputes_one_open_per_job_post ON disputes(job_post_id) WHERE status IN ('open','in_review');
CREATE UNIQUE INDEX idx_disputes_settlement_idempotency_key ON disputes(settlement_idempotency_key) WHERE settlement_idempotency_key IS NOT NULL;

-- ============================================================================
-- TABLE: dispute_events (Timeline events for disputes)
-- ============================================================================

CREATE TABLE dispute_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('note', 'status_change')),
    message TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispute_events_dispute_id ON dispute_events(dispute_id);
CREATE INDEX idx_dispute_events_created_at ON dispute_events(created_at);

-- ============================================================================
-- TABLE: dispute_messages (Participant/admin chat for disputes)
-- ============================================================================

CREATE TABLE dispute_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system messages

    type chat_message_type NOT NULL DEFAULT 'text',
    content TEXT,
    attachment_key VARCHAR(500),

    is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX idx_dispute_messages_sender_id ON dispute_messages(sender_id);
CREATE INDEX idx_dispute_messages_created_at ON dispute_messages(created_at);

-- ============================================================================
-- TABLE: wallets (User wallets + Escrow + Platform)
-- ============================================================================

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE, -- For escrow wallets

    -- Wallet type
    wallet_type VARCHAR(50) NOT NULL CHECK (wallet_type IN ('hirer', 'caregiver', 'escrow', 'platform', 'platform_replacement')),

    -- Balance (in smallest currency unit, e.g., satang for THB)
    available_balance BIGINT NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    held_balance BIGINT NOT NULL DEFAULT 0 CHECK (held_balance >= 0),

    -- Currency
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT wallets_user_or_job CHECK (
        (wallet_type = 'escrow' AND job_id IS NOT NULL AND user_id IS NULL) OR
        (wallet_type IN ('hirer', 'caregiver') AND user_id IS NOT NULL AND job_id IS NULL) OR
        (wallet_type IN ('platform', 'platform_replacement') AND user_id IS NULL AND job_id IS NULL)
    )
);

CREATE UNIQUE INDEX idx_wallets_hirer ON wallets(user_id) WHERE wallet_type = 'hirer';
CREATE UNIQUE INDEX idx_wallets_caregiver ON wallets(user_id) WHERE wallet_type = 'caregiver';
CREATE UNIQUE INDEX idx_wallets_escrow_job ON wallets(job_id) WHERE wallet_type = 'escrow';
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_job_id ON wallets(job_id);

COMMENT ON TABLE wallets IS 'User wallets (hirer, caregiver) + Escrow (per job) + Platform';
COMMENT ON COLUMN wallets.available_balance IS 'INVARIANT: Must be >= 0 (no negative balance)';

-- ============================================================================
-- TABLE: ledger_transactions (IMMUTABLE - Append-only!)
-- ============================================================================

CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Transaction details
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',

    -- Double-entry accounting
    from_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,
    to_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,

    -- Transaction type
    type transaction_type NOT NULL,

    -- Reference (what triggered this transaction)
    reference_type transaction_reference_type NOT NULL,
    reference_id UUID NOT NULL,

    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,

    -- Provider reference (for external transactions)
    provider_name VARCHAR(100),
    provider_transaction_id VARCHAR(255),

    -- Description
    description TEXT,
    metadata JSONB,

    -- Timestamp (IMMUTABLE)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- NO updated_at - this table is APPEND-ONLY!
);

CREATE INDEX idx_ledger_transactions_from_wallet ON ledger_transactions(from_wallet_id);
CREATE INDEX idx_ledger_transactions_to_wallet ON ledger_transactions(to_wallet_id);
CREATE INDEX idx_ledger_transactions_reference ON ledger_transactions(reference_type, reference_id);
CREATE INDEX idx_ledger_transactions_created_at ON ledger_transactions(created_at);
CREATE INDEX idx_ledger_transactions_idempotency ON ledger_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE ledger_transactions IS 'IMMUTABLE LEDGER - Append-only, NO UPDATE/DELETE allowed!';

-- Prevent UPDATE and DELETE on ledger_transactions
CREATE OR REPLACE FUNCTION prevent_ledger_modification() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger_transactions is IMMUTABLE - UPDATE/DELETE not allowed. Use reversal transactions instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_update_ledger BEFORE UPDATE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER prevent_delete_ledger BEFORE DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

-- ============================================================================
-- TABLE: banks (Bank master data)
-- ============================================================================

CREATE TABLE banks (
    code VARCHAR(20) PRIMARY KEY, -- e.g., "BBL", "SCB", "KBANK"
    full_name_th VARCHAR(255) NOT NULL UNIQUE,
    full_name_en VARCHAR(255) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banks_is_active ON banks(is_active);

COMMENT ON TABLE banks IS 'Bank master data (prevent users from typing arbitrary bank names)';

-- ============================================================================
-- TABLE: bank_accounts (User bank accounts for withdrawal)
-- ============================================================================

CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Bank details
    bank_code VARCHAR(20) NOT NULL REFERENCES banks(code),
    account_number_encrypted TEXT NOT NULL, -- Encrypted
    account_number_last4 VARCHAR(4) NOT NULL, -- For display
    account_name VARCHAR(255) NOT NULL,

    -- Verification
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_name_match_percent INT CHECK (kyc_name_match_percent >= 0 AND kyc_name_match_percent <= 100),

    -- Status
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_is_primary ON bank_accounts(user_id, is_primary) WHERE is_primary = TRUE;

COMMENT ON TABLE bank_accounts IS 'User bank accounts (encrypted account numbers, KYC name matching)';

-- ============================================================================
-- TABLE: withdrawal_requests (Manual withdrawal by admin)
-- ============================================================================

CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

    -- Amount
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',

    -- Status
    status withdrawal_status NOT NULL DEFAULT 'queued',

    -- Admin actions
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,

    -- Payment proof (uploaded by admin after manual transfer)
    payout_reference VARCHAR(255), -- Bank transaction reference
    payout_proof_storage_key VARCHAR(500), -- Slip/proof image
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,

    -- Rejection
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Provider reference (for future automation)
    provider_name VARCHAR(100),
    provider_request_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);

COMMENT ON TABLE withdrawal_requests IS 'Withdrawal requests (manual approval by admin)';

-- ============================================================================
-- TABLE: notifications
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification details
    channel notification_channel NOT NULL,
    template_key VARCHAR(100) NOT NULL, -- e.g., "job_assigned", "payment_received"

    -- Content
    title VARCHAR(255),
    body TEXT,
    data JSONB, -- Additional data for the notification

    -- Reference
    reference_type VARCHAR(50), -- e.g., "job", "payment"
    reference_id UUID,

    -- Status
    status notification_status NOT NULL DEFAULT 'queued',

    -- Provider (for email/SMS/push)
    provider_name VARCHAR(100),
    provider_message_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

COMMENT ON TABLE notifications IS 'Notification queue (email, SMS, push, in-app)';

-- ============================================================================
-- TABLE: trust_score_history (Audit trail for trust score changes)
-- ============================================================================

CREATE TABLE trust_score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Score change
    delta INT NOT NULL, -- Can be negative
    score_before INT NOT NULL CHECK (score_before >= 0 AND score_before <= 100),
    score_after INT NOT NULL CHECK (score_after >= 0 AND score_after <= 100),

    -- Trust level change (if any)
    trust_level_before trust_level,
    trust_level_after trust_level,

    -- Reason
    reason_code VARCHAR(100) NOT NULL, -- e.g., "job_completed", "no_show", "good_review"
    reason_detail TEXT,

    -- Reference
    reference_type VARCHAR(50), -- e.g., "job", "review"
    reference_id UUID,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_score_history_user_id ON trust_score_history(user_id);
CREATE INDEX idx_trust_score_history_created_at ON trust_score_history(created_at);

COMMENT ON TABLE trust_score_history IS 'Audit trail for trust score changes (for transparency)';

-- ============================================================================
-- TABLE: auth_sessions (Login sessions)
-- ============================================================================

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session data
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255) UNIQUE,

    -- Device info
    device_info TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX idx_auth_sessions_status ON auth_sessions(status);

COMMENT ON TABLE auth_sessions IS 'Authentication sessions (JWT tokens)';

-- ============================================================================
-- TABLE: topup_intents (Top-up payment intents)
-- ============================================================================

CREATE TABLE topup_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Amount
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',

    -- Payment method
    method VARCHAR(50) NOT NULL CHECK (method IN ('dynamic_qr', 'payment_link')),

    -- Provider data
    provider_name VARCHAR(100) NOT NULL,
    provider_payment_id VARCHAR(255),
    provider_transaction_id VARCHAR(255),

    -- Payment data (QR/Link)
    qr_payload TEXT,
    payment_link_url TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'expired', 'cancelled')),

    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX idx_topup_intents_user_id ON topup_intents(user_id);
CREATE INDEX idx_topup_intents_status ON topup_intents(status);
CREATE INDEX idx_topup_intents_provider_payment_id ON topup_intents(provider_payment_id);

COMMENT ON TABLE topup_intents IS 'Top-up payment intents (QR/Link from mock payment gateway)';

-- ============================================================================
-- TABLE: provider_webhooks (Webhook event log for deduplication)
-- ============================================================================

CREATE TABLE provider_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Provider info
    provider_name VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) NOT NULL, -- Provider's event ID
    event_type VARCHAR(100) NOT NULL,

    -- Reference
    reference_type VARCHAR(50), -- e.g., "topup", "kyc"
    reference_id UUID,

    -- Payload
    payload JSONB NOT NULL,

    -- Signature verification
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,

    -- Processing status
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_provider_webhooks_event_id ON provider_webhooks(provider_name, event_id);
CREATE INDEX idx_provider_webhooks_reference ON provider_webhooks(reference_type, reference_id);
CREATE INDEX idx_provider_webhooks_processed ON provider_webhooks(processed);

COMMENT ON TABLE provider_webhooks IS 'Webhook event log (for idempotency and deduplication)';

-- ============================================================================
-- Initial Data: Platform wallets
-- ============================================================================

INSERT INTO wallets (wallet_type, currency) VALUES
    ('platform', 'THB'),
    ('platform_replacement', 'THB');

-- ============================================================================
-- End of Schema
-- ============================================================================
