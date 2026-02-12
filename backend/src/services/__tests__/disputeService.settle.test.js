import { jest } from '@jest/globals';

const fakeClient = {
  query: jest.fn(),
};

await jest.unstable_mockModule('../../utils/db.js', () => ({
  transaction: async (cb) => cb(fakeClient),
}));

await jest.unstable_mockModule('uuid', () => ({
  v4: () => 'uuid-fixed',
}));

const disputeService = await import('../disputeService.js');

describe('disputeService settleDispute', () => {
  beforeEach(() => {
    fakeClient.query.mockReset();
  });

  test('settles dispute and writes dispute ledger transactions', async () => {
    fakeClient.query.mockImplementation(async (sql, params) => {
      const s = String(sql);

      if (s.includes('SELECT * FROM disputes') && s.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: params[0],
              status: 'open',
              job_id: 'job-1',
              job_post_id: 'jobpost-1',
              assigned_admin_id: null,
            },
          ],
        };
      }

      if (s.includes('SELECT') && s.includes('FROM disputes d') && s.includes('JOIN job_posts')) {
        return {
          rows: [
            {
              job_id: 'job-1',
              job_post_id: 'jobpost-1',
              hirer_id: 'hirer-1',
              job_caregiver_id: 'caregiver-1',
              assignment_caregiver_id: null,
            },
          ],
        };
      }

      if (s.includes("SELECT * FROM wallets WHERE job_id") && s.includes("wallet_type = 'escrow'")) {
        return { rows: [{ id: 'wallet-escrow-1', held_balance: '1000' }] };
      }

      if (s.includes("SELECT * FROM wallets WHERE user_id") && s.includes("wallet_type = 'hirer'")) {
        return { rows: [{ id: 'wallet-hirer-1' }] };
      }

      if (s.includes("SELECT * FROM wallets WHERE user_id") && s.includes("wallet_type = 'caregiver'")) {
        return { rows: [{ id: 'wallet-caregiver-1' }] };
      }

      if (s.includes('SELECT * FROM disputes WHERE id = $1') && !s.includes('FOR UPDATE')) {
        return { rows: [{ id: 'dispute-1', status: 'resolved' }] };
      }

      return { rows: [] };
    });

    const result = await disputeService.settleDispute('dispute-1', 'admin-1', {
      refund_amount: 200,
      payout_amount: 300,
      resolution: 'partial refund',
    });

    expect(result.settlement).toEqual({ refund_amount: 200, payout_amount: 300 });

    const calls = fakeClient.query.mock.calls.map(([sql, params]) => [String(sql), params]);

    const escrowUpdate = calls.find(([sql]) => sql.includes("UPDATE wallets SET held_balance = held_balance - $1"));
    expect(escrowUpdate).toBeTruthy();
    expect(escrowUpdate[1][0]).toBe(500);

    const hirerUpdate = calls.find(([sql]) => sql.includes("wallet_type = 'hirer' FOR UPDATE"));
    expect(hirerUpdate).toBeTruthy();

    const caregiverUpdate = calls.find(([sql]) => sql.includes("wallet_type = 'caregiver' FOR UPDATE"));
    expect(caregiverUpdate).toBeTruthy();

    const ledgerInserts = calls.filter(([sql]) => sql.includes('INSERT INTO ledger_transactions'));
    expect(ledgerInserts).toHaveLength(2);

    const statusUpdate = calls.find(([sql]) => sql.includes("UPDATE disputes SET status = 'resolved'"));
    expect(statusUpdate).toBeTruthy();
  });

  test('throws when escrow balance is insufficient', async () => {
    fakeClient.query.mockImplementation(async (sql) => {
      const s = String(sql);
      if (s.includes('SELECT * FROM disputes') && s.includes('FOR UPDATE')) {
        return { rows: [{ id: 'dispute-1', status: 'open', job_id: 'job-1', job_post_id: 'jobpost-1', assigned_admin_id: 'admin-1' }] };
      }
      if (s.includes('FROM disputes d') && s.includes('JOIN job_posts')) {
        return { rows: [{ job_id: 'job-1', job_post_id: 'jobpost-1', hirer_id: 'hirer-1', job_caregiver_id: 'caregiver-1', assignment_caregiver_id: null }] };
      }
      if (s.includes("SELECT * FROM wallets WHERE job_id") && s.includes("wallet_type = 'escrow'")) {
        return { rows: [{ id: 'wallet-escrow-1', held_balance: '100' }] };
      }
      if (s.includes("SELECT * FROM wallets WHERE user_id") && s.includes("wallet_type = 'hirer'")) {
        return { rows: [{ id: 'wallet-hirer-1' }] };
      }
      return { rows: [] };
    });

    await expect(
      disputeService.settleDispute('dispute-1', 'admin-1', { refund_amount: 200 })
    ).rejects.toThrow('Insufficient escrow balance for settlement');
  });

  test('allows refund-only settlement without caregiver', async () => {
    fakeClient.query.mockImplementation(async (sql, params) => {
      const s = String(sql);
      if (s.includes('SELECT * FROM disputes') && s.includes('FOR UPDATE')) {
        return { rows: [{ id: params[0], status: 'open', job_id: 'job-1', job_post_id: 'jobpost-1', assigned_admin_id: 'admin-1' }] };
      }
      if (s.includes('FROM disputes d') && s.includes('JOIN job_posts')) {
        return { rows: [{ job_id: 'job-1', job_post_id: 'jobpost-1', hirer_id: 'hirer-1', job_caregiver_id: null, assignment_caregiver_id: null }] };
      }
      if (s.includes("SELECT * FROM wallets WHERE job_id") && s.includes("wallet_type = 'escrow'")) {
        return { rows: [{ id: 'wallet-escrow-1', held_balance: '500' }] };
      }
      if (s.includes("SELECT * FROM wallets WHERE user_id") && s.includes("wallet_type = 'hirer'")) {
        return { rows: [{ id: 'wallet-hirer-1' }] };
      }
      if (s.includes('SELECT * FROM disputes WHERE id = $1') && !s.includes('FOR UPDATE')) {
        return { rows: [{ id: 'dispute-1', status: 'resolved' }] };
      }
      return { rows: [] };
    });

    const result = await disputeService.settleDispute('dispute-1', 'admin-1', { refund_amount: 200 });
    expect(result.settlement).toEqual({ refund_amount: 200, payout_amount: 0 });
  });

  test('treats settle as idempotent when key matches already-resolved dispute', async () => {
    fakeClient.query.mockImplementation(async (sql, params) => {
      const s = String(sql);
      if (s.includes('SELECT * FROM disputes') && s.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: params[0],
              status: 'resolved',
              settlement_idempotency_key: 'k1',
              settlement_refund_amount: '100',
              settlement_payout_amount: '50',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await disputeService.settleDispute('dispute-1', 'admin-1', { refund_amount: 100, payout_amount: 50, idempotency_key: 'k1' });
    expect(result.settlement).toEqual({ refund_amount: 100, payout_amount: 50 });
  });
});

