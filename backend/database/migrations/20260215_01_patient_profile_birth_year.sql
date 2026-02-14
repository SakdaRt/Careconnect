-- Add birth_year to patient_profiles to persist year of birth from care recipient form
ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS birth_year INTEGER;
