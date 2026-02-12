ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS job_tasks_flags TEXT[];

ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS required_skills_flags TEXT[];

ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS equipment_available_flags TEXT[];

ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS precautions_flags TEXT[];

CREATE INDEX IF NOT EXISTS idx_job_posts_job_type ON job_posts(job_type);
