import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getPayments as getPaymentsService,
  getPaymentById as getPaymentByIdService,
  simulatePaymentProcess as simulatePaymentProcessService
} from '../services/paymentService.js';
import { validateQuery, validateParams, paymentSchemas } from '../utils/validation.js';
import { NotFoundError } from '../utils/errors.js';

const router = express.Router();

/**
 * GET /api/payments
 * Get payments with filtering and pagination
 * Requires: requireAuth
 */
router.get('/', 
  requireAuth, 
  validateQuery(paymentSchemas.paymentQuery),
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const userRole = req.userRole;
      
      const { status, page, limit, sort_by, sort_order } = req.query;

      // Build filters object
      const filters = {
        status,
        page,
        limit,
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
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/:id
 * Get payment details by ID
 * Requires: requireAuth
 */
router.get('/:id', 
  requireAuth, 
  validateParams(paymentSchemas.paymentParams),
  async (req, res, next) => {
    try {
      const { payment_id } = req.params;
      const userId = req.userId;
      const userRole = req.userRole;

      const payment = await getPaymentByIdService(payment_id, userId, userRole);

      if (!payment) {
        throw new NotFoundError('Payment', payment_id);
      }

      res.status(200).json({
        success: true,
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/:id/simulate
 * Simulate payment processing (for testing/demo)
 * Requires: requireAuth, admin role
 */
router.post('/:id/simulate', 
  requireAuth, 
  validateParams(paymentSchemas.paymentParams),
  async (req, res, next) => {
    try {
      const { payment_id } = req.params;
      
      const result = await simulatePaymentProcessService(payment_id);

      res.status(200).json({
        success: true,
        data: result.payment,
        ledgerEntry: result.ledgerEntry
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
