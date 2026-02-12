import BaseModel from './BaseModel.js';
import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * LedgerTransaction Model
 * Handles immutable ledger transactions (append-only)
 *
 * IMPORTANT: Ledger transactions are IMMUTABLE
 * - Cannot UPDATE or DELETE (enforced by database triggers)
 * - Use reversal transactions to correct errors
 */
class LedgerTransaction extends BaseModel {
  constructor() {
    super('ledger_transactions');
  }

  /**
   * Record a ledger transaction
   * @param {object} txnData - Transaction data
   * @returns {object} - Created transaction
   */
  async recordTransaction(txnData) {
    const {
      from_wallet_id,
      to_wallet_id,
      amount,
      type,
      reference_type,
      reference_id,
      description,
      metadata = {},
      idempotency_key,
      provider_name,
      provider_transaction_id,
    } = txnData;

    if (!amount || amount <= 0) {
      throw new Error('Transaction amount must be positive');
    }

    if (!from_wallet_id && !to_wallet_id) {
      throw new Error('Either from_wallet_id or to_wallet_id must be provided');
    }

    if (!reference_type || !reference_id) {
      throw new Error('Both reference_type and reference_id are required');
    }

    const transaction = await this.create({
      id: uuidv4(),
      from_wallet_id: from_wallet_id || null,
      to_wallet_id: to_wallet_id || null,
      amount: parseInt(amount),
      currency: 'THB',
      type,
      reference_type,
      reference_id,
      idempotency_key: idempotency_key || null,
      provider_name: provider_name || null,
      provider_transaction_id: provider_transaction_id || null,
      description: description || null,
      metadata,
      created_at: new Date(),
    });

    return transaction;
  }

  /**
   * Record credit transaction (add funds to wallet)
   * @param {string} toWalletId - Destination wallet ID
   * @param {number} amount - Amount to credit (in satoshi/smallest unit)
   * @param {object} details - Transaction details (must include reference_type and reference_id)
   * @returns {object} - Created transaction
   */
  async recordCredit(toWalletId, amount, details = {}) {
    return await this.recordTransaction({
      to_wallet_id: toWalletId,
      amount,
      type: 'credit',
      ...details,
    });
  }

  /**
   * Record debit transaction (deduct funds from wallet)
   * @param {string} fromWalletId - Source wallet ID
   * @param {number} amount - Amount to debit (in satoshi/smallest unit)
   * @param {object} details - Transaction details (must include reference_type and reference_id)
   * @returns {object} - Created transaction
   */
  async recordDebit(fromWalletId, amount, details = {}) {
    return await this.recordTransaction({
      from_wallet_id: fromWalletId,
      amount,
      type: 'debit',
      ...details,
    });
  }

  /**
   * Record hold transaction (freeze funds)
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to hold (in satoshi/smallest unit)
   * @param {object} details - Transaction details (must include reference_type and reference_id)
   * @returns {object} - Created transaction
   */
  async recordHold(walletId, amount, details = {}) {
    return await this.recordTransaction({
      from_wallet_id: walletId,
      to_wallet_id: walletId, // Hold within same wallet
      amount,
      type: 'hold',
      ...details,
    });
  }

  /**
   * Record release transaction (unfreeze funds)
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to release (in satoshi/smallest unit)
   * @param {object} details - Transaction details (must include reference_type and reference_id)
   * @returns {object} - Created transaction
   */
  async recordRelease(walletId, amount, details = {}) {
    return await this.recordTransaction({
      from_wallet_id: walletId,
      to_wallet_id: walletId, // Release within same wallet
      amount,
      type: 'release',
      ...details,
    });
  }

  /**
   * Record reversal transaction (compensating transaction)
   * @param {string} originalTxnId - Original transaction ID to reverse
   * @param {string} reason - Reversal reason
   * @returns {object} - Created reversal transaction
   */
  async recordReversal(originalTxnId, reason) {
    // Get original transaction
    const originalTxn = await this.findById(originalTxnId);
    if (!originalTxn) {
      throw new Error('Original transaction not found');
    }

    // Create reversal with swapped from/to wallets
    return await this.recordTransaction({
      from_wallet_id: originalTxn.to_wallet_id,
      to_wallet_id: originalTxn.from_wallet_id,
      amount: originalTxn.amount,
      type: 'reversal',
      reference_type: originalTxn.reference_type,
      reference_id: originalTxn.reference_id,
      description: `Reversal of ${originalTxnId}: ${reason}`,
      metadata: {
        original_transaction_id: originalTxnId,
        reversal_reason: reason,
      },
    });
  }

