-- Add unique index to ledger_transactions for idempotency
-- This prevents duplicate ledger entries for the same reference

-- Create unique index on (reference_type, reference_id, transaction_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_transactions_reference_unique 
ON ledger_transactions(reference_type, reference_id, transaction_type);

-- Add comment for documentation
COMMENT ON INDEX idx_ledger_transactions_reference_unique IS 
'Prevents duplicate ledger entries for the same reference type, ID, and transaction type';
