import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { runTrustLevelWorker, triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';
import { listUsers, getUser, setUserStatus } from '../controllers/adminUserController.js';
import { listJobs, getJob, cancelJob } from '../controllers/adminJobController.js';
import { listLedgerTransactions } from '../controllers/adminLedgerController.js';
import { getHealth } from '../controllers/adminHealthController.js';
import { listDisputes, getDispute, updateDispute, settle } from '../controllers/adminDisputeController.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

/**
 * Admin Routes
 * Base path: /api/admin
 *
 * These endpoints are for administrative operations.
 * Requires admin role (to be implemented).
 */

/**
 * Trigger trust level recalculation for all users
 * POST /api/admin/trust/recalculate
 * Headers: Authorization: Bearer <token>
 */
router.post('/trust/recalculate', async (req, res) => {
  try {
    // TODO: Add admin role check when implemented
    // For now, any authenticated user can trigger (development only)

    console.log('[Admin] Trust level recalculation triggered');
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
router.post('/trust/recalculate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`[Admin] Trust level recalculation triggered for user ${userId}`);
    const result = await triggerUserTrustUpdate(userId);

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

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.post('/users/:id/status', setUserStatus);

router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/cancel', cancelJob);

router.get('/ledger/transactions', listLedgerTransactions);

router.get('/health', getHealth);

router.get('/disputes', listDisputes);
router.get('/disputes/:id', getDispute);
router.post('/disputes/:id', updateDispute);
router.post('/disputes/:id/settle', settle);

export default router;
