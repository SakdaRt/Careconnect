/**
 * Auth Integration Tests
 * Tests: register -> login -> refresh -> access protected route
 */

import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { 
  createTestUser, 
  generateTestToken, 
  generateRefreshToken 
} from '../setup.js';

describe('Auth Integration Tests', () => {
  let server;
  let testUser;
  let accessToken;
  let refreshToken;

  beforeAll(async () => {
    // Start server for integration tests
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Tier-0 Auth Flow', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'integration-test@example.com',
        password: 'TestPassword123!',
        role: 'caregiver'
      };

      const response = await request(app)
        .post('/api/auth/register/guest')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe(userData.role);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      // Store tokens for subsequent tests
      accessToken = response.body.tokens.accessToken;
      refreshToken = response.body.tokens.refreshToken;
      testUser = response.body.user;
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'integration-test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      // Update tokens
      accessToken = response.body.tokens.accessToken;
      refreshToken = response.body.tokens.refreshToken;
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).not.toBe(accessToken);

      // Update access token
      accessToken = response.body.accessToken;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('integration-test@example.com');
    });

    it('should reject protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration-test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register/guest')
        .send({
          email: 'integration-test@example.com',
          password: 'TestPassword123!',
          role: 'caregiver'
        })
        .expect(409);

      expect(response.body).toHaveProperty('code', 'CONFLICT');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register/guest')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
          role: 'caregiver'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
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

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal auth requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration-test@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
    });
  });
});
