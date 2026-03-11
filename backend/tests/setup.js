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

  await pool.query(
    `CREATE TABLE IF NOT EXISTS early_checkout_requests (
       id UUID PRIMARY KEY,
       job_id UUID NOT NULL,
       caregiver_id UUID NOT NULL,
       status TEXT NOT NULL DEFAULT 'pending',
       evidence_note TEXT,
       reason TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );

  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS hirer_id UUID`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS caregiver_id UUID`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS created_by_user_id UUID`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS created_by_role TEXT`);
  await pool.query(`ALTER TABLE disputes ALTER COLUMN opened_by_user_id DROP NOT NULL`);
});

// Clean up before each test file
beforeAll(async () => {
  // Clean up test data but preserve schema
  const validTables = [
    'withdrawal_requests',
    'topup_intents',
    'ledger_transactions',
    'dispute_messages',
    'dispute_events',
    'disputes',
    'chat_messages',
    'chat_threads',
    'early_checkout_requests',
    'checkin_photos',
    'gps_logs',
    'job_patient_requirements',
    'job_assignments',
    'jobs',
    'job_posts',
    'wallets',
    'patient_profiles',
    'bank_accounts',
    'banks',
    'notifications',
    'caregiver_profiles',
    'hirer_profiles',
    'user_policy_acceptances',
    'user_kyc_info',
    'users'
  ];
  
  for (const table of validTables) {
    try {
      // Validate table name to prevent SQL injection
      const tableName = table.replace(/[^a-zA-Z0-9_]/g, '');
      if (tableName !== table) {
        throw new Error(`Invalid table name: ${table}`);
      }
      
      await pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
    } catch (error) {
      // Table might not exist, continue
    }
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
