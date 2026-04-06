import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../models/User.js', () => ({
  default: {},
}));

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
}));

await jest.unstable_mockModule('../../services/notificationService.js', () => ({
  notifyAccountBanned: jest.fn(),
}));

const { query } = await import('../../utils/db.js');
const ctrl = await import('../adminUserController.js');

const makeReq = (queryParams = {}) => ({
  query: queryParams,
  params: {},
  body: {},
  userId: 'admin-1',
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const SAMPLE_USER_ROW = {
  id: 'user-1',
  email: 'sakda@example.com',
  phone_number: '0650128796',
  account_type: 'member',
  role: 'hirer',
  status: 'active',
  trust_level: 'L2',
  trust_score: 50,
  is_email_verified: true,
  is_phone_verified: true,
  two_factor_enabled: false,
  completed_jobs_count: 0,
  first_job_waiver_used: false,
  ban_login: false,
  ban_job_create: false,
  ban_job_accept: false,
  ban_withdraw: false,
  created_at: '2026-04-06T00:00:00Z',
  updated_at: '2026-04-06T00:00:00Z',
  display_name: 'Sakda R.',
};

describe('listUsers', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('reg_type=phone matches users that have a phone number even if they also have email', async () => {
    query
      .mockResolvedValueOnce({ rows: [SAMPLE_USER_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const req = makeReq({ q: '065', reg_type: 'phone', page: '1', limit: '20' });
    const res = makeRes();

    await ctrl.listUsers(req, res);

    const sqlText = String(query.mock.calls[0][0]);
    const params = query.mock.calls[0][1];

    expect(sqlText).toContain(`u.phone_number IS NOT NULL AND u.phone_number <> ''`);
    expect(sqlText).not.toContain(`u.email IS NULL OR u.email = ''`);
    expect(params).toContain('%065%');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 1,
          data: [expect.objectContaining({
            email: 'sakda@example.com',
            phone_number: '0650128796',
          })],
        }),
      })
    );
  });

  test('returns 500 when listing users fails', async () => {
    query.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ q: '065', reg_type: 'phone' });
    const res = makeRes();

    await ctrl.listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Server error',
        message: 'Failed to list users',
      })
    );
  });
});
