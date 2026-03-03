import express from 'express';
import webhookController from '../controllers/webhookController.js';
import { webhookLimiter } from '../utils/rateLimiter.js';
import { transaction } from '../utils/db.js';
import '../config/loadEnv.js';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

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
router.post('/payment', express.json(), webhookLimiter, webhookController.handlePaymentWebhook);

/**
 * KYC provider webhook
 * POST /api/webhooks/kyc
 * Headers: x-webhook-signature (optional in dev)
 * Body: { event, data }
 */
router.post('/kyc', express.json(), webhookLimiter, webhookController.handleKycWebhook);

/**
 * SMS provider webhook
 * POST /api/webhooks/sms
 * Headers: x-webhook-signature (optional in dev)
 * Body: { event, data }
 */
router.post('/sms', express.json(), webhookController.handleSmsWebhook);

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
    case 'checkout.session.completed': {
      const checkoutSession = event.data.object;
      await handleCheckoutSessionCompleted(checkoutSession);
      break;
    }

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      await handleSuccessfulPaymentIntent(paymentIntent);
      break;
    }

    case 'payment_intent.payment_failed': {
      const failedPayment = event.data.object;
      console.log(`Payment failed: ${failedPayment.last_payment_error ? failedPayment.last_payment_error.message : 'Unknown error'}`);
      await handleFailedPaymentIntent(failedPayment);
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

// Handle successful payment - update wallet balance
async function markTopupSucceeded(topupId, providerTransactionId) {
  try {
    await transaction(async (client) => {
      const topupResult = await client.query(
        `SELECT ti.*, w.id as wallet_id FROM topup_intents ti
         JOIN users u ON u.id = ti.user_id
         JOIN wallets w ON w.user_id = ti.user_id
          AND w.wallet_type = CASE WHEN u.role = 'hirer' THEN 'hirer' ELSE 'caregiver' END
         WHERE ti.id = $1 FOR UPDATE`,
        [topupId]
      );

      if (topupResult.rows.length === 0) {
        console.log(`Top-up not found for id ${topupId}`);
        return;
      }

      const topup = topupResult.rows[0];
      if (topup.status !== 'pending') {
        console.log(`Top-up ${topupId} already processed: ${topup.status}`);
        return;
      }

      await client.query(
        `UPDATE topup_intents
         SET status = 'succeeded', succeeded_at = NOW(), provider_transaction_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [topupId, providerTransactionId || null]
      );

      await client.query(
        `UPDATE wallets
         SET available_balance = available_balance + $1, updated_at = NOW()
         WHERE id = $2`,
        [topup.amount, topup.wallet_id]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, to_wallet_id, amount, currency, type, reference_type, reference_id, provider_name, provider_transaction_id, description, created_at)
         VALUES ($1, $2, $3, 'THB', 'credit', 'topup', $4, 'stripe', $5, 'Wallet top-up', NOW())`,
        [uuidv4(), topup.wallet_id, topup.amount, topupId, providerTransactionId || null]
      );

      console.log(`Successfully updated wallet for topup ${topupId} with amount ${topup.amount}`);
    });
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

async function handleCheckoutSessionCompleted(session) {
  const topupId = session?.metadata?.topup_id;
  if (!topupId) {
    console.log('checkout.session.completed missing topup_id metadata');
    return;
  }

  await markTopupSucceeded(topupId, session.payment_intent ? String(session.payment_intent) : session.id);
}

async function handleSuccessfulPaymentIntent(paymentIntent) {
  const topupId = paymentIntent?.metadata?.topup_id;
  if (!topupId) {
    console.log(`No topup_id metadata found for PaymentIntent ${paymentIntent.id}`);
    return;
  }

  await markTopupSucceeded(topupId, paymentIntent.id);
}

async function handleFailedPaymentIntent(paymentIntent) {
  try {
    const topupId = paymentIntent?.metadata?.topup_id;
    if (!topupId) {
      console.log(`No topup_id metadata found for failed PaymentIntent ${paymentIntent.id}`);
      return;
    }

    await transaction(async (client) => {
      const result = await client.query(
        `UPDATE topup_intents
         SET status = 'failed', failed_at = NOW(), error_message = $2, provider_transaction_id = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [
          topupId,
          paymentIntent.last_payment_error ? paymentIntent.last_payment_error.message : 'Payment failed',
          paymentIntent.id,
        ]
      );

      if (result.rowCount === 0) {
        console.log(`No pending top-up found for topup_id ${topupId}`);
        return;
      }

      console.log(`Marked top-up ${topupId} as failed for PaymentIntent ${paymentIntent.id}`);
    });
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

export default router;
