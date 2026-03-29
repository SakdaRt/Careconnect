import { jest } from '@jest/globals';

// ─── Module mocks ─────────────────────────────────────────────────────────────

await jest.unstable_mockModule('../../services/jobService.js', () => ({
  processNoShowBatch: jest.fn(),
  default: {},
}));

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { processNoShowBatch } = await import('../../services/jobService.js');
const { runNoShowWorker, triggerNoShowScan } = await import('../noShowWorker.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runNoShowWorker', () => {
  beforeEach(() => {
    processNoShowBatch.mockReset();
  });

  test('happy path: processes jobs and returns correct counts', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 3, processed: 3, failed: 0 });

    const result = await runNoShowWorker();

    expect(processNoShowBatch).toHaveBeenCalledWith(100);
    expect(result.total).toBe(3);
    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('no jobs found: returns zero counts', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 0, processed: 0, failed: 0 });

    const result = await runNoShowWorker();

    expect(result.total).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  test('partial failure: returns correct processed/failed split', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 5, processed: 3, failed: 2 });

    const result = await runNoShowWorker();

    expect(result.total).toBe(5);
    expect(result.processed).toBe(3);
    expect(result.failed).toBe(2);
  });

  test('passes custom limit to processNoShowBatch', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 0, processed: 0, failed: 0 });

    await runNoShowWorker({ limit: 50 });

    expect(processNoShowBatch).toHaveBeenCalledWith(50);
  });

  test('uses default limit 100 when called without arguments', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 0, processed: 0, failed: 0 });

    await runNoShowWorker();

    expect(processNoShowBatch).toHaveBeenCalledWith(100);
  });

  test('propagates error from processNoShowBatch (triggerNoShowScan catches it)', async () => {
    processNoShowBatch.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(runNoShowWorker()).rejects.toThrow('DB connection lost');
  });

  test('[ALERT] logs CRITICAL when adminOverride > 0', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 2, processed: 1, failed: 0, adminOverride: 1, batchLimitHit: false });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await runNoShowWorker();

    const alertCall = spy.mock.calls.find(([msg]) => String(msg).includes('[ALERT]'));
    expect(alertCall).toBeTruthy();
    expect(String(alertCall[0])).toContain('admin_override');

    spy.mockRestore();
  });

  test('[WARN] logs when batchLimitHit is true', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 100, processed: 100, failed: 0, adminOverride: 0, batchLimitHit: true });
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runNoShowWorker();

    const warnCall = spy.mock.calls.find(([msg]) => String(msg).includes('[WARN]'));
    expect(warnCall).toBeTruthy();
    expect(String(warnCall[0])).toContain('Batch limit');

    spy.mockRestore();
  });

  test('no [ALERT] or [WARN] when adminOverride=0 and batchLimitHit=false', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 3, processed: 3, failed: 0, adminOverride: 0, batchLimitHit: false });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runNoShowWorker();

    const alertCalls = errorSpy.mock.calls.filter(([msg]) => String(msg).includes('[ALERT]'));
    const warnCalls = warnSpy.mock.calls.filter(([msg]) => String(msg).includes('[WARN]'));
    expect(alertCalls).toHaveLength(0);
    expect(warnCalls).toHaveLength(0);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('defaults adminOverride=0 and batchLimitHit=false when fields absent (backward compat)', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 1, processed: 1, failed: 0 });

    const result = await runNoShowWorker();

    expect(result.adminOverride).toBeUndefined();
    expect(result.batchLimitHit).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('triggerNoShowScan', () => {
  beforeEach(() => {
    processNoShowBatch.mockReset();
  });

  test('does not throw when processNoShowBatch succeeds', async () => {
    processNoShowBatch.mockResolvedValueOnce({ total: 2, processed: 2, failed: 0 });

    await expect(triggerNoShowScan()).resolves.not.toThrow();
  });

  test('does not throw when runNoShowWorker throws (DB outage scenario)', async () => {
    processNoShowBatch.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(triggerNoShowScan()).resolves.not.toThrow();
  });

  test('does not re-throw when processNoShowBatch throws unexpected error', async () => {
    processNoShowBatch.mockRejectedValueOnce(new TypeError('Cannot read properties of undefined'));

    await expect(triggerNoShowScan()).resolves.not.toThrow();
  });
});
