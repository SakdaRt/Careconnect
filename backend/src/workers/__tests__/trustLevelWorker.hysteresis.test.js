import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const { query } = await import('../../utils/db.js');
const { determineTrustLevel } = await import('../trustLevelWorker.js');

const mockUser = (overrides = {}) => ({
  is_email_verified: false,
  is_phone_verified: true,
  trust_level: 'L2',
  ...overrides,
});

const mockKyc = (status = 'approved') => ({ rows: [{ status }] });
const mockBank = (verified = true) => ({ rows: verified ? [{ is_verified: true }] : [] });

describe('trustLevelWorker hysteresis', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('keeps L3 when score >= 75 and current level is L3', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockUser({ trust_level: 'L3' })] })
      .mockResolvedValueOnce(mockKyc('approved'))
      .mockResolvedValueOnce(mockBank(true));

    const level = await determineTrustLevel('user-1', 76);
    expect(level).toBe('L3');
  });

  test('drops to L2 when score < 75 even if current level is L3', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockUser({ trust_level: 'L3' })] })
      .mockResolvedValueOnce(mockKyc('approved'))
      .mockResolvedValueOnce(mockBank(true));

    const level = await determineTrustLevel('user-1', 74);
    expect(level).toBe('L2');
  });

  test('does not upgrade to L3 when score is below 80', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockUser({ trust_level: 'L2' })] })
      .mockResolvedValueOnce(mockKyc('approved'))
      .mockResolvedValueOnce(mockBank(true));

    const level = await determineTrustLevel('user-1', 79);
    expect(level).toBe('L2');
  });

  test('upgrades to L3 when score >= 80 and prerequisites met', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockUser({ trust_level: 'L2' })] })
      .mockResolvedValueOnce(mockKyc('approved'))
      .mockResolvedValueOnce(mockBank(true));

    const level = await determineTrustLevel('user-1', 80);
    expect(level).toBe('L3');
  });
});
