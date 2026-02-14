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

async function runMigrations() {
  try {
    console.log('🚀 Starting migration process...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');
    
    // Create migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Migrations table ready');
    
    // Get migration files
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${files.length} migration files`);
    
    // Get applied migrations
    const appliedResult = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
    const applied = new Set(appliedResult.rows.map(r => r.filename));
    
    // Run pending migrations
    for (const file of files) {
      if (!applied.has(file)) {
        console.log(`🔄 Running migration: ${file}`);
        
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        
        console.log(`✅ Applied migration: ${file}`);
      } else {
        console.log(`⏭️  Skipping already applied: ${file}`);
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
