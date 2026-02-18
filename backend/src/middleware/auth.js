import { verifyToken, getUserByToken } from '../services/authService.js';
import { query } from '../utils/db.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Auth Middleware
 * Handles JWT verification and user authentication
 */

/**
 * Extract JWT token from Authorization header
 * @param {object} req - Express request
 * @returns {string|null} - JWT token or null
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check for "Bearer TOKEN" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Direct token (fallback)
  return authHeader;
};

/**
 * Require authentication middleware
 * User must be logged in to access the route
 */
export const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      const error = new UnauthorizedError('Authentication required');
      return res.status(error.status).json(error.toJSON());
    }

    // Verify token
    try {
      verifyToken(token);
    } catch (error) {
      const authError = new UnauthorizedError('Invalid authentication token', { code: 'INVALID_TOKEN' });
      return res.status(authError.status).json(authError.toJSON());
    }

    // Get user from token
    try {
      const user = await getUserByToken(token);

      // Attach user to request
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
      req.userTrustLevel = user.trust_level;
      req.userAccountType = user.account_type;

      next();
    } catch (error) {
      const authError = new UnauthorizedError('Authentication failed');
      return res.status(authError.status).json(authError.toJSON());
    }
  } catch (error) {
    console.error('[Auth Middleware Error]', error);
    const { ApiError } = await import('../utils/errors.js');
    const serverError = new ApiError('Authentication check failed', { status: 500, code: 'INTERNAL_SERVER_ERROR' });
    return res.status(serverError.status).json(serverError.toJSON());
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token, continue without user
      req.user = null;
      req.userId = null;
      return next();
    }

    // Try to verify token
    try {
      const user = await getUserByToken(token);
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
      req.userTrustLevel = user.trust_level;
      req.userAccountType = user.account_type;
    } catch (error) {
      // Invalid token, continue without user
      req.user = null;
      req.userId = null;
    }

    next();
  } catch (error) {
    console.error('[Optional Auth Middleware Error]', error);
    next(); // Continue even if error
  }
};

/**
 * Require specific role middleware
 * @param {string|array} allowedRoles - Required role(s)
 */
export const requireRole = (allowedRoles) => {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      const error = new UnauthorizedError('Authentication required');
      return res.status(error.status).json(error.toJSON());
    }

    if (!roles.includes(req.userRole)) {
      const error = new ForbiddenError('Access denied', {
        requiredRoles: roles,
        userRole: req.userRole,
        reason: `This resource requires ${roles.join(' or ')} role`
      });
      return res.status(error.status).json(error.toJSON());
    }

    next();
  };
};

/**
 * Require minimum trust level middleware
 * @param {string} minTrustLevel - Minimum required trust level (L0, L1, L2, L3)
 */
export const requireTrustLevel = (minTrustLevel) => {
  const trustLevelOrder = ['L0', 'L1', 'L2', 'L3'];
  const requiredIndex = trustLevelOrder.indexOf(minTrustLevel);

  if (requiredIndex === -1) {
    throw new Error('Invalid trust level');
  }

  return (req, res, next) => {
    if (!req.user) {
      const error = new UnauthorizedError('Authentication required');
      return res.status(error.status).json(error.toJSON());
    }

    const userTrustIndex = trustLevelOrder.indexOf(req.userTrustLevel);

    if (userTrustIndex < requiredIndex) {
      const error = new ForbiddenError('Insufficient trust level', {
        requiredLevel: minTrustLevel,
        currentLevel: req.userTrustLevel,
        reason: `This resource requires trust level ${minTrustLevel} or higher`
      });
      return res.status(error.status).json(error.toJSON());
    }

    next();
  };
};

