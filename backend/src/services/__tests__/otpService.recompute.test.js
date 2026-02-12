import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
}));

const triggerUserTrustUpdate = jest.fn(async () => ({ success: true }));

await jest.unstable_mockModule('../../workers/trustLevelWorker.js', () => ({
  triggerUserTrustUpdate,
}));

const { query } = await import('../../utils/db.js');
const otpServiceModule = await import('../otpService.js');
const otpService = otpServiceModule.default;

describe('otpService recompute trigger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    query.mockReset();
    triggerUserTrustUpdate.mockClear();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('verifyOtp triggers trust recompute', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({ success: true }),
    }));

    query.mockResolvedValue({ rows: [] });

    const sendRes = await otpService.sendPhoneOtp('user-1', '+66123456789');
    const code = sendRes.debug_code;

    const res = await otpService.verifyOtp(sendRes.otp_id, code);
    expect(res.success).toBe(true);
    expect(triggerUserTrustUpdate).toHaveBeenCalledWith('user-1', 'otp');
  });
});
