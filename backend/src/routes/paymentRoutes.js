import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getPayments as getPaymentsService,
  getPaymentById as getPaymentByIdService,
  simulatePaymentProcess as simulatePaymentProcessService
} from '../services/paymentService.js';

const router = express.Router();

/**
 * GET /api/payments
 * Get payments with filtering and pagination
 * Requires: requireAuth
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    
    const {
      status,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    // Build filters object with bounds enforcement
    const filters = {
      status,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(Math.max(1, parseInt(limit) || 20), 100), // Min 1, Max 100
      sort_by,
      sort_order
    };

    // Non-admin users can only see their own payments
    if (userRole !== 'admin') {
      filters.user_id = userId;
    }

    const result = await getPaymentsService(filters);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('[Payment Routes] Get payments error:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get payments'
    });
  }
});

/**
 * GET /api/payments/:id
 * Get payment details by ID
 * Requires: requireAuth
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id: paymentId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const payment = await getPaymentByIdService(paymentId, userId, userRole);

    if (!payment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('[Payment Routes] Get payment details error:', error);
    
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get payment details'
    });
  }
});

/**
 * POST /api/payments/:id/simulate
 * Simulate payment processing (for testing/demo)
 * Requires: requireAuth, admin role
 */
router.post('/:id/simulate', requireAuth, async (req, res) => {
  try {
    const { id: paymentId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    // Only admins can simulate payments
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can simulate payments'
      });
    }

    const result = await simulatePaymentProcessService(paymentId, userId);

    res.status(200).json({
      success: true,
      message: 'Payment simulation completed',
      data: result
    });
  } catch (error) {
    console.error('[Payment Routes] Simulate payment error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not found',
        message: error.message
      });
    }

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to simulate payment'
    });
  }
});

export default router;
