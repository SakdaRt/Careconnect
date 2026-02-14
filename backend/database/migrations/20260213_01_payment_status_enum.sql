-- Create payment status enum (idempotent)
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'processing', 
        'completed',
        'failed',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add comment for documentation
COMMENT ON TYPE payment_status IS 'Payment status enum for CareConnect payment processing';
