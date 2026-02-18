-- Reviews table: hirers can review caregivers after job completion
CREATE TABLE IF NOT EXISTS caregiver_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  job_post_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  caregiver_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_caregiver_reviews_caregiver ON caregiver_reviews(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_reviews_reviewer ON caregiver_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_reviews_job ON caregiver_reviews(job_id);

-- Favorites table: hirers can favorite caregivers
CREATE TABLE IF NOT EXISTS caregiver_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hirer_id UUID NOT NULL,
  caregiver_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hirer_id, caregiver_id)
);

CREATE INDEX IF NOT EXISTS idx_caregiver_favorites_hirer ON caregiver_favorites(hirer_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_favorites_caregiver ON caregiver_favorites(caregiver_id);
