/**
 * Wallet Integration Tests
 * Tests: create/ensure wallet -> ledger transaction creation -> withdrawal request
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { pool } from '../../src/utils/db.js';
import { 
  createTestUser, 
  createTestWallet,
  generateTestToken 
} from '../setup.js';

describe('Wallet Integration Tests', () => {
  let userToken;
  let testUser;
  let bankAccountId;
  let withdrawalId;
  const originalPaymentProvider = process.env.PAYMENT_PROVIDER;

  beforeAll(async () => {
    testUser = await createTestUser({ 
      role: 'caregiver', 
      email: 'wallet-test@example.com',
      trust_level: 'L2'
    });

    await createTestWallet(testUser.id, 5000);

    userToken = await generateTestToken(testUser.id);
  });

  beforeEach(() => {
    process.env.PAYMENT_PROVIDER = 'mock';
  });

  afterAll(() => {
    if (originalPaymentProvider === undefined) {
      delete process.env.PAYMENT_PROVIDER;
      return;
    }

    process.env.PAYMENT_PROVIDER = originalPaymentProvider;
  });

  const ensureUserTrustLevel = async (trustLevel = 'L2') => {
    await pool.query(
      `UPDATE users SET trust_level = $1, updated_at = NOW() WHERE id = $2`,
      [trustLevel, testUser.id]
    );
  };

  describe('Tier-0 Wallet Flow', () => {
    it('should get wallet balance', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('wallet_id');
      expect(response.body).toHaveProperty('wallet_type', 'caregiver');
      expect(response.body).toHaveProperty('available_balance', 5000);
      expect(response.body).toHaveProperty('held_balance', 0);
      expect(response.body).toHaveProperty('total_balance', 5000);
    });

    it('should initiate top-up with canonical payment_link method', async () => {
      const response = await request(app)
        .post('/api/wallet/topup')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 500,
          payment_method: 'payment_link',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('topup_id');
      expect(response.body).toHaveProperty('payment_method', 'payment_link');
      expect(response.body).toHaveProperty('status', 'pending');

      const stored = await pool.query(
        `SELECT method, provider_name, payment_link_url
         FROM topup_intents
         WHERE id = $1`,
        [response.body.topup_id]
      );

      expect(stored.rows[0]).toEqual(
        expect.objectContaining({
          method: 'payment_link',
          provider_name: 'mock',
        })
      );
      expect(String(stored.rows[0].payment_link_url || '')).toContain(response.body.topup_id);
    });

    it('should accept legacy stripe alias and persist payment_link method', async () => {
      const response = await request(app)
        .post('/api/wallet/topup')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 750,
          payment_method: 'stripe',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('topup_id');
      expect(response.body).toHaveProperty('payment_method', 'payment_link');
      expect(response.body).toHaveProperty('status', 'pending');

      const stored = await pool.query(
        `SELECT method, provider_name
         FROM topup_intents
         WHERE id = $1`,
        [response.body.topup_id]
      );

      expect(stored.rows[0]).toEqual(
        expect.objectContaining({
          method: 'payment_link',
          provider_name: 'mock',
        })
      );
    });

    it('should add bank account for withdrawal', async () => {
      const response = await request(app)
        .post('/api/wallet/bank-accounts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bank_code: 'SCB',
          bank_name: 'Siam Commercial Bank',
          account_number: '1234567890',
          account_name: 'Caregiver Wallet Test',
          set_primary: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('bank_account');
      expect(response.body.bank_account).toHaveProperty('id');

      bankAccountId = response.body.bank_account.id;
    });

    it('should create withdrawal request', async () => {
      await ensureUserTrustLevel('L2');

      const response = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 500,
          bank_account_id: bankAccountId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('withdrawal_id');
      expect(response.body).toHaveProperty('status', 'queued');

      withdrawalId = response.body.withdrawal_id;
    });

    it('should list withdrawal requests', async () => {
      const response = await request(app)
        .get('/api/wallet/withdrawals')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      const withdrawal = response.body.data.find((w) => w.id === withdrawalId);
      expect(withdrawal).toBeDefined();
      expect(withdrawal.status).toBe('queued');
    });

    it('should cancel withdrawal request', async () => {
      await ensureUserTrustLevel('L2');

      const response = await request(app)
        .post(`/api/wallet/withdrawals/${withdrawalId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('withdrawal_id', withdrawalId);
      expect(response.body).toHaveProperty('status', 'cancelled');
    });

    it('should get transaction history', async () => {
      const response = await request(app)
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Wallet Validation', () => {
    it('should reject balance request without authentication', async () => {
      const response = await request(app)
        .get('/api/wallet/balance')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject withdrawal without bank account id', async () => {
      await ensureUserTrustLevel('L2');

      const response = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 500 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject withdrawal without sufficient funds', async () => {
      await ensureUserTrustLevel('L2');

      const response = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 999999,
          bank_account_id: bankAccountId,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
