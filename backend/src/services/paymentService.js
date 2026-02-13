import Payment from '../models/Payment.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Service
 * Handles payment business logic and simulation
 */

/**
 * Get payments with filtering
 * @param {object} filters - Filter options
 * @returns {object} - Paginated payments
 */
export const getPayments = async (filters = {}) => {
  return await Payment.getPayments(filters);
};

/**
 * Get payment by ID with access control
 * @param {string} paymentId - Payment ID
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {object|null} - Payment details
 */
export const getPaymentById = async (paymentId, userId, userRole) => {
  const payment = await Payment.getPaymentDetails(paymentId);
  
  if (!payment) {
    return null;
  }

  // Access control: non-admin users can only see their own payments
  if (userRole !== 'admin' && 
      payment.payer_user_id !== userId && 
      payment.payee_user_id !== userId) {
    throw new Error('Access denied');
  }

  return payment;
};

/**
 * Create a payment ledger entry with idempotency
 * @param {object} client - Transaction client (required)
 * @param {object} ledgerData - Ledger entry data
 * @returns {object} - Created ledger entry
 */
export const createPaymentLedgerEntry = async (client, ledgerData) => {
  const {
    wallet_id,
    transaction_type,
    reference_type = 'payment',
    reference_id,
    amount,
    metadata = {}
  } = ledgerData;

  // Insert with ON CONFLICT DO NOTHING for idempotency
  const result = await client.query(
    `INSERT INTO ledger_transactions 
     (id, wallet_id, transaction_type, reference_type, reference_id, amount, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
     ON CONFLICT (reference_type, reference_id, transaction_type) DO NOTHING
     RETURNING *`,
    [
      uuidv4(),
      wallet_id,
      transaction_type,
      reference_type,
      reference_id,
      amount,
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0] || null;
};

/**
 * Simulate payment processing (2-phase approach with concurrency safety)
 * @param {string} paymentId - Payment ID
 * @param {string} adminId - Admin user ID
 * @returns {object} - Processing result
 */
export const simulatePaymentProcess = async (paymentId, adminId) => {
  // Phase 1: Claim payment with row-level lock
  const claimResult = await transaction(async (client) => {
    // Lock the row for update
    const lockResult = await client.query(
      `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (lockResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = lockResult.rows[0];
    const now = new Date();
    const processingTimeMs = now - new Date(payment.updated_at);

    // Claim rules
    if (payment.status === 'completed') {
      return { payment, shouldProcess: false };
    }

    if (payment.status === 'processing') {
      if (processingTimeMs <= 60000) { // 60 seconds
        return { payment, shouldProcess: false };
      }
      // Stalled - allow re-claim
    }

    if (payment.status === 'refunded') {
      throw new Error('Cannot process refunded payment');
    }

    // Claim the payment
    const updateResult = await client.query(
      `UPDATE payments 
       SET status = 'processing', updated_at = NOW() 
       WHERE id = $1 AND status IN ('pending', 'processing', 'failed')
       RETURNING *`,
      [paymentId]
    );

    if (updateResult.rows.length === 0) {
      // Someone else claimed it
      const currentResult = await client.query(
        `SELECT * FROM payments WHERE id = $1`,
        [paymentId]
      );
      return { payment: currentResult.rows[0], shouldProcess: false };
    }

    return { payment: updateResult.rows[0], shouldProcess: true };
  });

  if (!claimResult.shouldProcess) {
    return { payment: claimResult.payment, ledgerEntry: null };
  }

  // Phase 2: Wait outside transaction (simulate processing delay)
  const delayMs = 2000 + Math.random() * 3000; // 2-5 seconds
  await new Promise(resolve => setTimeout(resolve, delayMs));

  // Phase 3: Finalize payment with row-level lock
  const result = await transaction(async (client) => {
    // Re-lock the row
    const lockResult = await client.query(
      `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (lockResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const currentPayment = lockResult.rows[0];

    // If another request already finished it, return current state
    if (currentPayment.status !== 'processing') {
      return { payment: currentPayment, ledgerEntry: null };
    }

    // Decide final status (95% success rate)
    const isSuccess = Math.random() > 0.05;
    const finalStatus = isSuccess ? 'completed' : 'failed';
    const now = new Date();

    // Update payment with merged metadata
    const updateResult = await client.query(
      `UPDATE payments 
       SET status = $1, 
           processed_at = NOW(), 
           updated_at = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $3
       RETURNING *`,
      [
        finalStatus,
        JSON.stringify({
          simulated_by: adminId,
          simulated_at: now.toISOString(),
          processing_ms: Math.round(delayMs),
          status_updated_at: now.toISOString()
        }),
        paymentId
      ]
    );

    const updatedPayment = updateResult.rows[0];

    // Create ledger entry for completed payments
    let ledgerEntry = null;
    if (isSuccess) {
      // Get payee's wallet
      const walletResult = await client.query(
        `SELECT id FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver'`,
        [updatedPayment.payee_user_id]
      );

      if (walletResult.rows.length > 0) {
        ledgerEntry = await createPaymentLedgerEntry(client, {
          wallet_id: walletResult.rows[0].id,
          transaction_type: 'payment_completed',
          reference_type: 'payment',
          reference_id: paymentId,
          amount: updatedPayment.amount,
          metadata: {
            provider: 'mock',
            provider_ref: paymentId,
            final_status: finalStatus,
            payment_id: paymentId,
            payer_user_id: updatedPayment.payer_user_id,
            payee_user_id: updatedPayment.payee_user_id,
            job_id: updatedPayment.job_id,
            simulated: true
          }
        });
      }
    } else {
      // Create failed ledger entry
      const walletResult = await client.query(
        `SELECT id FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver'`,
        [updatedPayment.payee_user_id]
      );

      if (walletResult.rows.length > 0) {
        ledgerEntry = await createPaymentLedgerEntry(client, {
          wallet_id: walletResult.rows[0].id,
          transaction_type: 'payment_failed',
          reference_type: 'payment',
          reference_id: paymentId,
          amount: 0, // No amount for failed payments
          metadata: {
            provider: 'mock',
            provider_ref: paymentId,
            final_status: finalStatus,
            payment_id: paymentId,
            payer_user_id: updatedPayment.payer_user_id,
            payee_user_id: updatedPayment.payee_user_id,
            job_id: updatedPayment.job_id,
            simulated: true,
            failure_reason: 'simulation_failed'
          }
        });
      }
    }

    return {
      payment: updatedPayment,
      ledgerEntry
    };
  });

  return result;
};

/**
 * Create a payment record (typically called after job completion)
 * @param {object} paymentData - Payment data
 * @returns {object} - Created payment
 */
export const createPayment = async (paymentData) => {
  return await Payment.createPayment(paymentData);
};

/**
 * Update payment status
 * @param {string} paymentId - Payment ID
 * @param {string} status - New status
 * @param {object} metadata - Additional metadata
 * @returns {object} - Updated payment
 */
export const updatePaymentStatus = async (paymentId, status, metadata = {}) => {
  return await Payment.updateStatus(paymentId, status, metadata);
};
