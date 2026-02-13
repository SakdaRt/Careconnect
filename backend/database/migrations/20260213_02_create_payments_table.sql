-- Create payments table for UI display and simulation
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User references
    payer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Job reference (optional)
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    
    -- Payment amounts (in THB - baht)
    amount BIGINT NOT NULL CHECK (amount > 0),
    fee_amount BIGINT NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    
    -- Status and processing
    status payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'mock',
    provider_payment_id VARCHAR(255),
    
    -- Metadata for additional information
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_payments_payer_user_id ON payments(payer_user_id);
CREATE INDEX idx_payments_payee_user_id ON payments(payee_user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_job_id ON payments(job_id);

-- Create composite index for user payment queries
CREATE INDEX idx_payments_user_access ON payments(payer_user_id, payee_user_id, status);

-- Add comments for documentation
COMMENT ON TABLE payments IS 'Payment records for UI display and simulation - actual money movement via wallet/ledger system';
COMMENT ON COLUMN payments.amount IS 'Payment amount in Thai Baht (THB) - BIGINT for larger values';
COMMENT ON COLUMN payments.fee_amount IS 'Platform fee amount in Thai Baht (THB) - BIGINT for larger values';
COMMENT ON COLUMN payments.metadata IS 'Additional payment metadata stored as JSONB';
