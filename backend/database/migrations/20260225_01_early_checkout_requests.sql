-- Early checkout request table
-- When caregiver wants to checkout before scheduled_end_at, they must request approval from hirer
CREATE TABLE IF NOT EXISTS early_checkout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id),
  hirer_id UUID NOT NULL REFERENCES users(id),
  evidence_note TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_early_checkout_job_id ON early_checkout_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_early_checkout_hirer_pending ON early_checkout_requests(hirer_id, status) WHERE status = 'pending';
