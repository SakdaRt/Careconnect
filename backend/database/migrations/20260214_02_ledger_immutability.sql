-- Enforce ledger immutability at the database level.
-- ledger_transactions is append-only: no UPDATE or DELETE allowed.

-- Trigger function that raises an exception on any UPDATE or DELETE attempt
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger_transactions is immutable: % not allowed', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Block UPDATE
DROP TRIGGER IF EXISTS trg_ledger_no_update ON ledger_transactions;
CREATE TRIGGER trg_ledger_no_update
    BEFORE UPDATE ON ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- Block DELETE
DROP TRIGGER IF EXISTS trg_ledger_no_delete ON ledger_transactions;
CREATE TRIGGER trg_ledger_no_delete
    BEFORE DELETE ON ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
