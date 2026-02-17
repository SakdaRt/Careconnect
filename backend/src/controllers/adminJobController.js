import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import Job from '../models/Job.js';

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

export const listJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, parseIntOr(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const risk_level = String(req.query.risk_level || '').trim();
    const job_type = String(req.query.job_type || '').trim();

    const where = [];
    const values = [];
    let idx = 1;

    if (status) {
      values.push(status);
      where.push(`jp.status = $${idx++}`);
    }
    if (risk_level) {
      values.push(risk_level);
      where.push(`jp.risk_level = $${idx++}`);
    }
    if (job_type) {
      values.push(job_type);
      where.push(`jp.job_type = $${idx++}`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(
        `(jp.id::text ILIKE $${idx} OR j.id::text ILIKE $${idx} OR jp.title ILIKE $${idx} OR COALESCE(hp.display_name, '') ILIKE $${idx} OR COALESCE(cp.display_name, '') ILIKE $${idx} OR COALESCE(pp.patient_display_name, '') ILIKE $${idx})`
      );
      idx += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         jp.*,
         j.id as job_id,
         j.status as job_status,
         j.assigned_at,
         j.started_at,
         j.completed_at,
         j.cancelled_at,
         ja.caregiver_id,
         ja.status as assignment_status,
         cp.display_name as caregiver_name,
         pp.patient_display_name,
         hp.display_name as hirer_name
       FROM job_posts jp
       LEFT JOIN jobs j ON j.job_post_id = jp.id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
       LEFT JOIN patient_profiles pp ON pp.id = COALESCE(jpr.patient_id, jp.patient_profile_id)
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       ${whereSql}
       ORDER BY jp.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total
       FROM job_posts jp
       LEFT JOIN jobs j ON j.job_post_id = jp.id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
       LEFT JOIN patient_profiles pp ON pp.id = COALESCE(jpr.patient_id, jp.patient_profile_id)
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
    console.error('[Admin Jobs] List jobs error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list jobs' });
  }
};

export const getJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.getJobWithDetails(id);
    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }
    res.json({ success: true, data: { job } });
  } catch (error) {
    console.error('[Admin Jobs] Get job error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get job' });
  }
};

export const cancelJob = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'Validation error', message: 'Cancellation reason is required' });
    }

    const job = await Job.getJobWithDetails(id);
    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

    const currentStatus = job.job_status || job.status;
    const cancellableStatuses = ['draft', 'posted', 'assigned', 'in_progress'];
    if (!cancellableStatuses.includes(currentStatus)) {
      return res.status(400).json({ error: 'Bad request', message: `Cannot cancel job in status: ${currentStatus}` });
    }

    const resolvedJobPostId = job.id;

    const result = await transaction(async (client) => {
      await client.query(
        `UPDATE job_posts SET status = 'cancelled', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [resolvedJobPostId]
      );

      if (job.job_id) {
        await client.query(
          `UPDATE jobs SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [job.job_id]
        );

        await client.query(
          `UPDATE job_assignments SET status = 'cancelled', updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
          [job.job_id]
        );

        const escrowWalletResult = await client.query(
          `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`,
          [job.job_id]
        );

        if (escrowWalletResult.rows.length > 0) {
          const escrowWallet = escrowWalletResult.rows[0];
          const escrowAmount = parseInt(escrowWallet.held_balance);

          if (escrowAmount > 0) {
            const hirerWalletResult = await client.query(
              `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`,
              [job.hirer_id]
            );

            if (hirerWalletResult.rows.length > 0) {
              const hirerWallet = hirerWalletResult.rows[0];

              await client.query(
                `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
                [escrowAmount, escrowWallet.id]
              );

              await client.query(
                `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
                [escrowAmount, hirerWallet.id]
              );

              await client.query(
                `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
                 VALUES ($1, $2, $3, $4, 'reversal', 'refund', $5, $6, NOW())`,
                [uuidv4(), escrowWallet.id, hirerWallet.id, escrowAmount, job.job_id, 'Refund for cancelled job (admin)']
              );
            }
          }
        }

        const threadResult = await client.query(
          `SELECT id FROM chat_threads WHERE job_id = $1 LIMIT 1`,
          [job.job_id]
        );

        if (threadResult.rows.length > 0) {
          await client.query(
            `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, is_system_message, created_at)
             VALUES ($1, $2, NULL, 'system', $3, true, NOW())`,
            [uuidv4(), threadResult.rows[0].id, `Job cancelled by admin. Reason: ${reason}`]
          );
        }
      }

      return { job_post_id: resolvedJobPostId, job_id: job.job_id, status: 'cancelled' };
    });

    await logAdminAction(req.userId, 'job:cancel', {
      job_post_id: result.job_post_id,
      job_id: result.job_id,
      reason,
    });

    res.json({ success: true, message: 'Job cancelled successfully', data: result });
  } catch (error) {
    console.error('[Admin Jobs] Cancel job error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to cancel job' });
  }
};

export default { listJobs, getJob, cancelJob };

