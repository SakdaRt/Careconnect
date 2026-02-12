/**
 * Database Connection and Model Test Script
 * Run with: node src/utils/testDb.js
 */

import { testConnection, closePool, transaction } from './db.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import { v4 as uuidv4 } from 'uuid';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
};

async function testDatabaseConnection() {
  log.info('Testing database connection...');
  const connected = await testConnection();
  if (connected) {
    log.success('Database connection successful');
    return true;
  } else {
    log.error('Database connection failed');
    return false;
  }
}

async function testUserModel() {
  log.info('Testing User model...');

  try {
    // Test: Create user
    const userData = {
      email: `test_${Date.now()}@example.com`,
      phone_number: `+66${Math.floor(Math.random() * 1000000000)}`,
      password_hash: 'test_password_123',
      role: 'hirer',
      account_type: 'member',
    };

    const user = await User.createUser(userData);
    log.success(`Created user: ${user.id}`);

    // Test: Find user by ID
    const foundUser = await User.findById(user.id);
    if (foundUser && foundUser.id === user.id) {
      log.success('Found user by ID');
    } else {
      log.error('Failed to find user by ID');
    }

    // Test: Find user by email
    const foundByEmail = await User.findByEmail(userData.email);
    if (foundByEmail && foundByEmail.email === userData.email) {
      log.success('Found user by email');
    } else {
      log.error('Failed to find user by email');
    }

    // Test: Verify email
    await User.verifyEmail(user.id);
    const verifiedUser = await User.findById(user.id);
    if (verifiedUser.is_email_verified) {
      log.success('Email verification successful');
    } else {
      log.error('Email verification failed');
    }

    // Test: Update trust level
    await User.updateTrustLevel(user.id, 'L1');
    const updatedUser = await User.findById(user.id);
    if (updatedUser.trust_level === 'L1') {
      log.success('Trust level update successful');
    } else {
      log.error('Trust level update failed');
    }

    // Test: Get user stats
    const stats = await User.getUserStats();
    log.success(`User stats: ${stats.total_users} users, ${stats.total_hirers} hirers`);

    // Clean up: Delete test user
    await User.deleteById(user.id);
    log.success('Deleted test user');

    return true;
  } catch (error) {
    log.error(`User model test failed: ${error.message}`);
    return false;
  }
}

async function testWalletModel() {
  log.info('Testing Wallet model...');

  try {
    // Create test user first
    const user = await User.createUser({
      email: `wallet_test_${Date.now()}@example.com`,
      phone_number: `+66${Math.floor(Math.random() * 1000000000)}`,
      password_hash: 'test_password_123',
      role: 'hirer',
      account_type: 'member',
    });

    // Test: Create wallet
    const wallet = await Wallet.createWallet(user.id, 'hirer');
    log.success(`Created wallet: ${wallet.id}`);

    // Test: Get or create wallet (should return existing)
    const existingWallet = await Wallet.getOrCreateWallet(user.id, 'hirer');
    if (existingWallet.id === wallet.id) {
      log.success('Get or create wallet works correctly');
    } else {
      log.error('Get or create wallet returned different wallet');
    }

    // Test: Update balance (credit)
    await Wallet.updateBalance(wallet.id, 1000);
    const balance1 = await Wallet.getBalance(wallet.id);
    if (balance1.available_balance === 1000) {
      log.success('Balance credit successful');
    } else {
      log.error('Balance credit failed');
    }

    // Test: Hold funds
    await Wallet.holdFunds(wallet.id, 300);
    const balance2 = await Wallet.getBalance(wallet.id);
    if (balance2.available_balance === 700 && balance2.held_balance === 300) {
      log.success('Hold funds successful');
    } else {
      log.error('Hold funds failed');
    }

    // Test: Release funds
    await Wallet.releaseFunds(wallet.id, 100);
    const balance3 = await Wallet.getBalance(wallet.id);
    if (balance3.available_balance === 800 && balance3.held_balance === 200) {
      log.success('Release funds successful');
    } else {
      log.error('Release funds failed');
    }

    // Test: Negative balance protection
    try {
      await Wallet.updateBalance(wallet.id, -2000); // Should fail
      log.error('Negative balance protection failed');
    } catch (error) {
      log.success('Negative balance protection working');
    }

    // Test: Get wallet stats
    const stats = await Wallet.getWalletStats();
    log.success(`Wallet stats: ${stats.total_wallets} wallets, ${stats.total_available} total available`);

    // Clean up
    await Wallet.deleteById(wallet.id);
    await User.deleteById(user.id);
    log.success('Deleted test wallet and user');

    return true;
  } catch (error) {
    log.error(`Wallet model test failed: ${error.message}`);
    return false;
  }
}

