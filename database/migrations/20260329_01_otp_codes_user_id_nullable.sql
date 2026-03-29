-- Migration: make otp_codes.user_id nullable
-- Registration OTPs are sent before the user record exists,
-- so user_id must allow NULL at the point of OTP creation.
ALTER TABLE otp_codes ALTER COLUMN user_id DROP NOT NULL;
