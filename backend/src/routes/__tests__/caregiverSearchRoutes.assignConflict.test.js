import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: queryMock,
}));

await jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: '11111111-1111-4111-8111-111111111111' };
    next();
  },
  requirePolicy: () => (_req, _res, next) => next(),
}));

const { default: caregiverSearchRoutes } = await import('../caregiverSearchRoutes.js');

describe('caregiverSearchRoutes assignment conflict validation', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/caregivers', caregiverSearchRoutes);

  beforeEach(() => {
    queryMock.mockReset();
  });

  test('rejects assignment when caregiver has overlapping assigned/in-progress job', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          status: 'posted',
          hirer_id: '11111111-1111-4111-8111-111111111111',
          scheduled_start_at: '2026-02-20T09:00:00.000Z',
          scheduled_end_at: '2026-02-20T12:00:00.000Z',
          job_id: null,
          job_status: null,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: '22222222-2222-4222-8222-222222222222',
          role: 'caregiver',
          status: 'active',
          trust_level: 'L1',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'conflict-job' }] });

    const response = await request(app)
      .post('/api/caregivers/assign')
      .send({
        job_post_id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        caregiver_id: '22222222-2222-4222-8222-222222222222',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch('ช่วงเวลาเดียวกัน');
  });

  test('allows assignment when no overlap exists', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          status: 'posted',
          hirer_id: '11111111-1111-4111-8111-111111111111',
          scheduled_start_at: '2026-02-20T13:00:00.000Z',
          scheduled_end_at: '2026-02-20T16:00:00.000Z',
          job_id: null,
          job_status: null,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: '22222222-2222-4222-8222-222222222222',
          role: 'caregiver',
          status: 'active',
          trust_level: 'L1',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/caregivers/assign')
      .send({
        job_post_id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        caregiver_id: '22222222-2222-4222-8222-222222222222',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('มอบหมายผู้ดูแลสำเร็จ');
  });
});
