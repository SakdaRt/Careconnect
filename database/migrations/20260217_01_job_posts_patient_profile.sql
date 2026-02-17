ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS patient_profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_posts_patient_profile_id ON job_posts(patient_profile_id);

-- Legacy backfill: infer care recipient by exact home-address match within the same hirer.
WITH candidate_matches AS (
  SELECT
    jp.id AS job_post_id,
    MIN(pp.id) AS patient_id,
    COUNT(*) AS match_count
  FROM job_posts jp
  JOIN patient_profiles pp
    ON pp.hirer_id = jp.hirer_id
   AND pp.is_active = TRUE
   AND COALESCE(LOWER(TRIM(pp.address_line1)), '') = COALESCE(LOWER(TRIM(jp.address_line1)), '')
   AND COALESCE(LOWER(TRIM(pp.district)), '') = COALESCE(LOWER(TRIM(jp.district)), '')
   AND COALESCE(LOWER(TRIM(pp.province)), '') = COALESCE(LOWER(TRIM(jp.province)), '')
   AND COALESCE(TRIM(pp.postal_code), '') = COALESCE(TRIM(jp.postal_code), '')
  WHERE jp.patient_profile_id IS NULL
  GROUP BY jp.id
)
UPDATE job_posts jp
SET patient_profile_id = cm.patient_id,
    updated_at = NOW()
FROM candidate_matches cm
WHERE jp.id = cm.job_post_id
  AND cm.match_count = 1;
