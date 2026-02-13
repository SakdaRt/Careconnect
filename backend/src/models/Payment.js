import BaseModel from './BaseModel.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Model
 * Handles payment records for UI display and simulation
 * Note: Actual money movement happens through wallet/ledger system
 */
class Payment extends BaseModel {
  constructor() {
    super('payments');
  }

  /**
   * Get payments with filtering and pagination
   * @param {object} options - Query options
   * @returns {object} - Paginated payments
   */
  async getPayments(options = {}) {
    const {
      status,
      user_id,
      payer_user_id,
      payee_user_id,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = options;

    // Enforce bounds
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

    // Build WHERE clause for SQL-level filtering
    const whereConditions = [];
    const values = [];
    let paramIndex = 1;

    // Non-admin users can only see their own payments
    if (user_id) {
      whereConditions.push(`(payer_user_id = $${paramIndex} OR payee_user_id = $${paramIndex})`);
      values.push(user_id);
      paramIndex++;
    } else if (payer_user_id) {
      whereConditions.push(`payer_user_id = $${paramIndex}`);
      values.push(payer_user_id);
      paramIndex++;
    } else if (payee_user_id) {
      whereConditions.push(`payee_user_id = $${paramIndex}`);
      values.push(payee_user_id);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Whitelist sort columns
    const validSortColumns = ['created_at', 'updated_at', 'amount', 'status'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (validPage - 1) * validLimit;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM payments ${whereClause}`,
      values
    );

    // Get paginated results
    const result = await query(
      `SELECT 
        id, payer_user_id, payee_user_id, job_id, amount, fee_amount,
        status, payment_method, provider_payment_id, metadata,
        created_at, updated_at, processed_at
       FROM payments 
       ${whereClause}
       ORDER BY ${sortColumn} ${sortDirection}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, validLimit, offset]
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit),
    };
  }

  /**
   * Get payment details by ID
   * @param {string} paymentId - Payment ID
   * @returns {object|null} - Payment details
   */
  async getPaymentDetails(paymentId) {
    const result = await query(
      `SELECT 
        p.id, p.payer_user_id, p.payee_user_id, p.job_id, p.amount, p.fee_amount,
        p.status, p.payment_method, p.provider_payment_id, p.metadata,
        p.created_at, p.updated_at, p.processed_at,
        u_payer.display_name as payer_name, u_payee.display_name as payee_name,
        COALESCE(lt.ledger_entries, '[]'::json) as ledger_entries
       FROM payments p
       LEFT JOIN LATERAL (
         SELECT COALESCE(json_agg(lt ORDER BY lt.created_at DESC), '[]'::json) AS ledger_entries
         FROM ledger_transactions lt
         WHERE lt.reference_type = 'payment' AND lt.reference_id = p.id
       ) lt ON true
       LEFT JOIN users u_payer ON u_payer.id = p.payer_user_id
       LEFT JOIN users u_payee ON u_payee.id = p.payee_user_id
       WHERE p.id = $1`,
      [paymentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Update payment status
   * @param {string} paymentId - Payment ID
   * @param {string} status - New status
   * @param {object} metadata - Additional metadata
   * @returns {object} - Updated payment
   */
  async updateStatus(paymentId, status, metadata = {}) {
    const result = await query(
      `UPDATE payments 
       SET status = $1, 
           updated_at = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(metadata), paymentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Payment not found');
    }

    return result.rows[0];
  }

  /**
   * Create a new payment record
   * @param {object} paymentData - Payment data
   * @returns {object} - Created payment
   */
  async createPayment(paymentData) {
    const {
      payer_user_id,
      payee_user_id,
      job_id,
      amount,
      fee_amount = 0,
      payment_method = 'mock',
      provider_payment_id = null,
      metadata = {}
    } = paymentData;

    const newPayment = await this.create({
      id: uuidv4(),
      payer_user_id,
      payee_user_id,
      job_id,
      amount,
      fee_amount,
      status: 'pending',
      payment_method,
      provider_payment_id,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      created_at: new Date(),
      updated_at: new Date()
    });

    return newPayment;
  }
}

export default new Payment();
