import BaseModel from './BaseModel.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Wallet Model
 * Handles wallet operations and balance management
 */
class Wallet extends BaseModel {
  constructor() {
    super('wallets');
  }

  /**
   * Create wallet for user
   * @param {string} userId - User ID (null for platform/escrow wallets)
   * @param {string} walletType - Wallet type (hirer, caregiver, escrow, platform)
   * @param {string} jobId - Job ID (only for escrow wallets)
   * @returns {object} - Created wallet
   */
  async createWallet(userId, walletType, jobId = null) {
    const walletData = {
      id: uuidv4(),
      user_id: userId || null,
      job_id: jobId || null,
      wallet_type: walletType,
      available_balance: 0,
      held_balance: 0,
      currency: 'THB',
      created_at: new Date(),
      updated_at: new Date(),
    };

    return await this.create(walletData);
  }

  /**
   * Get wallet by user ID and type
   * @param {string} userId - User ID
   * @param {string} walletType - Wallet type
   * @returns {object|null} - Wallet or null
   */
  async getWalletByUser(userId, walletType) {
    return await this.findOne({ user_id: userId, wallet_type: walletType });
  }

  /**
   * Get or create wallet
   * @param {string} userId - User ID
   * @param {string} walletType - Wallet type
   * @returns {object} - Wallet
   */
  async getOrCreateWallet(userId, walletType) {
    let wallet = await this.getWalletByUser(userId, walletType);
    if (!wallet) {
      wallet = await this.createWallet(userId, walletType);
    }
    return wallet;
  }

  /**
   * Get wallet balance
   * @param {string} walletId - Wallet ID
   * @returns {object} - Balance info
   */
  async getBalance(walletId) {
    const wallet = await this.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    const availableBalance = parseInt(wallet.available_balance);
    const heldBalance = parseInt(wallet.held_balance);
    return {
      available_balance: availableBalance,
      held_balance: heldBalance,
      total_balance: availableBalance + heldBalance,
    };
  }

  /**
   * Update wallet balance (atomic)
   * @param {string} walletId - Wallet ID
   * @param {number} availableChange - Change in available balance (in satoshi/smallest unit)
   * @param {number} heldChange - Change in held balance (in satoshi/smallest unit)
   * @returns {object} - Updated wallet
   */
  async updateBalance(walletId, availableChange, heldChange = 0) {
    const result = await query(
      `UPDATE wallets
       SET available_balance = available_balance + $1,
           held_balance = held_balance + $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [availableChange, heldChange, walletId]
    );

    if (result.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    const wallet = result.rows[0];

    // Check for negative balance (should never happen due to DB constraint)
    if (parseInt(wallet.available_balance) < 0) {
      throw new Error('Insufficient balance');
    }

    return wallet;
  }

  /**
   * Hold funds (move from available to held)
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to hold
   * @returns {object} - Updated wallet
   */
  async holdFunds(walletId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const result = await query(
      `UPDATE wallets
       SET available_balance = available_balance - $1,
           held_balance = held_balance + $1,
           updated_at = NOW()
       WHERE id = $2 AND available_balance >= $1
       RETURNING *`,
      [amount, walletId]
    );

    if (result.rows.length === 0) {
      throw new Error('Insufficient available balance to hold');
    }

    return result.rows[0];
  }

  /**
   * Release held funds (move from held to available)
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to release
   * @returns {object} - Updated wallet
   */
  async releaseFunds(walletId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const result = await query(
      `UPDATE wallets
       SET held_balance = held_balance - $1,
           available_balance = available_balance + $1,
           updated_at = NOW()
       WHERE id = $2 AND held_balance >= $1
       RETURNING *`,
      [amount, walletId]
    );

    if (result.rows.length === 0) {
      throw new Error('Insufficient held balance to release');
    }

    return result.rows[0];
  }

  /**
   * Capture held funds (deduct from held balance)
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Amount to capture
   * @returns {object} - Updated wallet
   */
  async captureFunds(walletId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const result = await query(
      `UPDATE wallets
       SET held_balance = held_balance - $1,
           updated_at = NOW()
       WHERE id = $2 AND held_balance >= $1
       RETURNING *`,
      [amount, walletId]
    );

    if (result.rows.length === 0) {
      throw new Error('Insufficient held balance to capture');
    }

    return result.rows[0];
  }

  /**
   * Transfer funds between wallets (atomic)
   * @param {string} fromWalletId - Source wallet ID
   * @param {string} toWalletId - Destination wallet ID
   * @param {number} amount - Amount to transfer (in satoshi/smallest unit)
   * @returns {object} - { fromWallet, toWallet }
   */
  async transferFunds(fromWalletId, toWalletId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    return await transaction(async (client) => {
      // Deduct from source wallet
      const deductResult = await client.query(
        `UPDATE wallets
         SET available_balance = available_balance - $1,
             updated_at = NOW()
         WHERE id = $2 AND available_balance >= $1
         RETURNING *`,
        [amount, fromWalletId]
      );

      if (deductResult.rows.length === 0) {
        throw new Error('Insufficient balance in source wallet');
      }

      // Add to destination wallet
      const addResult = await client.query(
        `UPDATE wallets
         SET available_balance = available_balance + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [amount, toWalletId]
      );

      if (addResult.rows.length === 0) {
        throw new Error('Destination wallet not found');
      }

      return {
        fromWallet: deductResult.rows[0],
        toWallet: addResult.rows[0],
      };
    });
  }

  /**
   * Get wallet transaction history
   * @param {string} walletId - Wallet ID
   * @param {object} options - Pagination options
   * @returns {array} - Transactions
   */
  async getTransactionHistory(walletId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await query(
      `SELECT * FROM ledger_transactions
       WHERE from_wallet_id = $1 OR to_wallet_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [walletId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get all wallets for user
   * @param {string} userId - User ID
   * @returns {array} - User wallets
   */
  async getUserWallets(userId) {
    return await this.findAll({ user_id: userId });
  }

  /**
   * Get wallet statistics
   * @returns {object} - Wallet stats
   */
  async getWalletStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total_wallets,
        SUM(available_balance) as total_available,
        SUM(held_balance) as total_held,
        SUM(available_balance + held_balance) as total_balance,
        COUNT(*) FILTER (WHERE wallet_type = 'hirer') as hirer_wallets,
        COUNT(*) FILTER (WHERE wallet_type = 'caregiver') as caregiver_wallets,
        COUNT(*) FILTER (WHERE wallet_type = 'escrow') as escrow_wallets,
        COUNT(*) FILTER (WHERE wallet_type = 'platform') as platform_wallets
      FROM wallets
    `);

    return result.rows[0];
  }
}

export default new Wallet();
