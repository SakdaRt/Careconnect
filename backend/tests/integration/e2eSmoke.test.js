import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/server.js';
import { pool } from '../../src/utils/db.js';
import {
  createTestUser,
  createTestWallet,
  createTestPatientProfile,
  createTestJob,
  generateTestToken,
} from '../setup.js';

const uniqueEmail = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;

describe('E2E Smoke Integration Tests', () => {
  it('should complete register -> login -> refresh -> me flow', async () => {
    const email = uniqueEmail('e2e-auth');
    const password = 'TestPassword123!';

    // Step 1: Register (sends OTP, returns otp_id)
    const registerResponse = await request(app)
      .post('/api/auth/register/guest')
      .send({ email, password, role: 'caregiver' })
      .expect(200);

    expect(registerResponse.body).toHaveProperty('success', true);
    expect(registerResponse.body.data).toHaveProperty('otp_id');

    // Step 2: Verify OTP (creates user, returns tokens)
    const verifyResponse = await request(app)
      .post('/api/otp/verify')
      .send({ otp_id: registerResponse.body.data.otp_id, code: registerResponse.body.data._dev_code })
      .expect(200);

    expect(verifyResponse.body).toHaveProperty('success', true);
    expect(verifyResponse.body.data).toHaveProperty('registered', true);
    expect(verifyResponse.body.data.user.email).toBe(email);

    // Step 3: Login with created account
    const loginResponse = await request(app)
      .post('/api/auth/login/email')
      .send({ email, password })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body.data).toHaveProperty('accessToken');

    // Step 4: Refresh token
    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginResponse.body.data.refreshToken })
      .expect(200);

    expect(refreshResponse.body).toHaveProperty('success', true);
    expect(refreshResponse.body.data).toHaveProperty('accessToken');

    // Step 5: Access /me
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshResponse.body.data.accessToken}`)
      .expect(200);

    expect(meResponse.body).toHaveProperty('success', true);
    expect(meResponse.body.data.user.email).toBe(email);
  });

  it('should complete create -> publish -> accept -> checkin -> checkout job flow', async () => {
    const hirer = await createTestUser({ role: 'hirer', email: uniqueEmail('e2e-hirer') });
    const caregiver = await createTestUser({ role: 'caregiver', email: uniqueEmail('e2e-caregiver'), trust_level: 'L2' });

    await createTestWallet(hirer.id, 200000);

    const hirerToken = await generateTestToken(hirer.id);
    const caregiverToken = await generateTestToken(caregiver.id);

    const patientProfile = await createTestPatientProfile(hirer.id, {
      patient_display_name: 'E2E Patient',
      mobility_level: 'independent',
      communication_style: 'verbal',
    });

    const start = new Date(Date.now() + (6 * 60 * 60 * 1000));
    const end = new Date(Date.now() + (10 * 60 * 60 * 1000));

    const createResponse = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${hirerToken}`)
      .send({
        title: 'E2E Companionship Job',
        description: 'E2E smoke flow for full job lifecycle',
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
        precautions_flags: [],
      })
      .expect(201);

    expect(createResponse.body).toHaveProperty('success', true);
    const jobPostId = createResponse.body.data.job.id;

    const publishResponse = await request(app)
      .post(`/api/jobs/${jobPostId}/publish`)
      .set('Authorization', `Bearer ${hirerToken}`)
      .expect(200);

    expect(publishResponse.body).toHaveProperty('success', true);
    expect(publishResponse.body.data.job.status).toBe('posted');

    const feedResponse = await request(app)
      .get('/api/jobs/feed')
      .set('Authorization', `Bearer ${caregiverToken}`)
      .expect(200);

    expect(feedResponse.body).toHaveProperty('success', true);
    const inFeed = feedResponse.body.data.data.find((job) => job.id === jobPostId);
    expect(inFeed).toBeDefined();

    const acceptResponse = await request(app)
      .post(`/api/jobs/${jobPostId}/accept`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({})
      .expect(200);

    expect(acceptResponse.body).toHaveProperty('success', true);
    const jobInstanceId = acceptResponse.body.data.job_id;

    const checkinResponse = await request(app)
      .post(`/api/jobs/${jobInstanceId}/checkin`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        lat: 13.7563,
        lng: 100.5018,
        accuracy_m: 10,
      })
      .expect(200);

    expect(checkinResponse.body).toHaveProperty('success', true);
    expect(['assigned', 'in_progress']).toContain(checkinResponse.body.data.job.status);

    const checkoutResponse = await request(app)
      .post(`/api/jobs/${jobInstanceId}/checkout`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        lat: 13.7563,
        lng: 100.5018,
        accuracy_m: 10,
        evidence_note: 'E2E smoke checkout completed',
        evidence_photo_url: '/uploads/jobs/test-evidence.jpg',
      })
      .expect(200);

    expect(checkoutResponse.body).toHaveProperty('success', true);
  });

  it('should complete topup pending -> confirm -> status flow with mock provider intent', async () => {
    const user = await createTestUser({ role: 'hirer', email: uniqueEmail('e2e-topup') });
    await createTestWallet(user.id, 1000);
    const token = await generateTestToken(user.id);

    const topupId = uuidv4();
    const topupAmount = 2500;

    await pool.query(
      `INSERT INTO topup_intents (
         id,
         user_id,
         amount,
         currency,
         method,
         provider_name,
         provider_payment_id,
         status,
         payment_link_url,
         expires_at,
         created_at,
         updated_at
       ) VALUES (
         $1,
         $2,
         $3,
         'THB',
         'payment_link',
         'mock',
         $4,
         'pending',
         $5,
         NOW() + INTERVAL '30 minutes',
         NOW(),
         NOW()
       )`,
      [topupId, user.id, topupAmount, `mock-payment-${topupId}`, `https://mock.local/topup/${topupId}`]
    );

    const pendingResponse = await request(app)
      .get('/api/wallet/topup/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(pendingResponse.body).toHaveProperty('success', true);
    expect(Array.isArray(pendingResponse.body.data)).toBe(true);
    const pendingTopup = pendingResponse.body.data.find((item) => item.id === topupId);
    expect(pendingTopup).toBeDefined();

    const confirmResponse = await request(app)
      .post(`/api/wallet/topup/${topupId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(confirmResponse.body).toHaveProperty('success', true);
    expect(confirmResponse.body.topup.status).toBe('succeeded');

    const statusResponse = await request(app)
      .get(`/api/wallet/topup/${topupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body).toHaveProperty('success', true);
    expect(statusResponse.body.topup.status).toBe('succeeded');

    const balanceResponse = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(balanceResponse.body).toHaveProperty('success', true);
    expect(balanceResponse.body.available_balance).toBe(1000 + topupAmount);
  });

  it('should complete dispute open -> message -> admin review flow', async () => {
    const hirer = await createTestUser({ role: 'hirer', email: uniqueEmail('e2e-dispute-hirer') });
    const caregiver = await createTestUser({ role: 'caregiver', email: uniqueEmail('e2e-dispute-caregiver'), trust_level: 'L2' });
    const admin = await createTestUser({ role: 'admin', email: uniqueEmail('e2e-dispute-admin') });

    const hirerToken = await generateTestToken(hirer.id);
    const caregiverToken = await generateTestToken(caregiver.id);
    const adminToken = await generateTestToken(admin.id);

    const patientProfile = await createTestPatientProfile(hirer.id, {
      patient_display_name: 'E2E Dispute Patient',
    });

    const assignedJob = await createTestJob(hirer.id, patientProfile.id, {
      title: 'E2E Dispute Job',
      status: 'assigned',
      caregiver_id: caregiver.id,
    });

    const createDisputeResponse = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${hirerToken}`)
      .send({
        job_id: assignedJob.job_id,
        reason: 'Caregiver arrived late in smoke flow',
      })
      .expect(200);

    expect(createDisputeResponse.body).toHaveProperty('success', true);
    const disputeId = createDisputeResponse.body.data.dispute.id;

    const messageResponse = await request(app)
      .post(`/api/disputes/${disputeId}/messages`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        content: 'Acknowledged, sharing details in smoke flow',
      })
      .expect(200);

    expect(messageResponse.body).toHaveProperty('success', true);

    const byJobResponse = await request(app)
      .get(`/api/disputes/by-job/${assignedJob.job_id}`)
      .set('Authorization', `Bearer ${hirerToken}`)
      .expect(200);

    expect(byJobResponse.body).toHaveProperty('success', true);
    expect(byJobResponse.body.data.dispute.id).toBe(disputeId);

    const adminReviewResponse = await request(app)
      .post(`/api/admin/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'in_review',
        assign_to_me: true,
        note: 'Smoke review started',
      })
      .expect(200);

    expect(adminReviewResponse.body).toHaveProperty('success', true);
    expect(adminReviewResponse.body.data.dispute.status).toBe('in_review');
  });
});
