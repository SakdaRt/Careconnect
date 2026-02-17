import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const getHirerJobsMock = jest.fn((req, res) => {
  res.status(200).json({ success: true, query: req.query });
});

const getCaregiverJobsMock = jest.fn((req, res) => {
  res.status(200).json({ success: true, query: req.query });
});

await jest.unstable_mockModule('../../controllers/jobController.js', () => ({
  getJobStats: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getJobFeed: jest.fn((_req, res) => res.status(200).json({ success: true })),
  getHirerJobs: getHirerJobsMock,
  getCaregiverJobs: getCaregiverJobsMock,
  getJobById: jest.fn((_req, res) => res.status(200).json({ success: true })),
  createJob: jest.fn((_req, res) => res.status(200).json({ success: true })),
  publishJob: jest.fn((_req, res) => res.status(200).json({ success: true })),
  acceptJob: jest.fn((_req, res) => res.status(200).json({ success: true })),
  rejectAssignedJob: jest.fn((_req, res) => res.status(200).json({ success: true })),
  checkIn: jest.fn((_req, res) => res.status(200).json({ success: true })),
  checkOut: jest.fn((_req, res) => res.status(200).json({ success: true })),
  cancelJob: jest.fn((_req, res) => res.status(200).json({ success: true })),
}));

await jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
  requirePolicy: () => (_req, _res, next) => next(),
}));

const { default: jobRoutes } = await import('../jobRoutes.js');

describe('jobRoutes status query validation', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', jobRoutes);

  beforeEach(() => {
    getHirerJobsMock.mockClear();
    getCaregiverJobsMock.mockClear();
  });

  test('passes status query to /my-jobs controller', async () => {
    const response = await request(app).get('/api/jobs/my-jobs?status=completed&page=1&limit=20');

    expect(response.status).toBe(200);
    expect(response.body.query.status).toBe('completed');
    expect(getHirerJobsMock).toHaveBeenCalledTimes(1);
  });

  test('passes status query to /assigned controller', async () => {
    const response = await request(app).get('/api/jobs/assigned?status=cancelled&page=1&limit=20');

    expect(response.status).toBe(200);
    expect(response.body.query.status).toBe('cancelled');
    expect(getCaregiverJobsMock).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid status query', async () => {
    const response = await request(app).get('/api/jobs/my-jobs?status=invalid_status');

    expect(response.status).toBe(400);
    expect(getHirerJobsMock).not.toHaveBeenCalled();
  });
});