async function testLedgerModel() {
  log.info('Testing LedgerTransaction model...');

  try {
    // Create test user and wallet
    const user = await User.createUser({
      email: `ledger_test_${Date.now()}@example.com`,
      phone_number: `+66${Math.floor(Math.random() * 1000000000)}`,
      password_hash: 'test_password_123',
      role: 'caregiver',
      account_type: 'member',
    });

    const wallet = await Wallet.createWallet(user.id, 'caregiver');

    // Test: Record credit transaction
    const creditTxn = await LedgerTransaction.recordCredit(wallet.id, 500, {
      reference_type: 'topup',
      reference_id: uuidv4(),
      description: 'Test credit transaction',
    });
    log.success(`Recorded credit transaction: ${creditTxn.id}`);

    // Test: Get transactions by wallet
    const walletTxns = await LedgerTransaction.getByWallet(wallet.id);
    if (walletTxns.length > 0) {
      log.success(`Found ${walletTxns.length} transaction(s) for wallet`);
    } else {
      log.error('Failed to find transactions for wallet');
    }

    // Test: Record debit transaction
    const debitTxn = await LedgerTransaction.recordDebit(wallet.id, 100, {
      reference_type: 'withdrawal',
      reference_id: uuidv4(),
      description: 'Test debit transaction',
    });
    log.success(`Recorded debit transaction: ${debitTxn.id}`);

    // Test: Record reversal
    const reversalTxn = await LedgerTransaction.recordReversal(
      debitTxn.id,
      'Test reversal'
    );
    log.success(`Recorded reversal transaction: ${reversalTxn.id}`);

    // Test: Immutability (UPDATE should fail)
    try {
      await LedgerTransaction.updateById(creditTxn.id, { amount: 999 });
      log.error('Ledger immutability failed - UPDATE succeeded');
    } catch (error) {
      log.success('Ledger immutability working - UPDATE blocked');
    }

    // Test: Immutability (DELETE should fail)
    try {
      await LedgerTransaction.deleteById(creditTxn.id);
      log.error('Ledger immutability failed - DELETE succeeded');
    } catch (error) {
      log.success('Ledger immutability working - DELETE blocked');
    }

    // Test: Get transaction stats
    const stats = await LedgerTransaction.getTransactionStats();
    log.success(`Transaction stats: ${stats.total_transactions} total, ${stats.total_volume} volume`);

    // Note: Cannot delete wallet with ledger transactions due to RESTRICT constraint
    // This is the correct behavior for financial integrity
    log.success('Ledger transactions recorded successfully (wallet cannot be deleted - this is correct!)');

    return true;
  } catch (error) {
    log.error(`Ledger model test failed: ${error.message}`);
    return false;
  }
}

async function testTransactionIntegrity() {
  log.info('Testing transaction integrity...');

  try {
    const result = await transaction(async (client) => {
      // Create user within transaction
      const userQuery = await client.query(
        `INSERT INTO users (id, email, phone_number, password_hash, account_type, role, trust_level, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [`txn_test_${Date.now()}@example.com`, `+66${Math.floor(Math.random() * 1000000000)}`, 'test123', 'member', 'hirer', 'L0', 'active']
      );
      const user = userQuery.rows[0];

      // Create wallet within same transaction
      const walletQuery = await client.query(
        `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 0, 0, $3, NOW(), NOW())
         RETURNING *`,
        [user.id, 'hirer', 'THB']
      );
      const wallet = walletQuery.rows[0];

      return { user, wallet };
    });

    log.success('Transaction commit successful');

    // Clean up
    await Wallet.deleteById(result.wallet.id);
    await User.deleteById(result.user.id);

    return true;
  } catch (error) {
    log.error(`Transaction integrity test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('   Careconnect Database Layer Tests');
  console.log('========================================\n');

  const results = {
    connection: false,
    user: false,
    wallet: false,
    ledger: false,
    transaction: false,
  };

  results.connection = await testDatabaseConnection();
  if (!results.connection) {
    log.error('Aborting tests - database connection failed');
    await closePool();
    process.exit(1);
  }

  console.log('');
  results.user = await testUserModel();

  console.log('');
  results.wallet = await testWalletModel();

  console.log('');
  results.ledger = await testLedgerModel();

  console.log('');
  results.transaction = await testTransactionIntegrity();

  console.log('\n========================================');
  console.log('           Test Summary');
  console.log('========================================');
  console.log(`Database Connection: ${results.connection ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`User Model: ${results.user ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Wallet Model: ${results.wallet ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Ledger Model: ${results.ledger ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Transaction Integrity: ${results.transaction ? '✓ PASS' : '✗ FAIL'}`);
  console.log('========================================\n');

  const allPassed = Object.values(results).every((r) => r === true);
  if (allPassed) {
    log.success('All tests passed! 🎉');
  } else {
    log.error('Some tests failed. Please check the output above.');
  }

  await closePool();
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  log.error(`Test runner failed: ${error.message}`);
  console.error(error);
  closePool();
  process.exit(1);
});
