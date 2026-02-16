import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const payments = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Basic routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'careconnect-mock-provider',
    version: '1.0.0',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Careconnect Mock Provider Server',
    version: '1.0.0',
    providers: {
      payment: '/payment',
      sms: '/sms',
      kyc: '/kyc',
      withdrawal: '/withdrawal',
    },
  });
});

// Mock Payment Gateway endpoints
app.post('/payment/charge', (req, res) => {
  const { amount, currency, reference_id } = req.body;
  res.json({
    success: true,
    transaction_id: `mock_txn_${Date.now()}`,
    amount,
    currency,
    reference_id,
    status: 'success',
  });
});

app.post('/payment/initiate', (req, res) => {
  const { reference_id, amount, currency = 'THB', payment_method, callback_url } = req.body;
  if (!reference_id || !amount) {
    res.status(400).json({ success: false, error: 'reference_id and amount are required' });
    return;
  }

  payments.set(reference_id, {
    reference_id,
    amount: Number(amount),
    currency,
    payment_method: payment_method || 'dynamic_qr',
    callback_url: callback_url || process.env.MOCK_PAYMENT_CALLBACK_URL || 'http://localhost:3000/api/webhooks/payment',
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  const PORT = process.env.PORT || 4000;
  res.json({
    reference_id,
    payment_url: `http://localhost:${PORT}/payment/mock/${reference_id}`,
    qr_code: `mock_qr_${reference_id}`,
  });

  // Auto-success: automatically send webhook callback after delay
  const autoSuccess = process.env.MOCK_PAYMENT_AUTO_SUCCESS === 'true';
  if (autoSuccess) {
    const delay = Number(process.env.MOCK_PAYMENT_SUCCESS_DELAY_MS) || 3000;
    const storedPayment = payments.get(reference_id);
    setTimeout(async () => {
      // Only auto-complete if still pending (user may have already completed/failed it manually)
      if (!storedPayment || storedPayment.status !== 'pending') return;

      storedPayment.status = 'success';
      storedPayment.updated_at = new Date().toISOString();
      payments.set(reference_id, storedPayment);

      const payload = {
        event: 'payment.success',
        data: {
          reference_id,
          transaction_id: `mock_txn_${Date.now()}`,
          amount: storedPayment.amount,
        },
      };

      try {
        await fetch(storedPayment.callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log(`[Mock Payment] Auto-success webhook sent for ${reference_id}`);
      } catch (error) {
        console.error(`[Mock Payment] Auto-success webhook failed for ${reference_id}:`, error.message);
      }
    }, delay);
  }
});

app.get('/payment/mock/:referenceId', (req, res) => {
  const { referenceId } = req.params;
  const payment = payments.get(referenceId);
  const amount = payment?.amount ?? '-';
  const status = payment?.status ?? 'unknown';
  const currency = payment?.currency ?? 'THB';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mock Payment</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; background: #f6f7fb; }
      .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
      .row { display:flex; justify-content: space-between; gap: 12px; margin: 8px 0; }
      .btns { display:flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
      button { padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb; background: #111827; color: #fff; cursor:pointer; }
      button.secondary { background: #fff; color: #111827; }
      code { background:#f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Mock Payment</h2>
      <div class="row"><div>Reference</div><div><code>${referenceId}</code></div></div>
      <div class="row"><div>Amount</div><div><strong>${amount}</strong> ${currency}</div></div>
      <div class="row"><div>Status</div><div><strong>${status}</strong></div></div>
      <div class="btns">
        <form method="POST" action="/payment/mock/${referenceId}/complete">
          <input type="hidden" name="status" value="success" />
          <button type="submit">Pay Success (send webhook)</button>
        </form>
        <form method="POST" action="/payment/mock/${referenceId}/complete">
          <input type="hidden" name="status" value="failed" />
          <button type="submit" class="secondary">Pay Failed</button>
        </form>
        <form method="POST" action="/payment/mock/${referenceId}/complete">
          <input type="hidden" name="status" value="expired" />
          <button type="submit" class="secondary">Expire</button>
        </form>
      </div>
      <p style="margin-top:16px;color:#6b7280;font-size:12px;">This page simulates a provider payment screen and calls Careconnect webhook.</p>
    </div>
  </body>
</html>`);
});

app.post('/payment/mock/:referenceId/complete', async (req, res) => {
  const { referenceId } = req.params;
  const status = (req.body?.status || req.query?.status || 'success').toString();
  const payment = payments.get(referenceId);
  if (!payment) {
    res.status(404).json({ success: false, error: 'Payment reference not found' });
    return;
  }

  const nextStatus = status === 'failed' ? 'failed' : status === 'expired' ? 'expired' : 'success';
  payment.status = nextStatus;
  payment.updated_at = new Date().toISOString();
  payments.set(referenceId, payment);

  const event =
    nextStatus === 'success' ? 'payment.success' : nextStatus === 'expired' ? 'payment.expired' : 'payment.failed';

  const payload = {
    event,
    data: {
      reference_id: referenceId,
      transaction_id: `mock_txn_${Date.now()}`,
      amount: payment.amount,
      reason: nextStatus === 'failed' ? 'Mock payment failed' : undefined,
    },
  };

  try {
    await fetch(payment.callback_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[Mock Payment] Failed to call webhook:', error);
  }

  res.redirect(`/payment/mock/${referenceId}`);
});

// Mock SMS OTP endpoints
app.post('/sms/send-otp', (req, res) => {
  const { phone_number } = req.body;
  res.json({
    success: true,
    otp_id: `mock_otp_${Date.now()}`,
    phone_number,
    expires_in: 300,
  });
});

app.post('/sms/verify-otp', (req, res) => {
  const { otp_id, code } = req.body;
  const isValid = code === (process.env.MOCK_SMS_OTP_CODE || '123456');
  res.json({
    success: isValid,
    verified: isValid,
    otp_id,
  });
});

// Mock Email OTP endpoints
app.post('/email/send-otp', (req, res) => {
  const { email } = req.body;
  console.log(`[Mock Email] Sending OTP to ${email}`);
  res.json({
    success: true,
    otp_id: `mock_email_otp_${Date.now()}`,
    email,
    expires_in: 300,
    message: 'OTP sent to email (mock)',
  });
});

app.post('/email/verify-otp', (req, res) => {
  const { otp_id, code } = req.body;
  const isValid = code === (process.env.MOCK_EMAIL_OTP_CODE || '123456');
  res.json({
    success: isValid,
    verified: isValid,
    otp_id,
  });
});

// Mock KYC endpoints
app.post('/kyc/submit', (req, res) => {
  const { user_id } = req.body;
  res.json({
    success: true,
    kyc_id: `mock_kyc_${Date.now()}`,
    user_id,
    status: 'pending',
  });
});

app.get('/kyc/:kyc_id/status', (req, res) => {
  const { kyc_id } = req.params;
  res.json({
    success: true,
    kyc_id,
    status: 'approved',
    verified_at: new Date().toISOString(),
  });
});

// Mock Bank Transfer/Withdrawal endpoints
app.post('/withdrawal/initiate', (req, res) => {
  const { amount } = req.body;
  res.json({
    success: true,
    withdrawal_id: `mock_wd_${Date.now()}`,
    amount,
    status: 'processing',
  });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
  });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Mock Provider] Server running on port ${PORT}`);
  console.log(`[Mock Provider] Environment: ${process.env.NODE_ENV}`);
  console.log(`[Mock Provider] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Mock Provider] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

export default app;
