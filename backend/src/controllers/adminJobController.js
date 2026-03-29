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
    const jobAmount = parseInt(job.total_amount) || 0;
    const hirerDeposit = parseInt(job.hirer_deposit_amount) || 0;

    const result = await transaction(async (client) => {
      await client.query(
        `UPDATE job_posts SET status = 'cancelled', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [resolvedJobPostId]
      );

      // Posted only (no job instance) — unhold from hirer wallet
      if (!job.job_id && (currentStatus === 'posted' || currentStatus === 'draft')) {
        const totalHeld = jobAmount + hirerDeposit;
        if (totalHeld > 0) {
          const hwRes = await client.query(`SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`, [job.hirer_id]);
          if (hwRes.rows.length > 0) {
            const hw = hwRes.rows[0];
            const unhold = Math.min(parseInt(hw.held_balance), totalHeld);
            if (unhold > 0) {
              await client.query(`UPDATE wallets SET held_balance = held_balance - $1, available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [unhold, hw.id]);
              await client.query(
                `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
                 VALUES ($1, $2, $3, $4, 'release', 'job', $5, 'Admin cancel: release held job payment', NOW())`,
                [uuidv4(), hw.id, hw.id, jobAmount, resolvedJobPostId]
              );
              if (hirerDeposit > 0) {
                await client.query(
                  `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
                   VALUES ($1, $2, $3, $4, 'release', 'deposit', $5, 'Admin cancel: release held deposit', NOW())`,
                  [uuidv4(), hw.id, hw.id, hirerDeposit, resolvedJobPostId]
                );
              }
            }
          }
        }
        return { job_post_id: resolvedJobPostId, job_id: null, status: 'cancelled' };
      }

      // Job instance exists
      await client.query(
        `UPDATE jobs SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2,
         cancellation_reason = 'admin_override', fault_party = 'none', settlement_mode = 'admin_override',
         settlement_completed_at = NOW(), final_hirer_refund = $3,
         admin_settlement_by = $2, admin_settlement_note = $4, admin_settlement_at = NOW(),
         updated_at = NOW() WHERE id = $1`,
        [job.job_id, req.userId, jobAmount, `Admin cancel: ${reason}`]
      );

      await client.query(
        `UPDATE job_assignments SET status = 'cancelled', updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
        [job.job_id]
      );

      // Refund from escrow
      const escrowRes = await client.query(
        `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`, [job.job_id]
      );

      if (escrowRes.rows.length > 0) {
        const ew = escrowRes.rows[0];
        const escrowBal = parseInt(ew.held_balance);

        if (escrowBal > 0) {
          const hwRes = await client.query(`SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`, [job.hirer_id]);
          if (hwRes.rows.length > 0) {
            const hw = hwRes.rows[0];
            // Refund job amount
            const refundJob = Math.min(jobAmount, escrowBal);
            if (refundJob > 0) {
              await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [refundJob, ew.id]);
              await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [refundJob, hw.id]);
              await client.query(
                `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
                 VALUES ($1, $2, $3, $4, 'reversal', 'refund', $5, 'Admin cancel: refund job payment', NOW())`,
                [uuidv4(), ew.id, hw.id, refundJob, job.job_id]
              );
            }
            // Release deposit
            const remainingEscrow = escrowBal - refundJob;
            const releaseDep = Math.min(hirerDeposit, remainingEscrow);
            if (releaseDep > 0) {
              await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [releaseDep, ew.id]);
              await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [releaseDep, hw.id]);
              await client.query(
                `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
                 VALUES ($1, $2, $3, $4, 'release', 'deposit', $5, 'Admin cancel: release hirer deposit', NOW())`,
                [uuidv4(), ew.id, hw.id, releaseDep, job.job_id]
              );
            }
          }
        }
      }

      // Update job_deposits
      await client.query(
        `UPDATE job_deposits SET status = 'released', released_amount = amount, settlement_reason = 'admin_cancel', settled_by = $2, settled_at = NOW(), updated_at = NOW() WHERE job_id = $1 AND party = 'hirer'`,
        [job.job_id, req.userId]
      );

      // Chat system message
      const threadResult = await client.query(`SELECT id FROM chat_threads WHERE job_id = $1 LIMIT 1`, [job.job_id]);
      if (threadResult.rows.length > 0) {
        await client.query(
          `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, is_system_message, created_at)
           VALUES ($1, $2, NULL, 'system', $3, true, NOW())`,
          [uuidv4(), threadResult.rows[0].id, `งานถูกยกเลิกโดย Admin เหตุผล: ${reason}`]
        );
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

/**
 * Admin manual settlement for a job
 * POST /api/admin/jobs/:id/settle
 */
export const settleJob = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const adminUserId = req.userId;
    const {
      refund_amount = 0,
      payout_amount = 0,
      platform_fee_amount = 0,
      platform_penalty_revenue = 0,
      deposit_release_amount = 0,
      compensation_amount = 0,
      compensation_to = '',
      fault_party,
      fault_severity = null,
      settlement_note = '',
      idempotency_key = null,
    } = req.body || {};

    const refund = Math.max(0, parseInt(refund_amount) || 0);
    const payout = Math.max(0, parseInt(payout_amount) || 0);
    const fee = Math.max(0, parseInt(platform_fee_amount) || 0);
    const penaltyRev = Math.max(0, parseInt(platform_penalty_revenue) || 0);
    const depRelease = Math.max(0, parseInt(deposit_release_amount) || 0);
    const comp = Math.max(0, parseInt(compensation_amount) || 0);
    const totalDisburse = refund + payout + fee + penaltyRev + depRelease + comp;

    if (totalDisburse === 0 && !settlement_note) {
      return res.status(400).json({ error: 'Bad request', message: 'No settlement actions provided' });
    }

    const result = await transaction(async (client) => {
      // Get job with lock
      const jobRes = await client.query(
        `SELECT j.*, jp.hirer_id, jp.total_amount, jp.platform_fee_amount AS jp_fee, jp.hirer_deposit_amount
         FROM jobs j JOIN job_posts jp ON jp.id = j.job_post_id WHERE j.id = $1 FOR UPDATE OF j`,
        [jobId]
      );
      if (jobRes.rows.length === 0) throw new Error('Job not found');
      const job = jobRes.rows[0];

      // Prevent double-settlement
      if (job.admin_settlement_at) {
        if (idempotency_key && job.admin_settlement_note?.includes(idempotency_key)) {
          return { already_settled: true, job };
        }
        throw new Error('Job already settled by admin');
      }

      // Get escrow
      const escrowRes = await client.query(
        `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`, [jobId]
      );
      if (escrowRes.rows.length === 0) throw new Error('Escrow wallet not found');
      const escrow = escrowRes.rows[0];
      const escrowHeld = parseInt(escrow.held_balance) || 0;

      if (totalDisburse > escrowHeld) {
        throw new Error(`Settlement total (${totalDisburse}) exceeds escrow balance (${escrowHeld})`);
      }

      const hirerId = job.hirer_id;

      // Helper: get or create wallet
      const getWallet = async (userId, type) => {
        let r = await client.query(`SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = $2 FOR UPDATE`, [userId, type]);
        if (r.rows.length === 0) {
          const wId = uuidv4();
          await client.query(`INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at) VALUES ($1, $2, $3, 0, 0, 'THB', NOW(), NOW())`, [wId, userId, type]);
          r = await client.query(`SELECT * FROM wallets WHERE id = $1`, [wId]);
        }
        return r.rows[0];
      };

      const getPlatformWallet = async () => {
        let r = await client.query(`SELECT * FROM wallets WHERE wallet_type = 'platform' ORDER BY created_at ASC LIMIT 1 FOR UPDATE`);
        if (r.rows.length === 0) {
          const pId = uuidv4();
          await client.query(`INSERT INTO wallets (id, wallet_type, available_balance, held_balance, currency, created_at, updated_at) VALUES ($1, 'platform', 0, 0, 'THB', NOW(), NOW())`, [pId]);
          r = await client.query(`SELECT * FROM wallets WHERE id = $1`, [pId]);
        }
        return r.rows[0];
      };

      const insertLedger = async (from, to, amount, type, refType, desc) => {
        if (amount <= 0) return;
        await client.query(
          `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [uuidv4(), from, to, amount, type, refType, jobId, desc, JSON.stringify({ admin_settlement: true, admin_id: adminUserId })]
        );
      };

      // Execute transfers
      if (refund > 0) {
        const hw = await getWallet(hirerId, 'hirer');
        await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [refund, escrow.id]);
        await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [refund, hw.id]);
        await insertLedger(escrow.id, hw.id, refund, 'reversal', 'refund', 'Admin settlement: refund to hirer');
      }

      if (payout > 0) {
        // Find caregiver from assignment
        const assignRes = await client.query(`SELECT caregiver_id FROM job_assignments WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`, [jobId]);
        const cgId = assignRes.rows[0]?.caregiver_id;
        if (!cgId) throw new Error('No caregiver found for payout');
        const cw = await getWallet(cgId, 'caregiver');
        await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [payout, escrow.id]);
        await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [payout, cw.id]);
        await insertLedger(escrow.id, cw.id, payout, 'release', 'job', 'Admin settlement: payout to caregiver');
      }

      if (fee > 0) {
        const pw = await getPlatformWallet();
        await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [fee, escrow.id]);
        await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [fee, pw.id]);
        await insertLedger(escrow.id, pw.id, fee, 'debit', 'fee', 'Admin settlement: platform fee');
      }

      if (depRelease > 0) {
        const hw = await getWallet(hirerId, 'hirer');
        await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [depRelease, escrow.id]);
        await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [depRelease, hw.id]);
        await insertLedger(escrow.id, hw.id, depRelease, 'release', 'deposit', 'Admin settlement: deposit release');
      }

      if (comp > 0 && compensation_to) {
        const assignRes = await client.query(`SELECT caregiver_id FROM job_assignments WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`, [jobId]);
        const recipientId = compensation_to === 'caregiver' ? assignRes.rows[0]?.caregiver_id : hirerId;
        if (!recipientId) throw new Error('Compensation recipient not found');
        const rw = await getWallet(recipientId, compensation_to === 'caregiver' ? 'caregiver' : 'hirer');
        await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [comp, escrow.id]);
        await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [comp, rw.id]);
        await insertLedger(escrow.id, rw.id, comp, 'compensation', 'compensation', `Admin settlement: compensation to ${compensation_to}`);
      }

      if (penaltyRev > 0) {
        const pw = await getPlatformWallet();
        await client.query(`UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`, [penaltyRev, escrow.id]);
        await client.query(`UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`, [penaltyRev, pw.id]);
        await insertLedger(escrow.id, pw.id, penaltyRev, 'forfeit', 'platform_penalty_revenue', 'Admin settlement: penalty revenue');
      }

      // Update job_deposits if exists
      const depositForfeit = penaltyRev + comp;
      if (depRelease > 0 || depositForfeit > 0) {
        const assignRes2 = await client.query(`SELECT caregiver_id FROM job_assignments WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`, [jobId]);
        const cgId2 = assignRes2.rows[0]?.caregiver_id;
        await client.query(
          `UPDATE job_deposits SET
            status = CASE WHEN $2 > 0 THEN 'forfeited'::deposit_status ELSE 'released'::deposit_status END,
            released_amount = $3, forfeited_amount = $2,
            compensation_to_user_id = $4, compensation_amount = $5, platform_revenue_amount = $6,
            settlement_reason = $7, settled_by = $8, settled_at = NOW(), updated_at = NOW()
           WHERE job_id = $1 AND party = 'hirer'`,
          [jobId, depositForfeit, depRelease, compensation_to === 'caregiver' ? cgId2 : hirerId, comp, penaltyRev, settlement_note || 'admin_override', adminUserId]
        );
      }

      // Update jobs
      const noteWithKey = idempotency_key ? `[${idempotency_key}] ${settlement_note}` : settlement_note;
      await client.query(
        `UPDATE jobs SET
           fault_party = $2, fault_severity = $3, settlement_mode = 'admin_override',
           settlement_completed_at = NOW(),
           final_hirer_refund = $4, final_caregiver_payout = $5,
           final_platform_fee = $6, final_platform_penalty_revenue = $7,
           compensation_amount = $8, compensation_recipient = $9,
           admin_settlement_by = $10, admin_settlement_note = $11, admin_settlement_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [jobId, fault_party, fault_severity, refund, payout, fee, penaltyRev, comp,
         compensation_to === 'caregiver' ? (await client.query(`SELECT caregiver_id FROM job_assignments WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`, [jobId])).rows[0]?.caregiver_id : hirerId,
         adminUserId, noteWithKey]
      );

      return { job_id: jobId, settlement_mode: 'admin_override', fault_party, total_disbursed: totalDisburse };
    });

    await logAdminAction(adminUserId, 'job:settle', {
      job_id: jobId, refund, payout, fee, penaltyRev, depRelease, comp,
      fault_party, settlement_note,
    });

    res.json({ success: true, message: 'Job settled successfully', data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.includes('not found') ? 404 : msg.includes('already settled') || msg.includes('exceeds') || msg.includes('No ') ? 400 : 500;
    if (status === 500) console.error('[Admin Jobs] Settle error:', error);
    res.status(status).json({ error: status === 500 ? 'Server error' : 'Bad request', message: msg });
  }
};

/**
 * Get job financial breakdown
 * GET /api/admin/jobs/:id/financial
 */
export const getJobFinancial = async (req, res) => {
  try {
    const { id: jobId } = req.params;

    const jobRes = await query(
      `SELECT j.*, jp.total_amount, jp.platform_fee_percent, jp.platform_fee_amount,
              jp.hirer_deposit_amount, jp.caregiver_deposit_amount,
              jp.hourly_rate, jp.total_hours, jp.title,
              jp.hirer_id, hp.display_name AS hirer_name,
              ja.caregiver_id, cp.display_name AS caregiver_name
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       LEFT JOIN LATERAL (SELECT caregiver_id FROM job_assignments WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1) ja ON true
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       WHERE j.id = $1`,
      [jobId]
    );

    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

    const job = jobRes.rows[0];

    const depositsRes = await query(`SELECT * FROM job_deposits WHERE job_id = $1 ORDER BY party`, [jobId]);
    const ledgerRes = await query(
      `SELECT lt.* FROM ledger_transactions lt
       JOIN wallets w ON w.id = lt.from_wallet_id OR w.id = lt.to_wallet_id
       WHERE lt.reference_id = $1
       ORDER BY lt.created_at`,
      [jobId]
    );
    const escrowRes = await query(`SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow'`, [jobId]);

    res.json({
      success: true,
      data: {
        job,
        deposits: depositsRes.rows,
        ledger_transactions: ledgerRes.rows,
        escrow: escrowRes.rows[0] || null,
      },
    });
  } catch (error) {
    console.error('[Admin Jobs] Get financial error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get job financial data' });
  }
};

