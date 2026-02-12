CREATE TABLE IF NOT EXISTS user_policy_acceptances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('hirer', 'caregiver')),
    policy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version_policy_accepted VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_policy_acceptances_user_id ON user_policy_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_policy_acceptances_role ON user_policy_acceptances(role);
