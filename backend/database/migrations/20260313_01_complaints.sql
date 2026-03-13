-- ============================================================================
-- Migration: Complaint / Report System
-- Date: 2026-03-13
-- Description: เพิ่มระบบร้องเรียนทั่วไป (ไม่ผูก job) แยกจาก dispute
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status') THEN
    CREATE TYPE complaint_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- ผู้แจ้ง
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- ประเภทเรื่อง
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'inappropriate_name',
    'inappropriate_photo',
    'inappropriate_chat',
    'scam_fraud',
    'harassment',
    'safety_concern',
    'payment_issue',
    'service_quality',
    'other'
  )),

  -- ผู้ถูกร้องเรียน (ถ้ามี)
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- งานที่เกี่ยวข้อง (ถ้ามี — ไม่บังคับ)
  related_job_post_id UUID REFERENCES job_posts(id) ON DELETE SET NULL,

  -- รายละเอียด
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- สถานะ
  status complaint_status NOT NULL DEFAULT 'open',

  -- แอดมินที่รับเรื่อง
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- ผลการพิจารณา
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_reporter_id ON complaints(reporter_id);
CREATE INDEX IF NOT EXISTS idx_complaints_target_user_id ON complaints(target_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

-- ตารางเก็บไฟล์แนบ (รูปภาพหลักฐาน)
CREATE TABLE IF NOT EXISTS complaint_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint_id ON complaint_attachments(complaint_id);
