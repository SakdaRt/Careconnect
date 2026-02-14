import express from 'express';
import walletController from '../controllers/walletController.js';
import { requireAuth, requireRole, requirePolicy } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams, walletSchemas, commonSchemas } from '../utils/validation.js';
import Joi from 'joi';

const router = express.Router();

/**
 * Wallet Routes
 * Base path: /api/wallet
 */

// ============================================================================
// Protected Routes (Authentication required)
// ============================================================================

/**
 * Get wallet balance
 * GET /api/wallet/balance
 * Headers: Authorization: Bearer <token>
 */
router.get('/balance', requireAuth, requirePolicy('wallet:balance'), walletController.getBalance);

/**
 * Get transaction history
 * GET /api/wallet/transactions
 * Headers: Authorization: Bearer <token>
 * Query: { page?, limit?, transaction_type?, start_date?, end_date? }
 */
router.get('/transactions', 
  requireAuth, 
  requirePolicy('wallet:transactions'), 
  validateQuery(walletSchemas.walletQuery), 
  walletController.getTransactions
);

/**
 * Get bank accounts (caregiver)
 * GET /api/wallet/bank-accounts
 */
router.get('/bank-accounts', requireAuth, requirePolicy('wallet:bank-accounts'), walletController.getBankAccounts);

/**
 * Add bank account (caregiver)
 * POST /api/wallet/bank-accounts
 */
router.post('/bank-accounts', 
  requireAuth, 
  requirePolicy('wallet:bank-add'), 
  validateBody(walletSchemas.addBankAccount), 
  walletController.addBankAccount
);

/**
 * Get pending top-ups
 * GET /api/wallet/topup/pending
 * Headers: Authorization: Bearer <token>
 */
router.get('/topup/pending', requireAuth, requirePolicy('wallet:topup:pending'), walletController.getPendingTopups);

/**
 * Initiate top-up
 * POST /api/wallet/topup
 * Headers: Authorization: Bearer <token>
 * Body: { amount, payment_method }
 */
router.post('/topup', 
  requireAuth, 
  requirePolicy('wallet:topup'), 
  validateBody(walletSchemas.topup), 
  walletController.initiateTopup
);

/**
 * Get top-up status
 * GET /api/wallet/topup/:topupId
 * Headers: Authorization: Bearer <token>
 */
router.get('/topup/:topupId', 
  requireAuth, 
  requirePolicy('wallet:topup:status'),
  validateParams(Joi.object({ topupId: commonSchemas.uuid })),
  walletController.getTopupStatus
);

/**
 * Get withdrawal requests
 * GET /api/wallet/withdrawals
 * Headers: Authorization: Bearer <token>
 * Query: { page?, limit?, status? }
 */
router.get('/withdrawals', 
  requireAuth, 
  requirePolicy('wallet:withdrawals'),
  validateQuery(walletSchemas.walletQuery),
  walletController.getWithdrawals
);

/**
 * Initiate withdrawal (caregiver only)
 * POST /api/wallet/withdraw
 * Headers: Authorization: Bearer <token>
 * Body: { amount, bank_account_id }
 */
router.post('/withdraw', 
  requireAuth, 
  requirePolicy('wallet:withdraw'), 
  validateBody(walletSchemas.withdraw), 
  walletController.initiateWithdrawal
);

/**
 * Cancel withdrawal
 * POST /api/wallet/withdrawals/:withdrawalId/cancel
 * Headers: Authorization: Bearer <token>
 */
router.post('/withdrawals/:withdrawalId/cancel', 
  requireAuth, 
  requirePolicy('wallet:withdraw:cancel'),
  validateParams(Joi.object({ withdrawalId: commonSchemas.uuid })),
  walletController.cancelWithdrawal
);

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * Get platform stats (admin only)
 * GET /api/wallet/admin/stats
 * Headers: Authorization: Bearer <token>
 */
router.get('/admin/stats', requireAuth, requireRole('admin'), walletController.getPlatformStats);

/**
 * Add funds directly (admin/testing)
 * POST /api/wallet/admin/add-funds
 * Headers: Authorization: Bearer <token>
 * Body: { user_id, amount, transaction_type, description }
 */
router.post('/admin/add-funds', 
  requireAuth, 
  requireRole('admin'), 
  validateBody(walletSchemas.adminAddFunds), 
  walletController.addFunds
);

router.get('/admin/withdrawals', 
  requireAuth, 
  requireRole('admin'), 
  validateQuery(walletSchemas.walletQuery),
  walletController.adminGetWithdrawals
);

router.post('/admin/withdrawals/:withdrawalId/review', 
  requireAuth, 
  requireRole('admin'),
  validateParams(Joi.object({ withdrawalId: commonSchemas.uuid })),
  walletController.adminReviewWithdrawal
);

router.post('/admin/withdrawals/:withdrawalId/approve', 
  requireAuth, 
  requireRole('admin'),
  validateParams(Joi.object({ withdrawalId: commonSchemas.uuid })),
  walletController.adminApproveWithdrawal
);

router.post('/admin/withdrawals/:withdrawalId/reject', 
  requireAuth, 
  requireRole('admin'), 
  validateBody(walletSchemas.adminReject),
  validateParams(Joi.object({ withdrawalId: commonSchemas.uuid })),
  walletController.adminRejectWithdrawal
);

router.post('/admin/withdrawals/:withdrawalId/mark-paid', 
  requireAuth, 
  requireRole('admin'),
  validateParams(Joi.object({ withdrawalId: commonSchemas.uuid })),
  walletController.adminMarkWithdrawalPaid
);

export default router;
