import { jest } from '@jest/globals';

const fakeClient = {
  query: jest.fn(),
};

await jest.unstable_mockModule('../../utils/db.js', () => ({
  transaction: async (cb) => cb(fakeClient),
  query: jest.fn(),
}));

await jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../models/Job.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

const jobService = await import('../jobService.js');
const { default: User } = await import('../../models/User.js');
const { default: Job } = await import('../../models/Job.js');

describe('jobService money flow', () => {
  beforeEach(() => {
    fakeClient.query.mockReset();
    User.findById.mockReset();
    Job.findById.mockReset();
  });

  test('acceptJob moves funds to escrow without increasing hirer held_balance', async () => {
    User.findById.mockResolvedValue({
      id: 'caregiver-1',
      role: 'caregiver',
      status: 'active',
      trust_level: 'L2',
    });

    fakeClient.query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM job_posts') && String(sql).includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'jobpost-1',
              hirer_id: 'hirer-1',
              status: 'posted',
              min_trust_level: 'L1',
              total_amount: '1000',
              platform_fee_amount: '100',
            },
          ],
        };
      }
      if (String(sql).includes("SELECT * FROM wallets WHERE user_id") && String(sql).includes("wallet_type = 'hirer'")) {
        return { rows: [{ id: 'wallet-hirer-1', available_balance: '2000', held_balance: '0' }] };
      }
      if (String(sql).includes('UPDATE job_posts') && String(sql).includes("status = 'posted'") && String(sql).includes('RETURNING')) {
        return { rows: [{ id: 'jobpost-1' }] };
      }
      return { rows: [] };
    });

    await jobService.acceptJob('jobpost-1', 'caregiver-1');

    const updateWalletCalls = fakeClient.query.mock.calls.filter(([sql]) =>
      String(sql).includes('UPDATE wallets')
    );
    const updateHirerWalletCall = updateWalletCalls.find(([sql]) =>
      String(sql).includes('WHERE id = $2') && String(sql).includes('available_balance = available_balance - $1')
    );

    expect(updateHirerWalletCall).toBeTruthy();
    expect(String(updateHirerWalletCall[0])).not.toContain('held_balance = held_balance + $1');
  });

  test('checkOut throws if escrow held_balance is insufficient', async () => {
    fakeClient.query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM jobs j') && String(sql).includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'job-1',
              job_post_id: 'jobpost-1',
              status: 'in_progress',
              caregiver_id: 'caregiver-1',
              total_amount: '1000',
              platform_fee_amount: '100',
            },
          ],
        };
      }
      if (String(sql).includes('UPDATE jobs') && String(sql).includes('RETURNING id')) {
        return { rows: [{ id: 'job-1' }] };
      }
      if (String(sql).includes("SELECT * FROM wallets WHERE job_id") && String(sql).includes("wallet_type = 'escrow'")) {
        return { rows: [{ id: 'wallet-escrow-1', held_balance: '50' }] };
      }
      return { rows: [] };
    });

    await expect(jobService.checkOut('job-1', 'caregiver-1', {})).rejects.toThrow(
      'Insufficient escrow balance for settlement'
    );
  });
});

