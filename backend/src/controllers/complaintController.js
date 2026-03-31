import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { notifyComplaintUpdated } from '../services/notificationService.js';

const VALID_CATEGORIES = [
  'inappropriate_name',
  'inappropriate_photo',
  'inappropriate_chat',
  'scam_fraud',
  'harassment',
  'safety_concern',
  'payment_issue',
  'service_quality',
  'fake_certificate',
  'other',
];

export const createComplaint = async (req, res) => {
  try {
    const category = String(req.body?.category || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const description = String(req.body?.description || '').trim();
    const target_user_id = req.body?.target_user_id || null;
    const related_job_post_id = req.body?.related_job_post_id || null;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Validation error', message: 'กรุณาเลือกประเภทเรื่องที่ถูกต้อง' });
    }
    if (!subject || subject.length < 2) {
      return res.status(400).json({ error: 'Validation error', message: 'กรุณากรอกหัวข้อเรื่อง' });
    }
    if (!description || description.length < 10) {
      return res.status(400).json({ error: 'Validation error', message: 'กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร' });
    }

    const result = await transaction(async (client) => {
      const complaintId = uuidv4();
      await client.query(
        `INSERT INTO complaints (id, reporter_id, category, target_user_id, related_job_post_id, subject, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', NOW(), NOW())`,
        [complaintId, req.userId, category, target_user_id, related_job_post_id, subject, description]
      );

      const files = req.files || [];
      const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
      for (const file of files) {
        const relativePath = path.relative(uploadDir, file.path).replace(/\\/g, '/');
        await client.query(
          `INSERT INTO complaint_attachments (id, complaint_id, file_path, file_name, file_size, mime_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [uuidv4(), complaintId, relativePath, file.originalname, file.size, file.mimetype]
        );
      }

      const row = await client.query(`SELECT * FROM complaints WHERE id = $1`, [complaintId]);
      const attachments = await client.query(`SELECT * FROM complaint_attachments WHERE complaint_id = $1`, [complaintId]);
      return { ...row.rows[0], attachments: attachments.rows };
    });

    res.json({ success: true, data: { complaint: result } });
  } catch (error) {
    console.error('[Complaints] Create error:', error);
    if (req.files) {
      for (const file of req.files) {
        fs.unlink(file.path, () => {});
      }
    }
    res.status(500).json({ error: 'Server error', message: 'ไม่สามารถส่งเรื่องร้องเรียนได้' });
  }
};

export const getMyComplaints = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, 
              (SELECT json_agg(ca.*) FROM complaint_attachments ca WHERE ca.complaint_id = c.id) as attachments
       FROM complaints c
       WHERE c.reporter_id = $1
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Complaints] List error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list complaints' });
  }
};

export const getComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.*,
              (SELECT json_agg(ca.*) FROM complaint_attachments ca WHERE ca.complaint_id = c.id) as attachments
       FROM complaints c
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'ไม่พบเรื่องร้องเรียน' });
    }
    const complaint = result.rows[0];
    if (complaint.reporter_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'ไม่มีสิทธิ์ดูเรื่องร้องเรียนนี้' });
    }
    res.json({ success: true, data: { complaint } });
  } catch (error) {
    console.error('[Complaints] Get error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get complaint' });
  }
};

export const adminListComplaints = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || '').trim();
    const category = String(req.query.category || '').trim();

    const where = [];
    const values = [];
    let idx = 1;

    if (status) { values.push(status); where.push(`c.status = $${idx++}::complaint_status`); }
    if (category) { values.push(category); where.push(`c.category = $${idx++}`); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT c.*,
              rp.display_name as reporter_name,
              ru.email as reporter_email,
              ru.role as reporter_role,
              tp.display_name as target_name,
              (SELECT json_agg(ca.*) FROM complaint_attachments ca WHERE ca.complaint_id = c.id) as attachments
       FROM complaints c
       LEFT JOIN users ru ON ru.id = c.reporter_id
       LEFT JOIN hirer_profiles rp ON rp.user_id = c.reporter_id
       LEFT JOIN hirer_profiles tp ON tp.user_id = c.target_user_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM complaints c ${whereSql}`,
      values
    );
    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      data: {
        data: result.rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('[Admin Complaints] List error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list complaints' });
  }
};

export const adminUpdateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body?.status ? String(req.body.status).trim() : null;
    const admin_note = req.body?.admin_note ? String(req.body.admin_note).trim() : null;
    const assign_to_me = !!req.body?.assign_to_me;

    if (!status && !admin_note && !assign_to_me) {
      return res.status(400).json({ error: 'Validation error', message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    }

    if (status && !['open', 'in_review', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Validation error', message: 'สถานะไม่ถูกต้อง' });
    }

    const result = await transaction(async (client) => {
      const existing = await client.query(`SELECT * FROM complaints WHERE id = $1 FOR UPDATE`, [id]);
      if (existing.rows.length === 0) return null;

      if (assign_to_me) {
        await client.query(`UPDATE complaints SET assigned_admin_id = $1, updated_at = NOW() WHERE id = $2`, [req.userId, id]);
      }
      if (status) {
        await client.query(
          `UPDATE complaints SET status = $1::complaint_status, resolved_at = CASE WHEN $1 IN ('resolved','dismissed') THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2`,
          [status, id]
        );
      }
      if (admin_note) {
        await client.query(`UPDATE complaints SET admin_note = $1, updated_at = NOW() WHERE id = $2`, [admin_note, id]);
      }

      const row = await client.query(
        `SELECT c.*,
                (SELECT json_agg(ca.*) FROM complaint_attachments ca WHERE ca.complaint_id = c.id) as attachments
         FROM complaints c WHERE c.id = $1`,
        [id]
      );
      return row.rows[0];
    });

    if (!result) {
      return res.status(404).json({ error: 'Not Found', message: 'ไม่พบเรื่องร้องเรียน' });
    }

    if (status && result.reporter_id) {
      notifyComplaintUpdated(result.reporter_id, status, result.subject, id).catch(() => {});
    }

    res.json({ success: true, data: { complaint: result } });
  } catch (error) {
    console.error('[Admin Complaints] Update error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to update complaint' });
  }
};
