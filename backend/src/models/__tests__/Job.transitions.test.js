import { jest } from '@jest/globals';

// Mock db before importing Job
const mockQuery = jest.fn();
const mockTransaction = jest.fn();

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

const { default: Job, InvalidTransitionError } = await import('../Job.js');

describe('Job State Machine', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockTransaction.mockReset();
  });

  // =========================================================================
  // 1. Valid transition map
  // =========================================================================
  describe('isValidTransition', () => {
    const validCases = [
      ['draft', 'posted'],
      ['posted', 'assigned'],
      ['posted', 'cancelled'],
      ['posted', 'expired'],
      ['assigned', 'in_progress'],
      ['assigned', 'cancelled'],
      ['in_progress', 'completed'],
      ['in_progress', 'cancelled'],
    ];

    it.each(validCases)('%s → %s should be valid', (from, to) => {
      expect(Job.isValidTransition(from, to)).toBe(true);
    });

    const invalidCases = [
      ['draft', 'assigned'],
      ['draft', 'in_progress'],
      ['draft', 'completed'],
      ['draft', 'cancelled'],
      ['posted', 'draft'],
      ['posted', 'in_progress'],
      ['posted', 'completed'],
      ['assigned', 'draft'],
      ['assigned', 'posted'],
      ['assigned', 'completed'],
      ['in_progress', 'draft'],
      ['in_progress', 'posted'],
      ['in_progress', 'assigned'],
      ['completed', 'draft'],
      ['completed', 'posted'],
      ['completed', 'assigned'],
      ['completed', 'in_progress'],
      ['completed', 'cancelled'],
      ['cancelled', 'draft'],
      ['cancelled', 'posted'],
      ['cancelled', 'assigned'],
      ['cancelled', 'in_progress'],
      ['cancelled', 'completed'],
      ['expired', 'posted'],
      ['expired', 'assigned'],
    ];

    it.each(invalidCases)('%s → %s should be invalid', (from, to) => {
      expect(Job.isValidTransition(from, to)).toBe(false);
    });

    it('self-transitions should be invalid', () => {
      const states = ['draft', 'posted', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'];
      for (const s of states) {
        expect(Job.isValidTransition(s, s)).toBe(false);
      }
    });

    it('unknown state should be invalid', () => {
      expect(Job.isValidTransition('unknown', 'posted')).toBe(false);
      expect(Job.isValidTransition('draft', 'unknown')).toBe(false);
    });
  });

  // =========================================================================
  // 2. getValidTransitions
  // =========================================================================
  describe('getValidTransitions', () => {
    it('returns correct targets for each state', () => {
      expect(Job.getValidTransitions('draft')).toEqual(['posted']);
      expect(Job.getValidTransitions('posted')).toEqual(expect.arrayContaining(['assigned', 'cancelled', 'expired']));
      expect(Job.getValidTransitions('assigned')).toEqual(expect.arrayContaining(['in_progress', 'cancelled']));
      expect(Job.getValidTransitions('in_progress')).toEqual(expect.arrayContaining(['completed', 'cancelled']));
      expect(Job.getValidTransitions('completed')).toEqual([]);
      expect(Job.getValidTransitions('cancelled')).toEqual([]);
      expect(Job.getValidTransitions('expired')).toEqual([]);
    });

    it('returns empty array for unknown state', () => {
      expect(Job.getValidTransitions('nonexistent')).toEqual([]);
    });
  });

  // =========================================================================
  // 3. executeTransition — happy path
  // =========================================================================
  describe('executeTransition', () => {
    it('executes valid transition and returns result', async () => {
      const fakeJob = { id: 'job-1', status: 'draft', hirer_id: 'h1' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] }); // findById

      const fakeClient = { query: jest.fn() };
      const updatedJob = { ...fakeJob, status: 'posted' };
      const transitionFn = jest.fn().mockResolvedValue(updatedJob);

      mockTransaction.mockImplementation(async (cb) => cb(fakeClient));
      // logTransition query inside transaction
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await Job.executeTransition('job-1', 'posted', 'h1', {}, transitionFn);

      expect(transitionFn).toHaveBeenCalledWith(fakeClient, fakeJob);
      expect(result).toEqual(updatedJob);
    });

    it('throws InvalidTransitionError for invalid transition', async () => {
      const fakeJob = { id: 'job-1', status: 'completed', hirer_id: 'h1' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] }); // findById

      const transitionFn = jest.fn();

      await expect(
        Job.executeTransition('job-1', 'in_progress', 'h1', {}, transitionFn)
      ).rejects.toThrow(InvalidTransitionError);

      expect(transitionFn).not.toHaveBeenCalled();
    });

    it('throws InvalidTransitionError with correct properties', async () => {
      const fakeJob = { id: 'job-1', status: 'completed', hirer_id: 'h1' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] });

      try {
        await Job.executeTransition('job-1', 'in_progress', 'h1', {}, jest.fn());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidTransitionError);
        expect(err.fromState).toBe('completed');
        expect(err.toState).toBe('in_progress');
        expect(err.jobId).toBe('job-1');
        expect(err.status).toBe(400);
      }
    });

    it('throws when job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // findById returns nothing

      await expect(
        Job.executeTransition('nonexistent', 'posted', 'h1', {}, jest.fn())
      ).rejects.toThrow('Job not found');
    });
  });

  // =========================================================================
  // 4. Terminal states reject all transitions
  // =========================================================================
  describe('terminal states', () => {
    const terminalStates = ['completed', 'cancelled', 'expired'];
    const allTargets = ['draft', 'posted', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'];

    for (const terminal of terminalStates) {
      for (const target of allTargets) {
        it(`${terminal} → ${target} should be rejected`, async () => {
          const fakeJob = { id: 'job-1', status: terminal };
          mockQuery.mockResolvedValueOnce({ rows: [fakeJob] });

          await expect(
            Job.executeTransition('job-1', target, 'u1', {}, jest.fn())
          ).rejects.toThrow();
        });
      }
    }
  });

  // =========================================================================
  // 5. publishJobPost uses executeTransition with WHERE guard
  // =========================================================================
  describe('publishJobPost', () => {
    it('publishes a draft job', async () => {
      const fakeJob = { id: 'jp-1', status: 'draft', hirer_id: 'h1' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] }); // findById inside executeTransition

      const fakeClient = { query: jest.fn() };
      fakeClient.query.mockResolvedValueOnce({ rows: [{ ...fakeJob, status: 'posted' }] }); // UPDATE RETURNING

      mockTransaction.mockImplementation(async (cb) => cb(fakeClient));
      mockQuery.mockResolvedValueOnce({ rows: [] }); // logTransition

      const result = await Job.publishJobPost('jp-1', 'h1');
      expect(result.status).toBe('posted');
    });

    it('rejects publishing a posted job (already posted)', async () => {
      const fakeJob = { id: 'jp-1', status: 'posted', hirer_id: 'h1' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] });

      await expect(Job.publishJobPost('jp-1', 'h1')).rejects.toThrow(InvalidTransitionError);
    });

    it('rejects publishing by non-owner', async () => {
      const fakeJob = { id: 'jp-1', status: 'draft', hirer_id: 'h1' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] });

      const fakeClient = { query: jest.fn() };
      mockTransaction.mockImplementation(async (cb) => cb(fakeClient));
      mockQuery.mockResolvedValueOnce({ rows: [] }); // logTransition

      await expect(Job.publishJobPost('jp-1', 'other-user')).rejects.toThrow('Not authorized');
    });
  });

  // =========================================================================
  // 6. Double-complete prevention (WHERE status = 'in_progress' guard)
  // =========================================================================
  describe('checkOut double-complete prevention', () => {
    it('second checkout returns already_completed via service idempotency', async () => {
      // This is tested at the service level in jobService.checkOut.idempotent.test.js
      // At the model level, executeTransition blocks completed → completed
      const fakeJob = { id: 'job-1', status: 'completed' };
      mockQuery.mockResolvedValueOnce({ rows: [fakeJob] });

      await expect(
        Job.executeTransition('job-1', 'completed', 'cg-1', {}, jest.fn())
      ).rejects.toThrow(); // self-transition blocked
    });
  });
});
