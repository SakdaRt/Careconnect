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
    const otpId = sendRes.otp_id;

    // OTP code is no longer exposed in response; use wrong code to confirm rejection
    const failRes = await otpService.verifyOtp(otpId, '000000');
    expect(failRes.success).toBe(false);
    expect(triggerUserTrustUpdate).not.toHaveBeenCalled();
  });
});
