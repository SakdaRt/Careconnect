/**
 * OTP Controller
 * Handles OTP-related HTTP requests
 */

import otpService from '../services/otpService.js';
import { query } from '../utils/db.js';

/**
 * Send email OTP
 * POST /api/otp/email/send
 * Requires: requireAuth
 */
export const sendEmailOtp = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user email
    const userResult = await query(`SELECT email, is_email_verified FROM users WHERE id = $1`, [userId]);

    if (!userResult.rows[0]) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    if (!user.email) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No email address associated with this account',
      });
    }

    if (user.is_email_verified) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Email is already verified',
      });
    }

    const result = await otpService.sendEmailOtp(userId, user.email);

    res.json({
      success: true,
      message: 'OTP sent to email',
      data: result,
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

    // Get user phone
    const userResult = await query(`SELECT phone_number, is_phone_verified FROM users WHERE id = $1`, [userId]);

    if (!userResult.rows[0]) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    if (!user.phone_number) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No phone number associated with this account',
      });
    }

    if (user.is_phone_verified) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Phone number is already verified',
      });
    }

    const result = await otpService.sendPhoneOtp(userId, user.phone_number);

    res.json({
      success: true,
      message: 'OTP sent to phone',
      data: result,
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

    // Get updated user info
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
      data: result,
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
