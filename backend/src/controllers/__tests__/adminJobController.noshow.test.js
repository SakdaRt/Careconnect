import { jest } from '@jest/globals';

// ─── Module mocks ─────────────────────────────────────────────────────────────

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { query } = await import('../../utils/db.js');
const ctrl = await import('../adminJobController.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (queryParams = {}) => ({ query: queryParams, params: {}, body: {}, userId: 'admin-1' });
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const SAMPLE_JOB_ROW = {
  job_id: 'job-1',
  job_post_id: 'jp-1',
  job_status: 'cancelled',
  cancellation_reason: 'caregiver_no_show',
  fault_party: 'caregiver',
  fault_severity: 'severe',
  settlement_mode: 'normal',
  final_hirer_refund: 1200,
  cancelled_at: '2026-03-29T10:00:00Z',
  title: 'Test Care Job',
  total_amount: 1000,
  hirer_deposit_amount: 200,
  hirer_id: 'hirer-1',
  hirer_name: 'Test Hirer',
  caregiver_id: 'cg-1',
  caregiver_name: 'Test CG',
};

// ─── listNoShowJobs ───────────────────────────────────────────────────────────

describe('listNoShowJobs', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('happy path: returns paginated no-show jobs', async () => {
    query
      .mockResolvedValueOnce({ rows: [SAMPLE_JOB_ROW] })   // data query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });     // count query

    const req = makeReq({ page: '1', limit: '20' });
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          data: [SAMPLE_JOB_ROW],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      })
    );
  });

  test('filter by settlement_mode=admin_override: passes value to SQL', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const req = makeReq({ settlement_mode: 'admin_override' });
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    const dataQueryCall = query.mock.calls[0];
    expect(dataQueryCall[1]).toContain('admin_override');
  });

  test('filter by date range: from and to appear in query params', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const req = makeReq({ from: '2026-01-01', to: '2026-03-31' });
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    const dataQueryCall = query.mock.calls[0];
    expect(dataQueryCall[1]).toContain('2026-01-01');
    expect(dataQueryCall[1]).toContain('2026-03-31');
  });

  test('returns empty list when no jobs found', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const req = makeReq();
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ total: 0, data: [] }),
      })
    );
  });

  test('returns 500 when query throws', async () => {
    query.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq();
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Server error' })
    );
  });

  test('pagination: correct offset for page 2 with limit 10', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 25 }] });

    const req = makeReq({ page: '2', limit: '10' });
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    const dataQueryCall = query.mock.calls[0];
    const params = dataQueryCall[1];
    expect(params).toContain(10);  // limit
    expect(params).toContain(10);  // offset = (2-1)*10 = 10
  });

  test('SQL includes cancellation_reason filter always', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const req = makeReq();
    const res = makeRes();

    await ctrl.listNoShowJobs(req, res);

    const sqlText = String(query.mock.calls[0][0]);
    expect(sqlText).toContain('caregiver_no_show');
  });
});

// ─── getNoShowStats ───────────────────────────────────────────────────────────

describe('getNoShowStats', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('happy path: returns all stats fields', async () => {
    const statsRow = {
      total_no_show: 15,
      admin_override_count: 2,
      normal_settled_count: 13,
      total_refunded: 19500,
      total_unrefunded_estimate: 2400,
    };
    query.mockResolvedValueOnce({ rows: [statsRow] });

    const req = makeReq();
    const res = makeRes();

    await ctrl.getNoShowStats(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: statsRow,
    });
  });

  test('date range filter: from and to passed to query', async () => {
    query.mockResolvedValueOnce({ rows: [{ total_no_show: 3, admin_override_count: 1, normal_settled_count: 2, total_refunded: 3000, total_unrefunded_estimate: 1000 }] });

    const req = makeReq({ from: '2026-03-01', to: '2026-03-31' });
    const res = makeRes();

    await ctrl.getNoShowStats(req, res);

    const params = query.mock.calls[0][1];
    expect(params).toContain('2026-03-01');
    expect(params).toContain('2026-03-31');
  });

  test('returns 500 when query throws', async () => {
    query.mockRejectedValueOnce(new Error('DB unavailable'));

    const req = makeReq();
    const res = makeRes();

    await ctrl.getNoShowStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('SQL includes admin_override filter', async () => {
    query.mockResolvedValueOnce({ rows: [{ total_no_show: 0, admin_override_count: 0, normal_settled_count: 0, total_refunded: 0, total_unrefunded_estimate: 0 }] });

    const req = makeReq();
    const res = makeRes();

    await ctrl.getNoShowStats(req, res);

    const sqlText = String(query.mock.calls[0][0]);
    expect(sqlText).toContain('admin_override');
    expect(sqlText).toContain('caregiver_no_show');
  });
});
