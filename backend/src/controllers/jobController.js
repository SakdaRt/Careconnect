import {
  createJob as createJobService,
  publishJob as publishJobService,
  getJobFeed as getJobFeedService,
  getHirerJobs as getHirerJobsService,
  getCaregiverJobs as getCaregiverJobsService,
  getJobById as getJobByIdService,
  acceptJob as acceptJobService,
  rejectAssignedJob as rejectAssignedJobService,
  checkIn as checkInService,
  checkOut as checkOutService,
  cancelJob as cancelJobService,
  getJobStats as getJobStatsService,
} from '../services/jobService.js';
import { ApiError } from '../utils/errors.js';
import Job, { InvalidTransitionError } from '../models/Job.js';

/**
 * Handle job-related errors with proper HTTP status codes
 * @param {Error} error - The error to handle
 * @param {object} res - Express response object
 * @param {string} operation - Operation description for logging
 */
const handleJobError = (error, res, operation) => {
  console.error(`[Job Controller] ${operation} error:`, error);

  if (error instanceof ApiError) {
    return res.status(error.status || 500).json({
      error: error.status >= 500 ? 'Server error' : 'Bad request',
      message: error.message,
      code: error.code,
      details: error.details || null,
    });
  }

  if (error instanceof InvalidTransitionError) {
    return res.status(error.status || 400).json({
      error: 'Invalid state transition',
      message: error.message,
      details: {
        from_state: error.fromState,
        to_state: error.toState,
        job_id: error.jobId,
      },
    });
  }

  if (error.message.includes('not found')) {
    return res.status(404).json({
      error: 'Not found',
      message: error.message,
    });
  }

  if (error.message.includes('Only hirers') || error.message.includes('Only caregivers') ||
      error.message.includes('not active') || error.message.includes('Not authorized') ||
      error.message.includes('Insufficient trust')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: error.message,
    });
  }

  if (error.message.includes('Missing') || error.message.includes('Invalid') ||
      error.message.includes('must') || error.message.includes('GPS') ||
      error.message.includes('Cannot accept') || error.message.includes('Cannot check') ||
      error.message.includes('Cannot cancel') || error.message.includes('Cannot reject') || error.message.includes('already has') ||
      error.message.includes('already assigned') || error.message.includes('Insufficient balance')) {
    return res.status(400).json({
      error: 'Bad request',
      message: error.message,
    });
  }

  res.status(500).json({
    error: 'Server error',
    message: `Failed to ${operation}`,
  });
};

/**
 * Job Controller
 * Handles job-related HTTP requests
 */

/**
 * Create a new job post (draft)
 * POST /api/jobs
 * Requires: requireAuth, requireRole('hirer')
 */
export const createJob = async (req, res) => {
  try {
    const hirerId = req.userId;
    const jobData = req.body;

    const job = await createJobService(hirerId, jobData);

    res.status(201).json({
      success: true,
      message: 'สร้างงานสำเร็จ',
      data: { job },
    });
  } catch (error) {
    handleJobError(error, res, 'create job');
  }
};

/**
 * Reject direct-assigned job offer (preferred caregiver flow)
 * POST /api/jobs/:id/reject
 * Requires: requireAuth, requireRole('caregiver')
 */
export const rejectAssignedJob = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { id: jobPostId } = req.params;
    const { reason } = req.body || {};

    const result = await rejectAssignedJobService(jobPostId, caregiverId, reason);

    res.status(200).json({
      success: true,
      message: 'ปฏิเสธงานสำเร็จ',
      data: result,
    });
  } catch (error) {
    handleJobError(error, res, 'reject assigned job');
  }
};

/**
 * Publish job post (draft → posted)
 * POST /api/jobs/:id/publish
 * Requires: requireAuth, requireRole('hirer')
 */
export const publishJob = async (req, res) => {
  try {
    const hirerId = req.userId;
    const { id: jobPostId } = req.params;

    const job = await publishJobService(hirerId, jobPostId);

    res.status(200).json({
      success: true,
      message: 'เผยแพร่งานสำเร็จ',
      data: { job },
    });
  } catch (error) {
    handleJobError(error, res, 'publish job');
  }
};

