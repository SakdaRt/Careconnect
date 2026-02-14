import express from 'express';
import Joi from 'joi';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateParams, validateQuery, validateBody, commonSchemas } from '../utils/validation.js';
import { runTrustLevelWorker, triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';
import { listUsers, getUser, setUserStatus } from '../controllers/adminUserController.js';
import { listJobs, getJob, cancelJob } from '../controllers/adminJobController.js';
import { listLedgerTransactions } from '../controllers/adminLedgerController.js';
import { getHealth } from '../controllers/adminHealthController.js';
import { listDisputes, getDispute, updateDispute, settle } from '../controllers/adminDisputeController.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// --- Shared Joi schemas for admin endpoints ---
const uuidParams = Joi.object({ id: commonSchemas.uuid });
const userIdParams = Joi.object({ userId: commonSchemas.uuid });

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(true);

const adminUserQuery = paginationQuery.keys({
  q: Joi.string().trim().max(200).allow(''),
  role: Joi.string().valid('admin', 'hirer', 'caregiver').allow(''),
  status: Joi.string().valid('active', 'suspended', 'deleted').allow(''),
});

const adminJobQuery = paginationQuery.keys({
  q: Joi.string().trim().max(200).allow(''),
  status: Joi.string().allow(''),
  risk_level: Joi.string().allow(''),
  job_type: Joi.string().allow(''),
});

const adminDisputeQuery = paginationQuery.keys({
  q: Joi.string().trim().max(200).allow(''),
  status: Joi.string().valid('open', 'in_review', 'resolved', 'rejected').allow(''),
  assigned: Joi.string().valid('me', 'unassigned').allow(''),
});

const adminLedgerQuery = paginationQuery.keys({
  reference_type: Joi.string().trim().max(50).allow(''),
  reference_id: Joi.string().trim().max(100).allow(''),
  wallet_id: Joi.string().uuid().allow(''),
  type: Joi.string().trim().max(50).allow(''),
  from: Joi.string().isoDate().allow(''),
  to: Joi.string().isoDate().allow(''),
});

const setUserStatusBody = Joi.object({
  status: Joi.string().valid('active', 'suspended', 'deleted').required(),
  reason: Joi.string().trim().max(500).allow(''),
});

const cancelJobBody = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
});

const updateDisputeBody = Joi.object({
  status: Joi.string().valid('open', 'in_review', 'resolved', 'rejected'),
  note: Joi.string().trim().max(2000),
  assign_to_me: Joi.boolean(),
}).min(1);

const settleDisputeBody = Joi.object({
  refund_amount: Joi.number().integer().min(0),
  payout_amount: Joi.number().integer().min(0),
  resolution: Joi.string().trim().max(2000),
  idempotency_key: Joi.string().trim().max(200),
});

/**
 * Admin Routes
 * Base path: /api/admin
 *
 * These endpoints are for administrative operations.
 * Requires admin role.
 */

/**
 * Trigger trust level recalculation for all users
 * POST /api/admin/trust/recalculate
 * Headers: Authorization: Bearer <token>
 */
router.post('/trust/recalculate', async (req, res) => {
  try {
    console.log('[Admin] Trust level recalculation triggered by', req.userId);
    const results = await runTrustLevelWorker();

    res.json({
      success: true,
      message: 'Trust level recalculation completed',
      results,
    });
  } catch (error) {
    console.error('[Admin] Trust recalculation error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Trust recalculation failed',
    });
  }
});

/**
 * Trigger trust level recalculation for a specific user
 * POST /api/admin/trust/recalculate/:userId
 * Headers: Authorization: Bearer <token>
 */
router.post('/trust/recalculate/:userId',
  validateParams(userIdParams),
  async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`[Admin] Trust level recalculation triggered for user ${userId}`);
    const result = await triggerUserTrustUpdate(userId, 'admin');

    res.json({
      success: true,
      message: 'Trust level recalculation completed for user',
      result,
    });
  } catch (error) {
    console.error('[Admin] Trust recalculation error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Trust recalculation failed',
    });
  }
});

/**
 * Get system statistics
 * GET /api/admin/stats
 * Headers: Authorization: Bearer <token>
 */
router.get('/stats', async (req, res) => {
  try {
    const { query } = await import('../utils/db.js');

    // Get user counts by role
    const userStats = await query(
      `SELECT role, COUNT(*) as count FROM users GROUP BY role`
    );

    // Get job counts by status
    const jobStats = await query(
      `SELECT status, COUNT(*) as count FROM job_posts GROUP BY status`
    );

    // Get wallet totals
    const walletStats = await query(
      `SELECT wallet_type, SUM(available_balance) as total_available, SUM(held_balance) as total_held
       FROM wallets GROUP BY wallet_type`
    );

    res.json({
      success: true,
      data: {
        users: userStats.rows.reduce((acc, row) => {
          acc[row.role] = parseInt(row.count);
          return acc;
        }, {}),
        jobs: jobStats.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        wallets: walletStats.rows.map(row => ({
          type: row.wallet_type,
          totalAvailable: parseFloat(row.total_available) || 0,
          totalHeld: parseFloat(row.total_held) || 0,
        })),
      },
    });
  } catch (error) {
    console.error('[Admin] Stats error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get stats',
    });
  }
});

router.get('/users', validateQuery(adminUserQuery), listUsers);
router.get('/users/:id', validateParams(uuidParams), getUser);
router.post('/users/:id/status', validateParams(uuidParams), validateBody(setUserStatusBody), setUserStatus);

router.get('/jobs', validateQuery(adminJobQuery), listJobs);
router.get('/jobs/:id', validateParams(uuidParams), getJob);
router.post('/jobs/:id/cancel', validateParams(uuidParams), validateBody(cancelJobBody), cancelJob);

router.get('/ledger/transactions', validateQuery(adminLedgerQuery), listLedgerTransactions);

router.get('/health', getHealth);

router.get('/disputes', validateQuery(adminDisputeQuery), listDisputes);
router.get('/disputes/:id', validateParams(uuidParams), getDispute);
router.post('/disputes/:id', validateParams(uuidParams), validateBody(updateDisputeBody), updateDispute);
router.post('/disputes/:id/settle', validateParams(uuidParams), validateBody(settleDisputeBody), settle);

export default router;
