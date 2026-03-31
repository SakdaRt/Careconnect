import Wallet from '../models/Wallet.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import Notification from '../models/Notification.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import { triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';
import { notifyTopupSuccess, notifyTopupFailed } from './notificationService.js';
import { emitToUserRoom } from '../sockets/realtimeHub.js';
import '../config/loadEnv.js';
import Stripe from 'stripe';

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

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
  async initiateTopup(userId, role, amount, paymentMethod = 'stripe') {
    if (amount < 100) {
      throw { status: 400, message: 'Minimum top-up amount is 100 THB' };
    }

    if (amount > 100000) {
      throw { status: 400, message: 'Maximum top-up amount is 100,000 THB' };
    }

    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    const wallet = await Wallet.getOrCreateWallet(userId, walletType);
    const paymentProvider = String(process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase();

    if (paymentProvider !== 'stripe') {
      throw { status: 400, message: 'Top-up provider is not set to stripe' };
    }

    const stripe = getStripeClient();
    const topupId = uuidv4();
    const frontendBaseUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const walletPath = role === 'hirer' ? '/hirer/wallet' : '/caregiver/wallet';
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + 30 * 60;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'thb',
            product_data: {
              name: 'CareConnect Wallet Top-up',
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        topup_id: topupId,
        user_id: userId,
        wallet_id: wallet.id,
      },
      success_url: `${frontendBaseUrl}${walletPath}?topup=success&topup_id=${topupId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl}${walletPath}?topup=cancel&topup_id=${topupId}`,
      expires_at: expiresAtEpoch,
    });

    const expiresAt = new Date(expiresAtEpoch * 1000);
    const persistedMethod = paymentMethod === 'stripe' ? 'payment_link' : paymentMethod;

    return await transaction(async (client) => {
      await client.query(
        `INSERT INTO topup_intents (
           id,
           user_id,
           amount,
           currency,
           method,
           provider_name,
           provider_payment_id,
           status,
           payment_link_url,
           qr_payload,
           expires_at,
           created_at,
           updated_at
         ) VALUES (
           $1, $2, $3, 'THB', $4, 'stripe', $5, 'pending', $6, NULL, $7, NOW(), NOW()
         )`,
        [
          topupId,
          userId,
          amount,
          persistedMethod || 'payment_link',
          checkoutSession.id,
          checkoutSession.url || null,
          expiresAt,
        ]
      );

      return {
        topup_id: topupId,
        amount,
        payment_method: paymentMethod || 'stripe',
        status: 'pending',
        payment_url: checkoutSession.url || null,
        expires_at: expiresAt.toISOString(),
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
    const result = await transaction(async (client) => {
      // Get and lock top-up intent
      const topupResult = await client.query(
        `SELECT ti.*, w.id as wallet_id FROM topup_intents ti
         JOIN users u ON u.id = ti.user_id
         JOIN wallets w ON w.user_id = ti.user_id
          AND w.wallet_type = CASE WHEN u.role = 'hirer' THEN 'hirer' ELSE 'caregiver' END
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
        [uuidv4(), topup.wallet_id, topup.amount, topupId, topup.provider_name || 'stripe', providerData.transaction_id || null]
      );

      // Get updated wallet
      const walletResult = await client.query(
        `SELECT * FROM wallets WHERE id = $1`,
        [topup.wallet_id]
      );

      return { wallet: walletResult.rows[0], userId: topup.user_id, amount: topup.amount, topupId };
    });

    notifyTopupSuccess(result.userId, result.amount, result.topupId).catch(() => {});
    return result.wallet;
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

    const topup = result.rows[0];
    notifyTopupFailed(topup.user_id, topup.amount, topupId).catch(() => {});
    return topup;
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
    if (topupIntent.provider_name === 'stripe') {
      if (!topupIntent.provider_payment_id) {
        return { status: 'pending' };
      }

      try {
        const stripe = getStripeClient();
        const session = await stripe.checkout.sessions.retrieve(topupIntent.provider_payment_id);

        if (session.payment_status === 'paid') {
          return {
            status: 'succeeded',
            transaction_id: session.payment_intent ? String(session.payment_intent) : session.id,
          };
        }

        if (session.status === 'expired') {
          return {
            status: 'expired',
            reason: 'Payment session expired',
          };
        }

        return { status: 'pending' };
      } catch (error) {
        console.error('[WalletService] Failed to verify Stripe top-up status:', error);
        return { status: 'pending' };
      }
    }

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
    const { page = 1, limit = 20, status, search, date_from, date_to } = options;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const values = [];

    if (status) {
      values.push(status);
      whereClause += ` AND wr.status = $${values.length}`;
    }

    if (search) {
      values.push(`%${search}%`);
      whereClause += ` AND (u.email ILIKE $${values.length} OR u.phone_number ILIKE $${values.length} OR cp.full_name ILIKE $${values.length} OR cp.display_name ILIKE $${values.length} OR hp.full_name ILIKE $${values.length} OR hp.display_name ILIKE $${values.length})`;
    }

    if (date_from) {
      values.push(date_from);
      whereClause += ` AND wr.created_at >= $${values.length}`;
    }

    if (date_to) {
      values.push(date_to);
      whereClause += ` AND wr.created_at <= $${values.length}`;
    }

    const result = await query(
      `SELECT
         wr.*,
         u.email as user_email,
         u.phone_number as user_phone,
         u.role as user_role,
         u.trust_level as user_trust_level,
         u.ban_withdraw as user_ban_withdraw,
         COALESCE(cp.display_name, hp.display_name) as user_display_name,
         COALESCE(cp.full_name, hp.full_name) as user_full_name,
         kyc.status as user_kyc_status,
         b.full_name_th as bank_name,
         b.code as bank_code,
         ba.account_number_last4,
         ba.account_name,
         ba.is_verified as bank_account_verified,
         w.available_balance as wallet_available_balance,
         w.held_balance as wallet_held_balance,
         (SELECT COUNT(*) FROM withdrawal_requests wr2 WHERE wr2.user_id = wr.user_id AND wr2.status = 'paid') as total_paid_count,
         (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests wr3 WHERE wr3.user_id = wr.user_id AND wr3.status = 'paid') as total_paid_amount
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = wr.user_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = wr.user_id
       LEFT JOIN user_kyc_info kyc ON kyc.user_id = wr.user_id
       LEFT JOIN bank_accounts ba ON ba.id = wr.bank_account_id
       LEFT JOIN banks b ON b.code = ba.bank_code
       LEFT JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = CASE WHEN u.role = 'hirer' THEN 'hirer' ELSE 'caregiver' END
       WHERE ${whereClause}
       ORDER BY wr.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = wr.user_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = wr.user_id
       WHERE ${whereClause}`,
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

  async getWithdrawalDetail(withdrawalId) {
    const result = await query(
      `SELECT
         wr.*,
         u.email as user_email,
         u.phone_number as user_phone,
         u.role as user_role,
         u.trust_level as user_trust_level,
         u.ban_withdraw as user_ban_withdraw,
         u.is_email_verified as user_email_verified,
         u.is_phone_verified as user_phone_verified,
         cp.display_name as user_display_name,
         cp.full_name as user_full_name,
         kyc.status as user_kyc_status,
         b.full_name_th as bank_name,
         b.code as bank_code,
         ba.account_number_last4,
         ba.account_name,
         ba.is_verified as bank_account_verified,
         w.available_balance as wallet_available_balance,
         w.held_balance as wallet_held_balance
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = wr.user_id
       LEFT JOIN user_kyc_info kyc ON kyc.user_id = wr.user_id
       LEFT JOIN bank_accounts ba ON ba.id = wr.bank_account_id
       LEFT JOIN banks b ON b.code = ba.bank_code
       LEFT JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = 'caregiver'
       WHERE wr.id = $1`,
      [withdrawalId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: 'Withdrawal request not found' };
    }

    const wd = result.rows[0];

    const historyResult = await query(
      `SELECT id, amount, status, created_at, paid_at
       FROM withdrawal_requests
       WHERE user_id = $1 AND id != $2
       ORDER BY created_at DESC LIMIT 10`,
      [wd.user_id, withdrawalId]
    );

    return {
      ...wd,
      withdrawal_history: historyResult.rows,
    };
  }

  async _logWithdrawalAudit(eventType, action, adminId, details) {
    try {
      await query(
        `INSERT INTO audit_events (id, user_id, event_type, action, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), adminId, eventType, action, JSON.stringify(details)]
      );
    } catch (err) {
      console.error('[WalletService] Failed to log audit event:', err.message);
    }
  }

  async _notifyWithdrawalStatus(userId, newStatus, amount, extra = {}) {
    const statusMessages = {
      review: { title: 'กำลังตรวจสอบคำขอถอนเงิน', body: `คำขอถอนเงิน ฿${Number(amount).toLocaleString()} กำลังได้รับการตรวจสอบ` },
      approved: { title: 'คำขอถอนเงินได้รับการอนุมัติ', body: `คำขอถอนเงิน ฿${Number(amount).toLocaleString()} ได้รับการอนุมัติแล้ว รอโอนเงิน` },
      rejected: { title: 'คำขอถอนเงินถูกปฏิเสธ', body: `คำขอถอนเงิน ฿${Number(amount).toLocaleString()} ถูกปฏิเสธ${extra.reason ? ': ' + extra.reason : ''} เงินได้คืนเข้า wallet แล้ว` },
      paid: { title: 'โอนเงินเรียบร้อย', body: `เงิน ฿${Number(amount).toLocaleString()} ถูกโอนเข้าบัญชีธนาคารแล้ว${extra.payout_reference ? ' (Ref: ' + extra.payout_reference + ')' : ''}` },
    };
    const msg = statusMessages[newStatus];
    if (!msg) return;
    try {
      await Notification.create({
        userId,
        channel: 'in_app',
        templateKey: `withdrawal_${newStatus}`,
        title: msg.title,
        body: msg.body,
        data: { withdrawal_id: extra.withdrawal_id, status: newStatus },
        referenceType: 'withdrawal',
        referenceId: extra.withdrawal_id,
      });
      emitToUserRoom(userId, 'notification:new', { title: msg.title, body: msg.body });
    } catch (err) {
      console.error('[WalletService] Failed to send withdrawal notification:', err.message);
    }
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
      const result = updated.rows[0];
      this._logWithdrawalAudit('withdrawal_reviewed', 'admin:review', adminId, { withdrawal_id: withdrawalId, amount: wd.amount, user_id: wd.user_id });
      this._notifyWithdrawalStatus(wd.user_id, 'review', wd.amount, { withdrawal_id: withdrawalId });
      return result;
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
      const result = updated.rows[0];
      this._logWithdrawalAudit('withdrawal_approved', 'admin:approve', adminId, { withdrawal_id: withdrawalId, amount: wd.amount, user_id: wd.user_id });
      this._notifyWithdrawalStatus(wd.user_id, 'approved', wd.amount, { withdrawal_id: withdrawalId });
      return result;
    });
  }

  async rejectWithdrawal(withdrawalId, adminId, reason = 'Rejected') {
    return await transaction(async (client) => {
      const wdResult = await client.query(
        `SELECT wr.*, w.id as wallet_id
         FROM withdrawal_requests wr
         JOIN users u ON u.id = wr.user_id
         JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = CASE WHEN u.role = 'hirer' THEN 'hirer' ELSE 'caregiver' END
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

      const walletUpdate = await client.query(
        `UPDATE wallets
         SET held_balance = held_balance - $1,
             available_balance = available_balance + $1,
             updated_at = NOW()
         WHERE id = $2 AND held_balance >= $1
         RETURNING id`,
        [wd.amount, wd.wallet_id]
      );

      if (walletUpdate.rowCount === 0) {
        throw { status: 400, message: 'Insufficient held balance to release funds' };
      }

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
         VALUES ($1, $2, $2, $3, 'THB', 'release', 'withdrawal', $4, 'Withdrawal rejected - funds released', NOW())`,
        [uuidv4(), wd.wallet_id, wd.amount, withdrawalId]
      );

      const updated = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [withdrawalId]);
      const result = updated.rows[0];
      this._logWithdrawalAudit('withdrawal_rejected', 'admin:reject', adminId, { withdrawal_id: withdrawalId, amount: wd.amount, user_id: wd.user_id, reason });
      this._notifyWithdrawalStatus(wd.user_id, 'rejected', wd.amount, { withdrawal_id: withdrawalId, reason });
      return result;
    });
  }

  async markWithdrawalPaid(withdrawalId, adminId, payoutReference = null, payoutProofKey = null) {
    if (!payoutReference) {
      throw { status: 400, message: 'payout_reference is required when marking as paid' };
    }

    return await transaction(async (client) => {
      const wdResult = await client.query(
        `SELECT wr.*, w.id as wallet_id
         FROM withdrawal_requests wr
         JOIN users u ON u.id = wr.user_id
         JOIN wallets w ON w.user_id = wr.user_id AND w.wallet_type = CASE WHEN u.role = 'hirer' THEN 'hirer' ELSE 'caregiver' END
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

      const walletUpdate = await client.query(
        `UPDATE wallets
         SET held_balance = held_balance - $1,
             updated_at = NOW()
         WHERE id = $2 AND held_balance >= $1
         RETURNING id`,
        [wd.amount, wd.wallet_id]
      );

      if (walletUpdate.rowCount === 0) {
        throw { status: 400, message: 'Insufficient held balance to complete payout' };
      }

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'paid',
             paid_by = $2,
             paid_at = NOW(),
             payout_reference = $3,
             payout_proof_storage_key = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, adminId, payoutReference, payoutProofKey]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, provider_name, provider_transaction_id, description, created_at)
         VALUES ($1, $2, NULL, $3, 'THB', 'debit', 'withdrawal', $4, 'manual', $5, 'Withdrawal payout', NOW())`,
        [uuidv4(), wd.wallet_id, wd.amount, withdrawalId, payoutReference]
      );

      const updated = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [withdrawalId]);
      const result = updated.rows[0];
      this._logWithdrawalAudit('withdrawal_paid', 'admin:mark_paid', adminId, { withdrawal_id: withdrawalId, amount: wd.amount, user_id: wd.user_id, payout_reference: payoutReference });
      this._notifyWithdrawalStatus(wd.user_id, 'paid', wd.amount, { withdrawal_id: withdrawalId, payout_reference: payoutReference });
      return result;
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

  async getDashboardStats() {
    const walletsByType = await query(`
      SELECT
        wallet_type,
        COUNT(*) as count,
        COALESCE(SUM(available_balance), 0) as total_available,
        COALESCE(SUM(held_balance), 0) as total_held
      FROM wallets
      GROUP BY wallet_type
    `);

    const withdrawalsByStatus = await query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM withdrawal_requests
      GROUP BY status
    `);

    const monthlyStats = await query(`
      SELECT
        to_char(created_at, 'YYYY-MM') as month,
        COUNT(*) FILTER (WHERE type = 'credit' AND reference_type = 'topup') as topup_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'credit' AND reference_type = 'topup'), 0) as topup_amount,
        COUNT(*) FILTER (WHERE type = 'debit' AND reference_type = 'fee') as fee_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'debit' AND reference_type = 'fee'), 0) as fee_amount,
        COUNT(*) FILTER (WHERE type = 'debit' AND reference_type = 'withdrawal') as payout_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'debit' AND reference_type = 'withdrawal'), 0) as payout_amount,
        COUNT(*) FILTER (WHERE type = 'reversal') as reversal_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'reversal'), 0) as reversal_amount,
        COUNT(*) FILTER (WHERE type = 'forfeit') as penalty_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'forfeit'), 0) as penalty_amount
      FROM ledger_transactions
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `);

    const depositStats = await query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM job_deposits
      GROUP BY status
    `);

    const unresolvedCount = await query(`
      SELECT COUNT(*)::int as count FROM jobs WHERE fault_party = 'unresolved'
    `);

    const platformRevenue = await query(`
      SELECT
        COALESCE(SUM(final_platform_fee), 0) as total_fee_revenue,
        COALESCE(SUM(final_platform_penalty_revenue), 0) as total_penalty_revenue
      FROM jobs WHERE settlement_completed_at IS NOT NULL
    `);

    const integrity = await LedgerTransaction.verifyLedgerIntegrity();

    const walletMap = {};
    for (const row of walletsByType.rows) {
      walletMap[row.wallet_type] = {
        count: parseInt(row.count),
        total_available: parseInt(row.total_available),
        total_held: parseInt(row.total_held),
      };
    }

    const withdrawalMap = {};
    for (const row of withdrawalsByStatus.rows) {
      withdrawalMap[row.status] = {
        count: parseInt(row.count),
        total_amount: parseInt(row.total_amount),
      };
    }

    const depositMap = {};
    for (const row of depositStats.rows) {
      depositMap[row.status] = {
        count: parseInt(row.count),
        total_amount: parseInt(row.total_amount),
      };
    }

    const revRow = platformRevenue.rows[0] || {};

    return {
      wallets: walletMap,
      withdrawals: withdrawalMap,
      deposits: depositMap,
      unresolved_jobs: unresolvedCount.rows[0]?.count || 0,
      platform_revenue: {
        total_fee_revenue: parseInt(revRow.total_fee_revenue) || 0,
        total_penalty_revenue: parseInt(revRow.total_penalty_revenue) || 0,
      },
      monthly: monthlyStats.rows.map(r => ({
        month: r.month,
        topup_count: parseInt(r.topup_count),
        topup_amount: parseInt(r.topup_amount),
        fee_count: parseInt(r.fee_count),
        fee_amount: parseInt(r.fee_amount),
        payout_count: parseInt(r.payout_count),
        payout_amount: parseInt(r.payout_amount),
        reversal_count: parseInt(r.reversal_count),
        reversal_amount: parseInt(r.reversal_amount),
        penalty_count: parseInt(r.penalty_count),
        penalty_amount: parseInt(r.penalty_amount),
      })),
      ledger_integrity: integrity,
    };
  }

  async getAdminTransactions(options = {}) {
    const { page = 1, limit = 30, type, reference_type, date_from, date_to } = options;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const values = [];

    if (type) {
      values.push(type);
      whereClause += ` AND lt.type = $${values.length}`;
    }

    if (reference_type) {
      values.push(reference_type);
      whereClause += ` AND lt.reference_type = $${values.length}`;
    }

    if (date_from) {
      values.push(date_from);
      whereClause += ` AND lt.created_at >= $${values.length}`;
    }

    if (date_to) {
      values.push(date_to);
      whereClause += ` AND lt.created_at <= $${values.length}`;
    }

    const result = await query(
      `SELECT
         lt.*,
         fw.wallet_type as from_wallet_type,
         fw.user_id as from_user_id,
         fu.email as from_user_email,
         COALESCE(fcp.display_name, fhp.display_name) as from_user_name,
         tw.wallet_type as to_wallet_type,
         tw.user_id as to_user_id,
         tu.email as to_user_email,
         COALESCE(tcp.display_name, thp.display_name) as to_user_name
       FROM ledger_transactions lt
       LEFT JOIN wallets fw ON fw.id = lt.from_wallet_id
       LEFT JOIN users fu ON fu.id = fw.user_id
       LEFT JOIN caregiver_profiles fcp ON fcp.user_id = fw.user_id
       LEFT JOIN hirer_profiles fhp ON fhp.user_id = fw.user_id
       LEFT JOIN wallets tw ON tw.id = lt.to_wallet_id
       LEFT JOIN users tu ON tu.id = tw.user_id
       LEFT JOIN caregiver_profiles tcp ON tcp.user_id = tw.user_id
       LEFT JOIN hirer_profiles thp ON thp.user_id = tw.user_id
       WHERE ${whereClause}
       ORDER BY lt.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM ledger_transactions lt WHERE ${whereClause}`,
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
