-- Migration: Add evidence_note and evidence_photo_url to jobs table
-- Date: 2026-03-31

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS evidence_note TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;
