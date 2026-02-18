import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import { testConnection, closePool, query } from './utils/db.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import otpRoutes from './routes/otpRoutes.js';
import careRecipientRoutes from './routes/careRecipientRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import caregiverDocumentRoutes from './routes/caregiverDocumentRoutes.js';
import caregiverSearchRoutes from './routes/caregiverSearchRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import { initChatSocket } from './sockets/chatSocket.js';
import { setSocketServer } from './sockets/realtimeHub.js';

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
  ADMIN_EMAIL: Joi.string().email({ tlds: { allow: false } }),
  ADMIN_PASSWORD: Joi.string(),
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

setSocketServer(io);

const DEV_MOCK_CAREGIVERS = [
  {
    email: 'caregiver.mock1@careconnect.local',
    display_name: 'mock พิมพ์ชนก ผู้ดูแล',
    bio: 'ดูแลผู้สูงอายุทั่วไป และช่วยกิจวัตรประจำวันอย่างอ่อนโยน',
    experience_years: 3,
    certifications: ['basic_first_aid', 'safe_transfer'],
    specializations: ['companionship', 'personal_care'],
    available_from: '08:00',
    available_to: '18:00',
    available_days: [1, 2, 3, 4, 5],
    trust_level: 'L2',
    trust_score: 82,
    completed_jobs_count: 18,
  },
  {
    email: 'caregiver.mock2@careconnect.local',
    display_name: 'mock กิตติพร ผู้ดูแล',
    bio: 'ถนัดดูแลผู้ป่วยสมองเสื่อม และเฝ้าระวังพฤติกรรมเสี่ยง',
    experience_years: 5,
    certifications: ['dementia_care', 'medication_management'],
    specializations: ['dementia_care', 'medical_monitoring'],
    available_from: '09:00',
    available_to: '20:00',
    available_days: [0, 1, 2, 3, 4, 5],
    trust_level: 'L3',
    trust_score: 91,
    completed_jobs_count: 44,
  },
  {
    email: 'caregiver.mock3@careconnect.local',
    display_name: 'mock วรัญญา ผู้ดูแล',
    bio: 'มีประสบการณ์ดูแลหลังผ่าตัดและติดตามสัญญาณชีพเบื้องต้น',
    experience_years: 4,
    certifications: ['post_surgery_care', 'vitals_monitoring'],
    specializations: ['post_surgery', 'medical_monitoring'],
    available_from: '07:00',
    available_to: '16:00',
    available_days: [1, 2, 3, 4, 5],
    trust_level: 'L2',
    trust_score: 85,
    completed_jobs_count: 27,
  },
  {
    email: 'caregiver.mock4@careconnect.local',
    display_name: 'mock ศิริพร ผู้ดูแล',
    bio: 'ช่วยพยุงเดิน ย้ายท่า และดูแลผู้ป่วยติดเตียงอย่างปลอดภัย',
    experience_years: 6,
    certifications: ['safe_transfer', 'catheter_care'],
    specializations: ['personal_care', 'medical_monitoring'],
    available_from: '10:00',
    available_to: '22:00',
    available_days: [0, 2, 3, 5, 6],
    trust_level: 'L2',
    trust_score: 79,
    completed_jobs_count: 36,
  },
  {
    email: 'caregiver.mock5@careconnect.local',
    display_name: 'mock ปวีณ์ ผู้ดูแล',
    bio: 'รับงานดูแลทั่วไปแบบยืดหยุ่น เหมาะกับงานช่วงสั้นและเร่งด่วน',
    experience_years: 2,
    certifications: ['basic_first_aid'],
    specializations: ['companionship', 'emergency'],
    available_from: '12:00',
    available_to: '23:00',
    available_days: [1, 3, 4, 6],
    trust_level: 'L1',
    trust_score: 68,
    completed_jobs_count: 9,
  },
];

async function ensureCaregiverPublicProfileColumn() {
  await query(`ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT TRUE`);
}

async function ensureMockCaregivers() {
  const isDev = process.env.NODE_ENV !== 'production';
  const enabled = process.env.SEED_MOCK_CAREGIVERS !== 'false';
  if (!isDev || !enabled) return;

  await ensureCaregiverPublicProfileColumn();

  const mockPasswordHash = await bcrypt.hash(process.env.MOCK_CAREGIVER_PASSWORD || 'DemoCare123!', 10);

  for (const caregiver of DEV_MOCK_CAREGIVERS) {
    const userResult = await query(
      `INSERT INTO users (
         id,
         email,
         password_hash,
         account_type,
         role,
         status,
         is_email_verified,
         trust_level,
         trust_score,
         completed_jobs_count,
         created_at,
         updated_at
       )
       VALUES (
         gen_random_uuid(),
         $1,
         $2,
         'guest',
         'caregiver',
         'active',
         TRUE,
         $3,
         $4,
         $5,
         NOW(),
         NOW()
       )
       ON CONFLICT (email) DO UPDATE
       SET role = 'caregiver',
           status = 'active',
           trust_level = EXCLUDED.trust_level,
           trust_score = EXCLUDED.trust_score,
           completed_jobs_count = GREATEST(users.completed_jobs_count, EXCLUDED.completed_jobs_count),
           updated_at = NOW()
       RETURNING id`,
      [
        caregiver.email,
        mockPasswordHash,
        caregiver.trust_level,
        caregiver.trust_score,
        caregiver.completed_jobs_count,
      ],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) continue;

    await query(
      `INSERT INTO caregiver_profiles (
         user_id,
         display_name,
         bio,
         experience_years,
         certifications,
         specializations,
         available_from,
         available_to,
         available_days,
         is_public_profile,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           bio = EXCLUDED.bio,
           experience_years = EXCLUDED.experience_years,
           certifications = EXCLUDED.certifications,
           specializations = EXCLUDED.specializations,
           available_from = EXCLUDED.available_from,
           available_to = EXCLUDED.available_to,
           available_days = EXCLUDED.available_days,
           is_public_profile = TRUE,
           updated_at = NOW()`,
      [
        userId,
        caregiver.display_name,
        caregiver.bio,
        caregiver.experience_years,
        caregiver.certifications,
        caregiver.specializations,
        caregiver.available_from,
        caregiver.available_to,
        caregiver.available_days,
      ],
    );
  }
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Prevent caching of API responses (important for Cloudflare tunnel / CDN)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

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
app.use('/api/kyc', kycRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/caregiver-documents', caregiverDocumentRoutes);
app.use('/api/caregivers', caregiverSearchRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api', reviewRoutes);

// Static file serving for uploads
const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Initialize Socket.IO chat handlers
initChatSocket(io);

// Error handling middleware
import { errorHandler, NotFoundError } from './utils/errors.js';

app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  const error = new NotFoundError('The requested resource was not found', {
    path: req.path,
    method: req.method
  });
  res.status(error.status).json(error.toJSON());
});

// Test database connection before starting server
testConnection().then((connected) => {
  if (!connected) {
    console.error('[Backend] Failed to connect to database. Exiting...');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const ensureAdmin = async () => {
    if (!adminEmail || !adminPassword) return;
    const existing = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length > 0) return;
    const hash = await bcrypt.hash(adminPassword, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, account_type, role, trust_level, status, is_email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'guest', 'admin', 'L3', 'active', true, NOW(), NOW())`,
      [adminEmail, hash]
    );
  };

  // Start server
  const PORT = process.env.PORT || 3000;
  ensureAdmin()
    .then(() => ensureMockCaregivers())
    .catch((error) => {
      console.error('[Backend] Bootstrap failed:', error);
    })
    .finally(() => {
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

// Export server for testing
export default server;

export { app, io };
