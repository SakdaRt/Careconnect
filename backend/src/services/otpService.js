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
import nodemailer from 'nodemailer';

const MOCK_PROVIDER_URL = process.env.MOCK_PROVIDER_URL || 'http://mock-provider:4000';
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'mock';
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';
const SMSOK_API_URL = process.env.SMSOK_API_URL || 'https://smsok.co/api/v1/s';
const SMSOK_API_KEY = process.env.SMSOK_API_KEY || '';
const SMSOK_API_SECRET = process.env.SMSOK_API_SECRET || '';
const SMSOK_SENDER = process.env.SMSOK_SENDER || 'CareConnect';

// In-memory OTP storage (for development)
// In production, this should be stored in Redis or database
const otpStore = new Map();

/**
 * Create a nodemailer SMTP transporter from environment variables
 */
function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

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
    sentAt: new Date(),
    verified: false,
  });

  try {
    if (EMAIL_PROVIDER === 'smtp') {
      // Send via real SMTP (nodemailer)
      const transporter = createSmtpTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@careconnect.local',
        to: email,
        subject: 'รหัส OTP ยืนยัน Email — CareConnect',
        text: `รหัส OTP ของคุณคือ: ${otpCode}\n\nรหัสนี้จะหมดอายุใน ${OTP_EXPIRY_MINUTES} นาที\nหากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
            <h2 style="color:#2563eb;margin-bottom:8px">CareConnect</h2>
            <p style="color:#374151">รหัส OTP สำหรับยืนยัน Email ของคุณ:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827;text-align:center;padding:16px 0">${otpCode}</div>
            <p style="color:#6b7280;font-size:14px">รหัสนี้จะหมดอายุใน <strong>${OTP_EXPIRY_MINUTES} นาที</strong></p>
            <p style="color:#6b7280;font-size:12px">หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
          </div>`,
      });
      console.log(`[OTP Service] Email OTP sent via SMTP to ${email}`);
    } else {
      // Send via mock provider
      const response = await fetch(`${MOCK_PROVIDER_URL}/email/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error('Failed to send email OTP');
      }

      console.log(`[OTP Service] Email OTP sent via mock to ${email}: ${otpCode}`);
    }

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
    otpStore.delete(otpId);
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
    sentAt: new Date(),
    verified: false,
  });

  try {
    if (SMS_PROVIDER === 'smsok') {
      // Send via SMSOK API (BasicAuth)
      const credentials = Buffer.from(`${SMSOK_API_KEY}:${SMSOK_API_SECRET}`).toString('base64');
      const response = await fetch(SMSOK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Authorization': `Basic ${credentials}`,
        },
        body: JSON.stringify({
          sender: SMSOK_SENDER,
          text: `รหัส OTP CareConnect ของคุณคือ: ${otpCode} (หมดอายุใน ${OTP_EXPIRY_MINUTES} นาที)`,
          destinations: [{ destination: phoneNumber }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SMSOK API error ${response.status}: ${errText}`);
      }

      const result = await response.json();
      console.log(`[OTP Service] SMS OTP sent via SMSOK to ${phoneNumber}`, result);
    } else {
      // Send via mock provider
      const response = await fetch(`${MOCK_PROVIDER_URL}/sms/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error('Failed to send SMS OTP');
      }

      console.log(`[OTP Service] SMS OTP sent via mock to ${phoneNumber}: ${otpCode}`);
    }

    return {
      success: true,
      otp_id: otpId,
      phone_number: phoneNumber,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      ...(process.env.NODE_ENV === 'development' && { debug_code: otpCode }),
    };
  } catch (error) {
    console.error('[OTP Service] Failed to send SMS OTP:', error);
    otpStore.delete(otpId);
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

  // Cooldown check: must wait RESEND_COOLDOWN_SECONDS before resending
  const secondsSinceSent = (Date.now() - new Date(otpData.sentAt).getTime()) / 1000;
  if (secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
    const remainingSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceSent);
    return {
      success: false,
      error: 'Please wait before requesting a new OTP',
      retry_after_seconds: remainingSeconds,
    };
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
