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

async function manualMigrate() {
  try {
    console.log('🚀 Manual migration process...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');
    
    // Read and run each migration file manually
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${files.length} migration files`);
    
    for (const file of files) {
      console.log(`🔄 Running migration: ${file}`);
      
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      
      console.log(`✅ Applied migration: ${file}`);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

manualMigrate();
