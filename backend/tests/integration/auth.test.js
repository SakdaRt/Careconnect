/**
 * Auth Integration Tests
 * Tests: register -> login -> refresh -> access protected route
 */

import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';

describe('Auth Integration Tests', () => {
  let accessToken;
  let refreshToken;
  const testEmail = 'integration-test@example.com';
  const testPassword = 'TestPassword123!';

  describe('Tier-0 Auth Flow', () => {
    it('should register a new user', async () => {
      const userData = {
        email: testEmail,
        password: testPassword,
        role: 'caregiver'
      };

      // Step 1: Start registration — sends OTP, returns otp_id
      const regResponse = await request(app)
        .post('/api/auth/register/guest')
        .send(userData)
        .expect(200);

      expect(regResponse.body).toHaveProperty('success', true);
      expect(regResponse.body.data).toHaveProperty('otp_id');

      const otpId = regResponse.body.data.otp_id;
      const devCode = regResponse.body.data._dev_code;

      // Step 2: Verify OTP — creates user and returns tokens
      const verifyResponse = await request(app)
        .post('/api/otp/verify')
        .send({ otp_id: otpId, code: devCode })
        .expect(200);

      expect(verifyResponse.body).toHaveProperty('success', true);
      expect(verifyResponse.body.data).toHaveProperty('registered', true);
      expect(verifyResponse.body.data).toHaveProperty('user');
      expect(verifyResponse.body.data.user.email).toBe(userData.email);
      expect(verifyResponse.body.data.user.role).toBe(userData.role);
      expect(verifyResponse.body.data).toHaveProperty('accessToken');
      expect(verifyResponse.body.data).toHaveProperty('refreshToken');

      accessToken = verifyResponse.body.data.accessToken;
      refreshToken = verifyResponse.body.data.refreshToken;
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testEmail,
        password: testPassword
      };

      const response = await request(app)
        .post('/api/auth/login/email')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // Update tokens
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(typeof response.body.data.accessToken).toBe('string');
      expect(response.body.data.accessToken.length).toBeGreaterThan(20);

      // Update access token
      accessToken = response.body.data.accessToken;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testEmail);
    });

    it('should reject protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: testEmail,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register/guest')
        .send({
          email: testEmail,
          password: testPassword,
          role: 'caregiver'
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register/guest')
        .send({
          email: 'invalid-email',
          password: testPassword,
          role: 'caregiver'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register/guest')
        .send({
          email: 'weak-password@example.com',
          password: '123',
          role: 'caregiver'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal auth requests', async () => {
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: testEmail,
          password: testPassword
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
