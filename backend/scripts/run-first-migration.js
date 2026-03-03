#!/usr/bin/env node

import pg from 'pg';
import '../src/config/loadEnv.js';

// Database connection
const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT, 10) || 5432,
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'careconnect',
  user: process.env.DATABASE_USER || process.env.DB_USER || 'careconnect',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'careconnect_dev_password',
});

async function runFirstMigration() {
  try {
    console.log('🚀 Running first migration...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');
    
    // Create migrations table
    await pool.query(`
      CREATE TABLE schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Migrations table created');
    
    // Mark first migration as applied
    await pool.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      ['20260213_01_payment_status_enum.sql']
    );
    
    console.log('✅ First migration marked as applied');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runFirstMigration();
