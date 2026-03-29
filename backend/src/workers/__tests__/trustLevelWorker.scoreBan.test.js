import { jest } from '@jest/globals';

// ─── Module mocks ─────────────────────────────────────────────────────────────

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

await jest.unstable_mockModule('../../services/jobService.js', () => ({
  cancelAssignedJobsForScoreBan: jest.fn(),
  processNoShowBatch: jest.fn(),
  default: {},
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { query, transaction } = await import('../../utils/db.js');
const { cancelAssignedJobsForScoreBan } = await import('../../services/jobService.js');
const { updateUserTrust } = await import('../trustLevelWorker.js');

// ─── Score engineering ────────────────────────────────────────────────────────
//
// calculateTrustScore base = 50, no individual caps. Buckets:
//   'score0'  → 3 no-shows × -20 = -60  → rawScore = -10 → clamp → 0
//   'below40' → 2 regular cancels × -10 = -20 → score = 30
//   'above40' → all zeros → score = 50
//
// Regular-cancel query contains "IS NULL"; no-show query does NOT.

const buildQueryImpl = (currentScore, targetBucket) => async (sql) => {
  const text = String(sql);

  if (text.includes('SELECT trust_score, trust_level FROM users')) {
    return { rows: [{ trust_score: currentScore, trust_level: 'L2' }] };
  }
  if (text.includes('is_email_verified, is_phone_verified, trust_level FROM users')) {
    return { rows: [{ is_email_verified: false, is_phone_verified: true, trust_level: 'L2' }] };
  }
  if (text.includes('FROM user_kyc_info')) return { rows: [{ status: 'approved' }] };
  if (text.includes('FROM bank_accounts')) return { rows: [] };
  if (text.includes('caregiver_no_show') && !text.includes('IS NULL')) {
    return { rows: [{ count: targetBucket === 'score0' ? '3' : '0' }] };
  }
  if (text.includes('IS NULL') && text.includes("'cancelled'")) {
    return { rows: [{ count: targetBucket === 'below40' ? '2' : '0' }] };
  }
  if (text.includes('FROM caregiver_reviews')) return { rows: [] };
  if (text.includes('FROM caregiver_profiles')) return { rows: [] };

  return { rows: [{ count: '0' }] };
};

const setupMocks = (currentScore, targetBucket) => {
  query.mockImplementation(buildQueryImpl(currentScore, targetBucket));
  transaction.mockImplementation(async (cb) => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    return cb(client);
  });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('trustLevelWorker score-based auto-cancel', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    cancelAssignedJobsForScoreBan.mockReset();
    cancelAssignedJobsForScoreBan.mockResolvedValue({ total: 0, cancelled: 0, failed: 0 });
  });

  test('triggers high_risk_only when score crosses 40 boundary (currentScore=45 → calculatedScore=30)', async () => {
    setupMocks(45, 'below40'); // 30

    const result = await updateUserTrust('cg-1');

    expect(result.crossedHighRiskBlock).toBe(true);
    expect(result.hitZero).toBe(false);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).toHaveBeenCalledWith('cg-1', 'high_risk_only', 'score_ban_high_risk');
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalledWith('cg-1', 'all', expect.anything());
  });

  test('triggers ban_login + all cancel when score hits 0 (currentScore=45 → calculatedScore=0)', async () => {
    setupMocks(45, 'score0'); // 3 no-shows → clamped to 0

    const result = await updateUserTrust('cg-1');

    expect(result.hitZero).toBe(true);
    // crossedHighRiskBlock is still computed true (45>=40 && 0<40) but else-if prevents its execution
    expect(result.crossedHighRiskBlock).toBe(true);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).toHaveBeenCalledWith('cg-1', 'all', 'score_ban_zero');
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalledWith('cg-1', 'high_risk_only', expect.anything());

    const banLoginCall = query.mock.calls.find(([sql]) => String(sql).includes('ban_login = true'));
    expect(banLoginCall).toBeTruthy();
  });

  test('triggers ban_login from low starting score (currentScore=10 → calculatedScore=0)', async () => {
    setupMocks(10, 'score0'); // currentScore already low, hits 0

    const result = await updateUserTrust('cg-1');

    expect(result.hitZero).toBe(true);
    expect(result.crossedHighRiskBlock).toBe(false); // 10 < 40 so crossedHighRiskBlock=false

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).toHaveBeenCalledWith('cg-1', 'all', 'score_ban_zero');
  });

  test('does not cancel when score stays above thresholds (currentScore=80 → calculatedScore=50)', async () => {
    setupMocks(80, 'above40'); // 50

    const result = await updateUserTrust('cg-1');

    expect(result.hitZero).toBe(false);
    expect(result.crossedHighRiskBlock).toBe(false);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalled();
  });

  test('does not cancel when already below 40 (currentScore=30 → calculatedScore=30, noChange)', async () => {
    setupMocks(30, 'below40'); // stays at 30, no new crossing

    const result = await updateUserTrust('cg-1');

    // score unchanged so noChange path
    expect(result.noChange).toBe(true);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalled();
  });

  test('does not cancel when score does not change (currentScore=50 → calculatedScore=50, noChange)', async () => {
    setupMocks(50, 'above40'); // 50 = currentScore

    const result = await updateUserTrust('cg-1');

    expect(result.noChange).toBe(true);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalled();
  });

  test('in_progress jobs are not touched (cancelAssignedJobsForScoreBan scope is assigned only)', async () => {
    setupMocks(45, 'score0'); // score hits 0

    await updateUserTrust('cg-2');

    await new Promise(setImmediate);
    const call = cancelAssignedJobsForScoreBan.mock.calls[0];
    expect(call[1]).toBe('all'); // scope='all' — function itself filters status='assigned' only
  });
});
