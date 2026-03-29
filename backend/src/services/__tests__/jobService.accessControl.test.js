import { jest } from '@jest/globals';

const fakeClient = {
  query: jest.fn(),
};

const mockQuery = jest.fn();
const mockTransaction = jest.fn(async (cb) => cb(fakeClient));

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

await jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../models/Job.js', () => ({
  default: {
    getJobFeed: jest.fn(),
    getJobWithDetails: jest.fn(),
  },
}));

await jest.unstable_mockModule('../notificationService.js', () => ({
  notifyJobAccepted: jest.fn(),
  notifyCheckIn: jest.fn(),
  notifyCheckOut: jest.fn(),
  notifyJobCancelled: jest.fn(),
  notifyNoShow: jest.fn(),
}));

const jobService = await import('../jobService.js');
const { default: User } = await import('../../models/User.js');
const { default: Job } = await import('../../models/Job.js');

describe('jobService access control + chat lock', () => {
  beforeEach(() => {
    fakeClient.query.mockReset();
    mockQuery.mockReset();
    mockTransaction.mockClear();
    User.findById.mockReset();
    Job.getJobFeed.mockReset();
    Job.getJobWithDetails.mockReset();
  });

  test('getJobFeed hides jobs created by the same user id', async () => {
    User.findById.mockResolvedValue({
      id: 'shared-user',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L1',
    });

    Job.getJobFeed.mockResolvedValue({
      data: [
        {
          id: 'job-own',
          hirer_id: 'shared-user',
          min_trust_level: 'L1',
          preferred_caregiver_id: null,
        },
        {
          id: 'job-other',
          hirer_id: 'hirer-2',
          min_trust_level: 'L1',
          preferred_caregiver_id: null,
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await jobService.getJobFeed('shared-user', { page: 1, limit: 20 });

    expect(Job.getJobFeed).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      limit: 20,
      exclude_hirer_id: 'shared-user',
    }));
    expect(result.data.map((job) => job.id)).toEqual(['job-other']);
    expect(result.total).toBe(1);
    expect(result.data[0].eligible).toBe(true);
  });

  test('acceptJob rejects when caregiver tries to accept own post', async () => {
    User.findById.mockResolvedValue({
      id: 'shared-user',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L2',
    });

    fakeClient.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('FROM job_posts') && text.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'job-own',
              status: 'posted',
              hirer_id: 'shared-user',
              min_trust_level: 'L1',
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(jobService.acceptJob('job-own', 'shared-user')).rejects.toThrow(
      'Not authorized to accept your own job post'
    );

    const updateJobPostCall = fakeClient.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE job_posts')
    );
    expect(updateJobPostCall).toBeUndefined();
  });

  test('acceptJob rejects when score < 20 (full ban)', async () => {
    User.findById.mockResolvedValue({
      id: 'cg-1',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L2',
      trust_score: 15,
    });

    fakeClient.query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM job_posts') && String(sql).includes('FOR UPDATE')) {
        return { rows: [{ id: 'job-1', status: 'posted', hirer_id: 'hirer-1', min_trust_level: 'L1', risk_level: 'low_risk' }] };
      }
      return { rows: [] };
    });

    await expect(jobService.acceptJob('job-1', 'cg-1')).rejects.toMatchObject({
      code: 'TRUST_SCORE_TOO_LOW',
    });
  });

  test('acceptJob rejects when score < 40 and job is high_risk', async () => {
    User.findById.mockResolvedValue({
      id: 'cg-1',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L2',
      trust_score: 35,
    });

    fakeClient.query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM job_posts') && String(sql).includes('FOR UPDATE')) {
        return { rows: [{ id: 'job-1', status: 'posted', hirer_id: 'hirer-1', min_trust_level: 'L2', risk_level: 'high_risk' }] };
      }
      return { rows: [] };
    });

    await expect(jobService.acceptJob('job-1', 'cg-1')).rejects.toMatchObject({
      code: 'TRUST_SCORE_TOO_LOW_HIGH_RISK',
    });
  });

  test('acceptJob allows score < 40 on low_risk job', async () => {
    User.findById.mockResolvedValue({
      id: 'cg-1',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L1',
      trust_score: 35,
    });

    fakeClient.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('FROM job_posts') && text.includes('FOR UPDATE')) {
        return { rows: [{ id: 'job-1', status: 'posted', hirer_id: 'hirer-1', min_trust_level: 'L1', risk_level: 'low_risk', required_certifications: [], preferred_caregiver_id: null, total_amount: 1000, hirer_deposit_amount: 0 }] };
      }
      if (text.includes('NOT (')) return { rows: [] };
      if (text.includes('FROM wallets') && text.includes("'hirer'")) {
        return { rows: [{ id: 'hw-1', available_balance: 5000, held_balance: 0 }] };
      }
      if (text.includes('UPDATE job_posts') && text.includes('RETURNING id')) return { rows: [{ id: 'job-1' }] };
      return { rows: [] };
    });

    await expect(jobService.acceptJob('job-1', 'cg-1')).resolves.toBeDefined();
  });

  test('acceptJob allows score >= 40 on high_risk job', async () => {
    User.findById.mockResolvedValue({
      id: 'cg-1',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L2',
      trust_score: 50,
    });

    fakeClient.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('FROM job_posts') && text.includes('FOR UPDATE')) {
        return { rows: [{ id: 'job-1', status: 'posted', hirer_id: 'hirer-1', min_trust_level: 'L2', risk_level: 'high_risk', required_certifications: [], preferred_caregiver_id: null, total_amount: 1000, hirer_deposit_amount: 0 }] };
      }
      if (text.includes('FROM caregiver_documents')) return { rows: [{ count: 1 }] };
      if (text.includes('FROM caregiver_profiles')) return { rows: [{ certifications: [] }] };
      if (text.includes('NOT (')) return { rows: [] };
      if (text.includes('FROM wallets') && text.includes("'hirer'")) {
        return { rows: [{ id: 'hw-1', available_balance: 5000, held_balance: 0 }] };
      }
      if (text.includes('UPDATE job_posts') && text.includes('RETURNING id')) return { rows: [{ id: 'job-1' }] };
      return { rows: [] };
    });

    await expect(jobService.acceptJob('job-1', 'cg-1')).resolves.toBeDefined();
  });

  test('checkIn rejects high_risk job when score < 40', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('jp.risk_level')) {
        return { rows: [{ risk_level: 'high_risk', trust_score: 30 }] };
      }
      return { rows: [] };
    });

    await expect(jobService.checkIn('job-1', 'cg-1', {})).rejects.toMatchObject({
      code: 'TRUST_SCORE_TOO_LOW_HIGH_RISK',
    });
  });

  test('checkIn allows high_risk job when score >= 40', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('jp.risk_level')) {
        return { rows: [{ risk_level: 'high_risk', trust_score: 40 }] };
      }
      return { rows: [] };
    });

    Job.checkIn = jest.fn().mockResolvedValue({ id: 'job-1', status: 'in_progress' });

    await expect(jobService.checkIn('job-1', 'cg-1', {})).resolves.toBeDefined();
  });

  test('checkIn allows low_risk job when score < 40', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('jp.risk_level')) {
        return { rows: [{ risk_level: 'low_risk', trust_score: 25 }] };
      }
      return { rows: [] };
    });

    Job.checkIn = jest.fn().mockResolvedValue({ id: 'job-1', status: 'in_progress' });

    await expect(jobService.checkIn('job-1', 'cg-1', {})).resolves.toBeDefined();
  });

  test('cancelJob closes chat thread so no more messages can be sent', async () => {
    Job.getJobWithDetails.mockResolvedValue({
      id: 'job-post-1',
      job_id: 'job-1',
      status: 'assigned',
      job_status: 'assigned',
      hirer_id: 'hirer-1',
      caregiver_id: 'caregiver-1',
      total_amount: '1000',
      platform_fee_amount: '100',
    });

    fakeClient.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes("SELECT * FROM wallets WHERE job_id") && text.includes("wallet_type = 'escrow'")) {
        return { rows: [] };
      }
      if (text.includes('SELECT id FROM chat_threads WHERE job_id = $1 LIMIT 1')) {
        return { rows: [{ id: 'thread-1' }] };
      }
      return { rows: [] };
    });

    const result = await jobService.cancelJob('job-post-1', 'hirer-1', 'No longer needed');

    expect(result.status).toBe('cancelled');
    const closeThreadCall = fakeClient.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE chat_threads') && String(sql).includes("status = 'closed'")
    );
    expect(closeThreadCall).toBeTruthy();
    expect(closeThreadCall[1]).toEqual(['thread-1']);
  });
});
