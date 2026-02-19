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
import Job from './models/Job.js';
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

const HOSPITAL_COMPANION_MOCK_NAMES = [
  'นลินี',
  'อาทิตยา',
  'สุภาภรณ์',
  'จิราภา',
  'ณัฐกานต์',
  'ขวัญชนก',
  'พิชญ์สินี',
  'ชนิศา',
  'สุชานันท์',
  'อมรรัตน์',
];

const DEV_HOSPITAL_COMPANION_MOCK_CAREGIVERS = HOSPITAL_COMPANION_MOCK_NAMES.map((name, index) => {
  const sequence = index + 1;
  const hasMedicationSupport = index % 3 === 0;
  const baseScore = 72 + (index * 2);

  return {
    email: `caregiver.hospital${sequence}@careconnect.local`,
    display_name: `mock ${name} ผู้ช่วยพาไปโรงพยาบาล`,
    bio: 'ถนัดพาผู้สูงอายุไปโรงพยาบาล ช่วยลงทะเบียน นัดหมาย และประสานการเดินทางไป-กลับ',
    experience_years: 2 + (index % 4),
    certifications: hasMedicationSupport
      ? ['basic_first_aid', 'medication_management']
      : ['basic_first_aid', 'safe_transfer'],
    specializations: ['companionship', 'medical_monitoring', 'hospital_companion'],
    available_from: index % 2 === 0 ? '06:30' : '07:30',
    available_to: index % 2 === 0 ? '17:30' : '19:00',
    available_days: [1, 2, 3, 4, 5, 6],
    trust_level: hasMedicationSupport ? 'L2' : 'L1',
    trust_score: baseScore,
    completed_jobs_count: 12 + (index * 3),
  };
});

DEV_MOCK_CAREGIVERS.push(...DEV_HOSPITAL_COMPANION_MOCK_CAREGIVERS);

const DEV_MOCK_HIRERS = [
  { email: 'hirer.mock.hospital1@careconnect.local', display_name: 'mock ญาติคุณพิม' },
  { email: 'hirer.mock.hospital2@careconnect.local', display_name: 'mock ครอบครัวคุณวินัย' },
  { email: 'hirer.mock.hospital3@careconnect.local', display_name: 'mock ลูกสาวคุณดาวเรือง' },
  { email: 'hirer.mock.hospital4@careconnect.local', display_name: 'mock ทีมดูแลผู้สูงวัย' },
];

