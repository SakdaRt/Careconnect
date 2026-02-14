-- Add address_line2 to patient_profiles for extra address details
ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
