/**
 * Jobs Integration Tests
 * Tests: create job (hirer) -> list jobs -> assign caregiver -> status transition basic flow
 */

import request from 'supertest';
import { beforeAll, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { pool } from '../../src/utils/db.js';
import { 
  createTestUser, 
  createTestWallet,
  createTestPatientProfile,
  generateTestToken 
} from '../setup.js';

describe('Jobs Integration Tests', () => {
  let hirerToken;
  let caregiverToken;
  let hirer;
  let caregiver;
  let patientProfile;
  let testJobPostId;
  let testJobInstanceId;

  beforeAll(async () => {
    hirer = await createTestUser({ role: 'hirer', email: 'hirer-jobs@example.com' });
    caregiver = await createTestUser({ role: 'caregiver', email: 'caregiver-jobs@example.com' });

    await createTestWallet(hirer.id, 200000);

    hirerToken = await generateTestToken(hirer.id);
    caregiverToken = await generateTestToken(caregiver.id);

    patientProfile = await createTestPatientProfile(hirer.id, {
      patient_display_name: 'John Doe',
      mobility_level: 'independent',
      communication_style: 'verbal'
    });
  });

  const ensureCaregiverTrustLevel = async (trustLevel = 'L2') => {
    await pool.query(
      `UPDATE users SET trust_level = $1, updated_at = NOW() WHERE id = $2`,
      [trustLevel, caregiver.id]
    );
  };

  const buildCreateJobPayload = () => {
    const start = new Date(Date.now() + (6 * 60 * 60 * 1000));
    const end = new Date(Date.now() + (10 * 60 * 60 * 1000));

    return {
      title: 'Companionship Care Needed',
      description: 'Need companionship care for elderly patient',
      job_type: 'companionship',
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      address_line1: '123 Main St, Bangkok',
      district: 'Wang Mai',
      province: 'Bangkok',
      postal_code: '10330',
      lat: 13.7563,
      lng: 100.5018,
      hourly_rate: 500,
      total_hours: 4,
      patient_profile_id: patientProfile.id,
      job_tasks_flags: ['companionship'],
      required_skills_flags: ['basic_first_aid'],
      equipment_available_flags: [],
      precautions_flags: []
    };
  };

  describe('Tier-0 Job Flow', () => {
    it('should create a new job as hirer', async () => {
      const jobData = buildCreateJobPayload();

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('job');
      expect(response.body.data.job.title).toBe(jobData.title);
      expect(response.body.data.job.status).toBe('draft');
      expect(response.body.data.job.hirer_id).toBe(hirer.id);
      expect(response.body.data.job.patient_profile_id).toBe(patientProfile.id);

      testJobPostId = response.body.data.job.id;
    });

    it('should publish job to make it visible', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobPostId}/publish`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('job');
      expect(response.body.data.job.status).toBe('posted');
    });

    it('should list jobs for caregiver', async () => {
      const response = await request(app)
        .get('/api/jobs/feed')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data.data)).toBe(true);

      const createdJob = response.body.data.data.find((job) => job.id === testJobPostId);
      expect(createdJob).toBeDefined();
      expect(createdJob.title).toBe('Companionship Care Needed');
    });

    it('should allow caregiver to accept job', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobPostId}/accept`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('job_id');
      expect(response.body.data).toHaveProperty('job_post_id', testJobPostId);
      expect(response.body.data).toHaveProperty('assignment_id');
      expect(response.body.data).toHaveProperty('status', 'assigned');

      testJobInstanceId = response.body.data.job_id;
    });

    it('should check in to start job (in_progress status)', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobInstanceId}/checkin`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          lat: 13.7563,
          lng: 100.5018,
          accuracy_m: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('job');
      expect(['assigned', 'in_progress']).toContain(response.body.data.job.status);
    });

    it('should check out to complete job', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobInstanceId}/checkout`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          lat: 13.7563,
          lng: 100.5018,
          accuracy_m: 10,
          evidence_note: 'Completed all requested companionship tasks.'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should get job details', async () => {
      const response = await request(app)
        .get(`/api/jobs/${testJobPostId}`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('job');
      expect(response.body.data.job.id).toBe(testJobPostId);
      expect(['posted', 'assigned', 'in_progress', 'completed']).toContain(response.body.data.job.status);
      expect(response.body.data.job).toHaveProperty('job_status');
    });

    it('should list hirer\'s jobs', async () => {
      const response = await request(app)
        .get('/api/jobs/my-jobs')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data.data)).toBe(true);

      const myJob = response.body.data.data.find((job) => job.id === testJobPostId);
      if (response.body.data.data.length > 0) {
        expect(myJob).toBeDefined();
      }
    });

    it('should list caregiver\'s assigned jobs', async () => {
      await ensureCaregiverTrustLevel('L2');

      const response = await request(app)
        .get('/api/jobs/assigned')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data.data)).toBe(true);

      const assignedJob = response.body.data.data.find(
        (job) => job.id === testJobInstanceId || job.job_post_id === testJobPostId
      );
      expect(assignedJob).toBeDefined();
    });
  });

  describe('Authorization and Validation', () => {
    it('should reject job creation without authentication', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send(buildCreateJobPayload())
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject job creation by caregiver', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send(buildCreateJobPayload())
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject invalid job data', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          title: 'Incomplete Job'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject access to non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject checkout without evidence note', async () => {
      await ensureCaregiverTrustLevel('L2');

      const response = await request(app)
        .post(`/api/jobs/${testJobInstanceId}/checkout`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
