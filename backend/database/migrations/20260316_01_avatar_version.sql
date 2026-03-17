-- Add avatar and avatar_version columns to users table
-- avatar: legacy path (VARCHAR) - kept for backward compatibility
-- avatar_version: incremented on each upload, 0 = no avatar

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_version INT NOT NULL DEFAULT 0;

-- Migrate existing avatar data: if user has avatar path, set version=1
UPDATE users SET avatar_version = 1 WHERE avatar IS NOT NULL AND avatar != '' AND avatar_version = 0;

COMMENT ON COLUMN users.avatar_version IS 'Incremented on each avatar upload. 0 = no avatar. Used for cache-busting URL.';
