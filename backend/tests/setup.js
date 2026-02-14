/**
 * Test setup for integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { pool } from '../src/utils/db.js';

// Test database configuration
const TEST_DATABASE = 'careconnect_test';

// Setup test database
beforeAll(async () => {
  // Validate test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run in test environment');
  }
  
  // Validate database name to prevent SQL injection
  const dbName = TEST_DATABASE.replace(/[^a-zA-Z0-9_]/g, '');
  if (dbName !== TEST_DATABASE) {
    throw new Error('Invalid database name');
  }
  
  // Create test database if it doesn't exist
  await pool.query(`CREATE DATABASE IF NOT EXISTS "${dbName}"`);
  
  // Switch to test database
  process.env.DATABASE_NAME = TEST_DATABASE;
  
  // Run migrations on test database
  const { execSync } = await import('child_process');
  try {
    execSync('npm run migrate:bootstrap', { cwd: process.cwd(), stdio: 'inherit' });
  } catch (error) {
    // Bootstrap may have already run, continue silently
  }
});

// Clean up before each test
beforeEach(async () => {
  // Clean up test data but preserve schema
  const validTables = [
    'ledger_transactions',
    'wallets',
    'job_assignments', 
    'jobs',
    'patient_profiles',
    'caregiver_profiles',
    'users',
    'schema_migrations'
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
  const { execSync } = await import('child_process');
  const bcrypt = await import('bcrypt');
  const { randomBytes } = await import('crypto');
  
  // Generate random suffix for unique email
  const suffix = randomBytes(4).toString('hex');
  
  const defaultUser = {
    email: `test-${suffix}@example.com`,
    password: 'testPassword123!',
    role: 'caregiver',
    ...userData
  };
  
  // Validate email format if provided
  if (userData.email && !userData.email.includes('@')) {
    throw new Error('Invalid email format');
  }
  
  const hashedPassword = await bcrypt.hash(defaultUser.password, 10);
  
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, status, trust_level, email_verified, phone_verified) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id, email, role, status, trust_level`,
    [
      defaultUser.email,
      hashedPassword,
      defaultUser.role,
      'active',
      'L0',
      true,
      false
    ]
  );
  
  return {
    ...result.rows[0],
    password: defaultUser.password // Return plain password for login tests
  };
};

export const createTestWallet = async (userId) => {
  const result = await pool.query(
    `INSERT INTO wallets (user_id, balance, available_balance, held_balance) 
     VALUES ($1, 1000.00, 1000.00, 0.00) 
     RETURNING *`,
    [userId]
  );
  
  return result.rows[0];
};

export const createTestPatientProfile = async (hirerId, data = {}) => {
  const defaultProfile = {
    first_name: 'Test',
    last_name: 'Patient',
    ...data
  };
  
  const result = await pool.query(
    `INSERT INTO patient_profiles (hirer_id, first_name, last_name, date_of_birth, gender, address) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING *`,
    [
      hirerId,
      defaultProfile.first_name,
      defaultProfile.last_name,
      defaultProfile.date_of_birth || '1990-01-01',
      defaultProfile.gender || 'other',
      defaultProfile.address || 'Test Address'
    ]
  );
  
  return result.rows[0];
};

export const createTestJob = async (hirerId, patientId, data = {}) => {
  const defaultJob = {
    title: 'Test Job',
    description: 'Test job description',
    job_type: 'companionship',
    hourly_rate: 25.00,
    estimated_duration_hours: 2,
    location_address: '123 Test St',
    ...data
  };
  
  const result = await pool.query(
    `INSERT INTO jobs (hirer_id, patient_id, title, description, job_type, hourly_rate, 
                      estimated_duration_hours, location_address, status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
     RETURNING *`,
    [
      hirerId,
      patientId,
      defaultJob.title,
      defaultJob.description,
      defaultJob.job_type,
      defaultJob.hourly_rate,
      defaultJob.estimated_duration_hours,
      defaultJob.location_address,
      'posted'
    ]
  );
  
  return result.rows[0];
};

export const generateTestToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

export const generateRefreshToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
    { expiresIn: '7d' }
  );
};
