import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  googleLogin,
  googleCallback,
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
  updateAvatar,
  logout,
} from '../controllers/authController.js';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import { validateBody, authSchemas, commonSchemas } from '../utils/validation.js';
import { authLimiter } from '../utils/rateLimiter.js';
import Joi from 'joi';

const router = express.Router();

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

const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
const avatarDir = path.join(uploadDir, 'avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP'));
  },
});

const avatarUploadMiddleware = (req, res, next) => {
  avatarUpload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB',
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ',
    });
  });
};

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
router.post('/register/guest', authLimiter, validateBody(authSchemas.registerGuest), registerGuest);

/**
 * Register member user (phone + password)
 * POST /api/auth/register/member
 * Body: { phone_number, password, role, email? }
 */
router.post('/register/member', authLimiter, validateBody(registerMemberSchema), registerMember);

/**
 * Login with email
 * POST /api/auth/login/email
 * Body: { email, password }
 */
router.post('/login/email', authLimiter, validateBody(authSchemas.login), loginWithEmail);

/**
 * Login with phone number
 * POST /api/auth/login/phone
 * Body: { phone_number, password }
 */
router.post('/login/phone', authLimiter, validateBody(loginPhoneSchema), loginWithPhone);

/**
 * Refresh access token
 * POST /api/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh', authLimiter, validateBody(authSchemas.refreshToken), refreshToken);

/**
 * Start Google OAuth 2.0 login
 * GET /api/auth/google
 */
router.get('/google', authLimiter, googleLogin);

/**
 * Google OAuth callback URL
 * GET /api/auth/google/callback
 */
router.get('/google/callback', authLimiter, googleCallback);

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
router.put('/profile', requireAuth, requirePolicy('auth:profile:update'), validateBody(authSchemas.updateProfile), updateMyProfile);

router.post('/avatar', requireAuth, requirePolicy('auth:profile:update'), avatarUploadMiddleware, updateAvatar);

router.post('/phone', requireAuth, requirePolicy('auth:phone'), validateBody(updatePhoneSchema), updatePhoneNumber);

router.post('/email', requireAuth, requirePolicy('auth:email'), validateBody(Joi.object({ email: Joi.string().email().required() })), updateEmailAddress);

router.post('/policy/accept', requireAuth, requirePolicy('auth:policy'), validateBody(Joi.object({ role: Joi.string().valid('hirer', 'caregiver').required(), version_policy_accepted: Joi.string().required() })), acceptPolicyConsent);

router.post('/role', requireAuth, requirePolicy('auth:role'), validateBody(Joi.object({ role: commonSchemas.role.required() })), updateRole);

/**
 * Logout (client-side token removal)
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 * Note: JWT is stateless, actual logout happens client-side
 */
router.post('/logout', requireAuth, requirePolicy('auth:logout'), logout);

export default router;
