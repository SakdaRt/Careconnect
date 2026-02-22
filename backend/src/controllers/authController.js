import {
  registerGuest as registerGuestService,
  registerMember as registerMemberService,
  loginWithEmail as loginWithEmailService,
  loginWithPhone as loginWithPhoneService,
  refreshAccessToken,
  generateAccessToken,
  generateRefreshToken,
} from '../services/authService.js';
import { acceptPolicy, getPolicyAcceptances } from '../services/policyService.js';
import User from '../models/User.js';
import { query } from '../utils/db.js';
import { triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GENERATED_DISPLAY_NAME_PATTERN = /^ผู้(?:ว่าจ้าง|ดูแล)\s+[A-Z0-9]{4}$/u;
const DISPLAY_NAME_PATTERN = /^(\S+)\s+(\S)\.?$/u;
const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_OAUTH_FRONTEND_COOKIE = 'google_oauth_frontend';
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_OAUTH_SCOPE = ['openid', 'email', 'profile'];

let _OAuth2Client = null;

const loadOAuth2Client = async () => {
  if (_OAuth2Client) return _OAuth2Client;
  try {
    const mod = await import('google-auth-library');
    _OAuth2Client = mod.OAuth2Client;
    return _OAuth2Client;
  } catch {
    return null;
  }
};

const getGoogleOAuthClient = async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const OAuth2Client = await loadOAuth2Client();
  if (!OAuth2Client) {
    console.error('[Auth Controller] google-auth-library is not installed');
    return null;
  }

  return new OAuth2Client(clientId, clientSecret);
};

const getBaseUrl = (req) => {
  // ใช้ค่าจาก environment variable ใน production ก่อน
  if (process.env.NODE_ENV === 'production' && process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
};

const getCallbackUrl = (req) => {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  return `${getBaseUrl(req)}/api/auth/google/callback`;
};

const getFrontendBaseUrl = (req) => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.NODE_ENV === 'production' && process.env.BACKEND_URL) {
    // ใช้ backend URL เป็น fallback ใน production ถ้าไม่มี FRONTEND_URL
    return process.env.BACKEND_URL;
  }
  if (req) {
    const origin = req.get('origin');
    if (origin) return origin;
    const referer = req.get('referer');
    if (referer) { try { return new URL(referer).origin; } catch { /* ignore */ } }
  }
  return 'http://localhost:5173';
};

const buildFrontendRedirectUrl = (pathname, params = {}, req = null, baseUrl = null) => {
  const base = baseUrl || getFrontendBaseUrl(req);
  const url = new URL(pathname, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const getOAuthStateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: GOOGLE_OAUTH_STATE_TTL_MS,
  path: '/api/auth',
});

const clearOAuthStateCookie = (res) => {
  const cookieOptions = getOAuthStateCookieOptions();
  delete cookieOptions.maxAge;
  res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, cookieOptions);
};

const parseCookieHeader = (cookieHeader = '') => cookieHeader
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean)
  .reduce((acc, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) return acc;
    const key = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1);
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(rawValue);
    } catch {
      acc[key] = rawValue;
    }
    return acc;
  }, {});

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

const normalizeFullNameInput = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return null;

  if (GENERATED_DISPLAY_NAME_PATTERN.test(normalized)) {
    return null;
  }

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return null;

  return normalized;
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
    const name = profile?.full_name
      ? String(profile.full_name)
      : (profile?.display_name ? String(profile.display_name) : rest.name || null);
    delete rest.password_hash;
    return { ...rest, name };
  } catch (err) {
    console.error('[buildSafeUserResponse] Error:', err.message, err.stack);
    return null;
  }
};

/**
 * Start Google OAuth Authorization Code flow
 * GET /api/auth/google
 */
export const googleLogin = async (req, res) => {
  try {
    const oauthClient = await getGoogleOAuthClient();
    if (!oauthClient) {
      console.error('[Auth Controller] Google OAuth is not configured');
      return res.status(500).json({
        error: 'Server error',
        message: 'Google OAuth is not configured',
      });
    }

    const callbackUrl = getCallbackUrl(req);
    const frontendUrl = getFrontendBaseUrl(req);
    const state = crypto.randomBytes(32).toString('hex');
    const cookieOpts = getOAuthStateCookieOptions();
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOpts);
    res.cookie(GOOGLE_OAUTH_FRONTEND_COOKIE, frontendUrl, cookieOpts);

    const authUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_OAUTH_SCOPE,
      state,
      prompt: 'select_account',
      redirect_uri: callbackUrl,
    });

    return res.redirect(authUrl);
  } catch (error) {
    console.error('[Auth Controller] Google login init error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to start Google login',
    });
  }
};

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/callback
 */
