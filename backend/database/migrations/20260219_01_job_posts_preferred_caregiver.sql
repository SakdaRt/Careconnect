-- Add preferred_caregiver_id to job_posts for direct caregiver assignment flow
ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS preferred_caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_posts_preferred_caregiver ON job_posts(preferred_caregiver_id)
  WHERE preferred_caregiver_id IS NOT NULL;
