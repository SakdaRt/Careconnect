/**
 * Disputes Integration Tests
 * Tests: create -> admin list -> resolve (happy path)
 */

import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { 
  createTestUser, 
  createTestPatientProfile,
  createTestJob,
  createTestWallet,
  generateTestToken 
} from '../setup.js';

describe('Disputes Integration Tests', () => {
  let server;
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
    server = app.listen(0);
    
    // Create test users
    hirer = await createTestUser({ role: 'hirer', email: 'hirer-dispute@example.com' });
    caregiver = await createTestUser({ role: 'caregiver', email: 'caregiver-dispute@example.com' });
    admin = await createTestUser({ role: 'admin', email: 'admin-dispute@example.com' });
    
    // Generate tokens
    hirerToken = await generateTestToken(hirer.id);
    caregiverToken = await generateTestToken(caregiver.id);
    adminToken = await generateTestToken(admin.id);
    
    // Create patient profile and job for dispute
    patientProfile = await createTestPatientProfile(hirer.id);
    testJob = await createTestJob(hirer.id, patientProfile.id, {
      title: 'Test Job for Dispute',
      status: 'completed'
    });
    
    // Create wallets for users
    await createTestWallet(hirer.id);
    await createTestWallet(caregiver.id);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Tier-0 Dispute Flow', () => {
    it('should create a dispute as hirer', async () => {
      const disputeData = {
        job_id: testJob.id,
        type: 'service_quality',
        description: 'Caregiver was late and did not complete all tasks',
        resolution_requested: 'partial_refund',
        amount: 50.00
      };

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send(disputeData)
        .expect(201);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.job_id).toBe(testJob.id);
      expect(response.body.dispute.type).toBe('service_quality');
      expect(response.body.dispute.status).toBe('pending');
      expect(response.body.dispute.hirer_id).toBe(hirer.id);
      expect(response.body.dispute.caregiver_id).toBe(caregiver.id);
      expect(response.body.dispute.amount).toBe('50.00');

      testDispute = response.body.dispute;
    });

    it('should allow caregiver to respond to dispute', async () => {
      const responseData = {
        message: 'I was only 10 minutes late due to traffic and completed all agreed tasks'
      };

      const response = await request(app)
        .post(`/api/disputes/${testDispute.id}/respond`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send(responseData)
        .expect(200);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.status).toBe('under_review');
    });

    it('should list disputes for admin', async () => {
      const response = await request(app)
        .get('/api/disputes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('disputes');
      expect(Array.isArray(response.body.disputes)).toBe(true);
      expect(response.body.disputes.length).toBeGreaterThan(0);

      // Should find our created dispute
      const createdDispute = response.body.disputes.find(
        dispute => dispute.id === testDispute.id
      );
      expect(createdDispute).toBeDefined();
      expect(createdDispute.type).toBe('service_quality');
    });

    it('should filter disputes by status', async () => {
      const response = await request(app)
        .get('/api/disputes?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('disputes');
      expect(Array.isArray(response.body.disputes)).toBe(true);

      response.body.disputes.forEach(dispute => {
        expect(['pending', 'under_review']).toContain(dispute.status);
      });
    });

    it('should get dispute details', async () => {
      const response = await request(app)
        .get(`/api/disputes/${testDispute.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.id).toBe(testDispute.id);
      expect(response.body.dispute.job).toBeDefined();
      expect(response.body.dispute.hirer).toBeDefined();
      expect(response.body.dispute.caregiver).toBeDefined();
    });

    it('should resolve dispute as admin', async () => {
      const resolutionData = {
        resolution: 'partial_refund',
        amount: 25.00,
        reason: 'Caregiver was partially at fault for delay',
        notes: 'Refunding half the requested amount as compromise'
      };

      const response = await request(app)
        .patch(`/api/disputes/${testDispute.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(resolutionData)
        .expect(200);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.status).toBe('resolved');
      expect(response.body.dispute.resolution).toBe('partial_refund');
      expect(response.body.dispute.resolved_amount).toBe('25.00');
      expect(response.body.dispute.resolved_by).toBe(admin.id);
    });

    it('should reflect resolution in dispute list', async () => {
      const response = await request(app)
        .get('/api/disputes?status=resolved')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('disputes');
      
      const resolvedDispute = response.body.disputes.find(
        dispute => dispute.id === testDispute.id
      );
      expect(resolvedDispute).toBeDefined();
      expect(resolvedDispute.status).toBe('resolved');
    });
  });

  describe('Dispute Creation and Validation', () => {
    let anotherJob;

    beforeAll(async () => {
      anotherJob = await createTestJob(hirer.id, patientProfile.id, {
        title: 'Another Test Job',
        status: 'completed'
      });
    });

    it('should create dispute as caregiver', async () => {
      const disputeData = {
        job_id: anotherJob.id,
        type: 'payment_issue',
        description: 'Payment was not processed correctly',
        resolution_requested: 'full_payment'
      };

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send(disputeData)
        .expect(201);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.type).toBe('payment_issue');
      expect(response.body.dispute.status).toBe('pending');
    });

    it('should reject dispute creation without authentication', async () => {
      const response = await request(app)
        .post('/api/disputes')
        .send({
          job_id: testJob.id,
          type: 'service_quality',
          description: 'Unauthorized dispute'
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject dispute creation for non-existent job', async () => {
      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: '00000000-0000-0000-0000-000000000000',
          type: 'service_quality',
          description: 'Invalid job dispute'
        })
        .expect(404);

      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should reject duplicate dispute for same job', async () => {
      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: testJob.id,
          type: 'service_quality',
          description: 'Duplicate dispute'
        })
        .expect(409);

      expect(response.body).toHaveProperty('code', 'CONFLICT');
    });

    it('should reject invalid dispute type', async () => {
      const newJob = await createTestJob(hirer.id, patientProfile.id, {
        title: 'Invalid Type Job',
        status: 'completed'
      });

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: newJob.id,
          type: 'invalid_type',
          description: 'Invalid dispute type'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject dispute for incomplete job', async () => {
      const incompleteJob = await createTestJob(hirer.id, patientProfile.id, {
        title: 'Incomplete Job',
        status: 'posted'
      });

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: incompleteJob.id,
          type: 'service_quality',
          description: 'Dispute for incomplete job'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Admin Dispute Management', () => {
    it('should reject dispute resolution by non-admin', async () => {
      const response = await request(app)
        .patch(`/api/disputes/${testDispute.id}/resolve`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          resolution: 'full_refund',
          amount: 50.00,
          reason: 'Unauthorized resolution'
        })
        .expect(403);

      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should reject dispute access by regular users', async () => {
      const response = await request(app)
        .get('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should allow admin to update dispute status', async () => {
      const newJob = await createTestJob(hirer.id, patientProfile.id, {
        title: 'Status Update Job',
        status: 'completed'
      });

      const newDispute = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          job_id: newJob.id,
          type: 'service_quality',
          description: 'Status update test'
        });

      const response = await request(app)
        .patch(`/api/disputes/${newDispute.body.dispute.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'investigating',
          notes: 'Starting investigation'
        })
        .expect(200);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.status).toBe('investigating');
    });

    it('should allow admin to add notes to dispute', async () => {
      const response = await request(app)
        .post(`/api/disputes/${testDispute.id}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          note: 'Follow-up required with both parties',
          internal: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('dispute');
      expect(response.body.dispute.notes).toBeDefined();
    });
  });

  describe('Dispute Statistics and Reporting', () => {
    it('should get dispute statistics for admin', async () => {
      const response = await request(app)
        .get('/api/disputes/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('total');
      expect(response.body.statistics).toHaveProperty('pending');
      expect(response.body.statistics).toHaveProperty('resolved');
      expect(response.body.statistics).toHaveProperty('by_type');
      expect(response.body.statistics).toHaveProperty('by_resolution');
    });

    it('should export disputes report for admin', async () => {
      const response = await request(app)
        .get('/api/disputes/export?format=json')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('disputes');
      expect(Array.isArray(response.body.disputes)).toBe(true);
    });
  });

  describe('User Dispute Views', () => {
    it('should allow hirer to see their disputes', async () => {
      const response = await request(app)
        .get('/api/disputes/my-disputes')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('disputes');
      expect(Array.isArray(response.body.disputes)).toBe(true);

      response.body.disputes.forEach(dispute => {
        expect(dispute.hirer_id).toBe(hirer.id);
      });
    });

    it('should allow caregiver to see their disputes', async () => {
      const response = await request(app)
        .get('/api/disputes/my-disputes')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('disputes');
      expect(Array.isArray(response.body.disputes)).toBe(true);

      response.body.disputes.forEach(dispute => {
        expect(dispute.caregiver_id).toBe(caregiver.id);
      });
    });
  });
});
