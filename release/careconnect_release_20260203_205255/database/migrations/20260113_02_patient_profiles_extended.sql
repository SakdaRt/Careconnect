ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS cognitive_status VARCHAR(30);

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS symptoms_flags TEXT[];

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS medical_devices_flags TEXT[];

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS care_needs_flags TEXT[];

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS behavior_risks_flags TEXT[];

ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS allergies_flags TEXT[];

CREATE INDEX IF NOT EXISTS idx_patient_profiles_cognitive_status ON patient_profiles(cognitive_status);
