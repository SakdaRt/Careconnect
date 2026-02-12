DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
    CREATE TYPE dispute_status AS ENUM ('open', 'in_review', 'resolved', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS disputes (
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

CREATE INDEX IF NOT EXISTS idx_disputes_job_post_id ON disputes(job_post_id);
CREATE INDEX IF NOT EXISTS idx_disputes_job_id ON disputes(job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by_user_id ON disputes(opened_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_one_open_per_job_post ON disputes(job_post_id) WHERE status IN ('open','in_review');
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_settlement_idempotency_key ON disputes(settlement_idempotency_key) WHERE settlement_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS dispute_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('note', 'status_change')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_events_dispute_id ON dispute_events(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_events_created_at ON dispute_events(created_at);

CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type chat_message_type NOT NULL DEFAULT 'text',
  content TEXT,
  attachment_key VARCHAR(500),
  is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender_id ON dispute_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON dispute_messages(created_at);

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS settlement_idempotency_key VARCHAR(255);

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS settlement_refund_amount BIGINT NOT NULL DEFAULT 0;

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS settlement_payout_amount BIGINT NOT NULL DEFAULT 0;

