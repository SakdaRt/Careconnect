-- Migration: Add patient_profile_id column to job_posts
-- This column exists in schema.sql but was never created in the running database

ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS patient_profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_posts_patient_profile_id ON job_posts(patient_profile_id);