/**
 * Get job feed for caregivers
 * GET /api/jobs/feed
 * Requires: requireAuth, requireRole('caregiver')
 */
export const getJobFeed = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { job_type, risk_level, is_urgent, page, limit } = req.query;

    const options = {
      job_type,
      risk_level,
      is_urgent: is_urgent === 'true' ? true : is_urgent === 'false' ? false : undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const jobs = await getJobFeedService(caregiverId, options);

    res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('[Job Controller] Get job feed error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not found',
        message: error.message,
      });
    }

    if (error.message.includes('Only caregivers')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get job feed',
    });
  }
};

/**
 * Get hirer's jobs
 * GET /api/jobs/my-jobs
 * Requires: requireAuth, requireRole('hirer')
 */
export const getHirerJobs = async (req, res) => {
  try {
    const hirerId = req.userId;
    const { status, page, limit } = req.query;

    const options = {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const jobs = await getHirerJobsService(hirerId, options);

    res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('[Job Controller] Get hirer jobs error:', error);

    // If table doesn't exist or query fails, return empty result
    if (error.code === '42P01') {
      return res.status(200).json({
        success: true,
        data: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get jobs',
    });
  }
};

/**
 * Get caregiver's assigned jobs
 * GET /api/jobs/assigned
 * Requires: requireAuth, requireRole('caregiver')
 */
export const getCaregiverJobs = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { status, page, limit } = req.query;

    const options = {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const jobs = await getCaregiverJobsService(caregiverId, options);

    res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('[Job Controller] Get caregiver jobs error:', error);

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get assigned jobs',
    });
  }
};

/**
 * Get job by ID
 * GET /api/jobs/:id
 * Requires: requireAuth
 */
export const getJobById = async (req, res) => {
  try {
    const userId = req.userId;
    const { id: jobPostId } = req.params;

    const job = await getJobByIdService(jobPostId, userId);

    res.status(200).json({
      success: true,
      data: { job },
    });
  } catch (error) {
    console.error('[Job Controller] Get job by ID error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not found',
        message: error.message,
      });
    }

    if (error.message.includes('Not authorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get job',
    });
  }
};

/**
 * Accept a job (posted → assigned)
 * POST /api/jobs/:id/accept
 * Requires: requireAuth, requireRole('caregiver')
 */
export const acceptJob = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { id: jobPostId } = req.params;

    const result = await acceptJobService(jobPostId, caregiverId);

    res.status(200).json({
      success: true,
      message: 'รับงานสำเร็จ',
      data: result,
    });
  } catch (error) {
    handleJobError(error, res, 'accept job');
  }
};

/**
 * Check in to job (assigned → in_progress)
 * POST /api/jobs/:jobId/checkin
 * Requires: requireAuth, requireRole('caregiver')
 */
export const checkIn = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { jobId } = req.params;
    const { lat, lng, accuracy_m } = req.body;

    const gpsData = { lat, lng, accuracy_m };
    const result = await checkInService(jobId, caregiverId, gpsData);

    res.status(200).json({
      success: true,
      message: 'เช็คอินสำเร็จ',
      data: { job: result },
    });
  } catch (error) {
    handleJobError(error, res, 'check in');
  }
};

/**
 * Check out from job (in_progress → completed)
 * POST /api/jobs/:jobId/checkout
 * Requires: requireAuth, requireRole('caregiver')
 */
export const checkOut = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { jobId } = req.params;
    const { lat, lng, accuracy_m, evidence_note } = req.body;

    if (!evidence_note || !String(evidence_note).trim()) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกหลักฐานการทำงาน (สรุปงานที่ทำ)',
      });
    }

    const gpsData = { lat, lng, accuracy_m };
    const result = await checkOutService(jobId, caregiverId, gpsData);

    res.status(200).json({
      success: true,
      message: 'เช็คเอาต์สำเร็จ ระบบจ่ายเงินเรียบร้อย',
      data: result,
    });
  } catch (error) {
    handleJobError(error, res, 'check out');
  }
};

