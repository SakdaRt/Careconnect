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

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.resolve(__dirname, '../../..', 'database', 'schema.sql');
  const migrationsDir = path.resolve(__dirname, '../../..', 'database', 'migrations');

  const connectionString = await getDatabaseUrl();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const migrationsOnly = String(process.env.MIGRATIONS_ONLY || '').toLowerCase() === 'true';
    if (!migrationsOnly) {
      const schemaSql = await fs.readFile(schemaPath, 'utf8');
      await client.query(schemaSql);
      process.stdout.write('[migrate] Applied schema.sql successfully\n');
    }

    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id VARCHAR(255) PRIMARY KEY,
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

    const appliedRes = await client.query(`SELECT id FROM schema_migrations`);
    const applied = new Set(appliedRes.rows.map((r) => r.id));

    for (const file of migrationFiles) {
      if (applied.has(file)) continue;
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        process.stdout.write(`[migrate] Applied migration ${file}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
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

