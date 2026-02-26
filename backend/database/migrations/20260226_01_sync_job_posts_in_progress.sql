-- Sync job_posts.status to 'in_progress' for jobs that are already in_progress
-- This fixes existing data where checkIn only updated jobs.status but not job_posts.status
UPDATE job_posts jp
SET status = 'in_progress', updated_at = NOW()
FROM jobs j
WHERE j.job_post_id = jp.id
  AND j.status = 'in_progress'
  AND jp.status = 'assigned';
