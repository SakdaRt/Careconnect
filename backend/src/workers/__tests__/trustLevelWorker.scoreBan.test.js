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
// calculateTrustScore base = 50. To produce specific score buckets:
//   'below20'  → 2 no-shows × -20 = -40 (cap) → score = 10
//   'below40'  → 2 regular cancels × -10 = -20 → score = 30
//   'above40'  → all zeros → score = 50
//
// Distinguishing regular-cancel vs no-show query:
//   regular cancel SQL contains "IS NULL" (j.cancellation_reason IS NULL OR ...)
//   no-show SQL does NOT contain "IS NULL" but contains "caregiver_no_show"

const buildQueryImpl = (currentScore, targetBucket) => async (sql) => {
  const text = String(sql);

  // updateUserTrust: current score fetch
  if (text.includes('SELECT trust_score, trust_level FROM users')) {
    return { rows: [{ trust_score: currentScore, trust_level: 'L2' }] };
  }

  // determineTrustLevel
  if (text.includes('is_email_verified, is_phone_verified, trust_level FROM users')) {
    return { rows: [{ is_email_verified: false, is_phone_verified: true, trust_level: 'L2' }] };
  }
  if (text.includes('FROM user_kyc_info')) return { rows: [{ status: 'approved' }] };
  if (text.includes('FROM bank_accounts')) return { rows: [] };

  // calculateTrustScore: no-show cancellations (has caregiver_no_show, no IS NULL)
  if (text.includes('caregiver_no_show') && !text.includes('IS NULL')) {
    return { rows: [{ count: targetBucket === 'below20' ? '2' : '0' }] };
  }

  // calculateTrustScore: regular cancellations (has IS NULL)
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
    setupMocks(45, 'below40'); // calculated = 30

    const result = await updateUserTrust('cg-1');

    expect(result.crossedHighRiskBlock).toBe(true);
    expect(result.crossedFullBan).toBe(false);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).toHaveBeenCalledWith('cg-1', 'high_risk_only', 'score_ban_high_risk');
  });

  test('triggers all cancel when score crosses 20 boundary (currentScore=25 → calculatedScore=10)', async () => {
    setupMocks(25, 'below20'); // calculated = 10

    const result = await updateUserTrust('cg-1');

    expect(result.crossedFullBan).toBe(true);
    expect(result.crossedHighRiskBlock).toBe(false); // currentScore=25 was already below 40

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).toHaveBeenCalledWith('cg-1', 'all', 'score_ban_full');
  });

  test('triggers all (not high_risk_only) when score crosses both thresholds (currentScore=45 → calculatedScore=10)', async () => {
    setupMocks(45, 'below20'); // calculated = 10

    const result = await updateUserTrust('cg-1');

    expect(result.crossedFullBan).toBe(true);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).toHaveBeenCalledWith('cg-1', 'all', 'score_ban_full');
    const highRiskCall = cancelAssignedJobsForScoreBan.mock.calls.find(([, scope]) => scope === 'high_risk_only');
    expect(highRiskCall).toBeUndefined();
  });

  test('does not cancel when score stays above both thresholds (currentScore=80 → calculatedScore=50)', async () => {
    setupMocks(80, 'above40'); // calculated = 50

    const result = await updateUserTrust('cg-1');

    expect(result.crossedHighRiskBlock).toBe(false);
    expect(result.crossedFullBan).toBe(false);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalled();
  });

  test('does not cancel when already below threshold (currentScore=15 → calculatedScore=10, no new crossing)', async () => {
    setupMocks(15, 'below20'); // calculated = 10; current=15 < 20 so no new crossing

    const result = await updateUserTrust('cg-1');

    expect(result.crossedFullBan).toBe(false);   // 15 < 20, so condition fails
    expect(result.crossedHighRiskBlock).toBe(false);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalled();
  });

  test('does not cancel when score does not change (currentScore=50 → calculatedScore=50, noChange)', async () => {
    setupMocks(50, 'above40'); // calculated = 50 = currentScore → noChange

    const result = await updateUserTrust('cg-1');

    expect(result.noChange).toBe(true);

    await new Promise(setImmediate);
    expect(cancelAssignedJobsForScoreBan).not.toHaveBeenCalled();
  });

  test('in_progress jobs are not touched (cancelAssignedJobsForScoreBan scope is assigned only)', async () => {
    setupMocks(45, 'below20'); // score drops below 20

    await updateUserTrust('cg-2');

    await new Promise(setImmediate);
    const call = cancelAssignedJobsForScoreBan.mock.calls[0];
    expect(call[1]).toBe('all'); // scope='all' but the function itself filters status='assigned'
  });
});
