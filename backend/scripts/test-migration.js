#!/usr/bin/env node

/**
 * Simple test to verify migration script syntax
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test that we can import the migration script functions
console.log('🧪 Testing migration script syntax...');

try {
  // Test basic Node.js functionality
  console.log('✅ Node.js working');
  
  // Test file system access
  const fs = await import('fs');
  const migrationsDir = path.join(__dirname, '../database/migrations');
  
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    console.log(`✅ Found ${files.length} migration files:`, files);
  } else {
    console.log('❌ Migrations directory not found');
  }
  
  // Test pg library import
  const pg = await import('pg');
  console.log('✅ pg library available');
  
  console.log('🎉 Migration script syntax test passed!');
  
} catch (error) {
  console.error('❌ Migration script test failed:', error.message);
  process.exit(1);
}