const HOSPITAL_ESCORT_JOB_LOCATIONS = [
  { hospital: 'รพ.ศิริราช', address_line1: 'ท่าพระจันทร์', district: 'บางกอกน้อย', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.จุฬาลงกรณ์', address_line1: 'สามย่าน', district: 'ปทุมวัน', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.รามาธิบดี', address_line1: 'ราชเทวี', district: 'ราชเทวี', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.พระมงกุฎ', address_line1: 'อนุสาวรีย์ชัย', district: 'ราชเทวี', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.กรุงเทพ', address_line1: 'เพชรบุรีตัดใหม่', district: 'ห้วยขวาง', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.เปาโลสมุทรปราการ', address_line1: 'ปากน้ำ', district: 'เมืองสมุทรปราการ', province: 'สมุทรปราการ' },
  { hospital: 'รพ.ศรีนครินทร์', address_line1: 'ศรีนครินทร์', district: 'บางพลี', province: 'สมุทรปราการ' },
  { hospital: 'รพ.บางปะกอก 9', address_line1: 'สุขสวัสดิ์', district: 'ราษฎร์บูรณะ', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.เกษมราษฎร์บางแค', address_line1: 'เพชรเกษม', district: 'บางแค', province: 'กรุงเทพมหานคร' },
  { hospital: 'รพ.พญาไท 2', address_line1: 'พหลโยธิน', district: 'พญาไท', province: 'กรุงเทพมหานคร' },
];

const DEV_MOCK_ESCORT_JOB_TEMPLATES = HOSPITAL_ESCORT_JOB_LOCATIONS.map((location, index) => {
  const shouldIncludeTransport = index % 2 === 0;
  const shouldIncludeMedicationPickup = index % 3 === 0;
  const jobTasksFlags = ['hospital_companion', 'hospital_registration_support'];

  if (shouldIncludeTransport) {
    jobTasksFlags.push('hospital_transport_coordination');
  }
  if (shouldIncludeMedicationPickup) {
    jobTasksFlags.push('medication_pickup');
  }

  return {
    title: `mock งานพาไป${location.hospital} #${index + 1}`,
    description: shouldIncludeMedicationPickup
      ? `ช่วยพาผู้รับการดูแลไป ${location.hospital} ลงทะเบียน พบแพทย์ และรับยากลับบ้าน`
      : `ช่วยพาผู้รับการดูแลไป ${location.hospital} และประสานงานหน้างานจนเสร็จสิ้น`,
    address_line1: location.address_line1,
    district: location.district,
    province: location.province,
    hourly_rate: 320 + ((index % 4) * 20),
    total_hours: shouldIncludeTransport ? 6 : 4,
    is_urgent: index % 4 === 0,
    risk_level: shouldIncludeMedicationPickup ? 'high_risk' : 'low_risk',
    min_trust_level: shouldIncludeMedicationPickup ? 'L2' : 'L1',
    job_tasks_flags: jobTasksFlags,
    required_skills_flags: shouldIncludeMedicationPickup
      ? ['basic_first_aid', 'medication_management']
      : ['basic_first_aid'],
    equipment_available_flags: shouldIncludeTransport ? ['wheelchair'] : [],
    precautions_flags: shouldIncludeMedicationPickup
      ? ['fall_risk', 'allergy_precaution']
      : ['fall_risk'],
  };
});

async function ensureReviewsAndFavoritesTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS caregiver_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL,
      job_post_id UUID NOT NULL,
      reviewer_id UUID NOT NULL,
      caregiver_id UUID NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(job_id, reviewer_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_caregiver_reviews_caregiver ON caregiver_reviews(caregiver_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_caregiver_reviews_reviewer ON caregiver_reviews(reviewer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_caregiver_reviews_job ON caregiver_reviews(job_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS caregiver_favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hirer_id UUID NOT NULL,
      caregiver_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(hirer_id, caregiver_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_caregiver_favorites_hirer ON caregiver_favorites(hirer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_caregiver_favorites_caregiver ON caregiver_favorites(caregiver_id)`);
}

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

function buildScheduleWindow(startAfterHours, durationHours) {
  const now = new Date();
  const start = new Date(now.getTime() + (startAfterHours * 60 * 60 * 1000));
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + (durationHours * 60 * 60 * 1000));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function ensureMockHirers() {
  const isDev = process.env.NODE_ENV !== 'production';
  const enabled = process.env.SEED_MOCK_JOBS !== 'false';
  if (!isDev || !enabled) return new Map();

  const mockPasswordHash = await bcrypt.hash(process.env.MOCK_HIRER_PASSWORD || 'DemoHirer123!', 10);
  const hirerIdsByEmail = new Map();

  for (const hirer of DEV_MOCK_HIRERS) {
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
         'hirer',
         'active',
         TRUE,
         'L1',
         70,
         0,
         NOW(),
         NOW()
       )
       ON CONFLICT (email) DO UPDATE
       SET role = 'hirer',
           status = 'active',
           account_type = 'guest',
           is_email_verified = TRUE,
           trust_level = EXCLUDED.trust_level,
           trust_score = GREATEST(users.trust_score, EXCLUDED.trust_score),
           updated_at = NOW()
       RETURNING id`,
      [hirer.email, mockPasswordHash],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) continue;

    hirerIdsByEmail.set(hirer.email, userId);

    await query(
      `INSERT INTO hirer_profiles (
         user_id,
         display_name,
         updated_at
       )
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           updated_at = NOW()`,
      [userId, hirer.display_name],
    );
  }

  return hirerIdsByEmail;
}

async function ensureMockEscortJobs(hirerIdsByEmail) {
  const isDev = process.env.NODE_ENV !== 'production';
  const enabled = process.env.SEED_MOCK_JOBS !== 'false';
  if (!isDev || !enabled) return;
  if (!hirerIdsByEmail || hirerIdsByEmail.size === 0) return;

  for (let index = 0; index < DEV_MOCK_ESCORT_JOB_TEMPLATES.length; index += 1) {
    const template = DEV_MOCK_ESCORT_JOB_TEMPLATES[index];
    const hirerSeed = DEV_MOCK_HIRERS[index % DEV_MOCK_HIRERS.length];
    const hirerId = hirerIdsByEmail.get(hirerSeed.email);
    if (!hirerId) continue;

    const existingResult = await query(
      `SELECT id, status
       FROM job_posts
       WHERE hirer_id = $1
         AND title = $2
       LIMIT 1`,
      [hirerId, template.title],
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.status !== 'posted') {
        await query(
          `UPDATE job_posts
           SET status = 'posted',
               posted_at = COALESCE(posted_at, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
          [existing.id],
        );
      }
      continue;
    }

    const schedule = buildScheduleWindow(8 + (index * 4), template.total_hours);

    const jobPost = await Job.createJobPost({
      hirer_id: hirerId,
      title: template.title,
      description: template.description,
      job_type: 'companionship',
      risk_level: template.risk_level,
      scheduled_start_at: schedule.startIso,
      scheduled_end_at: schedule.endIso,
      address_line1: template.address_line1,
      district: template.district,
      province: template.province,
      hourly_rate: template.hourly_rate,
      total_hours: template.total_hours,
      min_trust_level: template.min_trust_level,
      required_certifications: [],
      is_urgent: template.is_urgent,
      job_tasks_flags: template.job_tasks_flags,
      required_skills_flags: template.required_skills_flags,
      equipment_available_flags: template.equipment_available_flags,
      precautions_flags: template.precautions_flags,
      patient_profile_id: null,
    });

    if (jobPost?.id) {
      await query(
        `UPDATE job_posts
         SET status = 'posted',
             posted_at = COALESCE(posted_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [jobPost.id],
      );
    }
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
    .then(async () => {
      await ensureReviewsAndFavoritesTables();
      await ensureMockCaregivers();
      const hirerIdsByEmail = await ensureMockHirers();
      await ensureMockEscortJobs(hirerIdsByEmail);
    })
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
