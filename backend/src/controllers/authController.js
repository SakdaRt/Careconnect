import {
  registerGuest as registerGuestService,
  registerMember as registerMemberService,
  loginWithEmail as loginWithEmailService,
  loginWithPhone as loginWithPhoneService,
  refreshAccessToken,
} from '../services/authService.js';
import { acceptPolicy, getPolicyAcceptances } from '../services/policyService.js';
import User from '../models/User.js';
import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const GENERATED_DISPLAY_NAME_PATTERN = /^ผู้(?:ว่าจ้าง|ดูแล)\s+[A-Z0-9]{4}$/u;
const DISPLAY_NAME_PATTERN = /^(\S+)\s+(\S)\.?$/u;

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

export const updateAvatar = async (req, res) => {
  const uploadedFilePath = req.file?.path;

  try {
    await ensureProfileSchema();

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'กรุณาอัปโหลดรูปโปรไฟล์',
      });
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || '/app/uploads');
    const relativePath = path
      .relative(uploadDir, file.path)
      .replace(/\\/g, '/');

    const existingUser = await User.findById(req.userId);
    if (!existingUser) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const previousAvatar = typeof existingUser.avatar === 'string' ? existingUser.avatar : null;

    const updatedUser = await User.updateById(req.userId, {
      avatar: relativePath,
      updated_at: new Date(),
    });

    if (!updatedUser) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    if (previousAvatar && previousAvatar !== relativePath) {
      const previousAvatarPath = path.join(uploadDir, previousAvatar);
      if (fs.existsSync(previousAvatarPath)) {
        fs.unlinkSync(previousAvatarPath);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        avatar: relativePath,
      },
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    console.error('[Auth Controller] Update avatar error:', error);
    const detail = error instanceof Error ? error.message : 'Failed to update avatar';

    return res.status(500).json({
      error: 'Server error',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update avatar' : detail,
    });
  }
};

const normalizeEmail = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed.length ? trimmed : null;
};

const normalizeSpaces = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const buildDisplayNameFromFullName = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return null;

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return null;

  const firstName = parts[0];
  const lastName = parts.slice(1).join('').replace(/[^\p{L}\p{N}]/gu, '');
  if (lastName.length < 2) return null;
  const lastInitial = Array.from(lastName)[0];
  if (!lastInitial) return null;

  return `${firstName} ${lastInitial}.`;
};

const normalizeDisplayNameInput = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return null;

  if (GENERATED_DISPLAY_NAME_PATTERN.test(normalized)) {
    return null;
  }

  const derived = buildDisplayNameFromFullName(normalized);
  if (derived) return derived;

  const shortMatch = normalized.match(DISPLAY_NAME_PATTERN);
  if (shortMatch) {
    return `${shortMatch[1]} ${shortMatch[2]}.`;
  }

  return null;
};
/**
 * Auth Controller
 * Handles authentication-related HTTP requests
 */

/**
 * Ensure a profile row exists for a user. Creates one with a safe default
 * display_name if missing. This handles users created before auto-profile was added.
 */
