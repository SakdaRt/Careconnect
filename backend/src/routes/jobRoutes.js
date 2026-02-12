import express from 'express';
import Joi from 'joi';
import {
  getJobStats,
  getJobFeed,
  getHirerJobs,
  getCaregiverJobs,
  getJobById,
  createJob,
  publishJob,
  acceptJob,
  checkIn,
  checkOut,
  cancelJob,
} from '../controllers/jobController.js';
import { requireAuth, requirePolicy } from '../middleware/auth.js';

const router = express.Router();

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details.map((detail) => detail.message).join(', '),
    });
  }
  req.body = value;
  return next();
};

const createJobSchema = Joi.object({
  title: Joi.string().trim().min(1).required(),
  description: Joi.string().trim().min(1).required(),
  job_type: Joi.string().valid('companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency').required(),
  scheduled_start_at: Joi.string().isoDate().required(),
  scheduled_end_at: Joi.string().isoDate().required(),
  address_line1: Joi.string().trim().min(1).required(),
  address_line2: Joi.string().allow('', null),
  district: Joi.string().allow('', null),
  province: Joi.string().allow('', null),
  postal_code: Joi.string().allow('', null),
  lat: Joi.number().required(),
  lng: Joi.number().required(),
  geofence_radius_m: Joi.number().integer().min(0),
  hourly_rate: Joi.number().positive().required(),
  total_hours: Joi.number().positive().required(),
  min_trust_level: Joi.string().valid('L0', 'L1', 'L2', 'L3'),
  required_certifications: Joi.array().items(Joi.string()),
  is_urgent: Joi.boolean(),
  patient_profile_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).allow('', null),
  job_tasks_flags: Joi.array().items(Joi.string()),
  required_skills_flags: Joi.array().items(Joi.string()),
  equipment_available_flags: Joi.array().items(Joi.string()),
  precautions_flags: Joi.array().items(Joi.string()),
  risk_level: Joi.string().allow('', null),
  preferred_caregiver_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).allow('', null),
}).unknown(true);

const gpsSchema = Joi.object({
  lat: Joi.number(),
  lng: Joi.number(),
  accuracy_m: Joi.number(),
}).unknown(true);

const cancelSchema = Joi.object({
  reason: Joi.string().trim().min(1).required(),
}).unknown(true);

/**
 * Job Routes
 * Base path: /api/jobs
 */

// ============================================================================
// Public Routes (No authentication required)
// ============================================================================

// None - all job routes require authentication

// ============================================================================
// Protected Routes (Authentication required)
// ============================================================================

/**
 * Get job statistics
 * GET /api/jobs/stats
 * Headers: Authorization: Bearer <token>
 */
router.get('/stats', requireAuth, requirePolicy('job:stats'), getJobStats);

/**
 * Get job feed for caregivers
 * GET /api/jobs/feed
 * Headers: Authorization: Bearer <token>
 * Query: { job_type?, risk_level?, is_urgent?, page?, limit? }
 */
router.get('/feed', requireAuth, requirePolicy('job:feed'), getJobFeed);

/**
 * Get hirer's jobs
 * GET /api/jobs/my-jobs
 * Headers: Authorization: Bearer <token>
 * Query: { status?, page?, limit? }
 */
router.get('/my-jobs', requireAuth, requirePolicy('job:my-jobs'), getHirerJobs);

/**
 * Get caregiver's assigned jobs
 * GET /api/jobs/assigned
 * Headers: Authorization: Bearer <token>
 * Query: { status?, page?, limit? }
 */
router.get('/assigned', requireAuth, requirePolicy('job:assigned'), getCaregiverJobs);

/**
 * Get job by ID
 * GET /api/jobs/:id
 * Headers: Authorization: Bearer <token>
 */
router.get('/:id', requireAuth, requirePolicy('job:get'), getJobById);

/**
 * Create a new job post (draft)
 * POST /api/jobs
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   title, description, job_type, risk_level?,
 *   scheduled_start_at, scheduled_end_at,
 *   address_line1, address_line2?, district?, province?, postal_code?,
 *   lat?, lng?, geofence_radius_m?,
 *   hourly_rate, total_hours,
 *   min_trust_level?, required_certifications?, is_urgent?,
 *   patient_profile_id?
 * }
 */
router.post('/', requireAuth, requirePolicy('job:create'), validateBody(createJobSchema), createJob);

/**
 * Publish job post (draft → posted)
 * POST /api/jobs/:id/publish
 * Headers: Authorization: Bearer <token>
 */
router.post('/:id/publish', requireAuth, requirePolicy('job:publish'), publishJob);

/**
 * Accept a job (posted → assigned)
 * POST /api/jobs/:id/accept
 * Headers: Authorization: Bearer <token>
 */
router.post('/:id/accept', requireAuth, requirePolicy('job:accept'), acceptJob);

/**
 * Check in to job (assigned → in_progress)
 * POST /api/jobs/:jobId/checkin
 * Headers: Authorization: Bearer <token>
 * Body: { lat?, lng?, accuracy_m? }
 */
router.post('/:jobId/checkin', requireAuth, requirePolicy('job:checkin'), validateBody(gpsSchema), checkIn);

/**
 * Check out from job (in_progress → completed)
 * POST /api/jobs/:jobId/checkout
 * Headers: Authorization: Bearer <token>
 * Body: { lat?, lng?, accuracy_m? }
 */
router.post('/:jobId/checkout', requireAuth, requirePolicy('job:checkout'), validateBody(gpsSchema), checkOut);

/**
 * Cancel job
 * POST /api/jobs/:id/cancel
 * Headers: Authorization: Bearer <token>
 * Body: { reason }
 */
router.post('/:id/cancel', requireAuth, requirePolicy('job:cancel'), validateBody(cancelSchema), cancelJob);

export default router;