export const listNoShowJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, parseIntOr(req.query.limit, 20)));
    const offset = (page - 1) * limit;
    const settlementMode = String(req.query.settlement_mode || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const where = [`j.cancellation_reason = 'caregiver_no_show'`];
    const values = [];
    let idx = 1;

    if (settlementMode) {
      values.push(settlementMode);
      where.push(`j.settlement_mode = $${idx++}`);
    }
    if (from) {
      values.push(from);
      where.push(`j.cancelled_at >= $${idx++}`);
    }
    if (to) {
      values.push(to);
      where.push(`j.cancelled_at <= $${idx++}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const result = await query(
      `SELECT
         j.id AS job_id,
         j.job_post_id,
         j.status AS job_status,
         j.cancellation_reason,
         j.fault_party,
         j.fault_severity,
         j.settlement_mode,
         j.final_hirer_refund,
         j.cancelled_at,
         jp.title,
         jp.total_amount,
         jp.hirer_deposit_amount,
         jp.scheduled_start_at,
         jp.scheduled_end_at,
         jp.hirer_id,
         hp.display_name AS hirer_name,
         ja.caregiver_id,
         cp.display_name AS caregiver_name
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       ${whereSql}
       ORDER BY j.cancelled_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id
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
    console.error('[Admin Jobs] List no-show jobs error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list no-show jobs' });
  }
};

