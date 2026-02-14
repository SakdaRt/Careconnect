-- Caregiver certification/qualification documents
CREATE TABLE IF NOT EXISTS caregiver_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Document info
    document_type VARCHAR(50) NOT NULL,       -- e.g. 'certification', 'license', 'training', 'other'
    title VARCHAR(255) NOT NULL,              -- e.g. 'ใบรับรองปฐมพยาบาล'
    description TEXT,
    issuer VARCHAR(255),                      -- e.g. 'สภากาชาดไทย'
    issued_date DATE,
    expiry_date DATE,

    -- File
    file_path VARCHAR(500) NOT NULL,          -- relative path under /uploads
    file_name VARCHAR(255) NOT NULL,          -- original filename
    file_size INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_caregiver_documents_user_id ON caregiver_documents(user_id);
