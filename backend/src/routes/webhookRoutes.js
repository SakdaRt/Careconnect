import express from 'express';
import webhookController from '../controllers/webhookController.js';
import { webhookLimiter } from '../utils/rateLimiter.js';

const router = express.Router();

/**
 * Webhook Routes
 * Base path: /api/webhooks
 *
 * These endpoints receive callbacks from external providers.
 * They do NOT require user authentication but may verify signatures.
 */

/**
 * Payment provider webhook
 * POST /api/webhooks/payment
 * Headers: x-webhook-signature (optional in dev)
 * Body: { event, data }
 */
router.post('/payment', webhookLimiter, webhookController.handlePaymentWebhook);

/**
 * KYC provider webhook
 * POST /api/webhooks/kyc
 * Headers: x-webhook-signature (optional in dev)
 * Body: { event, data }
 */
router.post('/kyc', webhookLimiter, webhookController.handleKycWebhook);

/**
 * SMS provider webhook
 * POST /api/webhooks/sms
 * Headers: x-webhook-signature (optional in dev)
 * Body: { event, data }
 */
router.post('/sms', webhookController.handleSmsWebhook);

export default router;
