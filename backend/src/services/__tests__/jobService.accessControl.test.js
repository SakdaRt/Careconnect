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
