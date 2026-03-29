import { jest } from '@jest/globals';

// ─── Module mocks (must be declared before any imports) ───────────────────────

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

await jest.unstable_mockModule('../../models/Job.js', () => ({
  default: {
    getHirerJobs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    getCaregiverJobs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    getJobWithDetails: jest.fn(),
    getJobFeed: jest.fn(),
    checkIn: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../models/User.js', () => ({
  default: { findById: jest.fn() },
}));

await jest.unstable_mockModule('../notificationService.js', () => ({
  notifyJobAccepted: jest.fn(),
  notifyCheckIn: jest.fn(),
  notifyCheckOut: jest.fn(),
  notifyJobCancelled: jest.fn(),
  notifyNoShow: jest.fn(),
}));

await jest.unstable_mockModule('../../workers/trustLevelWorker.js', () => ({
  triggerUserTrustUpdate: jest.fn(),
}));

await jest.unstable_mockModule('../../utils/risk.js', () => ({
  computeRiskLevel: jest.fn().mockReturnValue('low_risk'),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { query, transaction } = await import('../../utils/db.js');
const { default: Job } = await import('../../models/Job.js');
const notifySvc = await import('../notificationService.js');
const trustWorker = await import('../../workers/trustLevelWorker.js');
const jobService = await import('../jobService.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a fakeClient whose query resolves correctly for the standard
 * happy-path flow of _cancelNoShowJob (escrow present, chat thread present).
 */
const makeHappyClient = () => {
  const client = { query: jest.fn() };
  client.query.mockImplementation(async (sql) => {
    const s = String(sql);
    // Guard UPDATE — succeed (status='assigned' matched)
    if (s.includes('UPDATE jobs') && s.includes("status = 'assigned'") && s.includes('RETURNING id')) {
      return { rowCount: 1, rows: [{ id: 'job-1' }] };
    }
    // Escrow wallet present
    if (s.includes("wallet_type = 'escrow'")) {
      return { rows: [{ id: 'escrow-1', held_balance: '1200' }] };
    }
    // Hirer wallet present
    if (s.includes("wallet_type = 'hirer'") && s.includes('FOR UPDATE')) {
      return { rows: [{ id: 'hirer-w-1', available_balance: '500', held_balance: '0' }] };
    }
    // Chat thread present
    if (s.includes('FROM chat_threads')) {
      return { rows: [{ id: 'thread-1' }] };
    }
    return { rowCount: 0, rows: [] };
  });
  return client;
};

/**
 * Configures `query` (outer module-level) so getHirerJobs triggers one no-show job.
 * Call order:
 *   1. autoCompleteOverdueJobsForHirer SELECT (in_progress) → empty
 *   2. autoHandleNoShowJobsForHirer SELECT (assigned) → one job
 *   3. title fetch after transaction → 'Test Job'
 */
const setupHirerQueryMocks = () => {
  query
    .mockResolvedValueOnce({ rows: [] })                                              // 1. no overdue in_progress
    .mockResolvedValueOnce({ rows: [{ id: 'job-1', job_post_id: 'jp-1', caregiver_id: 'cg-1' }] }) // 2. no-show
    .mockResolvedValueOnce({ rows: [{ title: 'Test Job' }] });                        // 3. title
};

/**
 * Same as above but for getCaregiverJobs path.
 */
const setupCaregiverQueryMocks = () => {
  query
    .mockResolvedValueOnce({ rows: [] })                                              // 1. no overdue in_progress
    .mockResolvedValueOnce({ rows: [{ id: 'job-1', job_post_id: 'jp-1', hirer_id: 'hirer-1' }] }) // 2. no-show
    .mockResolvedValueOnce({ rows: [{ title: 'Test Job' }] });                        // 3. title
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — happy path (getHirerJobs trigger)', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    trustWorker.triggerUserTrustUpdate.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('cancels job, releases escrow to hirer, notifies both parties, triggers trust update', async () => {
    const client = makeHappyClient();
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    await jobService.getHirerJobs('hirer-1');

    // Transaction ran once
    expect(transaction).toHaveBeenCalledTimes(1);

    // Guard UPDATE was the first query inside the transaction
    const firstTxQuery = client.query.mock.calls[0][0];
    expect(String(firstTxQuery)).toContain("status = 'assigned'");
    expect(String(firstTxQuery)).toContain('RETURNING id');

    // Escrow was released (UPDATE wallets held_balance -)
    const escrowDebit = client.query.mock.calls.find(
      ([sql]) => String(sql).includes('held_balance = held_balance - $1')
    );
    expect(escrowDebit).toBeTruthy();
    expect(escrowDebit[1][0]).toBe(1200);

    // Hirer wallet credited
    const hirerCredit = client.query.mock.calls.find(
      ([sql]) => String(sql).includes('available_balance = available_balance + $1')
    );
    expect(hirerCredit).toBeTruthy();
    expect(hirerCredit[1][0]).toBe(1200);

    // Ledger entry inserted
    const ledger = client.query.mock.calls.find(
      ([sql]) => String(sql).includes('INSERT INTO ledger_transactions') && String(sql).includes('reversal')
    );
    expect(ledger).toBeTruthy();

    // Notification sent to both parties
    expect(notifySvc.notifyNoShow).toHaveBeenCalledWith('hirer-1', 'cg-1', 'Test Job', 'job-1');

    // Trust update triggered for caregiver
    expect(trustWorker.triggerUserTrustUpdate).toHaveBeenCalledWith('cg-1');
  });

  test('inserts system message and closes chat thread', async () => {
    const client = makeHappyClient();
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    await jobService.getHirerJobs('hirer-1');

    const chatMsg = client.query.mock.calls.find(
      ([sql]) => String(sql).includes('INSERT INTO chat_messages')
    );
    expect(chatMsg).toBeTruthy();

    const closeThread = client.query.mock.calls.find(
      ([sql]) => String(sql).includes("UPDATE chat_threads") && String(sql).includes("'closed'")
    );
    expect(closeThread).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — happy path (getCaregiverJobs trigger)', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    trustWorker.triggerUserTrustUpdate.mockReset();
    Job.getCaregiverJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('caregiver trigger: cancels job and notifies with correct hirer/cg ids', async () => {
    const client = makeHappyClient();
    transaction.mockImplementation(async (cb) => cb(client));
    setupCaregiverQueryMocks();

    await jobService.getCaregiverJobs('cg-1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(notifySvc.notifyNoShow).toHaveBeenCalledWith('hirer-1', 'cg-1', 'Test Job', 'job-1');
    expect(trustWorker.triggerUserTrustUpdate).toHaveBeenCalledWith('cg-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — concurrent trigger / idempotency', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    trustWorker.triggerUserTrustUpdate.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('early returns when guard UPDATE returns rowCount=0 (job already cancelled)', async () => {
    const client = { query: jest.fn() };
    // Guard UPDATE finds no row in status='assigned' — concurrent trigger already processed it
    client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    transaction.mockImplementation(async (cb) => cb(client));

    query
      .mockResolvedValueOnce({ rows: [] })  // no overdue in_progress
      .mockResolvedValueOnce({ rows: [{ id: 'job-1', job_post_id: 'jp-1', caregiver_id: 'cg-1' }] });

    await jobService.getHirerJobs('hirer-1');

    // Guard was called exactly once — nothing after it
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(String(client.query.mock.calls[0][0])).toContain("status = 'assigned'");

    // No financial ops, no notification, no trust update
    expect(notifySvc.notifyNoShow).not.toHaveBeenCalled();
    expect(trustWorker.triggerUserTrustUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — boundary: grace period', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('processes job when no-show SELECT returns a row (past grace period)', async () => {
    const client = makeHappyClient();
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    await jobService.getHirerJobs('hirer-1');

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  test('does not process any jobs when no-show SELECT returns empty (within grace period)', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })  // autoComplete: no in_progress overdue
      .mockResolvedValueOnce({ rows: [] }); // autoNoShow: no assigned jobs past 30 min

    await jobService.getHirerJobs('hirer-1');

    expect(transaction).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — no chat thread', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('settlement succeeds and no chat queries are issued', async () => {
    const client = { query: jest.fn() };
    client.query.mockImplementation(async (sql) => {
      const s = String(sql);
      if (s.includes('UPDATE jobs') && s.includes("status = 'assigned'") && s.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: 'job-1' }] };
      }
      if (s.includes("wallet_type = 'escrow'")) {
        return { rows: [{ id: 'escrow-1', held_balance: '1000' }] };
      }
      if (s.includes("wallet_type = 'hirer'") && s.includes('FOR UPDATE')) {
        return { rows: [{ id: 'hirer-w-1', available_balance: '0', held_balance: '0' }] };
      }
      // No chat thread found
      if (s.includes('FROM chat_threads')) {
        return { rows: [] };
      }
      return { rowCount: 0, rows: [] };
    });
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    await expect(jobService.getHirerJobs('hirer-1')).resolves.not.toThrow();

    const chatMsgCall = client.query.mock.calls.find(
      ([sql]) => String(sql).includes('INSERT INTO chat_messages')
    );
    expect(chatMsgCall).toBeUndefined();

    const closeChatCall = client.query.mock.calls.find(
      ([sql]) => String(sql).includes("UPDATE chat_threads") && String(sql).includes("'closed'")
    );
    expect(closeChatCall).toBeUndefined();

    // Settlement still happened
    expect(notifySvc.notifyNoShow).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — notification failure', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    trustWorker.triggerUserTrustUpdate.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('settlement completes and trust update still runs when notifyNoShow throws', async () => {
    const client = makeHappyClient();
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    notifySvc.notifyNoShow.mockRejectedValueOnce(new Error('Push service unavailable'));

    await expect(jobService.getHirerJobs('hirer-1')).resolves.not.toThrow();

    // Transaction still ran (settlement done)
    expect(transaction).toHaveBeenCalledTimes(1);

    // Trust update still ran despite notification failure
    expect(trustWorker.triggerUserTrustUpdate).toHaveBeenCalledWith('cg-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — trust update failure', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    trustWorker.triggerUserTrustUpdate.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('settlement completes when triggerUserTrustUpdate throws', async () => {
    const client = makeHappyClient();
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    trustWorker.triggerUserTrustUpdate.mockRejectedValueOnce(new Error('Worker unavailable'));

    await expect(jobService.getHirerJobs('hirer-1')).resolves.not.toThrow();

    // Transaction and notification still ran
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(notifySvc.notifyNoShow).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelNoShowJob — no escrow wallet', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('job is still cancelled even when escrow wallet not found', async () => {
    const client = { query: jest.fn() };
    client.query.mockImplementation(async (sql) => {
      const s = String(sql);
      if (s.includes('UPDATE jobs') && s.includes("status = 'assigned'") && s.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: 'job-1' }] };
      }
      // Escrow not found
      if (s.includes("wallet_type = 'escrow'")) {
        return { rows: [] };
      }
      if (s.includes('FROM chat_threads')) {
        return { rows: [] };
      }
      return { rowCount: 0, rows: [] };
    });
    transaction.mockImplementation(async (cb) => cb(client));
    setupHirerQueryMocks();

    await expect(jobService.getHirerJobs('hirer-1')).resolves.not.toThrow();

    // Guard UPDATE ran
    const guardCall = client.query.mock.calls[0];
    expect(String(guardCall[0])).toContain("status = 'assigned'");

    // No financial wallet operations
    const walletOps = client.query.mock.calls.filter(
      ([sql]) => String(sql).includes('UPDATE wallets')
    );
    expect(walletOps).toHaveLength(0);

    // Notification still sent (fire-and-forget outside transaction)
    expect(notifySvc.notifyNoShow).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('autoHandleNoShowJobsForHirer — error handling', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    notifySvc.notifyNoShow.mockReset();
    Job.getHirerJobs.mockResolvedValue({ data: [], total: 0 });
  });

  test('continues processing remaining jobs when one job throws inside transaction', async () => {
    // Two no-show jobs; first transaction throws, second succeeds
    const clientA = { query: jest.fn().mockRejectedValueOnce(new Error('DB timeout')) };
    const clientB = makeHappyClient();

    let callCount = 0;
    transaction.mockImplementation(async (cb) => {
      callCount++;
      return cb(callCount === 1 ? clientA : clientB);
    });

    query
      .mockResolvedValueOnce({ rows: [] }) // autoComplete
      .mockResolvedValueOnce({             // two no-show jobs
        rows: [
          { id: 'job-1', job_post_id: 'jp-1', caregiver_id: 'cg-1' },
          { id: 'job-2', job_post_id: 'jp-2', caregiver_id: 'cg-2' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ title: 'Job 2' }] }); // title for job-2

    await expect(jobService.getHirerJobs('hirer-1')).resolves.not.toThrow();

    // Both transactions were attempted
    expect(transaction).toHaveBeenCalledTimes(2);

    // Second job still notified
    expect(notifySvc.notifyNoShow).toHaveBeenCalledTimes(1);
  });
});
