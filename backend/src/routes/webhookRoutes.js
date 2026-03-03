import express from 'express';
import webhookController from '../controllers/webhookController.js';
import { webhookLimiter } from '../utils/rateLimiter.js';
import { transaction } from '../utils/db.js';
import '../config/loadEnv.js';
import Stripe from 'stripe';

const router = express.Router();
const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

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

/**
 * Stripe webhook
 * POST /api/webhooks/stripe
 * Headers: stripe-signature
 * Body: Stripe event object
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      await handleSuccessfulPayment(paymentIntent);
      break;
    }

    case 'payment_intent.payment_failed': {
      const failedPayment = event.data.object;
      console.log(`Payment failed: ${failedPayment.last_payment_error ? failedPayment.last_payment_error.message : 'Unknown error'}`);
      await handleFailedPayment(failedPayment);
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

// Handle successful payment - update wallet balance
async function handleSuccessfulPayment(paymentIntent) {
  try {
    await transaction(async (client) => {
      const transactionResult = await client.query(
        `SELECT id, user_id, amount FROM wallet_transactions 
         WHERE stripe_payment_intent_id = $1 AND status = 'pending'`,
        [paymentIntent.id]
      );

      if (transactionResult.rows.length === 0) {
        console.log(`No pending transaction found for PaymentIntent ${paymentIntent.id}`);
        return;
      }

      const transaction = transactionResult.rows[0];

      await client.query(
        `UPDATE wallet_transactions 
         SET status = 'completed', stripe_charge_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [transaction.id, paymentIntent.charges.data[0] ? paymentIntent.charges.data[0].id : null]
      );

      await client.query(
        `UPDATE wallets 
         SET available_balance = available_balance + $1, updated_at = NOW()
         WHERE user_id = $2 AND wallet_type = 'hirer'`,
        [transaction.amount, transaction.user_id]
      );

      console.log(`Successfully updated wallet for user ${transaction.user_id} with amount ${transaction.amount}`);
    });
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Handle failed payment - update transaction status
async function handleFailedPayment(paymentIntent) {
  try {
    await transaction(async (client) => {
      const result = await client.query(
        `UPDATE wallet_transactions 
         SET status = 'failed', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1 AND status = 'pending'`,
        [paymentIntent.id]
      );

      if (result.rowCount === 0) {
        console.log(`No pending transaction found for PaymentIntent ${paymentIntent.id}`);
        return;
      }

      console.log(`Marked transaction as failed for PaymentIntent ${paymentIntent.id}`);
    });
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

export default router;
