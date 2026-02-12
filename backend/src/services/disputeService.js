import { transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

const parseAmount = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error('Invalid amount');
  const int = Math.round(num);
  if (int < 0) throw new Error('Invalid amount');
  return int;
};

export async function settleDispute(disputeId, adminUserId, input = {}) {
  const refundAmount = parseAmount(input.refund_amount);
  const payoutAmount = parseAmount(input.payout_amount);
  const resolution = String(input.resolution || '').trim();
  const idempotencyKey = input.idempotency_key ? String(input.idempotency_key).trim() : null;

  if (refundAmount === 0 && payoutAmount === 0 && !resolution) {
    throw new Error('No settlement actions provided');
  }

  return transaction(async (client) => {
    const disputeRes = await client.query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [disputeId]);
    if (disputeRes.rows.length === 0) throw new Error('Dispute not found');
    const dispute = disputeRes.rows[0];

    if (!['open', 'in_review'].includes(dispute.status)) {
      if (idempotencyKey && dispute.settlement_idempotency_key === idempotencyKey) {
        return {
          dispute,
          settlement: {
            refund_amount: Number.parseInt(String(dispute.settlement_refund_amount || '0'), 10),
            payout_amount: Number.parseInt(String(dispute.settlement_payout_amount || '0'), 10),
          },
        };
      }
      throw new Error(`Cannot settle dispute in status: ${dispute.status}`);
    }

    if (!dispute.assigned_admin_id) {
      await client.query(
        `UPDATE disputes SET assigned_admin_id = $1, updated_at = NOW() WHERE id = $2`,
        [adminUserId, disputeId]
      );
      await client.query(
        `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
         VALUES ($1, $2, $3, 'note', $4, NOW())`,
        [uuidv4(), disputeId, adminUserId, 'Assigned to admin (auto)']
      );
    }

    const ctxRes = await client.query(
      `SELECT
         d.job_id,
         d.job_post_id,
         jp.hirer_id,
         j.caregiver_id as job_caregiver_id,
         ja.caregiver_id as assignment_caregiver_id
       FROM disputes d
       JOIN job_posts jp ON jp.id = d.job_post_id
       LEFT JOIN jobs j ON j.id = d.job_id
       LEFT JOIN LATERAL (
         SELECT caregiver_id
         FROM job_assignments
         WHERE job_id = j.id
         ORDER BY created_at DESC
         LIMIT 1
       ) ja ON true
       WHERE d.id = $1`,
      [disputeId]
    );
    const ctx = ctxRes.rows[0];
    const jobId = ctx?.job_id;
    const jobPostId = ctx?.job_post_id;
    const hirerId = ctx?.hirer_id;
    const caregiverId = ctx?.job_caregiver_id || ctx?.assignment_caregiver_id;

    if (!jobId || !hirerId) {
      throw new Error('Dispute has no job context');
    }

    const escrowRes = await client.query(
      `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`,
      [jobId]
    );
    if (escrowRes.rows.length === 0) throw new Error('Escrow wallet not found');
    const escrowWallet = escrowRes.rows[0];

    const escrowHeld = Number.parseInt(String(escrowWallet.held_balance || '0'), 10);
    const total = refundAmount + payoutAmount;
    if (total > escrowHeld) {
      throw new Error('Insufficient escrow balance for settlement');
    }

    let hirerWallet = null;
    if (refundAmount > 0) {
      const hirerWalletRes = await client.query(
        `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`,
        [hirerId]
      );
      if (hirerWalletRes.rows.length === 0) throw new Error('Hirer wallet not found');
      hirerWallet = hirerWalletRes.rows[0];
    }

    let caregiverWallet = null;
    if (payoutAmount > 0) {
      if (!caregiverId) throw new Error('No caregiver assigned');
      const caregiverWalletRes = await client.query(
        `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver' FOR UPDATE`,
        [caregiverId]
      );
      if (caregiverWalletRes.rows.length === 0) throw new Error('Caregiver wallet not found');
      caregiverWallet = caregiverWalletRes.rows[0];
    }

    if (idempotencyKey) {
      await client.query(
        `UPDATE disputes
         SET settlement_idempotency_key = $1,
             settlement_refund_amount = $2,
             settlement_payout_amount = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [idempotencyKey, refundAmount, payoutAmount, disputeId]
      );
    } else {
      await client.query(
        `UPDATE disputes
         SET settlement_refund_amount = $1,
             settlement_payout_amount = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [refundAmount, payoutAmount, disputeId]
      );
    }

    if (total > 0) {
      await client.query(
        `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
        [total, escrowWallet.id]
      );
    }

    if (refundAmount > 0) {
      await client.query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [refundAmount, hirerWallet.id]
      );
      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, idempotency_key, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, 'reversal', 'dispute', $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          escrowWallet.id,
          hirerWallet.id,
          refundAmount,
          disputeId,
          idempotencyKey ? `dispute_settle:${idempotencyKey}:refund` : null,
          'Refund from escrow (dispute settlement)',
          JSON.stringify({ job_id: jobId, job_post_id: jobPostId }),
        ]
      );
    }

    if (payoutAmount > 0) {
      await client.query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [payoutAmount, caregiverWallet.id]
      );
      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, idempotency_key, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, 'release', 'dispute', $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          escrowWallet.id,
          caregiverWallet.id,
          payoutAmount,
          disputeId,
          idempotencyKey ? `dispute_settle:${idempotencyKey}:payout` : null,
          'Payout from escrow (dispute settlement)',
          JSON.stringify({ job_id: jobId, job_post_id: jobPostId }),
        ]
      );
    }

    if (resolution) {
      await client.query(`UPDATE disputes SET resolution = $1, updated_at = NOW() WHERE id = $2`, [resolution, disputeId]);
      await client.query(
        `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
         VALUES ($1, $2, $3, 'note', $4, NOW())`,
        [uuidv4(), disputeId, adminUserId, resolution]
      );
    }

    await client.query(
      `UPDATE disputes SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [disputeId]
    );
    await client.query(
      `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
       VALUES ($1, $2, $3, 'status_change', $4, NOW())`,
      [uuidv4(), disputeId, adminUserId, `Status changed: ${dispute.status} → resolved`]
    );

    const finalRes = await client.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
    return {
      dispute: finalRes.rows[0],
      settlement: { refund_amount: refundAmount, payout_amount: payoutAmount },
    };
  });
}

