import { jest } from '@jest/globals';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: queryMock,
}));

const policyService = await import('../policyService.js');

describe('policyService', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('getPolicyAcceptances maps rows by role', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          role: 'hirer',
          policy_accepted_at: '2026-02-01T10:00:00.000Z',
          version_policy_accepted: '2026-02-01',
        },
      ],
    });

    const result = await policyService.getPolicyAcceptances('user-1');

    expect(result).toEqual({
      hirer: {
        policy_accepted_at: '2026-02-01T10:00:00.000Z',
        version_policy_accepted: '2026-02-01',
      },
    });
  });

  test('acceptPolicy returns inserted record', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          role: 'caregiver',
          policy_accepted_at: '2026-02-01T11:00:00.000Z',
          version_policy_accepted: '2026-02-01',
        },
      ],
    });

    const result = await policyService.acceptPolicy('user-1', 'caregiver', '2026-02-01');

    expect(result).toEqual({
      role: 'caregiver',
      policy_accepted_at: '2026-02-01T11:00:00.000Z',
      version_policy_accepted: '2026-02-01',
    });
  });
});
