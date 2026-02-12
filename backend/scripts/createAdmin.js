import bcrypt from 'bcrypt';
import pg from 'pg';

const { Client } = pg;

const email = process.env.ADMIN_EMAIL || 'admin@careconnect.com';
const password = process.env.ADMIN_PASSWORD || 'Admin1234!';
const shouldReset = process.env.ADMIN_RESET_PASSWORD === '1';

const client = new Client({
  host: process.env.DATABASE_HOST || 'postgres',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'careconnect',
  user: process.env.DATABASE_USER || 'careconnect',
  password: process.env.DATABASE_PASSWORD || 'careconnect_dev_password',
});

async function run() {
  await client.connect();

  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  const hash = await bcrypt.hash(password, 10);
  if (existing.rows.length > 0) {
    if (shouldReset) {
      await client.query(
        `UPDATE users
         SET password_hash = $2,
             role = 'admin',
             status = 'active',
             is_email_verified = true,
             updated_at = NOW()
         WHERE email = $1`,
        [email, hash]
      );
      console.log('UPDATED');
    } else {
      console.log('EXISTS');
    }
    await client.end();
    return;
  }

  await client.query(
    `INSERT INTO users (id, email, password_hash, account_type, role, trust_level, status, is_email_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'guest', 'admin', 'L3', 'active', true, NOW(), NOW())`,
    [email, hash]
  );

  console.log('CREATED');
  await client.end();
}

run().catch(async (error) => {
  console.error(error);
  await client.end().catch(() => undefined);
  process.exit(1);
});