export const can = (user, action) => {
  if (!user) {
    return { allowed: false, reason: 'Authentication required' };
  }

  const trustLevelOrder = ['L0', 'L1', 'L2', 'L3'];
  const userLevel = user.trust_level || 'L0';
  const userIndex = trustLevelOrder.indexOf(userLevel);

  const meets = (minLevel) => userIndex >= trustLevelOrder.indexOf(minLevel);
  const role = user.role;

  if (role === 'admin') {
    return { allowed: true };
  }

  if (action === 'auth:me') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:profile:view') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:profile:update') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:phone') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:email') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:otp') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:policy') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:role') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'auth:logout') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };

  if (action === 'job:stats') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'job:get') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'job:create') {
    if (role !== 'hirer') return { allowed: false, reason: 'Hirer role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }
  if (action === 'job:publish') {
    if (role !== 'hirer') return { allowed: false, reason: 'Hirer role required' };
    return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required to publish jobs' };
  }
  if (action === 'job:my-jobs') {
    if (role !== 'hirer') return { allowed: false, reason: 'Hirer role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }
  if (action === 'job:feed') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }
  if (action === 'job:assigned') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required' };
  }
  if (action === 'job:accept') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required' };
  }
  if (action === 'job:checkin') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required' };
  }
  if (action === 'job:checkout') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required' };
  }
  if (action === 'job:cancel') {
    if (!['hirer', 'caregiver'].includes(role)) return { allowed: false, reason: 'Hirer or caregiver role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }

  if (action === 'wallet:balance') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'wallet:transactions') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'wallet:topup') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'wallet:topup:pending') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'wallet:topup:status') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'wallet:bank-accounts') {
    if (!['hirer', 'caregiver'].includes(role)) return { allowed: false, reason: 'Hirer or caregiver role required' };
    if (role === 'caregiver') {
      return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required' };
    }
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }
  if (action === 'wallet:bank-add') {
    if (!['hirer', 'caregiver'].includes(role)) return { allowed: false, reason: 'Hirer or caregiver role required' };
    if (role === 'caregiver') {
      return meets('L1') ? { allowed: true } : { allowed: false, reason: 'Trust level L1 required' };
    }
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }
  if (action === 'wallet:withdrawals') return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  if (action === 'wallet:withdraw') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L2') ? { allowed: true } : { allowed: false, reason: 'Trust level L2 required' };
  }
  if (action === 'wallet:withdraw:cancel') {
    if (role !== 'caregiver') return { allowed: false, reason: 'Caregiver role required' };
    return meets('L2') ? { allowed: true } : { allowed: false, reason: 'Trust level L2 required' };
  }

  if (action === 'care-recipient:manage') {
    if (role !== 'hirer') return { allowed: false, reason: 'Hirer role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }

  if (action === 'dispute:access') {
    if (!['hirer', 'caregiver'].includes(role)) return { allowed: false, reason: 'Hirer or caregiver role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }

  if (action === 'chat:access') {
    if (!['hirer', 'caregiver'].includes(role)) return { allowed: false, reason: 'Hirer or caregiver role required' };
    return meets('L0') ? { allowed: true } : { allowed: false, reason: 'Trust level L0 required' };
  }

  return { allowed: false, reason: 'Unknown action' };
};

export const requirePolicy = (action) => {
  return async (req, res, next) => {
    if (!req.user) {
      const error = new UnauthorizedError('Authentication required');
      return res.status(error.status).json(error.toJSON());
    }

    const result = can(req.user, action);
    if (!result.allowed) {
      try {
        await query(
          `INSERT INTO audit_events (id, user_id, event_type, action, details, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            uuidv4(),
            req.user.id,
            'policy_denied',
            action,
            JSON.stringify({
              role: req.user.role,
              trust_level: req.user.trust_level,
              method: req.method,
              path: req.originalUrl,
              reason: result.reason || null,
            }),
          ]
        );
      } catch (error) {
        console.error('[Policy] Failed to write audit log:', error);
      }

      const error = new ForbiddenError(result.reason || 'Insufficient permissions', {
        action,
        trust_level: req.user.trust_level,
        role: req.user.role,
      });
      return res.status(error.status).json(error.toJSON());
    }

    return next();
  };
};

/**
 * Require account type middleware
 * @param {string|array} allowedAccountTypes - Required account type(s) (guest, member)
 */
export const requireAccountType = (allowedAccountTypes) => {
  const accountTypes = Array.isArray(allowedAccountTypes) ? allowedAccountTypes : [allowedAccountTypes];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    if (!accountTypes.includes(req.userAccountType)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This resource requires ${accountTypes.join(' or ')} account type`,
        requiredAccountTypes: accountTypes,
        userAccountType: req.userAccountType,
      });
    }

    next();
  };
};

/**
 * Check if user is verified (email or phone)
 */
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource',
    });
  }

  const isVerified = req.user.is_email_verified || req.user.is_phone_verified;

  if (!isVerified) {
    return res.status(403).json({
      error: 'Verification required',
      message: 'Please verify your email or phone number to access this resource',
      emailVerified: req.user.is_email_verified,
      phoneVerified: req.user.is_phone_verified,
    });
  }

  next();
};

/**
 * Check if user owns the resource
 * @param {string} paramName - Request parameter name containing resource owner ID
 */
export const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    const resourceOwnerId = req.params[paramName] || req.body[paramName];

    if (!resourceOwnerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: `Missing ${paramName} parameter`,
      });
    }

    // Admin can access any resource
    if (req.userRole === 'admin') {
      return next();
    }

    // Check ownership
    if (resourceOwnerId !== req.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources',
      });
    }

    next();
  };
};

export default {
  requireAuth,
  optionalAuth,
  requireRole,
  requireTrustLevel,
  requirePolicy,
  requireAccountType,
  requireVerified,
  requireOwnership,
  can,
};
