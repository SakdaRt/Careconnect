import express from 'express';
import { sendEmailOtp, sendPhoneOtp, verifyOtp, resendOtp } from '../controllers/otpController.js';
import { requireAuth } from '../middleware/auth.js';

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
router.post('/email/send', requireAuth, sendEmailOtp);

/**
 * Send phone OTP
 * POST /api/otp/phone/send
 * Headers: Authorization: Bearer <token>
 */
router.post('/phone/send', requireAuth, sendPhoneOtp);

/**
 * Verify OTP
 * POST /api/otp/verify
 * Headers: Authorization: Bearer <token>
 * Body: { otp_id, code }
 */
router.post('/verify', requireAuth, verifyOtp);

/**
 * Resend OTP
 * POST /api/otp/resend
 * Headers: Authorization: Bearer <token>
 * Body: { otp_id }
 */
router.post('/resend', requireAuth, resendOtp);

export default router;
