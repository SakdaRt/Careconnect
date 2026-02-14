#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'careconnect',
  user: process.env.DB_USER || 'careconnect',
  password: process.env.DB_PASSWORD || 'careconnect_dev_password',
});

async function runInitialSchema() {
  try {
    console.log('🚀 Running initial schema...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');
    
    // Read and run the initial schema file
    const schemaFile = path.join(__dirname, '../database/migrations/20260214_01_initial_schema.sql');
    const sql = fs.readFileSync(schemaFile, 'utf8');
    
    console.log('🔄 Applying initial schema...');
    await pool.query(sql);
    
    console.log('✅ Initial schema applied successfully!');
    
  } catch (error) {
    console.error('❌ Schema migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runInitialSchema();
