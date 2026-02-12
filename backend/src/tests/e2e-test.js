/**
 * Careconnect E2E API Test Script
 * Tests the complete job lifecycle from registration to payment
 *
 * Run with: node src/tests/e2e-test.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://careconnect:careconnect_dev_password@postgres:5432/careconnect';

// Test state
let hirerToken = null;
let hirerId = null;
let caregiverToken = null;
let caregiverId = null;
let jobPostId = null;
let jobId = null;

// Database helper for test setup
let pgPool = null;
async function getDb() {
  if (!pgPool) {
    const { Pool } = await import('pg');
    pgPool = new Pool({ connectionString: DB_URL });
  }
  return pgPool;
}

async function dbQuery(sql, params = []) {
  const db = await getDb();
  const result = await db.query(sql, params);
  return result;
}

// Helper function for API calls
async function api(method, path, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const result = await response.json();

  return { status: response.status, data: result };
}

// Test utilities
function log(message, data = null) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[TEST] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function success(message) {
  console.log(`  ✓ ${message}`);
}

function fail(message, data = null) {
  console.log(`  ✗ ${message}`);
  if (data) console.log('    ', JSON.stringify(data));
  throw new Error(message);
}

// Test cases
async function testHealthCheck() {
  log('1. Health Check');
  const { status, data } = await api('GET', '/health');

  if (status !== 200 || data.status !== 'ok') {
    fail('Health check failed', data);
  }
  success('Backend is healthy');
}

async function testRegisterHirer() {
  log('2. Register Hirer');
  const timestamp = Date.now();
  const { status, data } = await api('POST', '/api/auth/register/member', {
    email: `hirer_${timestamp}@test.com`,
    password: 'Test123!',
    phone_number: `+6680000${timestamp.toString().slice(-4)}`,
    role: 'hirer',
    first_name: 'Test',
    last_name: 'Hirer',
  });

  if (status !== 201 || !data.success) {
    fail('Failed to register hirer', data);
  }

  hirerToken = data.data.accessToken;
  hirerId = data.data.user.id;
  success(`Hirer registered: ${hirerId}`);
}

async function testRegisterCaregiver() {
  log('3. Register Caregiver');
  const timestamp = Date.now();
  const { status, data } = await api('POST', '/api/auth/register/member', {
    email: `caregiver_${timestamp}@test.com`,
    password: 'Test123!',
    phone_number: `+6680001${timestamp.toString().slice(-4)}`,
    role: 'caregiver',
    first_name: 'Test',
    last_name: 'Caregiver',
  });

  if (status !== 201 || !data.success) {
    fail('Failed to register caregiver', data);
  }

  caregiverToken = data.data.accessToken;
  caregiverId = data.data.user.id;
  success(`Caregiver registered: ${caregiverId}`);
}

async function testGetWalletBalance() {
  log('4. Get Hirer Wallet Balance');
  const { status, data } = await api('GET', '/api/wallet/balance', null, hirerToken);

  if (status !== 200 || !data.success) {
    fail('Failed to get wallet balance', data);
  }

  success(`Wallet balance: ${data.available_balance} ${data.currency}`);
}

async function testTopupWallet() {
  log('5. Initiate Wallet Top-up');
  const { data } = await api('POST', '/api/wallet/topup', {
    amount: 10000,
    method: 'bank_transfer',
  }, hirerToken);

  if (!data.success || !data.topup_id) {
    fail('Failed to initiate topup', data);
  }

  const topupId = data.topup_id;
  success(`Topup initiated: ${topupId}`);

  // Simulate payment webhook
  log('5b. Simulate Payment Webhook');
  const webhookResult = await api('POST', '/api/webhooks/payment', {
    event: 'payment.success',
    data: {
      reference_id: topupId,
      transaction_id: `TXN_${Date.now()}`,
      amount: 10000,
    },
  });

  if (webhookResult.status !== 200) {
    fail('Webhook processing failed', webhookResult.data);
  }
  success('Payment webhook processed');

  // Verify balance
  const balanceResult = await api('GET', '/api/wallet/balance', null, hirerToken);
  if (balanceResult.data.available_balance !== 10000) {
    fail(`Expected balance 10000, got ${balanceResult.data.available_balance}`);
  }
  success(`Wallet balance updated: ${balanceResult.data.available_balance} THB`);
}

async function testCreateJob() {
  log('6. Create Job');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 8);

  const { status, data } = await api('POST', '/api/jobs', {
    title: 'E2E Test Job - Elderly Companionship',
    description: 'Testing the complete job flow',
    job_type: 'companionship',
    scheduled_start_at: startDate.toISOString(),
    scheduled_end_at: endDate.toISOString(),
    hourly_rate: 350,
    total_hours: 8,
    address_line1: '123 Test Street',
    district: 'Watthana',
    province: 'Bangkok',
    lat: 13.7563,
    lng: 100.5018,
  }, hirerToken);

  if (status !== 201 || !data.success) {
    fail('Failed to create job', data);
  }

  jobPostId = data.data.job.id;
  success(`Job created: ${jobPostId}`);
  success(`Status: ${data.data.job.status}`);
  success(`Total amount: ${data.data.job.total_amount} THB`);
}

async function testPublishJob() {
  log('7. Publish Job');
  const { status, data } = await api('POST', `/api/jobs/${jobPostId}/publish`, null, hirerToken);

  if (status !== 200 || !data.success) {
    fail('Failed to publish job', data);
  }

  success(`Job published, status: ${data.data.job.status}`);

  // Check wallet for hold
  const balanceResult = await api('GET', '/api/wallet/balance', null, hirerToken);
  success(`Wallet: available=${balanceResult.data.available_balance}, held=${balanceResult.data.held_balance}`);
}

async function testListJobs() {
  log('8. List Available Jobs (as Caregiver)');
  const { status, data } = await api('GET', '/api/jobs/feed', null, caregiverToken);

  if (status !== 200 || !data.success) {
    fail('Failed to list jobs', data);
  }

  // Response structure is data.data.data (array)
  const jobs = data.data?.data || data.data || [];
  success(`Found ${jobs.length} posted jobs`);
}

async function testUpgradeCaregiverTrustLevel() {
  log('9. Upgrade Caregiver Trust Level (for testing)');
  // For E2E testing, we directly update the database
  // In production, this would go through email/phone verification (L0->L1) then KYC (L1->L2)

  try {
    await dbQuery(
      `UPDATE users SET trust_level = 'L1', is_email_verified = true, is_phone_verified = true, updated_at = NOW() WHERE id = $1`,
      [caregiverId]
    );
    success('Caregiver trust level set to L1 via database');

    // Verify the update
    const result = await dbQuery(`SELECT trust_level FROM users WHERE id = $1`, [caregiverId]);
    if (result.rows[0]?.trust_level !== 'L1') {
      fail('Trust level update verification failed');
    }
    success(`Verified trust level: ${result.rows[0].trust_level}`);
  } catch (error) {
    fail(`Database update failed: ${error.message}`);
  }
}

async function testAcceptJob() {
  log('10. Accept Job (as Caregiver)');
  const { status, data } = await api('POST', `/api/jobs/${jobPostId}/accept`, null, caregiverToken);

  if (status !== 200 || !data.success) {
    fail('Failed to accept job', data);
  }

  jobId = data.data.job_id;
  success(`Job accepted, job_id: ${jobId}`);
  success(`Chat thread created: ${data.data.chat_thread_id}`);
  success(`Escrow amount: ${data.data.escrow_amount} THB`);
}

async function testGetJobDetails() {
  log('11. Get Job Details');
  const { status, data } = await api('GET', `/api/jobs/${jobPostId}`, null, caregiverToken);

  if (status !== 200 || !data.success) {
    fail('Failed to get job details', data);
  }

  const job = data.data.job;
  success(`Job status: ${job.status}`);
  success(`Job type: ${job.job_type}`);
  success(`Scheduled: ${job.scheduled_start_at}`);
}

async function testCheckIn() {
  log('12. Check In');
  const { status, data } = await api('POST', `/api/jobs/${jobPostId}/checkin`, {
    lat: 13.7563,
    lng: 100.5018,
    accuracy_m: 10,
  }, caregiverToken);

  if (status !== 200 || !data.success) {
    fail('Check-in failed', data);
  }

  success(`Checked in, status: ${data.data.job.status}`);
}

async function testCheckOut() {
  log('13. Check Out');
  const { status, data } = await api('POST', `/api/jobs/${jobPostId}/checkout`, {
    lat: 13.7563,
    lng: 100.5018,
    accuracy_m: 10,
  }, caregiverToken);

  if (status !== 200 || !data.success) {
    fail('Check-out failed', data);
  }

  success(`Checked out, status: ${data.data.status}`);
  success(`Caregiver payment: ${data.data.caregiver_payment} THB`);
  success(`Platform fee: ${data.data.platform_fee} THB`);
}

async function testCaregiverWalletBalance() {
  log('14. Verify Caregiver Wallet Balance');
  const { status, data } = await api('GET', '/api/wallet/balance', null, caregiverToken);

  if (status !== 200 || !data.success) {
    fail('Failed to get caregiver wallet', data);
  }

  if (data.available_balance <= 0) {
    fail(`Expected positive balance, got ${data.available_balance}`);
  }

  success(`Caregiver wallet: ${data.available_balance} THB`);
}

async function testChatThread() {
  log('15. Test Chat System');
  // Get threads
  const threadsResult = await api('GET', '/api/chat/threads', null, caregiverToken);

  if (threadsResult.status !== 200) {
    fail('Failed to get chat threads', threadsResult.data);
  }

  // Response structure is data.data (array directly)
  const threads = threadsResult.data.data || [];
  if (threads.length === 0) {
    fail('No chat threads found');
  }

  const threadId = threads[0].id;
  success(`Found chat thread: ${threadId}`);

  // Send a message
  const messageResult = await api('POST', `/api/chat/threads/${threadId}/messages`, {
    content: 'Thank you for the job!',
    type: 'text',
  }, caregiverToken);

  if (messageResult.status !== 201) {
    fail('Failed to send message', messageResult.data);
  }
  success('Message sent successfully');

  // Get messages
  const messagesResult = await api('GET', `/api/chat/threads/${threadId}/messages`, null, caregiverToken);

  if (messagesResult.status !== 200) {
    fail('Failed to get messages', messagesResult.data);
  }
  // Response structure is data.data (array directly)
  const messages = messagesResult.data.data || [];
  success(`Thread has ${messages.length} messages`);
}

async function testFinalJobStatus() {
  log('16. Verify Final Job Status');
  const { status, data } = await api('GET', `/api/jobs/${jobPostId}`, null, hirerToken);

  if (status !== 200 || !data.success) {
    fail('Failed to get final job status', data);
  }

  const job = data.data.job;
  if (job.job_status !== 'completed') {
    fail(`Expected job_status 'completed', got '${job.job_status}'`);
  }

  success(`Job post status: ${job.status}`);
  success(`Job instance status: ${job.job_status}`);
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  CARECONNECT E2E API TEST');
  console.log('='.repeat(60));
  console.log(`\nAPI URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const tests = [
    testHealthCheck,
    testRegisterHirer,
    testRegisterCaregiver,
    testGetWalletBalance,
    testTopupWallet,
    testCreateJob,
    testPublishJob,
    testListJobs,
    testUpgradeCaregiverTrustLevel,
    testAcceptJob,
    testGetJobDetails,
    testCheckIn,
    testCheckOut,
    testCaregiverWalletBalance,
    testChatThread,
    testFinalJobStatus,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`\n  ERROR: ${error.message}`);
      failed++;
      // Continue with remaining tests
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${tests.length}`);
  console.log('='.repeat(60) + '\n');

  // Cleanup
  if (pgPool) {
    await pgPool.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
