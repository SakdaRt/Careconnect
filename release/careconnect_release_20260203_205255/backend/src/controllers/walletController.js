import walletService from '../services/walletService.js';

/**
 * Wallet Controller
 * Handles HTTP requests for wallet operations
 */
const walletController = {
  /**
   * Get wallet balance
   * GET /api/wallet/balance
   */
  async getBalance(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.user.role;

      const balance = await walletService.getWalletBalance(userId, role);

      res.json({
        success: true,
        ...balance,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get transaction history
   * GET /api/wallet/transactions
   */
  async getTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const { page, limit } = req.query;

      const transactions = await walletService.getTransactionHistory(userId, role, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });

      res.json({
        success: true,
        ...transactions,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Initiate top-up
   * POST /api/wallet/topup
   */
  async initiateTopup(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const { amount, payment_method } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'Amount is required',
        });
      }

      const topup = await walletService.initiateTopup(
        userId,
        role,
        parseInt(amount),
        payment_method || 'promptpay'
      );

      res.status(201).json({
        success: true,
        message: 'Top-up initiated',
        ...topup,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get top-up status
   * GET /api/wallet/topup/:topupId
   */
  async getTopupStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const { topupId } = req.params;

      const topup = await walletService.getTopupById(topupId, userId);

      res.json({
        success: true,
        topup,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get pending top-ups
   * GET /api/wallet/topup/pending
   */
  async getPendingTopups(req, res, next) {
    try {
      const userId = req.user.id;

      const topups = await walletService.getPendingTopups(userId);

      res.json({
        success: true,
        data: topups,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get bank accounts (caregiver)
   * GET /api/wallet/bank-accounts
   */
  async getBankAccounts(req, res, next) {
    try {
      const userId = req.user.id;
      const bankAccounts = await walletService.getBankAccounts(userId);
      res.json({
        success: true,
        data: bankAccounts.map((ba) => ({
          id: ba.id,
          bank_code: ba.bank_code,
          bank_name: ba.bank_name,
          account_number_last4: ba.account_number_last4,
          account_name: ba.account_name,
          is_verified: ba.is_verified,
          is_primary: ba.is_primary,
        })),
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Add bank account (caregiver)
   * POST /api/wallet/bank-accounts
   */
  async addBankAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const { bank_code, bank_name, account_number, account_name, set_primary } = req.body;

      const bankAccount = await walletService.addBankAccount(userId, {
        bank_code,
        bank_name,
        account_number,
        account_name,
        set_primary,
      });

      res.status(201).json({
        success: true,
        message: bankAccount.is_verified ? 'Bank account added and verified (dev)' : 'Bank account added',
        bank_account: bankAccount,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Initiate withdrawal
   * POST /api/wallet/withdraw
   */
  async initiateWithdrawal(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const { amount, bank_account_id } = req.body;

      if (!amount || !bank_account_id) {
        return res.status(400).json({
          success: false,
          error: 'Amount and bank_account_id are required',
        });
      }

      const withdrawal = await walletService.initiateWithdrawal(
        userId,
        role,
        parseInt(amount),
        bank_account_id
      );

      res.status(201).json({
        success: true,
        ...withdrawal,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get withdrawal requests
   * GET /api/wallet/withdrawals
   */
  async getWithdrawals(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit, status } = req.query;

      const withdrawals = await walletService.getWithdrawalRequests(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
      });

      res.json({
        success: true,
        ...withdrawals,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Cancel withdrawal
   * POST /api/wallet/withdrawals/:withdrawalId/cancel
   */
  async cancelWithdrawal(req, res, next) {
    try {
      const userId = req.user.id;
      const { withdrawalId } = req.params;

      const result = await walletService.cancelWithdrawal(withdrawalId, userId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get platform stats (admin only)
   * GET /api/wallet/admin/stats
   */
  async getPlatformStats(req, res, next) {
    try {
      const stats = await walletService.getPlatformStats();

      res.json({
        success: true,
        ...stats,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Add funds directly (admin/testing)
   * POST /api/wallet/admin/add-funds
   */
  async addFunds(req, res, next) {
    try {
      const { user_id, role, amount, reason } = req.body;

      if (!user_id || !role || !amount) {
        return res.status(400).json({
          success: false,
          error: 'user_id, role, and amount are required',
        });
      }

      const wallet = await walletService.addFundsDirectly(
        user_id,
        role,
        parseInt(amount),
        reason || 'Admin credit'
      );

      res.json({
        success: true,
        message: `Added ${amount} THB to wallet`,
        wallet: {
          id: wallet.id,
          available_balance: parseInt(wallet.available_balance),
          held_balance: parseInt(wallet.held_balance),
        },
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  async adminGetWithdrawals(req, res, next) {
    try {
      const { page, limit, status } = req.query;
      const result = await walletService.getAllWithdrawals({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      next(error);
    }
  },

  async adminReviewWithdrawal(req, res, next) {
    try {
      const adminId = req.user.id;
      const { withdrawalId } = req.params;
      const withdrawal = await walletService.reviewWithdrawal(withdrawalId, adminId);
      res.json({ success: true, withdrawal });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      next(error);
    }
  },

  async adminApproveWithdrawal(req, res, next) {
    try {
      const adminId = req.user.id;
      const { withdrawalId } = req.params;
      const withdrawal = await walletService.approveWithdrawal(withdrawalId, adminId);
      res.json({ success: true, withdrawal });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      next(error);
    }
  },

  async adminRejectWithdrawal(req, res, next) {
    try {
      const adminId = req.user.id;
      const { withdrawalId } = req.params;
      const { reason } = req.body || {};
      const withdrawal = await walletService.rejectWithdrawal(withdrawalId, adminId, reason);
      res.json({ success: true, withdrawal });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      next(error);
    }
  },

  async adminMarkWithdrawalPaid(req, res, next) {
    try {
      const adminId = req.user.id;
      const { withdrawalId } = req.params;
      const { payout_reference } = req.body || {};
      const withdrawal = await walletService.markWithdrawalPaid(withdrawalId, adminId, payout_reference || null);
      res.json({ success: true, withdrawal });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
};

export default walletController;
