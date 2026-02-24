-- Migration: Add ban flags and admin_note columns to users table
-- These columns are required by adminUserController for ban management

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ban_login       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_job_create  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_job_accept  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_withdraw    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_note      TEXT;

COMMENT ON COLUMN users.ban_login      IS 'Admin ban: prevents user from logging in';
COMMENT ON COLUMN users.ban_job_create IS 'Admin ban: prevents user from creating job posts';
COMMENT ON COLUMN users.ban_job_accept IS 'Admin ban: prevents caregiver from accepting jobs';
COMMENT ON COLUMN users.ban_withdraw   IS 'Admin ban: prevents user from withdrawing funds';
COMMENT ON COLUMN users.admin_note     IS 'Internal admin notes about this user';
