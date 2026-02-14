import {
  createJob as createJobService,
  publishJob as publishJobService,
  getJobFeed as getJobFeedService,
  getHirerJobs as getHirerJobsService,
  getCaregiverJobs as getCaregiverJobsService,
  getJobById as getJobByIdService,
  acceptJob as acceptJobService,
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
      error.message.includes('Cannot cancel') || error.message.includes('already has') ||
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
      message: 'Job created successfully',
      data: { job },
    });
  } catch (error) {
    handleJobError(error, res, 'create job');
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
      message: 'Job published successfully',
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
      message: 'Job accepted successfully',
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
      message: 'Checked in successfully',
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
    const { lat, lng, accuracy_m } = req.body;

    const gpsData = { lat, lng, accuracy_m };
    const result = await checkOutService(jobId, caregiverId, gpsData);

    res.status(200).json({
      success: true,
      message: 'Checked out successfully. Payment released.',
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
      message: 'Job cancelled successfully',
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

export default {
  createJob,
  publishJob,
  getJobFeed,
  getHirerJobs,
  getCaregiverJobs,
  getJobById,
  acceptJob,
  checkIn,
  checkOut,
  cancelJob,
  getJobStats,
};
