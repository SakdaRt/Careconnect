import { verifyToken, getUserByToken } from '../services/authService.js';

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
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      });
    }

    // Verify token
    try {
      verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid token',
        message: error.message,
      });
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
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
      });
    }
  } catch (error) {
    console.error('[Auth Middleware Error]', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'Authentication check failed',
    });
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
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This resource requires ${roles.join(' or ')} role`,
        requiredRoles: roles,
        userRole: req.userRole,
      });
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
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    const userTrustIndex = trustLevelOrder.indexOf(req.userTrustLevel);

    if (userTrustIndex < requiredIndex) {
      return res.status(403).json({
        error: 'Insufficient trust level',
        message: `This resource requires trust level ${minTrustLevel} or higher`,
        requiredLevel: minTrustLevel,
        currentLevel: req.userTrustLevel,
      });
    }

    next();
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
  requireAccountType,
  requireVerified,
  requireOwnership,
};
