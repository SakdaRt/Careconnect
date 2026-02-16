import { jest } from '@jest/globals';

const fakeClient = { query: jest.fn() };
const mockQuery = jest.fn();

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: mockQuery,
  transaction: jest.fn(async (cb) => cb(fakeClient)),
}));

await jest.unstable_mockModule('../../models/Wallet.js', () => ({
  default: {
    getWalletByUser: jest.fn(),
    getBalance: jest.fn(),
    getOrCreateWallet: jest.fn(),
    findById: jest.fn(),
    holdFunds: jest.fn(),
    releaseFunds: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../models/LedgerTransaction.js', () => ({
  default: {
    recordTransaction: jest.fn(),
    recordHold: jest.fn(),
    recordRelease: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../workers/trustLevelWorker.js', () => ({
  triggerUserTrustUpdate: jest.fn(),
}));

const walletService = (await import('../walletService.js')).default;
const { default: Wallet } = await import('../../models/Wallet.js');

describe('Wallet Safety', () => {
  beforeEach(() => {
    fakeClient.query.mockReset();
    mockQuery.mockReset();
  });

  // ===========================================================================
  // 1. Hold → Release correctness
  // ===========================================================================
  describe('Hold → Release (cancelWithdrawal)', () => {
    it('releases held funds back to available on cancellation', async () => {
      // cancelWithdrawal: SELECT FOR UPDATE → check status → release funds → update status → ledger
      fakeClient.query
        // SELECT withdrawal + wallet FOR UPDATE
        .mockResolvedValueOnce({
          rows: [{
            id: 'wd-1',
            user_id: 'user-1',
            amount: 500,
            status: 'queued',
            wallet_id: 'wallet-1',
          }],
        })
        // UPDATE wallets (release held → available)
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-1', available_balance: 1500, held_balance: 0 }] })
        // UPDATE withdrawal_requests status
        .mockResolvedValueOnce({ rows: [{ id: 'wd-1', status: 'cancelled' }] })
        // INSERT ledger_transactions (release)
        .mockResolvedValueOnce({ rows: [] });

      const result = await walletService.cancelWithdrawal('wd-1', 'user-1');

      expect(result.status).toBe('cancelled');

      // Verify the release UPDATE was called with correct amounts
      const releaseCall = fakeClient.query.mock.calls[1];
      expect(String(releaseCall[0])).toContain('held_balance = held_balance - $1');
      expect(String(releaseCall[0])).toContain('available_balance = available_balance + $1');
      expect(releaseCall[1][0]).toBe(500); // amount

      // Verify ledger entry was created
      const ledgerCall = fakeClient.query.mock.calls[3];
      expect(String(ledgerCall[0])).toContain('ledger_transactions');
      expect(String(ledgerCall[0])).toContain("'release'");
    });

    it('rejects cancellation of non-queued withdrawal', async () => {
      fakeClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'wd-1',
          user_id: 'user-1',
          amount: 500,
          status: 'approved', // not queued
          wallet_id: 'wallet-1',
        }],
      });

      await expect(
        walletService.cancelWithdrawal('wd-1', 'user-1')
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  // ===========================================================================
  // 2. Parallel withdrawals — FOR UPDATE + rowCount check
  // ===========================================================================
  describe('Concurrent withdrawal prevention', () => {
    // Shared pre-flight mocks for initiateWithdrawal
    const setupPreflight = () => {
      // trust level check
      mockQuery.mockResolvedValueOnce({ rows: [{ trust_level: 'L2' }] });
      // bank account check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'ba-1', account_name: 'Test User', kyc_name_match_percent: 100 }],
      });
      // profile name check
      mockQuery.mockResolvedValueOnce({ rows: [{ display_name: 'Test User' }] });
    };

    it('first withdrawal succeeds with FOR UPDATE lock and RETURNING check', async () => {
      setupPreflight();

      fakeClient.query
        // SELECT wallet FOR UPDATE
        .mockResolvedValueOnce({
          rows: [{ id: 'wallet-1', available_balance: '1000', held_balance: '0' }],
        })
        // UPDATE wallets (hold) RETURNING
        .mockResolvedValueOnce({
          rows: [{ id: 'wallet-1', available_balance: '200', held_balance: '800' }],
        })
        // INSERT withdrawal_requests
        .mockResolvedValueOnce({ rows: [] })
        // INSERT ledger_transactions
        .mockResolvedValueOnce({ rows: [] });

      const result = await walletService.initiateWithdrawal('user-1', 'caregiver', 800, 'ba-1');

      expect(result.status).toBe('queued');
      expect(result.amount).toBe(800);

      // Verify FOR UPDATE was used
      const selectCall = fakeClient.query.mock.calls[0];
      expect(String(selectCall[0])).toContain('FOR UPDATE');
    });

    it('second withdrawal fails when balance insufficient after first hold', async () => {
      setupPreflight();

      fakeClient.query
        // SELECT wallet FOR UPDATE — sees balance after first withdrawal already held
        .mockResolvedValueOnce({
          rows: [{ id: 'wallet-1', available_balance: '200', held_balance: '800' }],
        });
      // Balance check inside txn: 200 < 800 → throws before UPDATE

      await expect(
        walletService.initiateWithdrawal('user-1', 'caregiver', 800, 'ba-1')
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Insufficient balance') });

      // Verify no withdrawal_request or ledger entry was created
      expect(fakeClient.query).toHaveBeenCalledTimes(1); // only the SELECT FOR UPDATE
    });

    it('throws if atomic hold UPDATE returns 0 rows (concurrent modification)', async () => {
      setupPreflight();

      fakeClient.query
        // SELECT wallet FOR UPDATE — shows enough balance
        .mockResolvedValueOnce({
          rows: [{ id: 'wallet-1', available_balance: '1000', held_balance: '0' }],
        })
        // UPDATE wallets RETURNING — returns 0 rows (concurrent drain)
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        walletService.initiateWithdrawal('user-1', 'caregiver', 800, 'ba-1')
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('concurrent') });

      // Verify no withdrawal_request or ledger entry was created (only SELECT + UPDATE)
      expect(fakeClient.query).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // 3. Webhook replay / idempotency
  // ===========================================================================
  describe('Webhook replay (processTopupSuccess)', () => {
    it('processes first webhook call successfully', async () => {
      fakeClient.query
        // SELECT topup_intents FOR UPDATE
        .mockResolvedValueOnce({
          rows: [{
            id: 'topup-1',
            user_id: 'user-1',
            amount: 1000,
            status: 'pending',
            wallet_id: 'wallet-1',
          }],
        })
        // UPDATE topup_intents status → succeeded
        .mockResolvedValueOnce({ rows: [] })
        // UPDATE wallets (credit)
        .mockResolvedValueOnce({ rows: [] })
        // INSERT ledger_transactions
        .mockResolvedValueOnce({ rows: [] })
        // SELECT updated wallet
        .mockResolvedValueOnce({
          rows: [{ id: 'wallet-1', available_balance: 2000 }],
        });

      const result = await walletService.processTopupSuccess('topup-1', {
        transaction_id: 'provider-txn-1',
      });

      expect(result.available_balance).toBe(2000);

      // Verify status was updated to succeeded
      const updateCall = fakeClient.query.mock.calls[1];
      expect(String(updateCall[0])).toContain("status = 'succeeded'");
    });

    it('rejects duplicate webhook (replay) — topup already succeeded', async () => {
      fakeClient.query
        // SELECT topup_intents FOR UPDATE — already succeeded
        .mockResolvedValueOnce({
          rows: [{
            id: 'topup-1',
            user_id: 'user-1',
            amount: 1000,
            status: 'succeeded', // already processed
            wallet_id: 'wallet-1',
          }],
        });

      await expect(
        walletService.processTopupSuccess('topup-1', { transaction_id: 'provider-txn-1' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('already processed') });

      // Verify no wallet credit or ledger entry was created
      expect(fakeClient.query).toHaveBeenCalledTimes(1); // only the SELECT
    });

    it('rejects webhook for non-existent topup', async () => {
      fakeClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        walletService.processTopupSuccess('nonexistent', {})
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ===========================================================================
  // 4. Negative balance prevention
  // ===========================================================================
  describe('Negative balance prevention', () => {
    it('Wallet.holdFunds uses WHERE available_balance >= amount', async () => {
      // Verify the model method pattern — holdFunds checks result
      // We test this at the service level: initiateWithdrawal checks holdResult.rows.length
      const setupPreflight = () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ trust_level: 'L2' }] });
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: 'ba-1', account_name: 'Test', kyc_name_match_percent: 100 }],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ display_name: 'Test' }] });
      };

      setupPreflight();

      fakeClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'w-1', available_balance: '100', held_balance: '0' }],
        });

      await expect(
        walletService.initiateWithdrawal('u-1', 'caregiver', 500, 'ba-1')
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Insufficient') });
    });
  });

  describe('Manual topup confirmation (simulation)', () => {
    it('confirms pending topup and returns succeeded status with credited wallet', async () => {
      mockQuery
        // initial getTopupById
        .mockResolvedValueOnce({
          rows: [{
            id: 'topup-1',
            user_id: 'user-1',
            status: 'pending',
            provider_name: 'mock',
          }],
        })
        // getTopupById after success processing
        .mockResolvedValueOnce({
          rows: [{
            id: 'topup-1',
            user_id: 'user-1',
            status: 'succeeded',
            provider_name: 'mock',
          }],
        });

      const processSpy = jest.spyOn(walletService, 'processTopupSuccess').mockResolvedValue({
        id: 'wallet-1',
        available_balance: 1500,
      });

      const result = await walletService.confirmTopupPayment('topup-1', 'user-1');

      expect(processSpy).toHaveBeenCalledWith(
        'topup-1',
        expect.objectContaining({ transaction_id: expect.stringContaining('mock_confirm_') })
      );
      expect(result.topup.status).toBe('succeeded');
      expect(result.wallet).toEqual(expect.objectContaining({ id: 'wallet-1' }));

      processSpy.mockRestore();
    });

    it('does not process already succeeded topup again', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'topup-1',
          user_id: 'user-1',
          status: 'succeeded',
          provider_name: 'mock',
        }],
      });

      const processSpy = jest.spyOn(walletService, 'processTopupSuccess').mockResolvedValue({
        id: 'wallet-1',
      });

      const result = await walletService.confirmTopupPayment('topup-1', 'user-1');

      expect(processSpy).not.toHaveBeenCalled();
      expect(result.topup.status).toBe('succeeded');
      expect(result.wallet).toBeNull();

      processSpy.mockRestore();
    });
  });
});