const ensureProfileExists = async (userId, role) => {
  try {
    if (role === 'admin') return;
    const table = role === 'hirer' ? 'hirer_profiles' : 'caregiver_profiles';
    const existing = await query(`SELECT user_id FROM ${table} WHERE user_id = $1`, [userId]);
    if (existing.rows.length > 0) return;
    const suffix = uuidv4().replace(/-/g, '').slice(0, 4).toUpperCase();
    const defaultName = role === 'caregiver' ? `ผู้ดูแล ${suffix}` : `ผู้ว่าจ้าง ${suffix}`;
    await query(
      `INSERT INTO ${table} (user_id, display_name, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [userId, defaultName]
    );
  } catch (err) {
    console.error('[ensureProfileExists] Error:', err.message, err.stack);
  }
};

/**
 * Build a safe user response object:
 * - Always includes 'name' from profile display_name
 * - Strips password_hash
 */
const buildSafeUserResponse = async (userId) => {
  try {
    const userWithProfile = await User.getUserWithProfile(userId);
    if (!userWithProfile) return null;
    const { profile, ...rest } = userWithProfile;
    const name = profile?.display_name ? String(profile.display_name) : rest.name || null;
    delete rest.password_hash;
    return { ...rest, name };
  } catch (err) {
    console.error('[buildSafeUserResponse] Error:', err.message, err.stack);
    return null;
  }
};

/**
 * Register guest user (email + password)
 * POST /api/auth/register/guest
 */
export const registerGuest = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email, password, and role are required',
        fields: {
          email: email ? undefined : 'Email is required',
          password: password ? undefined : 'Password is required',
          role: role ? undefined : 'Role is required',
        },
      });
    }

    // Register user
    const result = await registerGuestService({ email, password, role });

    const policyAcceptances = await getPolicyAcceptances(result.user.id);

    res.status(201).json({
      success: true,
      message: 'Guest user registered successfully',
      data: {
        user: { ...result.user, policy_acceptances: policyAcceptances },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Register guest error:', error);

    if (error.message.includes('already registered')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('must')) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to register user',
    });
  }
};

/**
 * Register member user (phone + password)
 * POST /api/auth/register/member
 */
export const registerMember = async (req, res) => {
  try {
    const { phone_number, password, role, email } = req.body;

    // Validate required fields
    if (!phone_number || !password || !role) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Phone number, password, and role are required',
        fields: {
          phone_number: phone_number ? undefined : 'Phone number is required',
          password: password ? undefined : 'Password is required',
          role: role ? undefined : 'Role is required',
        },
      });
    }

    // Register user
    const result = await registerMemberService({ phone_number, password, role, email });

    const policyAcceptances = await getPolicyAcceptances(result.user.id);

    res.status(201).json({
      success: true,
      message: 'Member user registered successfully',
      data: {
        user: { ...result.user, policy_acceptances: policyAcceptances },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Register member error:', error);

    if (error.message.includes('already registered')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('must')) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to register user',
    });
  }
};

/**
 * Login with email
 * POST /api/auth/login/email
 */
export const loginWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
        fields: {
          email: email ? undefined : 'Email is required',
          password: password ? undefined : 'Password is required',
        },
      });
    }

    // Login user
    const result = await loginWithEmailService(email, password);

    // Ensure profile exists for legacy users
    await ensureProfileExists(result.user.id, result.user.role);

    const safeUser = await buildSafeUserResponse(result.user.id);
    const policyAcceptances = await getPolicyAcceptances(result.user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: { ...(safeUser || result.user), policy_acceptances: policyAcceptances },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Login with email error:', error);

    if (error.message.includes('Invalid')) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
      });
    }

    if (error.message.includes('suspended') || error.message.includes('deleted')) {
      return res.status(403).json({
        error: 'Account access denied',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to login',
    });
  }
};

/**
 * Login with phone number
 * POST /api/auth/login/phone
 */
export const loginWithPhone = async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    // Validate required fields
    if (!phone_number || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Phone number and password are required',
        fields: {
          phone_number: phone_number ? undefined : 'Phone number is required',
          password: password ? undefined : 'Password is required',
        },
      });
    }

    // Login user
    const result = await loginWithPhoneService(phone_number, password);

    // Ensure profile exists for legacy users
    await ensureProfileExists(result.user.id, result.user.role);

    const safeUser = await buildSafeUserResponse(result.user.id);
    const policyAcceptances = await getPolicyAcceptances(result.user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: { ...(safeUser || result.user), policy_acceptances: policyAcceptances },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Login with phone error:', error);

    if (error.message.includes('Invalid')) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
      });
    }

    if (error.message.includes('suspended') || error.message.includes('deleted')) {
      return res.status(403).json({
        error: 'Account access denied',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to login',
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Validate required fields
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Refresh token is required',
      });
    }

    // Refresh tokens
    const result = await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Refresh token error:', error);

    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to refresh token',
    });
  }
};

export const updatePhoneNumber = async (req, res) => {
  try {
    const userId = req.userId;
    const { phone_number } = req.body;
    const normalized = normalizePhoneNumber(phone_number);

    if (!normalized) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid phone number',
      });
    }

    const existing = await User.findByPhoneNumber(normalized);
    if (existing && existing.id !== userId) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Phone number already in use',
      });
    }

    const updated = await User.updateById(userId, {
      phone_number: normalized,
      is_phone_verified: false,
      phone_verified_at: null,
      updated_at: new Date(),
    });

    if (!updated) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        phone_number: updated.phone_number,
        is_phone_verified: updated.is_phone_verified,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Update phone error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update phone number',
    });
  }
};

export const updateEmailAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { email } = req.body;
    const normalized = normalizeEmail(email);

    if (!normalized) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid email',
      });
    }

    const existing = await User.findByEmail(normalized);
    if (existing && existing.id !== userId) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already in use',
      });
    }

    const updated = await User.updateById(userId, {
      email: normalized,
      is_email_verified: false,
      email_verified_at: null,
      updated_at: new Date(),
    });

    if (!updated) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        email: updated.email,
        is_email_verified: updated.is_email_verified,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Update email error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update email',
    });
  }
};

export const acceptPolicyConsent = async (req, res) => {
  try {
    const userId = req.userId;
    const { role, version_policy_accepted } = req.body;

    await acceptPolicy(userId, role, version_policy_accepted);
    const policyAcceptances = await getPolicyAcceptances(userId);

    res.json({
      success: true,
      data: {
        policy_acceptances: policyAcceptances,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Accept policy error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to accept policy',
    });
  }
};

export const updateRole = async (req, res) => {
  try {
    const userId = req.userId;
    const { role } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin role cannot be changed',
      });
    }

    if (user.account_type === 'guest' && role === 'caregiver' && !user.is_phone_verified) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Guest accounts cannot switch to caregiver without phone verification',
      });
    }

    const updated = await User.updateById(userId, {
      role,
      updated_at: new Date(),
    });

    if (!updated) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const displayName = user.name || user.email || user.phone_number || 'Careconnect User';

    if (role === 'hirer') {
      await query(
        `INSERT INTO hirer_profiles (user_id, display_name, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, displayName]
      );
    }

    if (role === 'caregiver') {
      await query(
        `INSERT INTO caregiver_profiles (user_id, display_name, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, displayName]
      );
    }

    res.json({
      success: true,
      data: {
        user: updated,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Update role error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update role',
    });
  }
};

const normalizeString = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter((item) => item);
  return normalized.length ? normalized : null;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

let profileSchemaReady = false;

const ensureProfileSchema = async () => {
  if (profileSchemaReady) return;

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)
  `);

  await query(`
    ALTER TABLE hirer_profiles
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION
  `);

  await query(`
    ALTER TABLE caregiver_profiles
      ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT TRUE
  `);

  profileSchemaReady = true;
};

const hasCaregiverPublicProfileColumn = async () => {
  const result = await query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caregiver_profiles'
        AND column_name = 'is_public_profile'
    ) AS has_column`
  );
  return !!result.rows[0]?.has_column;
};

const hasHirerLatLngColumns = async () => {
  const result = await query(
    `SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'hirer_profiles'
          AND column_name = 'lat'
      ) AS has_lat,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'hirer_profiles'
          AND column_name = 'lng'
      ) AS has_lng`
  );
  return !!result.rows[0]?.has_lat && !!result.rows[0]?.has_lng;
};

/**
 * Get current user
 * GET /api/auth/me
 * Requires: requireAuth middleware
 */
export const getCurrentUser = async (req, res) => {
  try {
    // Ensure profile exists for legacy users
    const rawUser = await User.findById(req.userId);
    if (rawUser) {
      await ensureProfileExists(rawUser.id, rawUser.role);
    }

    const safeUser = await buildSafeUserResponse(req.userId);
    if (!safeUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const policyAcceptances = await getPolicyAcceptances(req.userId);
    const user = { ...safeUser, policy_acceptances: policyAcceptances };

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Get current user error:', error);

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user info',
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 * Requires: requireAuth middleware
 */
export const getMyProfile = async (req, res) => {
  try {
    await ensureProfileSchema();

    const userWithProfile = await User.getUserWithProfile(req.userId);
    if (!userWithProfile) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        role: userWithProfile.role,
        profile: userWithProfile.profile || null,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Get profile error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get profile',
    });
  }
};

/**
 * Update current user profile
 * PUT /api/auth/profile
 * Requires: requireAuth middleware
 */
export const updateMyProfile = async (req, res) => {
  try {
    await ensureProfileSchema();

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin profile cannot be updated here',
      });
    }

    const rawDisplayName = normalizeString(req.body?.display_name);
    const display_name = normalizeDisplayNameInput(rawDisplayName);
    if (!display_name) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'กรุณากรอกชื่อและนามสกุลเต็ม เช่น "สมชาย ใจดี" (ระบบจะแสดงเป็น "สมชาย ใ.")',
      });
    }

    if (user.role === 'hirer') {
      const rawLat = req.body?.lat;
      const rawLng = req.body?.lng;
      const hasLatLngColumns = await hasHirerLatLngColumns();
      const payload = {
        user_id: user.id,
        display_name,
        address_line1: normalizeString(req.body?.address_line1),
        address_line2: normalizeString(req.body?.address_line2),
        district: normalizeString(req.body?.district),
        province: normalizeString(req.body?.province),
        postal_code: normalizeString(req.body?.postal_code),
        lat: typeof rawLat === 'number' && Number.isFinite(rawLat) ? rawLat : null,
        lng: typeof rawLng === 'number' && Number.isFinite(rawLng) ? rawLng : null,
      };

      const result = hasLatLngColumns
        ? await query(
            `INSERT INTO hirer_profiles
              (user_id, display_name, address_line1, address_line2, district, province, postal_code, lat, lng, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (user_id) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 address_line1 = EXCLUDED.address_line1,
                 address_line2 = EXCLUDED.address_line2,
                 district = EXCLUDED.district,
                 province = EXCLUDED.province,
                 postal_code = EXCLUDED.postal_code,
                 lat = EXCLUDED.lat,
                 lng = EXCLUDED.lng,
                 updated_at = NOW()
             RETURNING *`,
            [
              payload.user_id,
              payload.display_name,
              payload.address_line1,
              payload.address_line2,
              payload.district,
              payload.province,
              payload.postal_code,
              payload.lat,
              payload.lng,
            ]
          )
        : await query(
            `INSERT INTO hirer_profiles
              (user_id, display_name, address_line1, address_line2, district, province, postal_code, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (user_id) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 address_line1 = EXCLUDED.address_line1,
                 address_line2 = EXCLUDED.address_line2,
                 district = EXCLUDED.district,
                 province = EXCLUDED.province,
                 postal_code = EXCLUDED.postal_code,
                 updated_at = NOW()
             RETURNING *`,
            [
              payload.user_id,
              payload.display_name,
              payload.address_line1,
              payload.address_line2,
              payload.district,
              payload.province,
              payload.postal_code,
            ]
          );

      return res.status(200).json({
        success: true,
        data: { profile: result.rows[0] },
      });
    }

    const available_days_raw = Array.isArray(req.body?.available_days) ? req.body.available_days : null;
    const available_days = available_days_raw
      ? available_days_raw
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      : null;

    const hasPublicProfileColumn = await hasCaregiverPublicProfileColumn();

    let existingIsPublic = true;
    if (hasPublicProfileColumn) {
      const existingCaregiverProfile = await query(
        `SELECT is_public_profile FROM caregiver_profiles WHERE user_id = $1 LIMIT 1`,
        [user.id],
      );
      existingIsPublic = typeof existingCaregiverProfile.rows[0]?.is_public_profile === 'boolean'
        ? existingCaregiverProfile.rows[0].is_public_profile
        : true;
    }

    const payload = {
      user_id: user.id,
      display_name,
      bio: normalizeString(req.body?.bio),
      experience_years: normalizeNumber(req.body?.experience_years),
      certifications: normalizeStringArray(req.body?.certifications),
      specializations: normalizeStringArray(req.body?.specializations),
      available_from: normalizeString(req.body?.available_from),
      available_to: normalizeString(req.body?.available_to),
      available_days: available_days && available_days.length ? available_days : null,
    };

    if (hasPublicProfileColumn) {
      const isPublicProfile = typeof req.body?.is_public_profile === 'boolean'
        ? req.body.is_public_profile
        : existingIsPublic;

      // Add is_public_profile to payload for this query
      payload.is_public_profile = isPublicProfile;

      const result = await query(
        `INSERT INTO caregiver_profiles
          (user_id, display_name, bio, experience_years, certifications, specializations, available_from, available_to, available_days, is_public_profile, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             bio = EXCLUDED.bio,
             experience_years = EXCLUDED.experience_years,
             certifications = EXCLUDED.certifications,
             specializations = EXCLUDED.specializations,
             available_from = EXCLUDED.available_from,
             available_to = EXCLUDED.available_to,
             available_days = EXCLUDED.available_days,
             is_public_profile = EXCLUDED.is_public_profile,
             updated_at = NOW()
         RETURNING *`,
        [
          payload.user_id,
          payload.display_name,
          payload.bio,
          payload.experience_years,
          payload.certifications,
          payload.specializations,
          payload.available_from,
          payload.available_to,
          payload.available_days,
          payload.is_public_profile,
        ]
      );

      return res.status(200).json({
        success: true,
        data: { profile: result.rows[0] },
      });
    }

    const result = await query(
      `INSERT INTO caregiver_profiles
        (user_id, display_name, bio, experience_years, certifications, specializations, available_from, available_to, available_days, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           bio = EXCLUDED.bio,
           experience_years = EXCLUDED.experience_years,
           certifications = EXCLUDED.certifications,
           specializations = EXCLUDED.specializations,
           available_from = EXCLUDED.available_from,
           available_to = EXCLUDED.available_to,
           available_days = EXCLUDED.available_days,
           updated_at = NOW()
       RETURNING *`,
      [
        payload.user_id,
        payload.display_name,
        payload.bio,
        payload.experience_years,
        payload.certifications,
        payload.specializations,
        payload.available_from,
        payload.available_to,
        payload.available_days,
      ]
    );

    return res.status(200).json({
      success: true,
      data: { profile: result.rows[0] },
    });
  } catch (error) {
    console.error('[Auth Controller] Update profile error:', error);
    const detail = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(500).json({
      error: 'Server error',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update profile' : detail,
    });
  }
};

/**
 * Logout (client-side token removal)
 * POST /api/auth/logout
 * Note: JWT tokens are stateless, so logout is handled client-side
 * This endpoint is optional and can be used for logging/analytics
 */
export const logout = async (req, res) => {
  try {
    // Optionally log logout event
    console.log(`[Auth] User ${req.userId} logged out`);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('[Auth Controller] Logout error:', error);

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to logout',
    });
  }
};

export default {
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
};
