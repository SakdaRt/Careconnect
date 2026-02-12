import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Joi from 'joi';
import { testConnection, closePool } from './utils/db.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import otpRoutes from './routes/otpRoutes.js';
import careRecipientRoutes from './routes/careRecipientRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import { initChatSocket } from './sockets/chatSocket.js';

// Load environment variables
dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535),
  CORS_ORIGIN: Joi.string().allow(''),
  DATABASE_HOST: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  DATABASE_PORT: Joi.number().integer().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  DATABASE_NAME: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  DATABASE_USER: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  DATABASE_PASSWORD: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  JWT_SECRET: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  JWT_EXPIRES_IN: Joi.string(),
  JWT_REFRESH_EXPIRES_IN: Joi.string(),
  WEBHOOK_SECRET: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  EMAIL_PROVIDER: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  EMAIL_FROM: Joi.string(),
  PUSH_PROVIDER: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  TZ: Joi.string(),
  MOCK_PROVIDER_URL: Joi.string(),
  MOCK_PROVIDER_BASE_URL: Joi.string(),
  PAYMENT_PROVIDER: Joi.string(),
  SMS_PROVIDER: Joi.string(),
  KYC_PROVIDER: Joi.string(),
  BANK_TRANSFER_PROVIDER: Joi.string(),
  UPLOAD_DIR: Joi.string(),
  MAX_FILE_SIZE_MB: Joi.number(),
  WEBHOOK_BASE_URL: Joi.string(),
}).unknown(true);

const { error: envError } = envSchema.validate(process.env, { abortEarly: false });
if (envError) {
  const details = envError.details.map((detail) => detail.message).join(', ');
  console.error(`[Backend] Environment validation failed: ${details}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Basic routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'careconnect-backend',
    version: '1.0.0',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Careconnect Backend API',
    version: '1.0.0',
    docs: '/api/docs',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      jobs: '/api/jobs',
      chat: '/api/chat',
      wallet: '/api/wallet',
      webhooks: '/api/webhooks',
      admin: '/api/admin',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/care-recipients', careRecipientRoutes);
app.use('/api/disputes', disputeRoutes);

// Initialize Socket.IO chat handlers
initChatSocket(io);

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Test database connection before starting server
testConnection().then((connected) => {
  if (!connected) {
    console.error('[Backend] Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Backend] Server running on port ${PORT}`);
    console.log(`[Backend] Environment: ${process.env.NODE_ENV}`);
    console.log(`[Backend] Health check: http://localhost:${PORT}/health`);
    console.log(`[Backend] Auth endpoints: http://localhost:${PORT}/api/auth`);
    console.log(`[Backend] Job endpoints: http://localhost:${PORT}/api/jobs`);
    console.log(`[Backend] Chat endpoints: http://localhost:${PORT}/api/chat`);
    console.log(`[Backend] Wallet endpoints: http://localhost:${PORT}/api/wallet`);
    console.log(`[Backend] Webhook endpoints: http://localhost:${PORT}/api/webhooks`);
  });
}).catch((error) => {
  console.error('[Backend] Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Backend] SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    console.log('[Backend] HTTP server closed');
    await closePool();
    console.log('[Backend] Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n[Backend] SIGINT received, shutting down gracefully...');
  server.close(async () => {
    console.log('[Backend] HTTP server closed');
    await closePool();
    console.log('[Backend] Database pool closed');
    process.exit(0);
  });
});

export { app, io };
