-- Create user_policy_acceptances table for tracking policy acceptances
CREATE TABLE IF NOT EXISTS user_policy_acceptances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    policy_accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version_policy_accepted VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_policy_acceptances_user_id ON user_policy_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_policy_acceptances_role ON user_policy_acceptances(role);