  /**
   * Record transfer between wallets (creates matching debit/credit pair)
   * @param {string} fromWalletId - Source wallet ID
   * @param {string} toWalletId - Destination wallet ID
   * @param {number} amount - Transfer amount (in satoshi/smallest unit)
   * @param {object} details - Transaction details (must include reference_type and reference_id)
   * @returns {object} - { debitTxn, creditTxn }
   */
  async recordTransfer(fromWalletId, toWalletId, amount, details = {}) {
    const transferId = uuidv4();

    // Record debit from source
    const debitTxn = await this.recordTransaction({
      from_wallet_id: fromWalletId,
      to_wallet_id: null,
      amount,
      type: 'debit',
      ...details,
      metadata: {
        ...details.metadata,
        transfer_id: transferId,
        transfer_type: 'debit',
      },
    });

    // Record credit to destination
    const creditTxn = await this.recordTransaction({
      from_wallet_id: null,
      to_wallet_id: toWalletId,
      amount,
      type: 'credit',
      ...details,
      metadata: {
        ...details.metadata,
        transfer_id: transferId,
        transfer_type: 'credit',
      },
    });

    return { debitTxn, creditTxn };
  }

  /**
   * Get transactions by wallet
   * @param {string} walletId - Wallet ID
   * @param {object} options - Query options
   * @returns {array} - Transactions
   */
  async getByWallet(walletId, options = {}) {
    const { limit = 50, offset = 0, type = null } = options;

    let queryText = `
      SELECT * FROM ledger_transactions
      WHERE (from_wallet_id = $1 OR to_wallet_id = $1)
    `;
    const values = [walletId];

    if (type) {
      queryText += ` AND type = $2`;
      values.push(type);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows;
  }

  /**
   * Get transactions by reference
   * @param {string} referenceType - Reference type (topup, job, withdrawal, etc.)
   * @param {string} referenceId - Reference ID
   * @returns {array} - Transactions
   */
  async getByReference(referenceType, referenceId) {
    return await this.findAll({
      reference_type: referenceType,
      reference_id: referenceId,
    });
  }

  /**
   * Get transaction statistics
   * @param {object} filters - Optional filters
   * @returns {object} - Transaction stats
   */
  async getTransactionStats(filters = {}) {
    let queryText = `
      SELECT
        COUNT(*) as total_transactions,
        SUM(amount) as total_volume,
        AVG(amount) as average_amount,
        COUNT(*) FILTER (WHERE type = 'credit') as credit_count,
        COUNT(*) FILTER (WHERE type = 'debit') as debit_count,
        COUNT(*) FILTER (WHERE type = 'hold') as hold_count,
        COUNT(*) FILTER (WHERE type = 'release') as release_count,
        COUNT(*) FILTER (WHERE type = 'reversal') as reversal_count,
        SUM(amount) FILTER (WHERE type = 'credit') as total_credits,
        SUM(amount) FILTER (WHERE type = 'debit') as total_debits
      FROM ledger_transactions
    `;

    const values = [];
    const conditions = [];

    if (filters.start_date) {
      conditions.push(`created_at >= $${values.length + 1}`);
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      conditions.push(`created_at <= $${values.length + 1}`);
      values.push(filters.end_date);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(queryText, values);
    return result.rows[0];
  }

  /**
   * Verify ledger integrity (sum of all transactions should match wallet totals)
   * @returns {object} - { valid, ledgerSum, walletSum, difference }
   */
  async verifyLedgerIntegrity() {
    const ledgerResult = await query(`
      SELECT
        SUM(amount) FILTER (WHERE to_wallet_id IS NOT NULL AND type = 'credit') as total_credits,
        SUM(amount) FILTER (WHERE from_wallet_id IS NOT NULL AND type = 'debit') as total_debits
      FROM ledger_transactions
    `);

    const walletResult = await query(`
      SELECT SUM(available_balance + held_balance) as total_balance
      FROM wallets
    `);

    const credits = parseInt(ledgerResult.rows[0].total_credits || 0);
    const debits = parseInt(ledgerResult.rows[0].total_debits || 0);
    const ledgerSum = credits - debits;
    const walletSum = parseInt(walletResult.rows[0].total_balance || 0);
    const difference = Math.abs(ledgerSum - walletSum);

    return {
      valid: difference === 0,
      ledgerSum,
      walletSum,
      difference,
      credits,
      debits,
    };
  }
}

export default new LedgerTransaction();
