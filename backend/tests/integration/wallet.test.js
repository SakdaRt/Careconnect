/**
 * Wallet Integration Tests
 * Tests: create/ensure wallet -> ledger transaction creation -> withdrawal request
 */

import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { 
  createTestUser, 
  createTestWallet,
  generateTestToken 
} from '../setup.js';

describe('Wallet Integration Tests', () => {
  let server;
  let userToken;
  let testUser;
  let testWallet;

  beforeAll(async () => {
    server = app.listen(0);
    
    // Create test user
    testUser = await createTestUser({ 
      role: 'caregiver', 
      email: 'wallet-test@example.com' 
    });
    
    // Generate token
    userToken = await generateTestToken(testUser.id);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Tier-0 Wallet Flow', () => {
    it('should create wallet on user registration', async () => {
      // Create new user to test wallet creation
      const newUser = await createTestUser({ 
        role: 'caregiver', 
        email: 'wallet-auto@example.com' 
      });

      const newUserToken = await generateTestToken(newUser.id);

      const response = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wallet');
      expect(response.body.wallet.user_id).toBe(newUser.id);
      expect(response.body.wallet.balance).toBe('0.00');
      expect(response.body.wallet.available_balance).toBe('0.00');
      expect(response.body.wallet.held_balance).toBe('0.00');
    });

    it('should get existing wallet', async () => {
      // Create wallet for our test user
      testWallet = await createTestWallet(testUser.id);

      const response = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wallet');
      expect(response.body.wallet.user_id).toBe(testUser.id);
      expect(response.body.wallet.balance).toBe('1000.00');
      expect(response.body.wallet.available_balance).toBe('1000.00');
    });

    it('should create credit ledger transaction', async () => {
      const transactionData = {
        type: 'credit',
        amount: 500.00,
        reference_type: 'topup',
        reference_id: 'test-topup-123',
        description: 'Test wallet top-up'
      };

      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.type).toBe('credit');
      expect(response.body.transaction.amount).toBe('500.00');
      expect(response.body.transaction.reference_type).toBe('topup');
      expect(response.body.transaction.balance_after).toBe('1500.00');
    });

    it('should create debit ledger transaction', async () => {
      const transactionData = {
        type: 'debit',
        amount: 200.00,
        reference_type: 'withdrawal',
        reference_id: 'test-withdrawal-123',
        description: 'Test withdrawal'
      };

      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.type).toBe('debit');
      expect(response.body.transaction.amount).toBe('200.00');
      expect(response.body.transaction.balance_after).toBe('1300.00');
    });

    it('should get wallet balance', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body.balance).toBe('1300.00');
      expect(response.body).toHaveProperty('available_balance');
      expect(response.body.available_balance).toBe('1300.00');
      expect(response.body).toHaveProperty('held_balance');
      expect(response.body.held_balance).toBe('0.00');
    });

    it('should get transaction history', async () => {
      const response = await request(app)
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body.transactions.length).toBeGreaterThan(0);

      // Should have our created transactions
      const creditTransaction = response.body.transactions.find(
        t => t.type === 'credit' && t.amount === '500.00'
      );
      expect(creditTransaction).toBeDefined();

      const debitTransaction = response.body.transactions.find(
        t => t.type === 'debit' && t.amount === '200.00'
      );
      expect(debitTransaction).toBeDefined();
    });

    it('should create withdrawal request', async () => {
      const withdrawalData = {
        amount: 300.00,
        method: 'bank_transfer',
        destination_account: '1234567890'
      };

      const response = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${userToken}`)
        .send(withdrawalData)
        .expect(201);

      expect(response.body).toHaveProperty('withdrawal');
      expect(response.body.withdrawal.amount).toBe('300.00');
      expect(response.body.withdrawal.status).toBe('pending');
      expect(response.body.withdrawal.method).toBe('bank_transfer');
    });

    it('should reflect withdrawal in wallet balance', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.balance).toBe('1000.00'); // 1300 - 300 withdrawal
      expect(response.body.available_balance).toBe('1000.00');
    });

    it('should get withdrawal requests', async () => {
      const response = await request(app)
        .get('/api/wallet/withdrawals')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('withdrawals');
      expect(Array.isArray(response.body.withdrawals)).toBe(true);
      expect(response.body.withdrawals.length).toBeGreaterThan(0);

      const withdrawal = response.body.withdrawals.find(
        w => w.amount === '300.00' && w.status === 'pending'
      );
      expect(withdrawal).toBeDefined();
    });
  });

  describe('Ledger Transaction Validation', () => {
    it('should reject transaction without authentication', async () => {
      const response = await request(app)
        .post('/api/wallet/transactions')
        .send({
          type: 'credit',
          amount: 100.00,
          reference_type: 'topup'
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject invalid transaction type', async () => {
      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'invalid_type',
          amount: 100.00,
          reference_type: 'topup'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject negative amount', async () => {
      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'credit',
          amount: -100.00,
          reference_type: 'topup'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject overdraft attempt', async () => {
      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'debit',
          amount: 2000.00, // More than available balance
          reference_type: 'withdrawal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_FUNDS');
    });

    it('should reject withdrawal without sufficient funds', async () => {
      const response = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 2000.00, // More than available
          method: 'bank_transfer'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_FUNDS');
    });
  });

  describe('Hold and Release Transactions', () => {
    it('should create hold transaction', async () => {
      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'hold',
          amount: 200.00,
          reference_type: 'job',
          reference_id: 'test-job-123',
          description: 'Hold for job payment'
        })
        .expect(201);

      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.type).toBe('hold');
      expect(response.body.transaction.amount).toBe('200.00');
    });

    it('should reflect hold in wallet balances', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.balance).toBe('1000.00');
      expect(response.body.available_balance).toBe('800.00'); // 1000 - 200 hold
      expect(response.body.held_balance).toBe('200.00');
    });

    it('should release held funds', async () => {
      const response = await request(app)
        .post('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'release',
          amount: 200.00,
          reference_type: 'job',
          reference_id: 'test-job-123',
          description: 'Release held funds'
        })
        .expect(201);

      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.type).toBe('release');
      expect(response.body.transaction.amount).toBe('200.00');
    });

    it('should reflect release in wallet balances', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.balance).toBe('1000.00');
      expect(response.body.available_balance).toBe('1000.00'); // 800 + 200 release
      expect(response.body.held_balance).toBe('0.00');
    });
  });

  describe('Transaction History Filtering', () => {
    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get('/api/wallet/transactions?type=credit')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(Array.isArray(response.body.transactions)).toBe(true);

      response.body.transactions.forEach(transaction => {
        expect(transaction.type).toBe('credit');
      });
    });

    it('should filter transactions by reference type', async () => {
      const response = await request(app)
        .get('/api/wallet/transactions?reference_type=topup')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(Array.isArray(response.body.transactions)).toBe(true);

      response.body.transactions.forEach(transaction => {
        expect(transaction.reference_type).toBe('topup');
      });
    });

    it('should limit transaction history results', async () => {
      const response = await request(app)
        .get('/api/wallet/transactions?limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body.transactions.length).toBeLessThanOrEqual(5);
    });
  });
});
