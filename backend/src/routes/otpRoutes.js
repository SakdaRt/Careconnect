import express from 'express';
import { sendEmailOtp, sendPhoneOtp, verifyOtp, resendOtp } from '../controllers/otpController.js';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import { otpLimiter } from '../utils/rateLimiter.js';

const router = express.Router();

/**
 * OTP Routes
 * Base path: /api/otp
 *
 * These endpoints handle OTP verification for email and phone.
 */

/**
 * Send email OTP
 * POST /api/otp/email/send
 * Headers: Authorization: Bearer <token>
 */
router.post('/email/send', requireAuth, requirePolicy('auth:otp'), otpLimiter, sendEmailOtp);

/**
 * Send phone OTP
 * POST /api/otp/phone/send
 * Headers: Authorization: Bearer <token>
 */
router.post('/phone/send', requireAuth, requirePolicy('auth:otp'), otpLimiter, sendPhoneOtp);

/**
 * Verify OTP
 * POST /api/otp/verify
 * Headers: Authorization: Bearer <token>
 * Body: { otp_id, code }
 */
router.post('/verify', requireAuth, requirePolicy('auth:otp'), otpLimiter, verifyOtp);

/**
 * Resend OTP
 * POST /api/otp/resend
 * Headers: Authorization: Bearer <token>
 * Body: { otp_id }
 */
router.post('/resend', requireAuth, requirePolicy('auth:otp'), otpLimiter, resendOtp);

export default router;
