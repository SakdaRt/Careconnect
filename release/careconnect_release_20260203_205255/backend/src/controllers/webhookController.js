import crypto from 'crypto';
import walletService from '../services/walletService.js';
import { query } from '../utils/db.js';

/**
 * Webhook Controller
 * Handles incoming webhooks from payment providers
 */
const webhookController = {
  /**
   * Verify webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - Signature from header
   * @param {string} secret - Webhook secret
   * @returns {boolean} - True if valid
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  },

  /**
   * Handle payment webhook
   * POST /api/webhooks/payment
   */
  async handlePaymentWebhook(req, res) {
    try {
      const signature = req.headers['x-webhook-signature'];
      const secret = process.env.WEBHOOK_SECRET || 'careconnect_webhook_secret_dev';

      // Verify signature (skip in development if no signature)
      if (signature && process.env.NODE_ENV === 'production') {
        const rawBody = JSON.stringify(req.body);
        if (!webhookController.verifySignature(rawBody, signature, secret)) {
          console.error('[Webhook] Invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const { event, data } = req.body;
      console.log(`[Webhook] Received payment event: ${event}`, data);

      switch (event) {
        case 'payment.success':
        case 'payment.completed':
          await webhookController.handlePaymentSuccess(data);
          break;

        case 'payment.failed':
          await webhookController.handlePaymentFailure(data);
          break;

        case 'payment.expired':
          await webhookController.handlePaymentExpired(data);
          break;

        default:
          console.log(`[Webhook] Unknown event: ${event}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] Payment webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },

  /**
   * Handle successful payment
   * @param {object} data - Payment data
   */
  async handlePaymentSuccess(data) {
    const { reference_id, transaction_id, amount } = data;

    try {
      await walletService.processTopupSuccess(reference_id, {
        transaction_id,
        amount,
      });
      console.log(`[Webhook] Top-up processed successfully: ${reference_id}`);
    } catch (error) {
      console.error(`[Webhook] Failed to process top-up ${reference_id}:`, error);
      throw error;
    }
  },

  /**
   * Handle failed payment
   * @param {object} data - Payment data
   */
  async handlePaymentFailure(data) {
    const { reference_id, reason } = data;

    try {
      await walletService.processTopupFailure(reference_id, reason || 'Payment failed');
      console.log(`[Webhook] Top-up marked as failed: ${reference_id}`);
    } catch (error) {
      console.error(`[Webhook] Failed to mark top-up as failed ${reference_id}:`, error);
    }
  },

  /**
   * Handle expired payment
   * @param {object} data - Payment data
   */
  async handlePaymentExpired(data) {
    const { reference_id } = data;

    try {
      await walletService.processTopupFailure(reference_id, 'Payment expired');
      console.log(`[Webhook] Top-up marked as expired: ${reference_id}`);
    } catch (error) {
      console.error(`[Webhook] Failed to mark top-up as expired ${reference_id}:`, error);
    }
  },

  /**
   * Handle KYC webhook
   * POST /api/webhooks/kyc
   */
  async handleKycWebhook(req, res) {
    try {
      const { event, data } = req.body;
      console.log(`[Webhook] Received KYC event: ${event}`, data);

      switch (event) {
        case 'kyc.approved':
          await webhookController.handleKycApproved(data);
          break;

        case 'kyc.rejected':
          await webhookController.handleKycRejected(data);
          break;

        case 'kyc.pending_review':
          console.log(`[Webhook] KYC pending review: ${data.reference_id}`);
          break;

        default:
          console.log(`[Webhook] Unknown KYC event: ${event}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] KYC webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },

  /**
   * Handle KYC approved
   * @param {object} data - KYC data
   */
  async handleKycApproved(data) {
    const { reference_id, user_id } = data;

    try {
      // Update user KYC info
      await query(
        `UPDATE user_kyc_info SET status = 'approved', verified_at = NOW(), updated_at = NOW()
         WHERE reference_id = $1 OR user_id = $2`,
        [reference_id, user_id]
      );

      // Update user trust level to L2 if currently L1
      await query(
        `UPDATE users SET trust_level = 'L2', updated_at = NOW()
         WHERE id = $1 AND trust_level = 'L1'`,
        [user_id]
      );

      console.log(`[Webhook] KYC approved for user: ${user_id}`);
    } catch (error) {
      console.error(`[Webhook] Failed to process KYC approval:`, error);
    }
  },

  /**
   * Handle KYC rejected
   * @param {object} data - KYC data
   */
  async handleKycRejected(data) {
    const { reference_id, user_id, reason } = data;

    try {
      await query(
        `UPDATE user_kyc_info SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
         WHERE reference_id = $2 OR user_id = $3`,
        [reason, reference_id, user_id]
      );

      console.log(`[Webhook] KYC rejected for user: ${user_id}`);
    } catch (error) {
      console.error(`[Webhook] Failed to process KYC rejection:`, error);
    }
  },

  /**
   * Handle SMS webhook
   * POST /api/webhooks/sms
   */
  async handleSmsWebhook(req, res) {
    try {
      const { event, data } = req.body;
      console.log(`[Webhook] Received SMS event: ${event}`, data);

      // Log SMS delivery status
      if (event === 'sms.delivered') {
        console.log(`[Webhook] SMS delivered to ${data.phone_number}`);
      } else if (event === 'sms.failed') {
        console.error(`[Webhook] SMS failed to ${data.phone_number}: ${data.reason}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] SMS webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
};

export default webhookController;
