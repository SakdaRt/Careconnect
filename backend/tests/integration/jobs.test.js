/**
 * Jobs Integration Tests
 * Tests: create job (hirer) -> list jobs -> assign caregiver -> status transition basic flow
 */

import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import app from '../../src/server.js';
import { 
  createTestUser, 
  createTestPatientProfile,
  createTestJob,
  generateTestToken 
} from '../setup.js';

describe('Jobs Integration Tests', () => {
  let server;
  let hirerToken;
  let caregiverToken;
  let hirer;
  let caregiver;
  let patientProfile;
  let testJob;

  beforeAll(async () => {
    server = app.listen(0);
    
    // Create test users
    hirer = await createTestUser({ role: 'hirer', email: 'hirer-jobs@example.com' });
    caregiver = await createTestUser({ role: 'caregiver', email: 'caregiver-jobs@example.com' });
    
    // Generate tokens
    hirerToken = await generateTestToken(hirer.id);
    caregiverToken = await generateTestToken(caregiver.id);
    
    // Create patient profile for hirer
    patientProfile = await createTestPatientProfile(hirer.id, {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1980-05-15'
    });
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Tier-0 Job Flow', () => {
    it('should create a new job as hirer', async () => {
      const jobData = {
        patient_id: patientProfile.id,
        title: 'Companionship Care Needed',
        description: 'Need companionship care for elderly patient',
        job_type: 'companionship',
        hourly_rate: 25.00,
        estimated_duration_hours: 4,
        location_address: '123 Main St, City, State',
        special_requirements: 'Patient prefers quiet environment'
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job.title).toBe(jobData.title);
      expect(response.body.job.status).toBe('draft');
      expect(response.body.job.hirer_id).toBe(hirer.id);
      expect(response.body.job.patient_id).toBe(patientProfile.id);

      testJob = response.body.job;
    });

    it('should list jobs for caregiver', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(response.body.jobs.length).toBeGreaterThan(0);
      
      // Should find our created job
      const createdJob = response.body.jobs.find(job => job.id === testJob.id);
      expect(createdJob).toBeDefined();
      expect(createdJob.title).toBe(testJob.title);
    });

    it('should post job to make it visible', async () => {
      const response = await request(app)
        .patch(`/api/jobs/${testJob.id}/post`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job.status).toBe('posted');
    });

    it('should assign caregiver to job', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJob.id}/assign`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('assignment');
      expect(response.body.assignment.caregiver_id).toBe(caregiver.id);
      expect(response.body.assignment.status).toBe('active');
    });

    it('should start job (in_progress status)', async () => {
      const response = await request(app)
        .patch(`/api/jobs/${testJob.id}/start`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job.status).toBe('in_progress');
    });

    it('should complete job', async () => {
      const completionData = {
        notes: 'Job completed successfully',
        actual_end_time: new Date().toISOString()
      };

      const response = await request(app)
        .patch(`/api/jobs/${testJob.id}/complete`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job.status).toBe('completed');
    });

    it('should get job details', async () => {
      const response = await request(app)
        .get(`/api/jobs/${testJob.id}`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job.id).toBe(testJob.id);
      expect(response.body.job.status).toBe('completed');
    });

    it('should list hirer\'s jobs', async () => {
      const response = await request(app)
        .get('/api/jobs/my-jobs')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(Array.isArray(response.body.jobs)).toBe(true);
      
      const myJob = response.body.jobs.find(job => job.id === testJob.id);
      expect(myJob).toBeDefined();
    });

    it('should list caregiver\'s assigned jobs', async () => {
      const response = await request(app)
        .get('/api/jobs/my-assignments')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(Array.isArray(response.body.jobs)).toBe(true);
      
      const assignedJob = response.body.jobs.find(job => job.id === testJob.id);
      expect(assignedJob).toBeDefined();
    });
  });

  describe('Job Status Transitions', () => {
    let transitionJob;

    beforeAll(async () => {
      // Create a job for transition tests
      transitionJob = await createTestJob(hirer.id, patientProfile.id, {
        title: 'Transition Test Job',
        status: 'draft'
      });
    });

    it('should follow valid status transition: draft -> posted', async () => {
      const response = await request(app)
        .patch(`/api/jobs/${transitionJob.id}/post`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(200);

      expect(response.body.job.status).toBe('posted');
    });

    it('should follow valid status transition: posted -> assigned', async () => {
      const response = await request(app)
        .post(`/api/jobs/${transitionJob.id}/assign`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({})
        .expect(200);

      expect(response.body.assignment.status).toBe('active');
    });

    it('should follow valid status transition: assigned -> in_progress', async () => {
      const response = await request(app)
        .patch(`/api/jobs/${transitionJob.id}/start`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body.job.status).toBe('in_progress');
    });

    it('should follow valid status transition: in_progress -> completed', async () => {
      const response = await request(app)
        .patch(`/api/jobs/${transitionJob.id}/complete`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({ notes: 'Test completion' })
        .expect(200);

      expect(response.body.job.status).toBe('completed');
    });

    it('should allow cancelling a posted job', async () => {
      const cancelJob = await createTestJob(hirer.id, patientProfile.id, {
        title: 'Cancel Test Job',
        status: 'posted'
      });

      const response = await request(app)
        .patch(`/api/jobs/${cancelJob.id}/cancel`)
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({ reason: 'No longer needed' })
        .expect(200);

      expect(response.body.job.status).toBe('cancelled');
    });
  });

  describe('Authorization and Validation', () => {
    it('should reject job creation without authentication', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          patient_id: patientProfile.id,
          title: 'Unauthorized Job',
          description: 'Should not be created'
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject job creation by caregiver', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          patient_id: patientProfile.id,
          title: 'Unauthorized Job',
          description: 'Should not be created'
        })
        .expect(403);

      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should reject invalid job data', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${hirerToken}`)
        .send({
          // Missing required fields
          title: 'Incomplete Job'
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject access to non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${hirerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  describe('Job Filtering and Search', () => {
    it('should filter jobs by status', async () => {
      const response = await request(app)
        .get('/api/jobs?status=completed')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(Array.isArray(response.body.jobs)).toBe(true);
      
      // All returned jobs should have status 'completed'
      response.body.jobs.forEach(job => {
        expect(['completed']).toContain(job.status);
      });
    });

    it('should filter jobs by job type', async () => {
      const response = await request(app)
        .get('/api/jobs?job_type=companionship')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(Array.isArray(response.body.jobs)).toBe(true);
      
      // All returned jobs should have job_type 'companionship'
      response.body.jobs.forEach(job => {
        expect(job.job_type).toBe('companionship');
      });
    });
  });
});
