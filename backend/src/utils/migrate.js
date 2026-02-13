import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '5432';
  const name = process.env.DATABASE_NAME || 'careconnect';
  const user = process.env.DATABASE_USER || 'careconnect';
  const password = process.env.DATABASE_PASSWORD || 'careconnect_dev_password';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

async function main() {
  const { Client } = await import('pg');
  const isStatus = process.argv.includes('--status');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.resolve(__dirname, '../../..', 'database', 'schema.sql');
  const migrationsDir = path.resolve(process.cwd(), 'database', 'migrations');

  const connectionString = await getDatabaseUrl();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Create schema_migrations table if it doesn't exist
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename TEXT PRIMARY KEY, 
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    );

    let migrationFiles = [];
    try {
      migrationFiles = (await fs.readdir(migrationsDir))
        .filter((f) => f.toLowerCase().endsWith('.sql'))
        .sort();
    } catch {
      migrationFiles = [];
    }

    if (migrationFiles.length === 0) {
      process.stdout.write('[migrate] No migrations found\n');
      return;
    }

    const appliedRes = await client.query(`SELECT filename FROM schema_migrations`);
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    if (isStatus) {
      process.stdout.write('[migrate] Migration status:\n');
      for (const file of migrationFiles) {
        const status = applied.has(file) ? '✓ applied' : '○ pending';
        process.stdout.write(`  ${status} ${file}\n`);
      }
      return;
    }

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        process.stdout.write(`[migrate] skipped ${file} (already applied)\n`);
        continue;
      }
      
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, 'utf8');
      
      process.stdout.write(`[migrate] applying ${file} ... `);
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        process.stdout.write('done\n');
      } catch (error) {
        await client.query('ROLLBACK');
        process.stdout.write('failed\n');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`[migrate] Failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