export const googleCallback = async (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie || '');
  const savedFrontendUrl = cookies[GOOGLE_OAUTH_FRONTEND_COOKIE] || null;
  res.clearCookie(GOOGLE_OAUTH_FRONTEND_COOKIE, { path: '/api/auth' });

  const redirectBase = savedFrontendUrl || getFrontendBaseUrl(req);
  const redirectToOauthFailed = () => res.redirect(
    buildFrontendRedirectUrl('/login', { error: 'oauth_failed' }, null, redirectBase)
  );

  try {
    const oauthClient = await getGoogleOAuthClient();
    if (!oauthClient) {
      console.error('[Auth Controller] Google OAuth is not configured');
      return redirectToOauthFailed();
    }

    const callbackUrl = getCallbackUrl(req);
    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      console.warn(`[Auth Controller] Google callback returned error: ${String(oauthError)}`);
      clearOAuthStateCookie(res);
      return redirectToOauthFailed();
    }

    const storedState = cookies[GOOGLE_OAUTH_STATE_COOKIE];
    clearOAuthStateCookie(res);

    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      console.warn('[Auth Controller] Missing OAuth callback code/state');
      return redirectToOauthFailed();
    }

    if (!storedState || storedState !== state) {
      console.warn('[Auth Controller] OAuth state mismatch');
      return redirectToOauthFailed();
    }

    await ensureProfileSchema();
    await ensureGoogleAuthSchema();

    const tokenResult = await oauthClient.getToken({ code, redirect_uri: callbackUrl });
    const idToken = tokenResult.tokens?.id_token;
    if (!idToken) {
      throw new Error('Google token exchange did not return id_token');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload?.sub ? String(payload.sub) : null;
    const email = normalizeEmail(payload?.email);
    const picture = typeof payload?.picture === 'string' ? payload.picture : null;
    const isEmailVerified = payload?.email_verified !== false;

    if (!googleId || !email) {
      throw new Error('Google profile payload is missing required identity fields');
    }

    let user = await User.findOne({ google_id: googleId });

    if (!user) {
      const existingByEmail = await User.findByEmail(email);

      if (existingByEmail) {
        const linkedUser = await User.updateById(existingByEmail.id, {
          google_id: googleId,
          avatar: picture || existingByEmail.avatar || null,
          is_email_verified: isEmailVerified || existingByEmail.is_email_verified,
          email_verified_at: isEmailVerified ? new Date() : existingByEmail.email_verified_at || null,
          last_login_at: new Date(),
          updated_at: new Date(),
        });
        user = linkedUser || existingByEmail;
      } else {
        const generatedPassword = crypto.randomBytes(32).toString('hex');
        const created = await registerGuestService({
          email,
          password: generatedPassword,
          role: 'hirer',
        });

        const updatedCreatedUser = await User.updateById(created.user.id, {
          google_id: googleId,
          avatar: picture,
          is_email_verified: isEmailVerified,
          email_verified_at: isEmailVerified ? new Date() : null,
          last_login_at: new Date(),
          updated_at: new Date(),
        });

        user = updatedCreatedUser || created.user;
      }
    } else {
      const updatedUser = await User.updateById(user.id, {
        email: user.email || email,
        avatar: picture || user.avatar || null,
        is_email_verified: isEmailVerified || user.is_email_verified,
        email_verified_at: isEmailVerified ? new Date() : user.email_verified_at || null,
        last_login_at: new Date(),
        updated_at: new Date(),
      });

      user = updatedUser || user;
    }

    if (!user || user.status !== 'active') {
      console.warn('[Auth Controller] Google OAuth user is not active or not found');
      return redirectToOauthFailed();
    }

    await ensureProfileExists(user.id, user.role);
    const safeUser = await buildSafeUserResponse(user.id);
    const tokenSource = safeUser || user;
    const accessToken = generateAccessToken(tokenSource);
    const refreshToken = generateRefreshToken(tokenSource);

    return res.redirect(buildFrontendRedirectUrl('/auth/callback', {
      token: accessToken,
      refreshToken,
    }, null, redirectBase));
  } catch (error) {
    console.error('[Auth Controller] Google callback error:', error);
    return redirectToOauthFailed();
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

export const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'ไม่พบผู้ใช้' });
    }

    // If user has a password (email-based), verify current password
    if (user.password_hash && current_password) {
      const valid = await User.verifyPassword(userId, current_password);
      if (!valid) {
        return res.status(401).json({ success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      }
    }

    await User.updatePassword(userId, new_password);

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('[Auth Controller] Change password error:', error);
    res.status(500).json({ success: false, error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
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

let googleAuthSchemaReady = false;
let profileSchemaReady = false;

const ensureGoogleAuthSchema = async () => {
  if (googleAuthSchemaReady) return;

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
    ON users(google_id)
    WHERE google_id IS NOT NULL
  `);

  googleAuthSchemaReady = true;
};

const ensureProfileSchema = async () => {
  if (profileSchemaReady) return;

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)
  `);

  await query(`
    ALTER TABLE hirer_profiles
      ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION
  `);

  await query(`
    ALTER TABLE caregiver_profiles
      ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
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
    const full_name = normalizeFullNameInput(rawDisplayName);
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
        full_name,
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
              (user_id, display_name, full_name, address_line1, address_line2, district, province, postal_code, lat, lng, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT (user_id) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 full_name = COALESCE(EXCLUDED.full_name, hirer_profiles.full_name),
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
              payload.full_name,
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
              (user_id, display_name, full_name, address_line1, address_line2, district, province, postal_code, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (user_id) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 full_name = COALESCE(EXCLUDED.full_name, hirer_profiles.full_name),
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
              payload.full_name,
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
      full_name,
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
          (user_id, display_name, full_name, bio, experience_years, certifications, specializations, available_from, available_to, available_days, is_public_profile, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             full_name = COALESCE(EXCLUDED.full_name, caregiver_profiles.full_name),
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
          payload.full_name,
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

      // Trigger trust score recalculation after caregiver profile update (fire-and-forget)
      triggerUserTrustUpdate(user.id, 'profile_updated').catch(() => {});

      return res.status(200).json({
        success: true,
        data: { profile: result.rows[0] },
      });
    }

    const result = await query(
      `INSERT INTO caregiver_profiles
        (user_id, display_name, full_name, bio, experience_years, certifications, specializations, available_from, available_to, available_days, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           full_name = COALESCE(EXCLUDED.full_name, caregiver_profiles.full_name),
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
        payload.full_name,
        payload.bio,
        payload.experience_years,
        payload.certifications,
        payload.specializations,
        payload.available_from,
        payload.available_to,
        payload.available_days,
      ]
    );

    // Trigger trust score recalculation after caregiver profile update (fire-and-forget)
    triggerUserTrustUpdate(user.id, 'profile_updated').catch(() => {});

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

export const cancelUnverifiedAccount = async (req, res) => {
  try {
    const userId = req.userId;

    const userResult = await query(
      `SELECT id, is_email_verified, is_phone_verified, account_type FROM users WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Not found', message: 'User not found' });
    }

    if (user.is_email_verified || user.is_phone_verified) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot delete an already-verified account via this endpoint',
      });
    }

    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    res.json({ success: true, message: 'Unverified account deleted' });
  } catch (error) {
    console.error('[Auth Controller] Cancel unverified account error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to delete account' });
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await query(
      `SELECT id, email, status FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Always return success to prevent email enumeration
    if (!userResult.rows.length || userResult.rows[0].status !== 'active') {
      return res.json({ success: true, message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้' });
    }

    const user = userResult.rows[0];

    // Invalidate previous tokens
    await query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    // Generate token (64 bytes hex)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const frontendUrl = getFrontendBaseUrl(req);
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    // Send email
    const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'mock';
    if (EMAIL_PROVIDER === 'smtp') {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@careconnect.local',
        to: user.email,
        subject: 'รีเซ็ตรหัสผ่าน — CareConnect',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
            <h2 style="color:#2563eb;margin-bottom:8px">CareConnect</h2>
            <p style="color:#374151">คุณได้ร้องขอรีเซ็ตรหัสผ่าน</p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;margin:16px 0">ตั้งรหัสผ่านใหม่</a>
            <p style="color:#6b7280;font-size:14px">ลิงก์นี้จะหมดอายุใน <strong>1 ชั่วโมง</strong></p>
            <p style="color:#6b7280;font-size:12px">หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
          </div>`,
      });
    } else {
      // Mock: log to console
      console.log(`[Auth] Password reset link for ${user.email}: ${resetLink}`);
    }

    res.json({ success: true, message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้' });
  } catch (error) {
    console.error('[Auth Controller] Forgot password error:', error);
    res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 * Body: { token, email, new_password }
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, email, new_password } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND u.email = $2`,
      [tokenHash, email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      return res.status(400).json({ success: false, error: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง' });
    }

    const resetToken = result.rows[0];

    if (resetToken.used_at) {
      return res.status(400).json({ success: false, error: 'ลิงก์นี้ถูกใช้งานไปแล้ว' });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว' });
    }

    // Hash new password
    const { hashPassword } = await import('../services/authService.js');
    const hashedPassword = await hashPassword(new_password);

    // Update password + mark token as used
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hashedPassword, resetToken.user_id]);
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [resetToken.id]);

    // Invalidate all other reset tokens for this user
    await query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [resetToken.user_id]
    );

    res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('[Auth Controller] Reset password error:', error);
    res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
};

export default {
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
  cancelUnverifiedAccount,
  forgotPassword,
  resetPassword,
};
