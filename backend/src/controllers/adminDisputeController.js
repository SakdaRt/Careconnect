import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import { settleDispute } from '../services/disputeService.js';

const logAdminAction = async (adminUserId, action, details = {}) => {
  try {
    await query(
      `INSERT INTO audit_events (id, user_id, event_type, action, details, created_at)
       VALUES ($1, $2, 'admin_action', $3, $4, NOW())`,
      [uuidv4(), adminUserId, action, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('[Admin Audit] Failed to log action:', err);
  }
};

const parseIntOr = (value, fallback) => {
  const num = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(num) ? num : fallback;
};

export const listDisputes = async (req, res) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, parseIntOr(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const assigned = String(req.query.assigned || '').trim();

    const where = [];
    const values = [];
    let idx = 1;

    if (status) {
      values.push(status);
      where.push(`d.status = $${idx++}::dispute_status`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(
        `(d.id::text ILIKE $${idx} OR d.job_post_id::text ILIKE $${idx} OR COALESCE(d.job_id::text, '') ILIKE $${idx} OR jp.title ILIKE $${idx} OR COALESCE(hp.display_name, '') ILIKE $${idx} OR COALESCE(cp.display_name, '') ILIKE $${idx})`
      );
      idx += 1;
    }
    if (assigned === 'me') {
      values.push(req.userId);
      where.push(`d.assigned_admin_id = $${idx++}`);
    } else if (assigned === 'unassigned') {
      where.push(`d.assigned_admin_id IS NULL`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         d.*,
         jp.title,
         hp.display_name as hirer_name,
         ja.caregiver_id,
         cp.display_name as caregiver_name,
         uo.role as opened_by_role
       FROM disputes d
       JOIN job_posts jp ON jp.id = d.job_post_id
       LEFT JOIN users uo ON uo.id = d.opened_by_user_id
       LEFT JOIN jobs j ON j.id = d.job_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       ${whereSql}
       ORDER BY d.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total
       FROM disputes d
       JOIN job_posts jp ON jp.id = d.job_post_id
       LEFT JOIN jobs j ON j.id = d.job_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       ${whereSql}`,
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
    console.error('[Admin Disputes] List disputes error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list disputes' });
  }
};

export const getDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const dRes = await query(
      `SELECT
         d.*,
         jp.title,
         jp.hirer_id,
         hp.display_name as hirer_name,
         j.id as resolved_job_id,
         j.status as job_status,
         ja.caregiver_id,
         cp.display_name as caregiver_name,
         uo.role as opened_by_role
       FROM disputes d
       JOIN job_posts jp ON jp.id = d.job_post_id
       LEFT JOIN users uo ON uo.id = d.opened_by_user_id
       LEFT JOIN jobs j ON j.id = d.job_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       WHERE d.id = $1`,
      [id]
    );

    if (dRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Dispute not found' });
    }

    const eRes = await query(
      `SELECT * FROM dispute_events WHERE dispute_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const mRes = await query(
      `SELECT
         m.*,
         u.email as sender_email,
         u.role as sender_role
       FROM dispute_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.dispute_id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: { dispute: dRes.rows[0], events: eRes.rows, messages: mRes.rows },
    });
  } catch (error) {
    console.error('[Admin Disputes] Get dispute error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get dispute' });
  }
};

export const updateDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body?.status ? String(req.body.status).trim() : null;
    const note = req.body?.note ? String(req.body.note).trim() : null;
    const assign_to_me = !!req.body?.assign_to_me;

    if (!status && !note && !assign_to_me) {
      return res.status(400).json({ error: 'Validation error', message: 'No updates provided' });
    }

    if (status && !['open', 'in_review', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid status' });
    }

    const result = await transaction(async (client) => {
      const existing = await client.query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [id]);
      if (existing.rows.length === 0) return null;
      const dispute = existing.rows[0];

      if (assign_to_me && !dispute.assigned_admin_id) {
        await client.query(
          `UPDATE disputes SET assigned_admin_id = $1, updated_at = NOW() WHERE id = $2`,
          [req.userId, id]
        );
        await client.query(
          `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
           VALUES ($1, $2, $3, 'note', $4, NOW())`,
          [uuidv4(), id, req.userId, 'Assigned to admin']
        );
      }

      if (status && status !== dispute.status) {
        await client.query(
          `UPDATE disputes
           SET status = $1::dispute_status,
               resolved_at = CASE WHEN $1 IN ('resolved','rejected') THEN NOW() ELSE NULL END,
               updated_at = NOW()
           WHERE id = $2`,
          [status, id]
        );

        await client.query(
          `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
           VALUES ($1, $2, $3, 'status_change', $4, NOW())`,
          [uuidv4(), id, req.userId, `Status changed: ${dispute.status} → ${status}`]
        );
      }

      if (note) {
        await client.query(
          `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
           VALUES ($1, $2, $3, 'note', $4, NOW())`,
          [uuidv4(), id, req.userId, note]
        );
        await client.query(`UPDATE disputes SET updated_at = NOW() WHERE id = $1`, [id]);
      }

      const next = await client.query(`SELECT * FROM disputes WHERE id = $1`, [id]);
      return next.rows[0];
    });

    if (!result) {
      return res.status(404).json({ error: 'Not Found', message: 'Dispute not found' });
    }

    await logAdminAction(req.userId, 'dispute:update', {
      dispute_id: id,
      status: req.body?.status || null,
      assign_to_me: req.body?.assign_to_me || false,
      has_note: !!req.body?.note,
    });

    res.json({ success: true, message: 'Dispute updated', data: { dispute: result } });
  } catch (error) {
    console.error('[Admin Disputes] Update dispute error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to update dispute' });
  }
};

export const settle = async (req, res) => {
  try {
    const { id } = req.params;
    const refund_amount = req.body?.refund_amount;
    const payout_amount = req.body?.payout_amount;
    const resolution = req.body?.resolution;
    const idempotency_key = req.body?.idempotency_key;

    const result = await settleDispute(id, req.userId, { refund_amount, payout_amount, resolution, idempotency_key });

    await logAdminAction(req.userId, 'dispute:settle', {
      dispute_id: id,
      refund_amount,
      payout_amount,
      has_resolution: !!resolution,
      idempotency_key: idempotency_key || null,
    });

    res.json({
      success: true,
      message: 'Dispute settled',
      data: result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status =
      msg.includes('not found') ? 404 : msg.includes('Invalid') || msg.includes('Insufficient') || msg.includes('Cannot') || msg.includes('No ') ? 400 : 500;
    if (status === 500) console.error('[Admin Disputes] Settle error:', error);
    res.status(status).json({
      error: status === 500 ? 'Server error' : 'Bad request',
      message: msg,
    });
  }
};

export default { listDisputes, getDispute, updateDispute, settle };

