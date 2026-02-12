import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

const getParticipantContext = async (jobPostIdOrJobId) => {
  const res = await query(
    `SELECT
       jp.id as job_post_id,
       jp.hirer_id,
       j.id as job_id,
       ja.caregiver_id
     FROM job_posts jp
     LEFT JOIN jobs j ON j.job_post_id = jp.id
     LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
     WHERE jp.id = $1 OR j.id = $1
     LIMIT 1`,
    [jobPostIdOrJobId]
  );
  return res.rows[0] || null;
};

const ensureParticipant = async (disputeId, userId) => {
  const res = await query(
    `SELECT
       d.*,
       u.role as requester_role,
       jp.hirer_id,
       ja.caregiver_id
     FROM disputes d
     JOIN job_posts jp ON jp.id = d.job_post_id
     LEFT JOIN users u ON u.id = $2
     LEFT JOIN jobs j ON j.id = d.job_id
     LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
     WHERE d.id = $1`,
    [disputeId, userId]
  );
  if (res.rows.length === 0) return { ok: false, dispute: null };
  const d = res.rows[0];
  const allowed =
    d.requester_role === 'admin' || d.hirer_id === userId || d.caregiver_id === userId || d.assigned_admin_id === userId;
  return { ok: allowed, dispute: d };
};

export const createDispute = async (req, res) => {
  try {
    const job_id = String(req.body?.job_id || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!job_id || !reason) {
      return res.status(400).json({ error: 'Validation error', message: 'job_id and reason are required' });
    }

    const ctx = await getParticipantContext(job_id);
    if (!ctx) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

  if (!ctx.job_id || !ctx.caregiver_id) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Cannot open dispute before a caregiver accepts the job',
      code: 'DISPUTE_JOB_NOT_ASSIGNED',
    });
  }

    if (ctx.hirer_id !== req.userId && ctx.caregiver_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not authorized to open dispute for this job' });
    }

    const requesterRole = req.userRole || (ctx.hirer_id === req.userId ? 'hirer' : 'caregiver');

    const created = await transaction(async (client) => {
      const existing = await client.query(
        `SELECT * FROM disputes WHERE job_post_id = $1 AND status IN ('open','in_review') ORDER BY created_at DESC LIMIT 1`,
        [ctx.job_post_id]
      );
      if (existing.rows.length > 0) return existing.rows[0];

      const disputeId = uuidv4();
      try {
        try {
          await client.query(
            `INSERT INTO disputes (id, job_post_id, job_id, hirer_id, caregiver_id, created_by_user_id, created_by_role, reason, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW(), NOW())`,
            [disputeId, ctx.job_post_id, ctx.job_id, ctx.hirer_id, ctx.caregiver_id, req.userId, requesterRole, reason]
          );
        } catch (innerError) {
          if (innerError && typeof innerError === 'object' && String(innerError.code || '') === '42703') {
            await client.query(
              `INSERT INTO disputes (id, job_post_id, job_id, opened_by_user_id, status, reason, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'open', $5, NOW(), NOW())`,
              [disputeId, ctx.job_post_id, ctx.job_id, req.userId, reason]
            );
          } else {
            throw innerError;
          }
        }
      } catch (error) {
        if (error && typeof error === 'object' && String(error.code || '') === '23505') {
          const retry = await client.query(
            `SELECT * FROM disputes WHERE job_post_id = $1 AND status IN ('open','in_review') ORDER BY created_at DESC LIMIT 1`,
            [ctx.job_post_id]
          );
          if (retry.rows.length > 0) return retry.rows[0];
        }
        throw error;
      }

      try {
        await client.query(
          `UPDATE disputes SET opened_by_user_id = created_by_user_id WHERE id = $1 AND opened_by_user_id IS NULL`,
          [disputeId]
        );
      } catch (error) {
        if (!error || typeof error !== 'object' || String(error.code || '') !== '42703') {
          throw error;
        }
      }

      try {
        await client.query(
          `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
           VALUES ($1, $2, $3, 'status_change', $4, NOW())`,
          [uuidv4(), disputeId, req.userId, 'Dispute opened: open']
        );
      } catch (error) {
        if (!error || typeof error !== 'object' || String(error.code || '') !== '42P01') {
          throw error;
        }
      }

      try {
        await client.query(
          `INSERT INTO dispute_messages (id, dispute_id, sender_id, type, content, is_system_message, created_at)
           VALUES ($1, $2, NULL, 'system', $3, true, NOW())`,
          [uuidv4(), disputeId, `Dispute opened by user. Reason: ${reason}`]
        );
      } catch (error) {
        if (!error || typeof error !== 'object' || String(error.code || '') !== '42P01') {
          throw error;
        }
      }

      const row = await client.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
      return row.rows[0];
    });

    res.json({ success: true, data: { dispute: created } });
  } catch (error) {
    console.error('[Disputes] Create dispute error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create dispute' });
  }
};

