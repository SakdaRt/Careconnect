ALTER TABLE hirer_profiles
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

ALTER TABLE caregiver_profiles
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
