import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const { transaction } = await import('../../utils/db.js');
const jobService = await import('../jobService.js');

describe('jobService checkOut idempotency', () => {
  beforeEach(() => {
    transaction.mockReset();
  });

  test('returns already_completed when job status is completed', async () => {
    const client = {
      query: jest.fn(),
    };

    client.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'job-1',
          job_post_id: 'jp-1',
          status: 'completed',
          caregiver_id: 'cg-1',
          total_amount: '1000',
          platform_fee_amount: '100',
        },
      ],
    });

    transaction.mockImplementation(async (cb) => cb(client));

    const res = await jobService.checkOut('job-1', 'cg-1', {});

    expect(res).toEqual({ job_id: 'job-1', status: 'completed', already_completed: true });
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});

