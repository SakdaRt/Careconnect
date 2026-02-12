/**
 * OTP Service
 *
 * Handles OTP generation, sending, and verification for email and phone.
 * Uses mock provider in development, real providers in production.
 */

import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';

const MOCK_PROVIDER_URL = process.env.MOCK_PROVIDER_URL || 'http://mock-provider:4000';
const OTP_EXPIRY_MINUTES = 5;

// In-memory OTP storage (for development)
// In production, this should be stored in Redis or database
const otpStore = new Map();

/**
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP code
 */
function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send OTP to email
 * @param {string} userId - User ID
 * @param {string} email - Email address
 * @returns {object} - OTP result with otp_id
 */
async function sendEmailOtp(userId, email) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock provider is disabled in production');
  }

  const otpCode = generateOtpCode();
  const otpId = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store OTP
  otpStore.set(otpId, {
    type: 'email',
    userId,
    email,
    code: otpCode,
    expiresAt,
    verified: false,
  });

  // Send via mock provider (in production, use real email service)
  try {
    const response = await fetch(`${MOCK_PROVIDER_URL}/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error('Failed to send email OTP');
    }

    console.log(`[OTP Service] Email OTP sent to ${email}: ${otpCode}`);

    return {
      success: true,
      otp_id: otpId,
      email,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      // In development, include the code for testing
      ...(process.env.NODE_ENV === 'development' && { debug_code: otpCode }),
    };
  } catch (error) {
    console.error('[OTP Service] Failed to send email OTP:', error);
    throw error;
  }
}

/**
 * Send OTP to phone
 * @param {string} userId - User ID
 * @param {string} phoneNumber - Phone number
 * @returns {object} - OTP result with otp_id
 */
async function sendPhoneOtp(userId, phoneNumber) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock provider is disabled in production');
  }

  const otpCode = generateOtpCode();
  const otpId = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store OTP
  otpStore.set(otpId, {
    type: 'phone',
    userId,
    phoneNumber,
    code: otpCode,
    expiresAt,
    verified: false,
  });

  // Send via mock provider (in production, use real SMS service)
  try {
    const response = await fetch(`${MOCK_PROVIDER_URL}/sms/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error('Failed to send SMS OTP');
    }

    console.log(`[OTP Service] SMS OTP sent to ${phoneNumber}: ${otpCode}`);

    return {
      success: true,
      otp_id: otpId,
      phone_number: phoneNumber,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      // In development, include the code for testing
      ...(process.env.NODE_ENV === 'development' && { debug_code: otpCode }),
    };
  } catch (error) {
    console.error('[OTP Service] Failed to send SMS OTP:', error);
    throw error;
  }
}

/**
 * Verify OTP code
 * @param {string} otpId - OTP ID
 * @param {string} code - OTP code to verify
 * @returns {object} - Verification result
 */
async function verifyOtp(otpId, code) {
  const otpData = otpStore.get(otpId);

  if (!otpData) {
    return { success: false, error: 'OTP not found or expired' };
  }

  if (otpData.verified) {
    return { success: false, error: 'OTP already used' };
  }

  if (new Date() > otpData.expiresAt) {
    otpStore.delete(otpId);
    return { success: false, error: 'OTP expired' };
  }

  // For development/testing, accept '123456' as a magic code
  const isValid = otpData.code === code ||
    (process.env.NODE_ENV === 'development' && code === '123456');

  if (!isValid) {
    return { success: false, error: 'Invalid OTP code' };
  }

  // Mark as verified
  otpData.verified = true;
  otpStore.set(otpId, otpData);

  // Update user verification status
  try {
    if (otpData.type === 'email') {
      await query(
        `UPDATE users SET is_email_verified = true, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [otpData.userId]
      );
    } else if (otpData.type === 'phone') {
      await query(
        `UPDATE users
         SET is_phone_verified = true,
             phone_verified_at = NOW(),
             account_type = CASE WHEN account_type = 'guest' THEN 'member' ELSE account_type END,
             updated_at = NOW()
         WHERE id = $1`,
        [otpData.userId]
      );
    }

    await triggerUserTrustUpdate(otpData.userId, 'otp');

    // Clean up
    otpStore.delete(otpId);

    return {
      success: true,
      type: otpData.type,
      userId: otpData.userId,
      verified: true,
    };
  } catch (error) {
    console.error('[OTP Service] Failed to update user verification:', error);
    throw error;
  }
}

/**
 * Resend OTP
 * @param {string} otpId - Original OTP ID
 * @returns {object} - New OTP result
 */
async function resendOtp(otpId) {
  const otpData = otpStore.get(otpId);

  if (!otpData) {
    return { success: false, error: 'OTP not found' };
  }

  // Delete old OTP
  otpStore.delete(otpId);

  // Send new OTP
  if (otpData.type === 'email') {
    return await sendEmailOtp(otpData.userId, otpData.email);
  } else {
    return await sendPhoneOtp(otpData.userId, otpData.phoneNumber);
  }
}

export default {
  sendEmailOtp,
  sendPhoneOtp,
  verifyOtp,
  resendOtp,
};
