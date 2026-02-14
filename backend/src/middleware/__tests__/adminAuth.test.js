import { jest } from '@jest/globals';

// Mock dependencies before importing
await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

await jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const { requireRole, requireAuth } = await import('../auth.js');

// Helper to create mock req/res/next
const mockReq = (overrides = {}) => ({
  headers: { authorization: 'Bearer fake-token' },
  user: null,
  userId: null,
  userRole: null,
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Admin authorization — privilege escalation prevention', () => {
  describe('requireRole("admin")', () => {
    const adminGuard = requireRole('admin');

    it('denies caregiver access to admin endpoints with 403', () => {
      const req = mockReq({
        user: { id: 'user-1', role: 'caregiver', trust_level: 'L2' },
        userRole: 'caregiver',
      });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'FORBIDDEN',
          }),
        })
      );
    });

    it('denies hirer access to admin endpoints with 403', () => {
      const req = mockReq({
        user: { id: 'user-2', role: 'hirer', trust_level: 'L1' },
        userRole: 'hirer',
      });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('denies unauthenticated request with 401', () => {
      const req = mockReq({ user: null, userRole: null });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('allows admin access', () => {
      const req = mockReq({
        user: { id: 'admin-1', role: 'admin', trust_level: 'L3' },
        userRole: 'admin',
      });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies when role is undefined', () => {
      const req = mockReq({
        user: { id: 'user-3' },
        userRole: undefined,
      });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('denies when role is empty string', () => {
      const req = mockReq({
        user: { id: 'user-4', role: '' },
        userRole: '',
      });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireRole with multiple roles', () => {
    const hirerOrCaregiverGuard = requireRole(['hirer', 'caregiver']);

    it('denies admin-only user from hirer/caregiver endpoint', () => {
      const req = mockReq({
        user: { id: 'admin-1', role: 'admin' },
        userRole: 'admin',
      });
      const res = mockRes();
      const next = jest.fn();

      hirerOrCaregiverGuard(req, res, next);

      // admin is NOT in ['hirer', 'caregiver'] — denied
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('allows caregiver', () => {
      const req = mockReq({
        user: { id: 'user-1', role: 'caregiver' },
        userRole: 'caregiver',
      });
      const res = mockRes();
      const next = jest.fn();

      hirerOrCaregiverGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('403 response does not leak sensitive data', () => {
    const adminGuard = requireRole('admin');

    it('does not include password_hash, email, or internal IDs in error response', () => {
      const req = mockReq({
        user: { id: 'user-1', role: 'caregiver', password_hash: 'secret', email: 'test@test.com' },
        userRole: 'caregiver',
      });
      const res = mockRes();
      const next = jest.fn();

      adminGuard(req, res, next);

      const responseBody = res.json.mock.calls[0][0];
      const responseStr = JSON.stringify(responseBody);

      expect(responseStr).not.toContain('secret');
      expect(responseStr).not.toContain('password_hash');
      expect(responseStr).not.toContain('test@test.com');
      expect(responseBody.error.code).toBe('FORBIDDEN');
      expect(responseBody.error.message).toBe('Access denied');
    });
  });
});
