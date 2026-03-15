/**
 * Test setup for integration tests
 */

import { beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../src/utils/db.js';

if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

// SAFEGUARD: Prevent test cleanup from running against production database
const dbName = process.env.DATABASE_NAME || 'careconnect';
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === 'production') {
  throw new Error('FATAL: Test setup must not run in production environment. Aborting.');
}
if (dbName.includes('prod')) {
  throw new Error(`FATAL: Test setup detected production-like database name "${dbName}". Aborting.`);
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret';
}

if (!process.env.RATE_LIMIT_AUTH_MAX) {
  process.env.RATE_LIMIT_AUTH_MAX = '1000';
}

if (!process.env.RATE_LIMIT_AUTH_WINDOW_MS) {
  process.env.RATE_LIMIT_AUTH_WINDOW_MS = '60000';
}

if (!process.env.STRIPE_SECRET_KEY) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
}

// Setup test database
beforeAll(async () => {
  try {
    execSync('npm run migrate:bootstrap', { cwd: process.cwd(), stdio: 'ignore' });
  } catch (error) {
    // Bootstrap may have already run, continue silently
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS early_checkout_requests (
    id UUID PRIMARY KEY, job_id UUID NOT NULL, caregiver_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', evidence_note TEXT, reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS hirer_id UUID`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS caregiver_id UUID`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS created_by_user_id UUID`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS created_by_role TEXT`);
  try { await pool.query(`ALTER TABLE disputes ALTER COLUMN opened_by_user_id DROP NOT NULL`); } catch { /* already nullable */ }
  await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, destination VARCHAR(255) NOT NULL, code_hash VARCHAR(255) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE, attempts INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE, push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, target_user_id UUID, related_job_post_id UUID,
    subject VARCHAR(200) NOT NULL, description TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_admin_id UUID, admin_note TEXT, resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS complaint_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), complaint_id UUID NOT NULL,
    file_path VARCHAR(500) NOT NULL, file_name VARCHAR(255) NOT NULL,
    file_size INTEGER, mime_type VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // Ensure columns that may be missing from old Docker volume schemas
  const addCol = async (table, col, def) => {
    try { await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`); } catch { /* exists */ }
  };
  await addCol('job_posts', 'patient_profile_id', 'UUID');
  await addCol('job_posts', 'preferred_caregiver_id', 'UUID');
  await addCol('users', 'account_type', "VARCHAR(10) NOT NULL DEFAULT 'guest'");
  await addCol('users', 'trust_score', 'INT NOT NULL DEFAULT 0');
  await addCol('users', 'completed_jobs_count', 'INT NOT NULL DEFAULT 0');
  await addCol('users', 'first_job_waiver_used', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'ban_login', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'ban_job_create', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'ban_job_accept', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'ban_withdraw', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'admin_note', 'TEXT');
  await addCol('users', 'is_email_verified', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'is_phone_verified', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('users', 'avatar', 'TEXT');
  await addCol('hirer_profiles', 'full_name', 'VARCHAR(255)');
  await addCol('caregiver_profiles', 'full_name', 'VARCHAR(255)');
  await addCol('caregiver_profiles', 'is_public_profile', 'BOOLEAN NOT NULL DEFAULT TRUE');
});

// Clean up before each test file — preserve mock/seed accounts + their child data
beforeAll(async () => {
  // Tables safe to truncate (no seed data)
  const safeTruncate = [
    'complaint_attachments', 'complaints', 'otp_codes', 'notification_preferences',
    'withdrawal_requests', 'topup_intents', 'ledger_transactions',
    'dispute_messages', 'dispute_events', 'disputes',
    'chat_messages', 'chat_threads', 'early_checkout_requests',
    'job_gps_events', 'job_photo_evidence', 'job_patient_sensitive_data',
    'job_patient_requirements', 'job_assignments',
    'notifications',
    'user_policy_acceptances', 'auth_sessions',
    'trust_score_history', 'audit_events',
  ];

  for (const table of safeTruncate) {
    try {
      const tableName = table.replace(/[^a-zA-Z0-9_]/g, '');
      if (tableName !== table) throw new Error(`Invalid table name: ${table}`);
      await pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
    } catch { /* table might not exist */ }
  }

  // Tables with seed data — delete only test-generated rows (preserve mock @careconnect.local)
  const seedUserIds = `(SELECT id FROM users WHERE email LIKE '%@careconnect.local' OR role = 'admin')`;
  const deleteQueries = [
    `DELETE FROM jobs WHERE hirer_id NOT IN ${seedUserIds}`,
    `DELETE FROM job_posts WHERE hirer_id NOT IN ${seedUserIds}`,
    `DELETE FROM wallets WHERE user_id NOT IN ${seedUserIds}`,
    `DELETE FROM patient_profiles WHERE hirer_id NOT IN ${seedUserIds}`,
    `DELETE FROM bank_accounts WHERE user_id NOT IN ${seedUserIds}`,
    `DELETE FROM caregiver_reviews WHERE reviewer_id NOT IN ${seedUserIds}`,
    `DELETE FROM caregiver_favorites WHERE hirer_id NOT IN ${seedUserIds}`,
    `DELETE FROM caregiver_documents WHERE user_id NOT IN ${seedUserIds}`,
    `DELETE FROM caregiver_profiles WHERE user_id NOT IN ${seedUserIds}`,
    `DELETE FROM hirer_profiles WHERE user_id NOT IN ${seedUserIds}`,
    `DELETE FROM user_kyc_info WHERE user_id NOT IN ${seedUserIds}`,
    `DELETE FROM users WHERE email NOT LIKE '%@careconnect.local' AND NOT (role = 'admin' AND email LIKE '%@careconnect.local')`,
  ];

  for (const sql of deleteQueries) {
    try { await pool.query(sql); } catch { /* ignore */ }
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    await pool.end();
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Export test utilities
export const createTestUser = async (userData = {}) => {
  const suffix = randomBytes(4).toString('hex');

  const defaultUser = {
    email: `test-${suffix}@example.com`,
    phone_number: null,
    password: 'testPassword123!',
    role: 'caregiver',
    account_type: 'guest',
    trust_level: 'L2',
    status: 'active',
    ...userData
  };

  if (!defaultUser.account_type) {
    defaultUser.account_type = defaultUser.phone_number ? 'member' : 'guest';
  }

  if (defaultUser.account_type === 'guest' && !defaultUser.email) {
    defaultUser.email = `test-${suffix}@example.com`;
  }

  if (defaultUser.account_type === 'member' && !defaultUser.phone_number) {
    defaultUser.phone_number = `+668${suffix.slice(0, 8)}`;
  }

  if (defaultUser.account_type === 'member') {
    defaultUser.email = defaultUser.email || null;
  }

  if (!defaultUser.email && !defaultUser.phone_number) {
    defaultUser.email = `test-${suffix}@example.com`;
    defaultUser.account_type = 'guest';
  }

  // Validate email format if provided
  if (defaultUser.email && !defaultUser.email.includes('@')) {
    throw new Error('Invalid email format');
  }

  const hashedPassword = await bcrypt.hash(defaultUser.password, 10);
  const isEmailVerified = !!defaultUser.email;
  const isPhoneVerified = !!defaultUser.phone_number;

  const result = await pool.query(
    `INSERT INTO users (
       id,
       email,
       phone_number,
       password_hash,
       account_type,
       role,
       status,
       trust_level,
       is_email_verified,
       is_phone_verified,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
     )
     RETURNING id, email, phone_number, account_type, role, status, trust_level`,
    [
      uuidv4(),
      defaultUser.email,
      defaultUser.phone_number,
      hashedPassword,
      defaultUser.account_type,
      defaultUser.role,
      defaultUser.status,
      defaultUser.trust_level,
      isEmailVerified,
      isPhoneVerified
    ]
  );

  const user = result.rows[0];

  if (user.role === 'hirer') {
    await pool.query(
      `INSERT INTO hirer_profiles (user_id, display_name, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, defaultUser.display_name || `Hirer ${suffix.slice(0, 4)}`]
    );
  }

  if (user.role === 'caregiver') {
    await pool.query(
      `INSERT INTO caregiver_profiles (user_id, display_name, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, defaultUser.display_name || `Caregiver ${suffix.slice(0, 4)}`]
    );
  }

  return {
    ...user,
    password: defaultUser.password // Return plain password for login tests
  };
};

export const createTestWallet = async (userId, amount = 1000) => {
  const userResult = await pool.query(
    `SELECT role FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const walletType = userResult.rows[0].role === 'hirer' ? 'hirer' : 'caregiver';

  const existing = await pool.query(
    `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = $2 LIMIT 1`,
    [userId, walletType]
  );

  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `UPDATE wallets
       SET available_balance = $1,
           held_balance = 0,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [Math.round(amount), existing.rows[0].id]
    );
    return updated.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO wallets (
       id,
       user_id,
       wallet_type,
       available_balance,
       held_balance,
       currency,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, 0, 'THB', NOW(), NOW()
     )
     RETURNING *`,
    [uuidv4(), userId, walletType, Math.round(amount)]
  );

  return result.rows[0];
};

export const createTestPatientProfile = async (hirerId, data = {}) => {
  const defaultProfile = {
    patient_display_name: 'Test Patient',
    address_line1: '123 Test Road',
    district: 'Test District',
    province: 'Bangkok',
    postal_code: '10110',
    birth_year: 1980,
    gender: 'other',
    mobility_level: 'needs_assistance',
    communication_style: 'verbal',
    general_health_summary: 'General care',
    ...data
  };

  const result = await pool.query(
    `INSERT INTO patient_profiles (
       id,
       hirer_id,
       patient_display_name,
       address_line1,
       district,
       province,
       postal_code,
       birth_year,
       gender,
       mobility_level,
       communication_style,
       general_health_summary,
       is_active,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW()
     )
     RETURNING *`,
    [
      uuidv4(),
      hirerId,
      defaultProfile.patient_display_name,
      defaultProfile.address_line1,
      defaultProfile.district,
      defaultProfile.province,
      defaultProfile.postal_code,
      defaultProfile.birth_year,
      defaultProfile.gender || 'other',
      defaultProfile.mobility_level,
      defaultProfile.communication_style,
      defaultProfile.general_health_summary
    ]
  );

  return result.rows[0];
};

export const createTestJob = async (hirerId, patientProfileId, data = {}) => {
  const defaultJob = {
    title: 'Test Job',
    description: 'Test job description',
    job_type: 'companionship',
    risk_level: 'low_risk',
    hourly_rate: 500,
    total_hours: 2,
    address_line1: '123 Test St',
    district: 'Test District',
    province: 'Bangkok',
    postal_code: '10110',
    min_trust_level: 'L1',
    status: 'posted',
    caregiver_id: null,
    ...data
  };

  const startAt = defaultJob.scheduled_start_at || new Date(Date.now() + (2 * 60 * 60 * 1000));
  const endAt = defaultJob.scheduled_end_at || new Date(Date.now() + (4 * 60 * 60 * 1000));
  const totalAmount = Math.round(Number(defaultJob.hourly_rate) * Number(defaultJob.total_hours));
  const platformFeePercent = 10;
  const platformFeeAmount = Math.round(totalAmount * (platformFeePercent / 100));
  const jobPostId = uuidv4();

  const jobPostResult = await pool.query(
    `INSERT INTO job_posts (
       id,
       hirer_id,
       title,
       description,
       job_type,
       risk_level,
       scheduled_start_at,
       scheduled_end_at,
       address_line1,
       district,
       province,
       postal_code,
       hourly_rate,
       total_hours,
       total_amount,
       platform_fee_percent,
       platform_fee_amount,
       min_trust_level,
       status,
       patient_profile_id,
       created_at,
       updated_at,
       posted_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18,
       $19, $20, NOW(), NOW(), CASE WHEN $21 = 'posted' THEN NOW() ELSE NULL END
     ) RETURNING *`,
    [
      jobPostId,
      hirerId,
      defaultJob.title,
      defaultJob.description,
      defaultJob.job_type,
      defaultJob.risk_level,
      startAt,
      endAt,
      defaultJob.address_line1,
      defaultJob.district,
      defaultJob.province,
      defaultJob.postal_code,
      Math.round(defaultJob.hourly_rate),
      Number(defaultJob.total_hours),
      totalAmount,
      platformFeePercent,
      platformFeeAmount,
      defaultJob.min_trust_level,
      defaultJob.status,
      patientProfileId || null,
      defaultJob.status
    ]
  );

  let jobId = null;
  let caregiverId = defaultJob.caregiver_id;
  const needsAssignment = ['assigned', 'in_progress', 'completed', 'cancelled', 'expired'].includes(defaultJob.status);

  if (needsAssignment) {
    if (!caregiverId) {
      const caregiver = await createTestUser({
        role: 'caregiver',
        email: `caregiver-${randomBytes(5).toString('hex')}@example.com`,
        trust_level: 'L2'
      });
      caregiverId = caregiver.id;
    }

    jobId = uuidv4();
    const assignedAt = new Date();
    const startedAt = ['in_progress', 'completed', 'cancelled', 'expired'].includes(defaultJob.status)
      ? new Date(Date.now() - (60 * 60 * 1000))
      : null;
    const completedAt = defaultJob.status === 'completed'
      ? new Date(Date.now() - (30 * 60 * 1000))
      : null;
    const cancelledAt = defaultJob.status === 'cancelled' ? new Date() : null;
    const expiredAt = defaultJob.status === 'expired' ? new Date() : null;

    await pool.query(
      `INSERT INTO jobs (
         id,
         job_post_id,
         hirer_id,
         status,
         assigned_at,
         started_at,
         completed_at,
         cancelled_at,
         expired_at,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
       )`,
      [
        jobId,
        jobPostId,
        hirerId,
        defaultJob.status,
        assignedAt,
        startedAt,
        completedAt,
        cancelledAt,
        expiredAt
      ]
    );

    await pool.query(
      `INSERT INTO job_assignments (
         id,
         job_id,
         job_post_id,
         caregiver_id,
         status,
         assigned_at,
         start_confirmed_at,
         end_confirmed_at,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, 'active', $5, $6, $7, NOW(), NOW()
       )`,
      [
        uuidv4(),
        jobId,
        jobPostId,
        caregiverId,
        assignedAt,
        startedAt,
        completedAt
      ]
    );

    await pool.query(
      `UPDATE job_posts
       SET status = CASE
             WHEN $2 = 'assigned' THEN 'assigned'::job_status
             WHEN $2 = 'in_progress' THEN 'assigned'::job_status
             ELSE 'posted'::job_status
           END,
           posted_at = COALESCE(posted_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [jobPostId, defaultJob.status]
    );
  }

  return {
    ...jobPostResult.rows[0],
    id: jobPostId,
    job_id: jobId,
    caregiver_id: caregiverId,
  };
};

export const generateTestToken = async (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h', issuer: 'careconnect', subject: userId }
  );
};

export const generateRefreshToken = async (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '7d', issuer: 'careconnect', subject: userId }
  );
};
