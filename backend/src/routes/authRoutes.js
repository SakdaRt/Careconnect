import express from 'express';
import Joi from 'joi';
import {
  registerGuest,
  registerMember,
  loginWithEmail,
  loginWithPhone,
  refreshToken,
  acceptPolicyConsent,
  updateRole,
  updatePhoneNumber,
  updateEmailAddress,
  getCurrentUser,
  getMyProfile,
  updateMyProfile,
  logout,
} from '../controllers/authController.js';
import { requireAuth, requirePolicy } from '../middleware/auth.js';

const router = express.Router();

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details.map((detail) => detail.message).join(', '),
    });
  }
  req.body = value;
  return next();
};

const normalizePhoneNumber = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  let national = '';
  if (digits.startsWith('66')) {
    national = digits.slice(2);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    return null;
  }
  if (national.length !== 9) return null;
  return `+66${national}`;
};

const phoneSchema = Joi.string()
  .required()
  .custom((value, helpers) => {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) {
      return helpers.error('string.pattern.base', { value });
    }
    return normalized;
  }, 'phone normalization');

const registerGuestSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('hirer', 'caregiver').required(),
}).unknown(true);

const registerMemberSchema = Joi.object({
  phone_number: phoneSchema,
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('hirer', 'caregiver').required(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
}).unknown(true);

const loginEmailSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
}).unknown(true);

const loginPhoneSchema = Joi.object({
  phone_number: phoneSchema,
  password: Joi.string().required(),
}).unknown(true);

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
}).unknown(true);

const profileSchema = Joi.object({
  display_name: Joi.string().trim().min(1).required(),
  bio: Joi.string().allow('', null),
  experience_years: Joi.number().integer().min(0).allow(null),
  certifications: Joi.array().items(Joi.string().trim()).allow(null),
  specializations: Joi.array().items(Joi.string().trim()).allow(null),
  available_from: Joi.string().allow('', null),
  available_to: Joi.string().allow('', null),
  available_days: Joi.array().items(Joi.number().integer().min(0).max(6)).allow(null),
  address_line1: Joi.string().allow('', null),
  address_line2: Joi.string().allow('', null),
  district: Joi.string().allow('', null),
  province: Joi.string().allow('', null),
  postal_code: Joi.string().allow('', null),
}).unknown(true);

const updatePhoneSchema = Joi.object({
  phone_number: phoneSchema,
}).unknown(true);

const updateEmailSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
}).unknown(true);

const policyConsentSchema = Joi.object({
  role: Joi.string().valid('hirer', 'caregiver').required(),
  version_policy_accepted: Joi.string().trim().min(1).required(),
}).unknown(true);

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('hirer', 'caregiver').required(),
}).unknown(true);

/**
 * Auth Routes
 * Base path: /api/auth
 */

// ============================================================================
// Public Routes (No authentication required)
// ============================================================================

/**
 * Register guest user (email + password)
 * POST /api/auth/register/guest
 * Body: { email, password, role }
 */
router.post('/register/guest', validateBody(registerGuestSchema), registerGuest);

/**
 * Register member user (phone + password)
 * POST /api/auth/register/member
 * Body: { phone_number, password, role, email? }
 */
router.post('/register/member', validateBody(registerMemberSchema), registerMember);

/**
 * Login with email
 * POST /api/auth/login/email
 * Body: { email, password }
 */
router.post('/login/email', validateBody(loginEmailSchema), loginWithEmail);

/**
 * Login with phone number
 * POST /api/auth/login/phone
 * Body: { phone_number, password }
 */
router.post('/login/phone', validateBody(loginPhoneSchema), loginWithPhone);

/**
 * Refresh access token
 * POST /api/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh', validateBody(refreshSchema), refreshToken);

// ============================================================================
// Protected Routes (Authentication required)
// ============================================================================

/**
 * Get current user information
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 */
router.get('/me', requireAuth, requirePolicy('auth:me'), getCurrentUser);

/**
 * Get current user profile
 * GET /api/auth/profile
 * Headers: Authorization: Bearer <token>
 */
router.get('/profile', requireAuth, requirePolicy('auth:profile:view'), getMyProfile);

/**
 * Update current user profile
 * PUT /api/auth/profile
 * Headers: Authorization: Bearer <token>
 */
router.put('/profile', requireAuth, requirePolicy('auth:profile:update'), validateBody(profileSchema), updateMyProfile);

router.post('/phone', requireAuth, requirePolicy('auth:phone'), validateBody(updatePhoneSchema), updatePhoneNumber);
router.post('/email', requireAuth, requirePolicy('auth:email'), validateBody(updateEmailSchema), updateEmailAddress);
router.post('/policy/accept', requireAuth, requirePolicy('auth:policy'), validateBody(policyConsentSchema), acceptPolicyConsent);
router.post('/role', requireAuth, requirePolicy('auth:role'), validateBody(updateRoleSchema), updateRole);

/**
 * Logout (client-side token removal)
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 * Note: JWT is stateless, actual logout happens client-side
 */
router.post('/logout', requireAuth, requirePolicy('auth:logout'), logout);

export default router;
