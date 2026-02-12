import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'careconnect',
  user: process.env.DATABASE_USER || 'careconnect',
  password: process.env.DATABASE_PASSWORD || 'careconnect_dev_password',
  min: 2, // Minimum number of connections in pool
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error if connection takes > 2 seconds
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[Database] New client connected to pool');
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[Database Query]', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('[Database Error]', { text, error: error.message });
    throw error;
  }
};

// Helper function to get a client for transactions
export const getClient = async () => {
  const client = await pool.connect();
  const release = client.release.bind(client);

  // Set a timeout to release client if not released manually
  const timeout = setTimeout(() => {
    console.error('[Database] Client checkout timeout - forcing release');
    release();
  }, 5000);

  // Monkey patch release to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };

  return client;
};

// Transaction helper
export const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Test database connection
export const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version()');
    console.log('[Database] Connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
    return false;
  }
};

// Graceful shutdown
export const closePool = async () => {
  await pool.end();
  console.log('[Database] Pool has been closed');
};

export default pool;
