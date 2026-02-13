-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing', 
    'completed',
    'failed',
    'refunded'
);

-- Add comment for documentation
COMMENT ON TYPE payment_status IS 'Payment status enum for CareConnect payment processing';