export const getNoShowStats = async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const dateWhere = [];
    const values = [];
    let idx = 1;

    if (from) {
      values.push(from);
      dateWhere.push(`j.cancelled_at >= $${idx++}`);
    }
    if (to) {
      values.push(to);
      dateWhere.push(`j.cancelled_at <= $${idx++}`);
    }

    const baseWhere = `WHERE j.cancellation_reason = 'caregiver_no_show'${dateWhere.length ? ' AND ' + dateWhere.join(' AND ') : ''}`;

    const statsResult = await query(
      `SELECT
         COUNT(*)::int                                                        AS total_no_show,
         COUNT(*) FILTER (WHERE j.settlement_mode = 'admin_override')::int   AS admin_override_count,
         COUNT(*) FILTER (WHERE j.settlement_mode = 'normal')::int           AS normal_settled_count,
         COALESCE(SUM(j.final_hirer_refund)
           FILTER (WHERE j.settlement_mode = 'normal'), 0)::bigint           AS total_refunded,
         COALESCE(SUM(jp.total_amount + COALESCE(jp.hirer_deposit_amount, 0))
           FILTER (WHERE j.settlement_mode = 'admin_override'), 0)::bigint  AS total_unrefunded_estimate
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       ${baseWhere}`,
      values
    );

    res.json({
      success: true,
      data: statsResult.rows[0],
    });
  } catch (error) {
    console.error('[Admin Jobs] No-show stats error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get no-show stats' });
  }
};

export default { listJobs, getJob, cancelJob, settleJob, getJobFinancial, listNoShowJobs, getNoShowStats };

