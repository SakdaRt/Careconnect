/**
 * OTP Service
 *
 * Handles OTP generation, sending, and verification for email and phone.
 * OTP codes stored in PostgreSQL (otp_codes table) — survives backend restarts.
 * Uses SMSOK for SMS, SMTP for email, mock provider as fallback.
 */

import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';
import nodemailer from 'nodemailer';

const MOCK_PROVIDER_URL = process.env.MOCK_PROVIDER_URL || 'http://mock-provider:4000';
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'mock';
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';
const SMSOK_API_URL = process.env.SMSOK_API_URL || 'https://api.smsok.co/s';
const SMSOK_API_KEY = process.env.SMSOK_API_KEY || '';
const SMSOK_API_SECRET = process.env.SMSOK_API_SECRET || '';
const SMSOK_SENDER = process.env.SMSOK_SENDER || 'CareConnect';
const IS_DEV = process.env.NODE_ENV !== 'production';

// ============================================================================
// DB helpers — ensure otp_codes table exists
// ============================================================================

let _tableReady = false;

async function ensureOtpTable() {
  if (_tableReady) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'phone')),
        destination VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        attempts INTEGER NOT NULL DEFAULT 0,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at)`);
    _tableReady = true;
  } catch (err) {
    console.error('[OTP Service] Failed to ensure otp_codes table:', err.message);
  }
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function storeOtp(otpId, userId, type, destination, code, expiresAt) {
  await ensureOtpTable();
  await query(
    `INSERT INTO otp_codes (id, user_id, type, destination, code_hash, expires_at, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [otpId, userId, type, destination, hashCode(code), expiresAt]
  );
}

async function findOtp(otpId) {
  await ensureOtpTable();
  const res = await query(`SELECT * FROM otp_codes WHERE id = $1`, [otpId]);
  return res.rows[0] || null;
}

async function markOtpVerified(otpId) {
  await query(`UPDATE otp_codes SET verified = true WHERE id = $1`, [otpId]);
}

async function incrementAttempts(otpId) {
  await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpId]);
}

async function deleteOtp(otpId) {
  await query(`DELETE FROM otp_codes WHERE id = $1`, [otpId]);
}

async function cleanExpired() {
  try {
    await ensureOtpTable();
    await query(`DELETE FROM otp_codes WHERE expires_at < NOW()`);
  } catch { /* ignore */ }
}

// ============================================================================
// Providers
// ============================================================================

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

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// ============================================================================
// Send Email OTP
// ============================================================================

