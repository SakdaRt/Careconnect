import Wallet from '../models/Wallet.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import { triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';

/**
 * Wallet Service
 * Handles business logic for wallet operations
 */
class WalletService {
  /**
   * Get user's wallet with balance
   * @param {string} userId - User ID
   * @param {string} role - User role (hirer or caregiver)
   * @returns {object} - Wallet with balance info
   */
  async getWalletBalance(userId, role) {
    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    const wallet = await Wallet.getOrCreateWallet(userId, walletType);
    const balance = await Wallet.getBalance(wallet.id);

    return {
      wallet_id: wallet.id,
      wallet_type: wallet.wallet_type,
      currency: wallet.currency,
      ...balance,
    };
  }

  /**
   * Get user's transaction history
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {object} options - Pagination options
   * @returns {object} - Paginated transactions
   */
  async getTransactionHistory(userId, role, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    const wallet = await Wallet.getWalletByUser(userId, walletType);

    if (!wallet) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const transactions = await Wallet.getTransactionHistory(wallet.id, { limit, offset });

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM ledger_transactions
       WHERE from_wallet_id = $1 OR to_wallet_id = $1`,
      [wallet.id]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBankAccounts(userId) {
    const result = await query(
      `SELECT
         ba.id,
         ba.bank_code,
         b.full_name_th as bank_name,
         ba.account_number_last4,
         ba.account_name,
         ba.is_verified,
         ba.is_primary,
         ba.is_active,
         ba.created_at,
         ba.updated_at
       FROM bank_accounts ba
       LEFT JOIN banks b ON b.code = ba.bank_code
       WHERE ba.user_id = $1 AND ba.is_active = true
       ORDER BY ba.is_primary DESC, ba.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async addBankAccount(userId, bankAccount) {
    const { bank_code, bank_name, account_number, account_name, set_primary } = bankAccount;

    if (!bank_code || !account_number || !account_name) {
      throw { status: 400, message: 'bank_code, account_number, and account_name are required' };
    }

    const normalizedCode = String(bank_code).trim().toUpperCase();
    const accountNumber = String(account_number).replace(/\s+/g, '');
    if (accountNumber.length < 4) {
      throw { status: 400, message: 'account_number must be at least 4 digits' };
    }

    const last4 = accountNumber.slice(-4);
    const displayBankName = bank_name ? String(bank_name).trim() : normalizedCode;
    const isVerified = process.env.NODE_ENV !== 'production';
    const shouldSetPrimary = !!set_primary;

    return await transaction(async (client) => {
      await client.query(
        `INSERT INTO banks (code, full_name_th, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET full_name_th = EXCLUDED.full_name_th, updated_at = NOW()`,
        [normalizedCode, displayBankName]
      );

      const existing = await client.query(
        `SELECT id FROM bank_accounts WHERE user_id = $1 AND is_active = true ORDER BY is_primary DESC, created_at ASC`,
        [userId]
      );

      const isPrimary = shouldSetPrimary || existing.rows.length === 0;
      if (isPrimary) {
        await client.query(
          `UPDATE bank_accounts SET is_primary = false, updated_at = NOW() WHERE user_id = $1 AND is_active = true`,
          [userId]
        );
      }

      const bankAccountId = uuidv4();
      await client.query(
        `INSERT INTO bank_accounts (
           id,
           user_id,
           bank_code,
           account_number_encrypted,
           account_number_last4,
           account_name,
           is_verified,
           kyc_name_match_percent,
           is_primary,
           is_active,
           created_at,
           updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, true,
           NOW(), NOW()
         )`,
        [
          bankAccountId,
          userId,
          normalizedCode,
          'redacted',
          last4,
          account_name,
          isVerified,
          isVerified ? 100 : null,
          isPrimary,
        ]
      );

      if (isVerified) {
        await triggerUserTrustUpdate(userId, 'bank_verified');
      }

      const created = await client.query(
        `SELECT
           ba.id,
           ba.bank_code,
           b.full_name_th as bank_name,
           ba.account_number_last4,
           ba.account_name,
           ba.is_verified,
           ba.is_primary
         FROM bank_accounts ba
         LEFT JOIN banks b ON b.code = ba.bank_code
         WHERE ba.id = $1`,
        [bankAccountId]
      );

      return created.rows[0];
    });
  }

  /**
   * Initiate top-up request
   * Creates a pending top-up and returns payment info
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {number} amount - Amount to top up (in THB)
   * @param {string} paymentMethod - Payment method (promptpay, card, bank_transfer)
   * @returns {object} - Top-up request with payment instructions
   */
  async initiateTopup(userId, role, amount, paymentMethod = 'promptpay') {
    if (amount < 100) {
      throw { status: 400, message: 'Minimum top-up amount is 100 THB' };
    }

    if (amount > 100000) {
      throw { status: 400, message: 'Maximum top-up amount is 100,000 THB' };
    }

    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    const wallet = await Wallet.getOrCreateWallet(userId, walletType);

    // Map payment method to provider method
    const providerMethod = paymentMethod === 'promptpay' ? 'dynamic_qr' : 'payment_link';

    // Wrap intent creation + provider call in a transaction so a provider
    // failure rolls back the orphaned topup_intent row.
    return await transaction(async (client) => {
      const topupId = uuidv4();
      const result = await client.query(
        `INSERT INTO topup_intents (id, user_id, amount, currency, method, provider_name, status, created_at, updated_at, expires_at)
         VALUES ($1, $2, $3, 'THB', $4, 'mock', 'pending', NOW(), NOW(), NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [topupId, userId, amount, providerMethod]
      );

      const topupIntent = result.rows[0];

      // Call mock payment provider to initiate payment
      const paymentResponse = await this.initiatePaymentWithProvider({
        ...topupIntent,
        wallet_id: wallet.id,
      });

      // Update with provider reference
      await client.query(
        `UPDATE topup_intents SET provider_payment_id = $1, payment_link_url = $2, qr_payload = $3, updated_at = NOW() WHERE id = $4`,
        [paymentResponse.reference_id, paymentResponse.payment_url, paymentResponse.qr_code, topupId]
      );

      return {
        topup_id: topupId,
        amount,
        payment_method: paymentMethod,
        status: 'pending',
        payment_url: paymentResponse.payment_url,
        qr_code: paymentResponse.qr_code,
        expires_at: topupIntent.expires_at,
      };
    });
  }

  /**
   * Initiate payment with provider (mock)
   * @param {object} topupRequest - Top-up request
   * @returns {object} - Payment provider response
   */
  async initiatePaymentWithProvider(topupRequest) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock provider is disabled in production');
    }

    const mockProviderUrl = process.env.MOCK_PROVIDER_BASE_URL || process.env.MOCK_PROVIDER_URL || 'http://localhost:4000';
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://127.0.0.1:3000';

    try {
      const response = await fetch(`${mockProviderUrl}/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: topupRequest.id,
          amount: topupRequest.amount,
          currency: 'THB',
          payment_method: topupRequest.payment_method,
          callback_url: `${webhookBaseUrl}/api/webhooks/payment`,
        }),
      });

      if (!response.ok) {
        throw new Error('Payment provider error');
      }

      return await response.json();
    } catch (error) {
      console.error('[WalletService] Payment provider error:', error);
      // Return mock response for development
      return {
        reference_id: topupRequest.id,
        payment_url: `http://localhost:4000/payment/mock/${topupRequest.id}`,
        qr_code: `mock_qr_${topupRequest.id}`,
      };
    }
  }

  /**
   * Process successful top-up (called by webhook)
   * @param {string} topupId - Top-up request ID
   * @param {object} providerData - Provider callback data
   * @returns {object} - Updated wallet
   */
  async processTopupSuccess(topupId, providerData = {}) {
    return await transaction(async (client) => {
      // Get and lock top-up intent
      const topupResult = await client.query(
        `SELECT ti.*, w.id as wallet_id FROM topup_intents ti
         JOIN wallets w ON w.user_id = ti.user_id AND w.wallet_type IN ('hirer', 'caregiver')
         WHERE ti.id = $1 FOR UPDATE`,
        [topupId]
      );

      if (topupResult.rows.length === 0) {
        throw { status: 404, message: 'Top-up request not found' };
      }

      const topup = topupResult.rows[0];

      if (topup.status !== 'pending') {
        throw { status: 400, message: `Top-up already processed: ${topup.status}` };
      }

      // Update top-up status
      await client.query(
        `UPDATE topup_intents SET status = 'succeeded', succeeded_at = NOW(), provider_transaction_id = $1, updated_at = NOW() WHERE id = $2`,
        [providerData.transaction_id || null, topupId]
      );

      // Credit wallet
      await client.query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [topup.amount, topup.wallet_id]
      );

      // Record ledger transaction
      await client.query(
        `INSERT INTO ledger_transactions (id, to_wallet_id, amount, currency, type, reference_type, reference_id, provider_name, provider_transaction_id, description, created_at)
         VALUES ($1, $2, $3, 'THB', 'credit', 'topup', $4, $5, $6, 'Wallet top-up', NOW())`,
        [uuidv4(), topup.wallet_id, topup.amount, topupId, 'mock', providerData.transaction_id || null]
      );

      // Get updated wallet
      const walletResult = await client.query(
        `SELECT * FROM wallets WHERE id = $1`,
        [topup.wallet_id]
      );

      return walletResult.rows[0];
    });
  }

  /**
   * Process failed top-up (called by webhook)
   * @param {string} topupId - Top-up request ID
   * @param {string} reason - Failure reason
   * @returns {object} - Updated top-up request
   */
  async processTopupFailure(topupId, reason) {
    const result = await query(
      `UPDATE topup_intents SET status = 'failed', failed_at = NOW(), error_message = $1, updated_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *`,
      [reason, topupId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: 'Top-up request not found or already processed' };
    }

    return result.rows[0];
  }

  /**
   * Get pending top-up intents for user
   * @param {string} userId - User ID
   * @returns {array} - Pending top-ups
   */
  async getPendingTopups(userId) {
    const result = await query(
      `SELECT * FROM topup_intents WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get top-up intent by ID
   * @param {string} topupId - Top-up ID
   * @param {string} userId - User ID (for authorization)
   * @returns {object} - Top-up intent
   */
  async getTopupById(topupId, userId) {
    const result = await query(
      `SELECT * FROM topup_intents WHERE id = $1 AND user_id = $2`,
      [topupId, userId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: 'Top-up request not found' };
    }

    return result.rows[0];
  }

  /**
   * Confirm top-up payment by checking provider status
   * In non-production with mock provider, this simulates a successful paid result.
   * @param {string} topupId - Top-up ID
   * @param {string} userId - User ID (authorization)
   * @returns {object} - Updated top-up status and wallet (if credited)
   */
  async confirmTopupPayment(topupId, userId) {
    const topup = await this.getTopupById(topupId, userId);

    if (topup.status === 'succeeded') {
      return { topup, wallet: null };
    }

    if (topup.status === 'failed' || topup.status === 'expired') {
      return { topup, wallet: null };
    }

    if (topup.status !== 'pending') {
      throw { status: 400, message: `Cannot confirm top-up with status: ${topup.status}` };
    }

    const verification = await this.checkTopupPaymentStatusWithProvider(topup);

    if (verification.status === 'succeeded') {
      const wallet = await this.processTopupSuccess(topupId, {
        transaction_id: verification.transaction_id || `mock_confirm_${Date.now()}`,
      });
      const updatedTopup = await this.getTopupById(topupId, userId);
      return { topup: updatedTopup, wallet };
    }

    if (verification.status === 'failed' || verification.status === 'expired') {
      await this.processTopupFailure(
        topupId,
        verification.reason || (verification.status === 'expired' ? 'Payment expired' : 'Payment failed')
      );
      const updatedTopup = await this.getTopupById(topupId, userId);
      return { topup: updatedTopup, wallet: null };
    }

    return { topup, wallet: null };
  }

  /**
   * Check payment status from provider
   * For mock provider in non-production, we simulate successful payment after user confirmation.
   * @param {object} topupIntent - Top-up intent
   * @returns {{status: 'pending'|'succeeded'|'failed'|'expired', transaction_id?: string, reason?: string}}
   */
  async checkTopupPaymentStatusWithProvider(topupIntent) {
    if (topupIntent.provider_name === 'mock') {
      if (process.env.NODE_ENV !== 'production') {
        return {
          status: 'succeeded',
          transaction_id: `mock_confirm_${Date.now()}`,
        };
      }

      return { status: 'pending' };
    }

    return { status: 'pending' };
  }

  /**
   * Initiate withdrawal request
   * @param {string} userId - User ID
   * @param {string} role - User role (must be caregiver)
   * @param {number} amount - Amount to withdraw
   * @param {string} bankAccountId - Bank account ID
   * @returns {object} - Withdrawal request
   */
  async initiateWithdrawal(userId, role, amount, bankAccountId) {
    // Only caregivers can withdraw
    if (role !== 'caregiver') {
      throw { status: 403, message: 'Only caregivers can withdraw funds' };
    }

    // Check trust level (must be L2+)
    const userResult = await query(`SELECT trust_level FROM users WHERE id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    const trustLevel = userResult.rows[0].trust_level;
    if (trustLevel !== 'L2' && trustLevel !== 'L3') {
      throw { status: 403, message: `Withdrawal requires Trust Level L2 or higher. Your level: ${trustLevel}` };
    }

    // Check minimum amount
    if (amount < 500) {
      throw { status: 400, message: 'Minimum withdrawal amount is 500 THB' };
    }

    // Verify bank account exists and belongs to user (read-only, safe outside txn)
    const bankResult = await query(
      `SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2 AND is_verified = true`,
      [bankAccountId, userId]
    );

    if (bankResult.rows.length === 0) {
      throw { status: 400, message: 'Verified bank account not found' };
    }

    // Verify account name matches profile (or KYC name match percent is sufficient)
    const bankAccount = bankResult.rows[0];
    const profileResult = await query(
      `SELECT display_name FROM caregiver_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const displayName = profileResult.rows[0]?.display_name || '';
    const normalize = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const namesEqual = normalize(bankAccount.account_name) === normalize(displayName);
    const kycMatchOk = (bankAccount.kyc_name_match_percent ?? 0) >= 90;
    if (!namesEqual && !kycMatchOk) {
      throw { status: 400, message: 'Bank account name must match your profile name' };
    }

    // All money operations inside a single transaction with row-level lock
    return await transaction(async (client) => {
      // Lock wallet row to prevent concurrent withdrawals from racing
      const walletResult = await client.query(
        `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver' FOR UPDATE`,
        [userId]
      );

      if (walletResult.rows.length === 0) {
        throw { status: 404, message: 'Wallet not found' };
      }

      const wallet = walletResult.rows[0];
      const availableBalance = parseInt(wallet.available_balance);

      if (availableBalance < amount) {
        throw { status: 400, message: `Insufficient balance. Available: ${availableBalance} THB` };
      }

      // Atomic hold: deduct available, add to held — with WHERE guard as final safety net
      const holdResult = await client.query(
        `UPDATE wallets SET available_balance = available_balance - $1, held_balance = held_balance + $1, updated_at = NOW()
         WHERE id = $2 AND available_balance >= $1
         RETURNING *`,
        [amount, wallet.id]
      );

      if (holdResult.rows.length === 0) {
        throw { status: 400, message: 'Insufficient balance (concurrent modification)' };
      }

      const withdrawalId = uuidv4();

      // Create withdrawal request (status is 'queued' per enum)
      await client.query(
        `INSERT INTO withdrawal_requests (id, user_id, bank_account_id, amount, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'THB', 'queued', NOW(), NOW())`,
        [withdrawalId, userId, bankAccountId, amount]
      );

      // Record hold transaction
      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $2, $3, 'THB', 'hold', 'withdrawal', $4, 'Withdrawal hold', NOW())`,
        [uuidv4(), wallet.id, amount, withdrawalId]
      );

      return {
        withdrawal_id: withdrawalId,
        amount,
        status: 'queued',
        message: 'Withdrawal request submitted. Admin will review and process.',
      };
    });
  }

  /**
   * Get user's withdrawal requests
   * @param {string} userId - User ID
   * @param {object} options - Pagination options
   * @returns {object} - Paginated withdrawal requests
   */
  async getWithdrawalRequests(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'wr.user_id = $1';
    const values = [userId];

    if (status) {
      whereClause += ` AND wr.status = $2`;
      values.push(status);
    }

    const result = await query(
      `SELECT
         wr.*,
         b.full_name_th as bank_name,
         ba.account_number_last4
       FROM withdrawal_requests wr
       LEFT JOIN bank_accounts ba ON ba.id = wr.bank_account_id
       LEFT JOIN banks b ON b.code = ba.bank_code
       WHERE ${whereClause}
       ORDER BY wr.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM withdrawal_requests wr WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Cancel pending withdrawal request
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} userId - User ID
   * @returns {object} - Cancelled withdrawal
   */
  async cancelWithdrawal(withdrawalId, userId) {
    return await transaction(async (client) => {
      // Get and lock withdrawal request
      const wdResult = await client.query(
        `SELECT wr.*, w.id as wallet_id FROM withdrawal_requests wr
         JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = 'caregiver'
         WHERE wr.id = $1 AND wr.user_id = $2 FOR UPDATE`,
        [withdrawalId, userId]
      );

      if (wdResult.rows.length === 0) {
        throw { status: 404, message: 'Withdrawal request not found' };
      }

      const withdrawal = wdResult.rows[0];

      if (withdrawal.status !== 'queued') {
        throw { status: 400, message: `Cannot cancel withdrawal with status: ${withdrawal.status}` };
      }

      // Release held funds
      await client.query(
        `UPDATE wallets SET held_balance = held_balance - $1, available_balance = available_balance + $1, updated_at = NOW()
         WHERE id = $2`,
        [withdrawal.amount, withdrawal.wallet_id]
      );

      // Update withdrawal status
      await client.query(
        `UPDATE withdrawal_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [withdrawalId]
      );

      // Record release transaction
      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $2, $3, 'THB', 'release', 'withdrawal', $4, 'Withdrawal cancelled - funds released', NOW())`,
        [uuidv4(), withdrawal.wallet_id, withdrawal.amount, withdrawalId]
      );

      return {
        withdrawal_id: withdrawalId,
        status: 'cancelled',
        message: 'Withdrawal request cancelled. Funds have been released.',
      };
    });
  }

  async getAllWithdrawals(options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const values = [];

    if (status) {
      values.push(status);
      whereClause += ` AND wr.status = $${values.length}`;
    }

    const result = await query(
      `SELECT
         wr.*,
         u.email as user_email,
         u.role as user_role,
         b.full_name_th as bank_name,
         ba.account_number_last4,
         ba.account_name
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       LEFT JOIN bank_accounts ba ON ba.id = wr.bank_account_id
       LEFT JOIN banks b ON b.code = ba.bank_code
       WHERE ${whereClause}
       ORDER BY wr.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM withdrawal_requests wr WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async reviewWithdrawal(withdrawalId, adminId) {
    return await transaction(async (client) => {
      const wdResult = await client.query(
        `SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (wdResult.rows.length === 0) {
        throw { status: 404, message: 'Withdrawal request not found' };
      }

      const wd = wdResult.rows[0];
      if (wd.status !== 'queued') {
        throw { status: 400, message: `Cannot review withdrawal with status: ${wd.status}` };
      }

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'review',
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, adminId]
      );

      const updated = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [withdrawalId]);
      return updated.rows[0];
    });
  }

  async approveWithdrawal(withdrawalId, adminId) {
    return await transaction(async (client) => {
      const wdResult = await client.query(
        `SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (wdResult.rows.length === 0) {
        throw { status: 404, message: 'Withdrawal request not found' };
      }

      const wd = wdResult.rows[0];
      if (wd.status !== 'review') {
        throw { status: 400, message: `Cannot approve withdrawal with status: ${wd.status}` };
      }

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'approved',
             approved_by = $2,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, adminId]
      );

      const updated = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [withdrawalId]);
      return updated.rows[0];
    });
  }

  async rejectWithdrawal(withdrawalId, adminId, reason = 'Rejected') {
    return await transaction(async (client) => {
      const wdResult = await client.query(
        `SELECT wr.*, w.id as wallet_id
         FROM withdrawal_requests wr
         JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = 'caregiver'
         WHERE wr.id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (wdResult.rows.length === 0) {
        throw { status: 404, message: 'Withdrawal request not found' };
      }

      const wd = wdResult.rows[0];
      if (!['queued', 'review', 'approved'].includes(wd.status)) {
        throw { status: 400, message: `Cannot reject withdrawal with status: ${wd.status}` };
      }

      await client.query(
        `UPDATE wallets
         SET held_balance = held_balance - $1,
             available_balance = available_balance + $1,
             updated_at = NOW()
         WHERE id = $2 AND held_balance >= $1`,
        [wd.amount, wd.wallet_id]
      );

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'rejected',
             rejected_by = $2,
             rejected_at = NOW(),
             rejection_reason = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, adminId, reason]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $2, $3, 'THB', 'reversal', 'withdrawal', $4, 'Withdrawal rejected - funds released', NOW())`,
        [uuidv4(), wd.wallet_id, wd.amount, withdrawalId]
      );

      const updated = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [withdrawalId]);
      return updated.rows[0];
    });
  }

  async markWithdrawalPaid(withdrawalId, adminId, payoutReference = null) {
    return await transaction(async (client) => {
      const wdResult = await client.query(
        `SELECT wr.*, w.id as wallet_id
         FROM withdrawal_requests wr
         JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = 'caregiver'
         WHERE wr.id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (wdResult.rows.length === 0) {
        throw { status: 404, message: 'Withdrawal request not found' };
      }

      const wd = wdResult.rows[0];
      if (wd.status !== 'approved') {
        throw { status: 400, message: `Cannot mark paid withdrawal with status: ${wd.status}` };
      }

      await client.query(
        `UPDATE wallets
         SET held_balance = held_balance - $1,
             updated_at = NOW()
         WHERE id = $2 AND held_balance >= $1`,
        [wd.amount, wd.wallet_id]
      );

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'paid',
             paid_by = $2,
             paid_at = NOW(),
             payout_reference = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, adminId, payoutReference]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, provider_name, provider_transaction_id, description, created_at)
         VALUES ($1, $2, NULL, $3, 'THB', 'debit', 'withdrawal', $4, 'manual', $5, 'Withdrawal payout', NOW())`,
        [uuidv4(), wd.wallet_id, wd.amount, withdrawalId, payoutReference]
      );

      const updated = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [withdrawalId]);
      return updated.rows[0];
    });
  }

  /**
   * Get platform wallet stats (admin only)
   * @returns {object} - Platform financial stats
   */
  async getPlatformStats() {
    // Get or create platform wallet
    let platformWallet = await query(
      `SELECT * FROM wallets WHERE wallet_type = 'platform' LIMIT 1`
    );

    if (platformWallet.rows.length === 0) {
      // Create platform wallet if doesn't exist
      await query(
        `INSERT INTO wallets (id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
         VALUES ($1, 'platform', 0, 0, 'THB', NOW(), NOW())`,
        [uuidv4()]
      );
      platformWallet = await query(`SELECT * FROM wallets WHERE wallet_type = 'platform' LIMIT 1`);
    }

    const walletStats = await Wallet.getWalletStats();
    const txnStats = await LedgerTransaction.getTransactionStats();

    // Get pending withdrawals (queued or review status)
    const pendingWithdrawals = await query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawal_requests WHERE status IN ('queued', 'review')`
    );

    return {
      platform_wallet: {
        id: platformWallet.rows[0].id,
        available_balance: parseInt(platformWallet.rows[0].available_balance),
        held_balance: parseInt(platformWallet.rows[0].held_balance),
      },
      wallet_stats: walletStats,
      transaction_stats: txnStats,
      pending_withdrawals: {
        count: parseInt(pendingWithdrawals.rows[0].count),
        total_amount: parseInt(pendingWithdrawals.rows[0].total),
      },
    };
  }

  /**
   * Add funds directly to wallet (for testing/admin)
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {number} amount - Amount to add
   * @param {string} reason - Reason for adding funds
   * @returns {object} - Updated wallet
   */
  async addFundsDirectly(userId, role, amount, reason = 'Admin credit') {
    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    const wallet = await Wallet.getOrCreateWallet(userId, walletType);

    return await transaction(async (client) => {
      // Credit wallet
      await client.query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [amount, wallet.id]
      );

      // Record ledger transaction (use 'refund' reference type for admin credits)
      await client.query(
        `INSERT INTO ledger_transactions (id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, 'THB', 'credit', 'refund', $4, $5, NOW())`,
        [uuidv4(), wallet.id, amount, uuidv4(), reason]
      );

      // Get updated wallet
      const result = await client.query(`SELECT * FROM wallets WHERE id = $1`, [wallet.id]);
      return result.rows[0];
    });
  }
}

export default new WalletService();