/**
 * Cancel job
 * POST /api/jobs/:id/cancel
 * Requires: requireAuth
 */
export const cancelJob = async (req, res) => {
  try {
    const userId = req.userId;
    const { id: jobPostId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Cancellation reason is required',
      });
    }

    const result = await cancelJobService(jobPostId, userId, reason);

    res.status(200).json({
      success: true,
      message: 'ยกเลิกงานสำเร็จ',
      data: result,
    });
  } catch (error) {
    handleJobError(error, res, 'cancel job');
  }
};

/**
 * Get job statistics
 * GET /api/jobs/stats
 * Requires: requireAuth (admin only in production)
 */
export const getJobStats = async (req, res) => {
  try {
    const stats = await getJobStatsService();

    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('[Job Controller] Get job stats error:', error);

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get job statistics',
    });
  }
};

/**
 * Request early checkout (before scheduled_end_at)
 * POST /api/jobs/:jobId/early-checkout-request
 * Requires: requireAuth, requireRole('caregiver')
 */
export const requestEarlyCheckout = async (req, res) => {
  try {
    const caregiverId = req.userId;
    const { jobId } = req.params;
    const { evidence_note } = req.body;

    if (!evidence_note || !String(evidence_note).trim()) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกหลักฐานการทำงาน (สรุปงานที่ทำ)',
      });
    }

    const { query: dbQuery } = await import('../utils/db.js');

    // Find job + assignment
    const jobResult = await dbQuery(
      `SELECT j.id AS job_id, j.job_post_id, j.status AS job_status,
              jp.hirer_id, jp.title, jp.scheduled_end_at,
              ja.caregiver_id
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       WHERE (j.id = $1 OR j.job_post_id = $1)
       LIMIT 1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
    }

    const job = jobResult.rows[0];

    if (job.caregiver_id !== caregiverId) {
      return res.status(403).json({ success: false, error: 'คุณไม่ใช่ผู้ดูแลงานนี้' });
    }

    if (job.job_status !== 'in_progress') {
      return res.status(400).json({ success: false, error: 'งานต้องอยู่ในสถานะกำลังทำงานเท่านั้น' });
    }

    // Ensure table exists
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS early_checkout_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL,
        job_post_id UUID NOT NULL,
        caregiver_id UUID NOT NULL,
        hirer_id UUID NOT NULL,
        evidence_note TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        rejected_reason TEXT,
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Check if already has pending request
    const existing = await dbQuery(
      `SELECT id FROM early_checkout_requests WHERE job_id = $1 AND status = 'pending' LIMIT 1`,
      [job.job_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'มีคำขอส่งงานก่อนเวลาที่รอตอบรับอยู่แล้ว' });
    }

    const insertResult = await dbQuery(
      `INSERT INTO early_checkout_requests (job_id, job_post_id, caregiver_id, hirer_id, evidence_note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [job.job_id, job.job_post_id, caregiverId, job.hirer_id, String(evidence_note).trim()]
    );

    // Send notification to hirer
    try {
      const { notifyEarlyCheckoutRequest } = await import('../services/notificationService.js');
      const cgRes = await dbQuery(`SELECT display_name FROM caregiver_profiles WHERE user_id = $1 LIMIT 1`, [caregiverId]);
      const caregiverName = cgRes.rows[0]?.display_name || 'ผู้ดูแล';
      await notifyEarlyCheckoutRequest(job.hirer_id, job.title, caregiverName, job.job_post_id);
    } catch (e) {
      console.error('Failed to send early checkout notification:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'ส่งคำขอส่งงานก่อนเวลาแล้ว รอผู้ว่าจ้างอนุมัติ',
      data: { request: insertResult.rows[0] },
    });
  } catch (error) {
    handleJobError(error, res, 'request early checkout');
  }
};

/**
 * Respond to early checkout request (hirer approve/reject)
 * POST /api/jobs/:jobId/early-checkout-respond
 * Requires: requireAuth, requireRole('hirer')
 */