async function sendEmailOtp(userId, email) {
  const otpCode = generateOtpCode();
  const otpId = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await storeOtp(otpId, userId, 'email', email, otpCode, expiresAt);

  try {
    if (EMAIL_PROVIDER === 'smtp') {
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
      const response = await fetch(`${MOCK_PROVIDER_URL}/email/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode }),
      });
      const result = await response.json();
      if (!result.success) throw new Error('Failed to send email OTP via mock');
      console.log(`[OTP Service] Email OTP sent via mock to ${email}`);
    }

    if (IS_DEV) {
      console.log(`[OTP Service] [DEV] Email OTP code for ${email}: ${otpCode}`);
    }

    return {
      success: true,
      otp_id: otpId,
      email,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      ...(IS_DEV ? { _dev_code: otpCode } : {}),
    };
  } catch (error) {
    console.error('[OTP Service] Failed to send email OTP:', error.message || error);
    await deleteOtp(otpId);
    throw error;
  }
}

// ============================================================================
// Send Phone OTP (SMS)
// ============================================================================

async function sendPhoneOtp(userId, phoneNumber) {
  const { normalizePhone, toE164 } = await import('../utils/phone.js');
  const canonical = normalizePhone(phoneNumber) || phoneNumber;
  const otpCode = generateOtpCode();
  const otpId = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await storeOtp(otpId, userId, 'phone', canonical, otpCode, expiresAt);

  try {
    if (SMS_PROVIDER === 'smsok') {
      if (!SMSOK_API_KEY || !SMSOK_API_SECRET) {
        throw new Error('SMSOK credentials not configured (SMSOK_API_KEY / SMSOK_API_SECRET)');
      }

      const providerPhone = toE164(canonical) || canonical;
      const credentials = Buffer.from(`${SMSOK_API_KEY}:${SMSOK_API_SECRET}`).toString('base64');
      const smsBody = {
        sender: SMSOK_SENDER,
        text: `รหัส OTP CareConnect: ${otpCode} ใช้ได้ ${OTP_EXPIRY_MINUTES} นาที`,
        destinations: [{ destination: providerPhone }],
      };

      console.log(`[OTP Service] Sending SMS via SMSOK to ${providerPhone} (canonical: ${canonical})...`);

      const response = await fetch(SMSOK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Authorization': `Basic ${credentials}`,
        },
        body: JSON.stringify(smsBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[OTP Service] SMSOK HTTP error ${response.status}:`, errText);
        throw new Error(`SMSOK API error ${response.status}: ${errText}`);
      }

      const result = await response.json();

      const dest = result.destinations?.[0];
      if (dest && dest.status !== 'NO_ERROR') {
        console.error(`[OTP Service] SMSOK destination error for ${phoneNumber}:`, dest.status);
        throw new Error(`SMS delivery failed: ${dest.status}`);
      }

      console.log(`[OTP Service] SMS OTP sent via SMSOK to ${phoneNumber} — message_id: ${dest?.message_id}, balance: ${result.remaining_balance}`);
    } else {
      const response = await fetch(`${MOCK_PROVIDER_URL}/sms/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
      });
      const result = await response.json();
      if (!result.success) throw new Error('Failed to send SMS OTP via mock');
      console.log(`[OTP Service] SMS OTP sent via mock to ${phoneNumber}`);
    }

    if (IS_DEV) {
      console.log(`[OTP Service] [DEV] Phone OTP code for ${phoneNumber}: ${otpCode}`);
    }

    return {
      success: true,
      otp_id: otpId,
      phone_number: phoneNumber,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      ...(IS_DEV ? { _dev_code: otpCode } : {}),
    };
  } catch (error) {
    console.error('[OTP Service] Failed to send SMS OTP:', error.message || error);
    await deleteOtp(otpId);
    throw error;
  }
}

// ============================================================================
// Verify OTP
// ============================================================================

async function verifyOtp(otpId, code) {
  await cleanExpired();

  const otpData = await findOtp(otpId);

  if (!otpData) {
    return { success: false, error: 'OTP not found or expired' };
  }

  if (otpData.verified) {
    return { success: false, error: 'OTP already used' };
  }

  if (new Date() > new Date(otpData.expires_at)) {
    await deleteOtp(otpId);
    return { success: false, error: 'OTP expired' };
  }

  if (otpData.attempts >= MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(otpId);
    return { success: false, error: 'Too many failed attempts. Please request a new OTP.' };
  }

  const isValid = hashCode(code) === otpData.code_hash;

  if (!isValid) {
    await incrementAttempts(otpId);
    return { success: false, error: 'Invalid OTP code' };
  }

  await markOtpVerified(otpId);

  try {
    if (otpData.type === 'email') {
      await query(
        `UPDATE users SET is_email_verified = true, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [otpData.user_id]
      );
    } else if (otpData.type === 'phone') {
      await query(
        `UPDATE users
         SET phone_number = $2,
             is_phone_verified = true,
             phone_verified_at = NOW(),
             account_type = CASE WHEN account_type = 'guest' THEN 'member' ELSE account_type END,
             updated_at = NOW()
         WHERE id = $1`,
        [otpData.user_id, otpData.destination]
      );
    }

    await triggerUserTrustUpdate(otpData.user_id, 'otp');

    await deleteOtp(otpId);

    console.log(`[OTP Service] OTP verified — type: ${otpData.type}, user: ${otpData.user_id}`);

    return {
      success: true,
      type: otpData.type,
      userId: otpData.user_id,
      verified: true,
    };
  } catch (error) {
    console.error('[OTP Service] Failed to update user verification:', error);
    throw error;
  }
}

// ============================================================================
// Resend OTP
// ============================================================================

async function resendOtp(otpId) {
  const otpData = await findOtp(otpId);

  if (!otpData) {
    return { success: false, error: 'OTP not found' };
  }

  const secondsSinceSent = (Date.now() - new Date(otpData.sent_at).getTime()) / 1000;
  if (secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
    const remainingSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceSent);
    return {
      success: false,
      error: 'Please wait before requesting a new OTP',
      retry_after_seconds: remainingSeconds,
    };
  }

  await deleteOtp(otpId);

  if (otpData.type === 'email') {
    return await sendEmailOtp(otpData.user_id, otpData.destination);
  } else {
    return await sendPhoneOtp(otpData.user_id, otpData.destination);
  }
}

export default {
  sendEmailOtp,
  sendPhoneOtp,
  verifyOtp,
  resendOtp,
};
