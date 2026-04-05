/**
 * OTP Controller
 * Handles OTP-related HTTP requests
 */

import otpService from '../services/otpService.js';
import { query } from '../utils/db.js';

const sanitizeOtpData = (result) => {
  if (process.env.NODE_ENV !== 'production' || !result || typeof result !== 'object') {
    return result;
  }
  const { _dev_code, ...safeResult } = result;
  return safeResult;
};

/**
 * Send email OTP
 * POST /api/otp/email/send
 * Requires: requireAuth
 */
export const sendEmailOtp = async (req, res) => {
  try {
    const userId = req.userId;

    // Accept email from body (pre-verify flow) or fall back to DB
    const bodyEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;

    const userResult = await query(`SELECT email, is_email_verified FROM users WHERE id = $1`, [userId]);

    if (!userResult.rows[0]) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];
    const emailToVerify = bodyEmail || user.email;

    if (!emailToVerify) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'กรุณากรอกอีเมล',
      });
    }

    // Check duplicate email
    if (bodyEmail && bodyEmail !== user.email) {
      const existing = await query(
        `SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1`,
        [emailToVerify, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'อีเมลนี้ถูกใช้งานแล้ว',
        });
      }
    }

    if (user.email === emailToVerify && user.is_email_verified) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'อีเมลนี้ยืนยันแล้ว',
      });
    }

    const result = await otpService.sendEmailOtp(userId, emailToVerify);

    res.json({
      success: true,
      message: 'OTP sent to email',
      data: sanitizeOtpData(result),
    });
  } catch (error) {
    console.error('[OTP Controller] Send email OTP error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to send OTP',
    });
  }
};

/**
 * Send phone OTP
 * POST /api/otp/phone/send
 * Requires: requireAuth
 */
export const sendPhoneOtp = async (req, res) => {
  try {
    const userId = req.userId;
    const { normalizePhone } = await import('../utils/phone.js');

    // Accept phone from body (for pre-verify flow) or fall back to DB
    const bodyPhone = req.body?.phone_number ? normalizePhone(req.body.phone_number) : null;

    const userResult = await query(`SELECT phone_number, is_phone_verified FROM users WHERE id = $1`, [userId]);

    if (!userResult.rows[0]) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];
    const phoneToVerify = bodyPhone || normalizePhone(user.phone_number);

    if (!phoneToVerify) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'กรุณากรอกเบอร์โทรศัพท์',
      });
    }

    // Check if this phone is already verified by another user
    if (bodyPhone && bodyPhone !== normalizePhone(user.phone_number)) {
      const existing = await query(
        `SELECT id FROM users WHERE phone_number = $1 AND id != $2 LIMIT 1`,
        [phoneToVerify, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'เบอร์โทรนี้ถูกใช้งานแล้ว',
        });
      }
    }

    if (normalizePhone(user.phone_number) === phoneToVerify && user.is_phone_verified) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'เบอร์โทรนี้ยืนยันแล้ว',
      });
    }

    const result = await otpService.sendPhoneOtp(userId, phoneToVerify);

    res.json({
      success: true,
      message: 'OTP sent to phone',
      data: sanitizeOtpData(result),
    });
  } catch (error) {
    console.error('[OTP Controller] Send phone OTP error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to send OTP',
    });
  }
};

/**
 * Verify OTP
 * POST /api/otp/verify
 * Requires: requireAuth
 */
export const verifyOtp = async (req, res) => {
  try {
    const { otp_id, code } = req.body;

    if (!otp_id || !code) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'OTP ID and code are required',
      });
    }

    const result = await otpService.verifyOtp(otp_id, code);

    if (!result.success) {
      return res.status(400).json({
        error: 'Verification failed',
        message: result.error,
      });
    }

    // Registration flow — return tokens for newly created user
    if (result.registeredUser) {
      const { generateAccessToken, generateRefreshToken } = await import('../services/authService.js');
      const accessToken = generateAccessToken(result.registeredUser);
      const refreshToken = generateRefreshToken(result.registeredUser);

      return res.json({
        success: true,
        message: 'ลงทะเบียนสำเร็จ',
        data: {
          type: result.type,
          registered: true,
          user: result.registeredUser,
          accessToken,
          refreshToken,
        },
      });
    }

    // Existing user verification flow
    const userResult = await query(
      `SELECT is_email_verified, is_phone_verified, trust_level FROM users WHERE id = $1`,
      [result.userId]
    );

    res.json({
      success: true,
      message: `${result.type === 'email' ? 'Email' : 'Phone'} verified successfully`,
      data: {
        type: result.type,
        is_email_verified: userResult.rows[0]?.is_email_verified,
        is_phone_verified: userResult.rows[0]?.is_phone_verified,
        trust_level: userResult.rows[0]?.trust_level,
      },
    });
  } catch (error) {
    console.error('[OTP Controller] Verify OTP error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to verify OTP',
    });
  }
};

/**
 * Resend OTP
 * POST /api/otp/resend
 * Requires: requireAuth
 */
export const resendOtp = async (req, res) => {
  try {
    const { otp_id } = req.body;

    if (!otp_id) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'OTP ID is required',
      });
    }

    const result = await otpService.resendOtp(otp_id);

    if (!result.success) {
      return res.status(400).json({
        error: 'Resend failed',
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: 'OTP resent',
      data: sanitizeOtpData(result),
    });
  } catch (error) {
    console.error('[OTP Controller] Resend OTP error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to resend OTP',
    });
  }
};

export default {
  sendEmailOtp,
  sendPhoneOtp,
  verifyOtp,
  resendOtp,
};
