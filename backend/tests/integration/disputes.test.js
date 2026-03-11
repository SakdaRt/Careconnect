/**
 * Disputes Integration Tests
 * Tests: create -> admin list -> resolve (happy path)
 */

import request from 'supertest';
import { beforeAll, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { 
  createTestUser, 
  createTestPatientProfile,
  createTestJob,
  generateTestToken 
} from '../setup.js';

describe('Disputes Integration Tests', () => {
  let hirerToken;
  let caregiverToken;
  let adminToken;
  let hirer;
  let caregiver;
  let admin;
  let patientProfile;
  let testJob;
  let testDispute;

  beforeAll(async () => {
    hirer = await createTestUser({ role: 'hirer', email: 'hirer-dispute@example.com' });
    caregiver = await createTestUser({ role: 'caregiver', email: 'caregiver-dispute@example.com' });
    admin = await createTestUser({ role: 'admin', email: 'admin-dispute@example.com' });

    hirerToken = await generateTestToken(hirer.id);
    caregiverToken = await generateTestToken(caregiver.id);
    adminToken = await generateTestToken(admin.id);

    patientProfile = await createTestPatientProfile(hirer.id);
    testJob = await createTestJob(hirer.id, patientProfile.id, {
      title: 'Test Job for Dispute',
      status: 'assigned',
      caregiver_id: caregiver.id,
    });
  });

  describe('Tier-0 Dispute Flow', () => {
    it('should create a dispute as hirer', async () => {
      const disputeData = {
        job_id: testJob.job_id,
        reason: 'Caregiver arrived late for assigned shift'
      };

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send(disputeData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dispute');
      expect(response.body.data.dispute.job_id).toBe(testJob.job_id);
      expect(response.body.data.dispute.status).toBe('open');

      testDispute = response.body.data.dispute;
    });

    it('should allow caregiver to post a message', async () => {
      const response = await request(app)
        .post(`/api/disputes/${testDispute.id}/messages`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({ content: 'I can provide supporting details for this case.' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.message.dispute_id).toBe(testDispute.id);
    });

    it('should get dispute by job', async () => {
      const response = await request(app)
        .get(`/api/disputes/by-job/${testJob.job_id}`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dispute');
      expect(response.body.data.dispute.id).toBe(testDispute.id);
    });

    it('should get dispute details', async () => {
      const response = await request(app)
        .get(`/api/disputes/${testDispute.id}`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dispute');
      expect(response.body.data).toHaveProperty('events');
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data.dispute.id).toBe(testDispute.id);
    });

    it('should allow participant to request close', async () => {
      const response = await request(app)
        .post(`/api/disputes/${testDispute.id}/request-close`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({ reason: 'Both sides have shared context, request review.' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('ok', true);
    });
  });

  describe('Admin Dispute Management', () => {
    it('should list disputes for admin', async () => {
      const response = await request(app)
        .get('/api/admin/disputes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('data');
      expect(Array.isArray(response.body.data.data)).toBe(true);

      const found = response.body.data.data.find((item) => item.id === testDispute.id);
      expect(found).toBeDefined();
    });

    it('should get dispute details for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/disputes/${testDispute.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dispute');
      expect(response.body.data.dispute.id).toBe(testDispute.id);
    });

    it('should allow admin to update dispute status and assignment', async () => {
      const response = await request(app)
        .post(`/api/admin/disputes/${testDispute.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'in_review',
          assign_to_me: true,
          note: 'Investigating details from both parties.'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dispute');
      expect(response.body.data.dispute.status).toBe('in_review');
    });

    it('should allow admin to mark dispute as resolved', async () => {
      const response = await request(app)
        .post(`/api/admin/disputes/${testDispute.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dispute');
      expect(response.body.data.dispute.status).toBe('resolved');
    });
  });

  describe('Authorization and Validation', () => {
    it('should reject dispute creation without authentication', async () => {
      const response = await request(app)
        .post('/api/disputes')
        .send({
          job_id: testJob.job_id,
          reason: 'Unauthorized dispute request'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject dispute creation for non-existent job', async () => {
      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: '00000000-0000-0000-0000-000000000000',
          reason: 'Invalid job dispute'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate dispute for same job', async () => {
      const firstResponse = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: testJob.job_id,
          reason: 'First dispute for duplicate check'
        })
        .expect(200);

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: testJob.job_id,
          reason: 'Duplicate dispute'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(firstResponse.body).toHaveProperty('success', true);
      expect(response.body.data.dispute.id).toBe(firstResponse.body.data.dispute.id);
    });

    it('should reject dispute creation without reason', async () => {
      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: testJob.job_id
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject dispute access by non-participant', async () => {
      const outsider = await createTestUser({ role: 'caregiver', email: 'outsider-dispute@example.com' });
      const outsiderToken = await generateTestToken(outsider.id);

      const response = await request(app)
        .get(`/api/disputes/${testDispute.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject admin endpoints for non-admin', async () => {
      const response = await request(app)
        .get('/api/admin/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });
  });
});
