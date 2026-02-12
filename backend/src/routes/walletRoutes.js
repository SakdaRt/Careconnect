import express from 'express';
import Joi from 'joi';
import walletController from '../controllers/walletController.js';
import { requireAuth, requireRole, requirePolicy } from '../middleware/auth.js';

const router = express.Router();

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details.map((detail) => detail.message).join(', '),
    });
  }
  req.body = value;
  return next();
};

const addBankAccountSchema = Joi.object({
  bank_code: Joi.string().trim().min(1).required(),
  bank_name: Joi.string().allow('', null),
  account_number: Joi.string().trim().min(4).required(),
  account_name: Joi.string().trim().min(1).required(),
  set_primary: Joi.boolean(),
}).unknown(true);

const topupSchema = Joi.object({
  amount: Joi.number().positive().required(),
  payment_method: Joi.string().valid('promptpay', 'card', 'bank_transfer'),
}).unknown(true);

const withdrawSchema = Joi.object({
  amount: Joi.number().positive().required(),
  bank_account_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
}).unknown(true);

const adminAddFundsSchema = Joi.object({
  user_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
  role: Joi.string().valid('hirer', 'caregiver').required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().allow('', null),
}).unknown(true);

const adminRejectSchema = Joi.object({
  reason: Joi.string().allow('', null),
}).unknown(true);

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
 * Query: { page?, limit? }
 */
router.get('/transactions', requireAuth, requirePolicy('wallet:transactions'), walletController.getTransactions);

/**
 * Get bank accounts (caregiver)
 * GET /api/wallet/bank-accounts
 */
router.get('/bank-accounts', requireAuth, requirePolicy('wallet:bank-accounts'), walletController.getBankAccounts);

/**
 * Add bank account (caregiver)
 * POST /api/wallet/bank-accounts
 */
router.post('/bank-accounts', requireAuth, requirePolicy('wallet:bank-add'), validateBody(addBankAccountSchema), walletController.addBankAccount);

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
 * Body: { amount, payment_method? }
 */
router.post('/topup', requireAuth, requirePolicy('wallet:topup'), validateBody(topupSchema), walletController.initiateTopup);

/**
 * Get top-up status
 * GET /api/wallet/topup/:topupId
 * Headers: Authorization: Bearer <token>
 */
router.get('/topup/:topupId', requireAuth, requirePolicy('wallet:topup:status'), walletController.getTopupStatus);

/**
 * Get withdrawal requests
 * GET /api/wallet/withdrawals
 * Headers: Authorization: Bearer <token>
 * Query: { page?, limit?, status? }
 */
router.get('/withdrawals', requireAuth, requirePolicy('wallet:withdrawals'), walletController.getWithdrawals);

/**
 * Initiate withdrawal (caregiver only)
 * POST /api/wallet/withdraw
 * Headers: Authorization: Bearer <token>
 * Body: { amount, bank_account_id }
 */
router.post('/withdraw', requireAuth, requirePolicy('wallet:withdraw'), validateBody(withdrawSchema), walletController.initiateWithdrawal);

/**
 * Cancel withdrawal
 * POST /api/wallet/withdrawals/:withdrawalId/cancel
 * Headers: Authorization: Bearer <token>
 */
router.post('/withdrawals/:withdrawalId/cancel', requireAuth, requirePolicy('wallet:withdraw:cancel'), walletController.cancelWithdrawal);

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
 * Body: { user_id, role, amount, reason? }
 */
router.post('/admin/add-funds', requireAuth, requireRole('admin'), validateBody(adminAddFundsSchema), walletController.addFunds);

router.get('/admin/withdrawals', requireAuth, requireRole('admin'), walletController.adminGetWithdrawals);
router.post('/admin/withdrawals/:withdrawalId/review', requireAuth, requireRole('admin'), walletController.adminReviewWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/approve', requireAuth, requireRole('admin'), walletController.adminApproveWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/reject', requireAuth, requireRole('admin'), validateBody(adminRejectSchema), walletController.adminRejectWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/mark-paid', requireAuth, requireRole('admin'), walletController.adminMarkWithdrawalPaid);

export default router;