export const getDisputeByJob = async (req, res) => {
  try {
    const job_id = String(req.params.jobId || '').trim();
    if (!job_id) return res.status(400).json({ error: 'Validation error', message: 'jobId is required' });

    const ctx = await getParticipantContext(job_id);
    if (!ctx) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

    if (ctx.hirer_id !== req.userId && ctx.caregiver_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });
    }

    const dRes = await query(
      `SELECT d.*, jp.title
       FROM disputes d
       JOIN job_posts jp ON jp.id = d.job_post_id
       WHERE d.job_post_id = $1
       ORDER BY
         CASE WHEN d.status IN ('open','in_review') THEN 0 ELSE 1 END,
         d.created_at DESC
       LIMIT 1`,
      [ctx.job_post_id]
    );

    res.json({ success: true, data: { dispute: dRes.rows[0] || null } });
  } catch (error) {
    console.error('[Disputes] Get dispute by job error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get dispute' });
  }
};

export const getDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const check = await ensureParticipant(id, req.userId);
    if (!check.dispute) return res.status(404).json({ error: 'Not Found', message: 'Dispute not found' });
    if (!check.ok) return res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });

    const details = await query(
      `SELECT d.*, jp.title
       FROM disputes d
       JOIN job_posts jp ON jp.id = d.job_post_id
       WHERE d.id = $1`,
      [id]
    );
    const events = await query(`SELECT * FROM dispute_events WHERE dispute_id = $1 ORDER BY created_at ASC`, [id]);
    const messages = await query(
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
      data: { dispute: details.rows[0], events: events.rows, messages: messages.rows },
    });
  } catch (error) {
    console.error('[Disputes] Get dispute error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get dispute' });
  }
};

export const postMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Validation error', message: 'content is required' });

    const check = await ensureParticipant(id, req.userId);
    if (!check.dispute) return res.status(404).json({ error: 'Not Found', message: 'Dispute not found' });
    if (!check.ok) return res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });

    if (!['open', 'in_review'].includes(check.dispute.status)) {
      return res.status(400).json({ error: 'Bad request', message: 'Dispute is closed' });
    }

    const msg = await transaction(async (client) => {
      if (req.userRole === 'admin' && !check.dispute.assigned_admin_id) {
        await client.query(
          `UPDATE disputes SET assigned_admin_id = $1, updated_at = NOW() WHERE id = $2`,
          [req.userId, id]
        );
        await client.query(
          `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
           VALUES ($1, $2, $3, 'note', $4, NOW())`,
          [uuidv4(), id, req.userId, 'Assigned to admin (auto)']
        );
      }
      const msgId = uuidv4();
      await client.query(
        `INSERT INTO dispute_messages (id, dispute_id, sender_id, type, content, is_system_message, created_at)
         VALUES ($1, $2, $3, 'text', $4, false, NOW())`,
        [msgId, id, req.userId, content]
      );
      await client.query(`UPDATE disputes SET updated_at = NOW() WHERE id = $1`, [id]);
      const row = await client.query(
        `SELECT m.*, u.email as sender_email, u.role as sender_role
         FROM dispute_messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.id = $1`,
        [msgId]
      );
      return row.rows[0];
    });

    res.json({ success: true, data: { message: msg } });
  } catch (error) {
    console.error('[Disputes] Post message error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to post message' });
  }
};

export const requestClose = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim();

    const check = await ensureParticipant(id, req.userId);
    if (!check.dispute) return res.status(404).json({ error: 'Not Found', message: 'Dispute not found' });
    if (!check.ok) return res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });

    if (!['open', 'in_review'].includes(check.dispute.status)) {
      return res.status(400).json({ error: 'Bad request', message: 'Dispute is closed' });
    }

    await transaction(async (client) => {
      if (check.dispute.status === 'open') {
        await client.query(
          `UPDATE disputes SET status = 'in_review', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        await client.query(
          `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
           VALUES ($1, $2, $3, 'status_change', $4, NOW())`,
          [uuidv4(), id, req.userId, 'Status changed: open → in_review (request close)']
        );
      }
      await client.query(
        `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
         VALUES ($1, $2, $3, 'note', $4, NOW())`,
        [uuidv4(), id, req.userId, reason ? `Request close: ${reason}` : 'Request close']
      );
      await client.query(
        `INSERT INTO dispute_messages (id, dispute_id, sender_id, type, content, is_system_message, created_at)
         VALUES ($1, $2, NULL, 'system', $3, true, NOW())`,
        [uuidv4(), id, reason ? `User requested close. Reason: ${reason}` : 'User requested close.']
      );
    });

    res.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[Disputes] Request close error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to request close' });
  }
};

export default { createDispute, getDisputeByJob, getDispute, postMessage, requestClose };

