#!/usr/bin/env node

/**
 * Minimal SQL Migration Runner
 * 
 * Features:
 * - Applies migrations in order
 * - Tracks applied migrations in schema_migrations table
 * - Idempotent and safe to run multiple times
 * - Uses existing pg library
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import '../src/config/loadEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

// Database connection from environment
const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT, 10) || 5432,
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'careconnect',
  user: process.env.DATABASE_USER || process.env.DB_USER || 'careconnect',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'careconnect_dev_password',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Get all migration files sorted by timestamp
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('❌ Migrations directory not found:', MIGRATIONS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => {
      // Validate filename format
      const filenamePattern = /^\d{8}_\d{2}[a-zA-Z0-9_]*\.sql$/;
      return file.endsWith('.sql') && filenamePattern.test(file);
    })
    .sort(); // Sort by filename (timestamp prefix)

  return files;
}

/**
 * Create schema_migrations table if it doesn't exist
 */
async function createMigrationsTable() {
  // Validate table name to prevent SQL injection
  const tableName = MIGRATIONS_TABLE.replace(/[^a-zA-Z0-9_]/g, '');
  if (tableName !== MIGRATIONS_TABLE) {
    throw new Error('Invalid table name');
  }
  
  const sql = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_${tableName}_filename ON "${tableName}"(filename);
  `;

  try {
    await pool.query(sql);
    console.log('✅ Migrations table ready');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error.message);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations() {
  // Validate table name to prevent SQL injection
  const tableName = MIGRATIONS_TABLE.replace(/[^a-zA-Z0-9_]/g, '');
  if (tableName !== MIGRATIONS_TABLE) {
    throw new Error('Invalid table name');
  }
  
  try {
    const result = await pool.query(
      `SELECT filename FROM "${tableName}" ORDER BY filename`
    );
    return result.rows.map(row => row.filename);
  } catch (error) {
    console.error('❌ Failed to get applied migrations:', error.message);
    throw error;
  }
}

/**
 * Apply a single migration file
 */
async function applyMigration(filename) {
  // Validate filename format
  const filenamePattern = /^\d{8}_\d{2}[a-zA-Z0-9_]*\.sql$/;
  if (!filenamePattern.test(filename)) {
    throw new Error(`Invalid migration filename format: ${filename}`);
  }
  
  const filePath = path.join(MIGRATIONS_DIR, filename);
  
  try {
    const migrationSQL = fs.readFileSync(filePath, 'utf8');
    
    // Validate migration file content
    if (!migrationSQL.trim()) {
      throw new Error(`Migration file is empty: ${filename}`);
    }
    
    if (migrationSQL.length > 1000000) { // 1MB limit
      throw new Error(`Migration file too large: ${filename}`);
    }
    
    console.log(`📝 Applying migration: ${filename}`);
    
    // Validate table name for tracking
    const tableName = MIGRATIONS_TABLE.replace(/[^a-zA-Z0-9_]/g, '');
    if (tableName !== MIGRATIONS_TABLE) {
      throw new Error('Invalid table name');
    }
    
    await pool.query('BEGIN');
    
    // Apply the migration
    await pool.query(migrationSQL);
    
    // Record that it was applied
    await pool.query(
      `INSERT INTO "${tableName}" (filename) VALUES ($1)`,
      [filename]
    );
    
    await pool.query('COMMIT');
    
    console.log(`✅ Applied migration: ${filename}`);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(`❌ Failed to apply migration ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  try {
    await createMigrationsTable();
    
    const allFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations();
    
    console.log('\n📊 Migration Status:');
    console.log('==================');
    
    if (allFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }
    
    allFiles.forEach(file => {
      const isApplied = appliedMigrations.includes(file);
      const status = isApplied ? '✅ APPLIED' : '⏳ PENDING';
      console.log(`${status} ${file}`);
    });
    
    const pendingCount = allFiles.length - appliedMigrations.length;
    console.log(`\nSummary: ${appliedMigrations.length} applied, ${pendingCount} pending`);
    
  } catch (error) {
    console.error('❌ Failed to show status:', error.message);
    process.exit(1);
  }
}

/**
 * Run pending migrations
 */
async function runMigrations() {
  try {
    console.log('🚀 Starting migration process...');
    
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection established');
    
    await createMigrationsTable();
    
    const allFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations();
    
    // Find pending migrations
    const pendingMigrations = allFiles.filter(file => !appliedMigrations.includes(file));
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations. Database is up to date.');
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);
    
    // Apply migrations in order
    for (const filename of pendingMigrations) {
      await applyMigration(filename);
    }
    
    console.log('🎉 All migrations applied successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Bootstrap initial schema from schema.sql
 */
async function bootstrapSchema() {
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.log('❌ Schema file not found:', schemaPath);
    process.exit(1);
  }
  
  try {
    console.log('🏗️  Bootstrapping initial schema...');
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query('BEGIN');
    await pool.query(schemaSQL);
    
    // Validate table name for tracking
    const tableName = MIGRATIONS_TABLE.replace(/[^a-zA-Z0-9_]/g, '');
    if (tableName !== MIGRATIONS_TABLE) {
      throw new Error('Invalid table name');
    }
    
    // Mark initial bootstrap as applied
    await pool.query(
      `INSERT INTO "${tableName}" (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      ['bootstrap_initial_schema']
    );
    
    await pool.query('COMMIT');
    
    console.log('✅ Initial schema bootstrapped successfully');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Failed to bootstrap schema:', error.message);
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return { command: 'migrate' };
  }
  
  const command = args[0];
  
  if (!['migrate', 'status', 'bootstrap'].includes(command)) {
    console.log('Usage:');
    console.log('  node scripts/migrate.js migrate   # Run pending migrations');
    console.log('  node scripts/migrate.js status    # Show migration status');
    console.log('  node scripts/migrate.js bootstrap # Bootstrap initial schema');
    process.exit(1);
  }
  
  return { command };
}

/**
 * Main execution
 */
async function main() {
  const { command } = parseArgs();
  
  try {
    switch (command) {
      case 'migrate':
        await runMigrations();
        break;
      case 'status':
        await showStatus();
        await pool.end();
        break;
      case 'bootstrap':
        await createMigrationsTable();
        await bootstrapSchema();
        await pool.end();
        break;
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
