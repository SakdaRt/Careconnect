ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS risk_reason_codes TEXT[];

ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS risk_reason_detail JSONB;

CREATE INDEX IF NOT EXISTS idx_job_posts_risk_level ON job_posts(risk_level);