export const respondEarlyCheckout = async (req, res) => {
  try {
    const hirerId = req.userId;
    const { jobId } = req.params;
    const { action, reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action ต้องเป็น approve หรือ reject' });
    }

    const { query: dbQuery } = await import('../utils/db.js');

    // Find pending request
    const reqResult = await dbQuery(
      `SELECT ecr.*, j.id AS actual_job_id, jp.title AS job_title
       FROM early_checkout_requests ecr
       JOIN jobs j ON j.id = ecr.job_id
       JOIN job_posts jp ON jp.id = ecr.job_post_id
       WHERE (ecr.job_id = $1 OR ecr.job_post_id = $1)
         AND ecr.hirer_id = $2
         AND ecr.status = 'pending'
       ORDER BY ecr.created_at DESC
       LIMIT 1`,
      [jobId, hirerId]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'ไม่พบคำขอส่งงานก่อนเวลาที่รอตอบรับ' });
    }

    const request = reqResult.rows[0];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await dbQuery(
      `UPDATE early_checkout_requests SET status = $1, rejected_reason = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [newStatus, action === 'reject' ? (reason || null) : null, request.id]
    );

    if (action === 'approve') {
      // Execute actual checkout
      try {
        const result = await checkOutService(request.actual_job_id, request.caregiver_id, {});
        // Notify caregiver
        try {
          const { notifyEarlyCheckoutApproved } = await import('../services/notificationService.js');
          await notifyEarlyCheckoutApproved(request.caregiver_id, request.job_title, request.actual_job_id);
        } catch (e) {
          console.error('Failed to send early checkout approved notification:', e.message);
        }

        return res.status(200).json({
          success: true,
          message: 'อนุมัติส่งงานก่อนเวลาแล้ว ระบบดำเนินการเช็คเอาต์เรียบร้อย',
          data: { checkout: result },
        });
      } catch (checkoutError) {
        // Revert request status if checkout fails
        await dbQuery(
          `UPDATE early_checkout_requests SET status = 'pending', responded_at = NULL, updated_at = NOW() WHERE id = $1`,
          [request.id]
        );
        throw checkoutError;
      }
    } else {
      // Notify caregiver of rejection
      try {
        const { notifyEarlyCheckoutRejected } = await import('../services/notificationService.js');
        await notifyEarlyCheckoutRejected(request.caregiver_id, request.job_title, request.job_post_id, reason);
      } catch (e) {
        console.error('Failed to send early checkout rejected notification:', e.message);
      }

      return res.status(200).json({
        success: true,
        message: 'ปฏิเสธคำขอส่งงานก่อนเวลาแล้ว',
      });
    }
  } catch (error) {
    handleJobError(error, res, 'respond early checkout');
  }
};

/**
 * Get early checkout request for a job
 * GET /api/jobs/:jobId/early-checkout-request
 * Requires: requireAuth
 */
export const getEarlyCheckoutRequest = async (req, res) => {
  try {
    const userId = req.userId;
    const { jobId } = req.params;
    const { query: dbQuery } = await import('../utils/db.js');

    // Ensure table exists
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS early_checkout_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL,
        job_post_id UUID NOT NULL,
        caregiver_id UUID NOT NULL,
        hirer_id UUID NOT NULL,
        evidence_note TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        rejected_reason TEXT,
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await dbQuery(
      `SELECT ecr.*, cp.display_name AS caregiver_name
       FROM early_checkout_requests ecr
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ecr.caregiver_id
       WHERE (ecr.job_id = $1 OR ecr.job_post_id = $1)
         AND (ecr.caregiver_id = $2 OR ecr.hirer_id = $2)
       ORDER BY ecr.created_at DESC
       LIMIT 1`,
      [jobId, userId]
    );

    res.status(200).json({
      success: true,
      data: { request: result.rows[0] || null },
    });
  } catch (error) {
    handleJobError(error, res, 'get early checkout request');
  }
};

export default {
  createJob,
  publishJob,
  getJobFeed,
  getHirerJobs,
  getCaregiverJobs,
  getJobById,
  acceptJob,
  rejectAssignedJob,
  checkIn,
  checkOut,
  cancelJob,
  getJobStats,
  requestEarlyCheckout,
  respondEarlyCheckout,
  getEarlyCheckoutRequest,
};
