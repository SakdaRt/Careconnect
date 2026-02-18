import BaseModel from './BaseModel.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Job State Machine
 * Defines valid status transitions and transition logic
 */
const JOB_STATES = {
  DRAFT: 'draft',
  POSTED: 'posted', 
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

/**
 * Valid state transitions
 * Format: FROM_STATE: [TO_STATE, TO_STATE, ...]
 */
const VALID_TRANSITIONS = {
  [JOB_STATES.DRAFT]: [JOB_STATES.POSTED],
  [JOB_STATES.POSTED]: [JOB_STATES.ASSIGNED, JOB_STATES.CANCELLED, JOB_STATES.EXPIRED],
  [JOB_STATES.ASSIGNED]: [JOB_STATES.IN_PROGRESS, JOB_STATES.CANCELLED],
  [JOB_STATES.IN_PROGRESS]: [JOB_STATES.COMPLETED, JOB_STATES.CANCELLED],
  [JOB_STATES.COMPLETED]: [], // Terminal state
  [JOB_STATES.CANCELLED]: [], // Terminal state
  [JOB_STATES.EXPIRED]: [] // Terminal state
};

/**
 * Check if a transition is valid
 * @param {string} fromState - Current state
 * @param {string} toState - Target state
 * @returns {boolean} - True if transition is valid
 */
const isValidTransition = (fromState, toState) => {
  if (fromState === toState) return false; // No self-transitions
  return VALID_TRANSITIONS[fromState]?.includes(toState) || false;
};

/**
 * Job State Transition Error
 */
class InvalidTransitionError extends Error {
  constructor(fromState, toState, jobId = null) {
    super(`Invalid job status transition: ${fromState} → ${toState}${jobId ? ` for job ${jobId}` : ''}`);
    this.name = 'InvalidTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    this.jobId = jobId;
    this.status = 400;
  }
}

/**
 * Log state transition to audit trail
 * @param {string} jobId - Job ID
 * @param {string} fromState - Previous state
 * @param {string} toState - New state
 * @param {string} userId - User who made the change
 * @param {object} metadata - Additional transition data
 */
const logTransition = async (jobId, fromState, toState, userId, metadata = {}) => {
  try {
    await query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, old_values, new_values, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        uuidv4(),
        'job',
        jobId,
        'status_transition',
        JSON.stringify({ status: fromState }),
        JSON.stringify({ status: toState }),
        userId,
        JSON.stringify(metadata)
      ]
    );
  } catch (error) {
    console.error('[Job Model] Failed to log transition:', error);
    // Don't throw - logging failure shouldn't break the transition
  }
};

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const isMissingPatientProfileColumnError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('patient_profile_id');
};

const isRecipientSchemaCompatibilityError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (code === '42703') {
    return (
      message.includes('patient_profile_id') ||
      message.includes('patient_id') ||
      message.includes('patient_display_name')
    );
  }

  if (code === '42P01') {
    return message.includes('job_patient_requirements') || message.includes('patient_profiles');
  }

  return false;
};

const queryWithRecipientFallback = async (queries, values) => {
  let lastError = null;

  for (let i = 0; i < queries.length; i += 1) {
    try {
      return await query(queries[i], values);
    } catch (error) {
      lastError = error;
      const isCompatibilityError = isRecipientSchemaCompatibilityError(error);
      if (i === queries.length - 1) {
        throw error;
      }
      if (!isCompatibilityError) {
        // Keep trying remaining fallback queries to maximize compatibility
        // across partially migrated environments.
      }
    }
  }

  throw lastError;
};

/**
 * Job Model
 * Handles job posts and job instances
 */
class Job extends BaseModel {
  constructor() {
    super('job_posts');
  }

  /**
   * Create a new job post (draft)
   * @param {object} jobData - Job data
   * @returns {object} - Created job post
   */
  async createJobPost(jobData) {
    const {
      hirer_id,
      title,
      description,
      job_type,
      risk_level,
      risk_reason_codes,
      risk_reason_detail,
      scheduled_start_at,
      scheduled_end_at,
      address_line1,
      address_line2,
      district,
      province,
      postal_code,
      lat,
      lng,
      geofence_radius_m = 1000,
      hourly_rate,
      total_hours,
      min_trust_level = 'L1',
      required_certifications = [],
      is_urgent = false,
      job_tasks_flags = [],
      required_skills_flags = [],
      equipment_available_flags = [],
      precautions_flags = [],
      preferred_caregiver_id = null,
      patient_profile_id = null,
    } = jobData;

    // Calculate total amount and platform fee
    const total_amount = Math.round(hourly_rate * total_hours);
    const platform_fee_percent = 10;
    const platform_fee_amount = Math.round(total_amount * (platform_fee_percent / 100));

    const payload = {
      id: uuidv4(),
      hirer_id,
      title,
      description,
      job_type,
      risk_level,
      risk_reason_codes: risk_reason_codes || null,
      risk_reason_detail: risk_reason_detail || null,
      scheduled_start_at,
      scheduled_end_at,
      address_line1,
      address_line2: address_line2 || null,
      district: district || null,
      province: province || null,
      postal_code: postal_code || null,
      lat: lat || null,
      lng: lng || null,
      geofence_radius_m,
      hourly_rate,
      total_hours,
      total_amount,
      platform_fee_percent,
      platform_fee_amount,
      min_trust_level,
      required_certifications,
      job_tasks_flags: job_tasks_flags.length ? job_tasks_flags : null,
      required_skills_flags: required_skills_flags.length ? required_skills_flags : null,
      equipment_available_flags: equipment_available_flags.length ? equipment_available_flags : null,
      precautions_flags: precautions_flags.length ? precautions_flags : null,
      preferred_caregiver_id: preferred_caregiver_id || null,
      patient_profile_id: patient_profile_id || null,
      is_urgent,
      status: 'draft',
      replacement_chain_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    try {
      return await this.create(payload);
    } catch (error) {
      if (!isMissingPatientProfileColumnError(error)) {
        throw error;
      }

      const { patient_profile_id: _ignored, ...legacyPayload } = payload;
      return await this.create(legacyPayload);
    }
  }

  /**
   * Execute a state transition with validation and logging
   * @param {string} jobId - Job ID
   * @param {string} toState - Target state
   * @param {string} userId - User making the change
   * @param {object} metadata - Additional transition data
   * @param {function} transitionFn - Function to execute the transition
   * @returns {object} - Updated job data
   */
  async executeTransition(jobId, toState, userId, metadata = {}, transitionFn) {
    // Get current job state - try job_posts first, then jobs table
    let currentJob = await this.findById(jobId);
    if (!currentJob) {
      // Try looking up in jobs table (for check-in/check-out which use jobs.id)
      const jobResult = await query(
        `SELECT j.*, ja.caregiver_id
         FROM jobs j
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         WHERE j.id = $1`,
        [jobId]
      );
      currentJob = jobResult.rows[0] || null;
    }
    if (!currentJob) {
      throw new Error('Job not found');
    }

    const fromState = currentJob.status;

    // Validate transition
    if (!isValidTransition(fromState, toState)) {
      throw new InvalidTransitionError(fromState, toState, jobId);
    }

    // Check for idempotency (already in target state)
    if (fromState === toState) {
      return currentJob; // Return existing data
    }

    try {
      // Execute the transition within a transaction
      const result = await transaction(async (client) => {
        // Execute the specific transition logic
        const updatedJob = await transitionFn(client, currentJob);
        
        // Log the transition
        await logTransition(jobId, fromState, toState, userId, {
          ...metadata,
          transition_time: new Date().toISOString()
        });

        return updatedJob;
      });

      return result;
    } catch (error) {
      console.error(`[Job Model] Transition ${fromState} → ${toState} failed:`, error);
      throw error;
    }
  }

  /**
   * Publish job post (draft → posted)
   * @param {string} jobPostId - Job post ID
   * @param {string} hirerId - Hirer ID for ownership check
   * @returns {object} - Updated job post
   */
  async publishJobPost(jobPostId, hirerId) {
    return await this.executeTransition(
      jobPostId,
      JOB_STATES.POSTED,
      hirerId,
      { action: 'publish_job' },
      async (client, currentJob) => {
        // Authorization check
        if (currentJob.hirer_id !== hirerId) {
          throw new Error('Not authorized to publish this job');
        }

        // Execute the update
        const result = await client.query(
          `UPDATE job_posts 
           SET status = $1, posted_at = NOW(), updated_at = NOW() 
           WHERE id = $2 AND status = $3
           RETURNING *`,
          [JOB_STATES.POSTED, jobPostId, JOB_STATES.DRAFT]
        );

        if (result.rows.length === 0) {
          throw new InvalidTransitionError(JOB_STATES.DRAFT, JOB_STATES.POSTED, jobPostId);
        }

        return result.rows[0];
      }
    );
  }

  /**
   * Get job feed for caregivers
   * @param {object} options - Filter and pagination options
   * @returns {object} - Paginated job posts
   */
  async getJobFeed(options = {}) {
    const {
      job_type,
      risk_level,
      is_urgent,
      exclude_hirer_id,
      page = 1,
      limit = 20,
    } = options;

    let whereClause = "status = 'posted'";
    const values = [];
    let paramIndex = 1;

    if (job_type) {
      whereClause += ` AND job_type = $${paramIndex++}`;
      values.push(job_type);
    }

    if (risk_level) {
      whereClause += ` AND risk_level = $${paramIndex++}`;
      values.push(risk_level);
    }

    if (is_urgent !== undefined) {
      whereClause += ` AND is_urgent = $${paramIndex++}`;
      values.push(is_urgent);
    }

    if (exclude_hirer_id) {
      whereClause += ` AND hirer_id <> $${paramIndex++}`;
      values.push(exclude_hirer_id);
    }

    // TODO: Add distance filtering if lat/lng provided

    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM job_posts
       WHERE ${whereClause}
       ORDER BY is_urgent DESC, scheduled_start_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM job_posts WHERE ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get jobs for a hirer
   * @param {string} hirerId - Hirer ID
   * @param {object} options - Filter options
   * @returns {object} - Paginated jobs
   */
  async getHirerJobs(hirerId, options = {}) {
    const { status, page = 1, limit = 20 } = options;

    let whereClause = 'jp.hirer_id = $1';
    const values = [hirerId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND jp.status = $${paramIndex++}`;
      values.push(status);
    }

    const offset = (page - 1) * limit;

    const limitParam = paramIndex++;
    const offsetParam = paramIndex++;
    const queryParams = [...values, limit, offset];

    const result = await queryWithRecipientFallback(
      [
        `SELECT jp.*,
                j.id as job_id,
                j.status as job_status,
                j.started_at,
                j.completed_at,
                ja.caregiver_id,
                cp.display_name as caregiver_name,
                COALESCE(jpr.patient_id, jp.patient_profile_id) as patient_profile_id,
                pp.patient_display_name
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
         LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
         LEFT JOIN patient_profiles pp ON pp.id = COALESCE(jpr.patient_id, jp.patient_profile_id)
         WHERE ${whereClause}
         ORDER BY jp.created_at DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        `SELECT jp.*,
                j.id as job_id,
                j.status as job_status,
                j.started_at,
                j.completed_at,
                ja.caregiver_id,
                cp.display_name as caregiver_name,
                NULL::text as patient_display_name
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
         WHERE ${whereClause}
         ORDER BY jp.created_at DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
      ],
      queryParams
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM job_posts jp WHERE ${whereClause}`,
      values.slice(0, status ? 2 : 1)
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get job with full details including assignment and caregiver
   * @param {string} jobPostId - Job post ID
   * @returns {object|null} - Job with details
   */
  async getJobWithDetails(jobPostId) {
    const result = await queryWithRecipientFallback(
      [
        `SELECT
          jp.*,
          j.id as job_id,
          j.status as job_status,
          j.assigned_at,
          j.started_at,
          j.completed_at,
          ja.caregiver_id,
          ja.status as assignment_status,
          cp.display_name as caregiver_name,
          pp.patient_display_name,
          jp.patient_profile_id,
          hp.display_name as hirer_name
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
         LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
         LEFT JOIN patient_profiles pp ON pp.id = COALESCE(jpr.patient_id, jp.patient_profile_id)
         LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
         WHERE jp.id = $1 OR j.id = $1`,
        `SELECT
          jp.*,
          j.id as job_id,
          j.status as job_status,
          j.assigned_at,
          j.started_at,
          j.completed_at,
          ja.caregiver_id,
          ja.status as assignment_status,
          cp.display_name as caregiver_name,
          COALESCE(pp.patient_display_name, pp_addr.patient_display_name) as patient_display_name,
          COALESCE(jpr.patient_id, pp_addr.patient_id) as patient_profile_id,
          hp.display_name as hirer_name
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
         LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
         LEFT JOIN patient_profiles pp ON pp.id = jpr.patient_id
         LEFT JOIN LATERAL (
           SELECT
             CASE WHEN COUNT(*) = 1 THEN MIN(pp2.id) ELSE NULL END as patient_id,
             CASE WHEN COUNT(*) = 1 THEN MIN(pp2.patient_display_name) ELSE NULL END as patient_display_name
           FROM patient_profiles pp2
           WHERE pp2.hirer_id = jp.hirer_id
             AND pp2.is_active = TRUE
             AND COALESCE(LOWER(TRIM(pp2.address_line1)), '') = COALESCE(LOWER(TRIM(jp.address_line1)), '')
             AND COALESCE(LOWER(TRIM(pp2.district)), '') = COALESCE(LOWER(TRIM(jp.district)), '')
             AND COALESCE(LOWER(TRIM(pp2.province)), '') = COALESCE(LOWER(TRIM(jp.province)), '')
             AND COALESCE(TRIM((pp2.postal_code)::text), '') = COALESCE(TRIM((jp.postal_code)::text), '')
         ) pp_addr ON TRUE
         LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
         WHERE jp.id = $1 OR j.id = $1`,
        `SELECT
          jp.*,
          j.id as job_id,
          j.status as job_status,
          j.assigned_at,
          j.started_at,
          j.completed_at,
          ja.caregiver_id,
          ja.status as assignment_status,
          cp.display_name as caregiver_name,
          pp_addr.patient_display_name,
          pp_addr.patient_id as patient_profile_id,
          hp.display_name as hirer_name
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
         LEFT JOIN LATERAL (
           SELECT
             CASE WHEN COUNT(*) = 1 THEN MIN(pp.id) ELSE NULL END as patient_id,
             CASE WHEN COUNT(*) = 1 THEN MIN(pp.patient_display_name) ELSE NULL END as patient_display_name
           FROM patient_profiles pp
           WHERE pp.hirer_id = jp.hirer_id
             AND pp.is_active = TRUE
             AND COALESCE(LOWER(TRIM(pp.address_line1)), '') = COALESCE(LOWER(TRIM(jp.address_line1)), '')
             AND COALESCE(LOWER(TRIM(pp.district)), '') = COALESCE(LOWER(TRIM(jp.district)), '')
             AND COALESCE(LOWER(TRIM(pp.province)), '') = COALESCE(LOWER(TRIM(jp.province)), '')
             AND COALESCE(TRIM((pp.postal_code)::text), '') = COALESCE(TRIM((jp.postal_code)::text), '')
         ) pp_addr ON TRUE
         LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
         WHERE jp.id = $1 OR j.id = $1`,
        `SELECT
          jp.*,
          j.id as job_id,
          j.status as job_status,
          j.assigned_at,
          j.started_at,
          j.completed_at,
          ja.caregiver_id,
          ja.status as assignment_status,
          cp.display_name as caregiver_name,
          NULL::text as patient_display_name,
          NULL::uuid as patient_profile_id,
          hp.display_name as hirer_name
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
         LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
         WHERE jp.id = $1 OR j.id = $1`,
      ],
      [jobPostId]
    );

    return result.rows[0] || null;
  }

  /**
   * Accept a job (creates job instance and assignment)
   * @param {string} jobPostId - Job post ID
   * @param {string} caregiverId - Caregiver ID
   * @returns {object} - Created job and assignment
   */
  async acceptJob(jobPostId, caregiverId) {
    const jobPost = await this.findById(jobPostId);

    if (!jobPost) {
      throw new Error('Job post not found');
    }

    if (jobPost.status !== 'posted') {
      throw new Error(`Cannot accept job in status: ${jobPost.status}`);
    }

    // Check if caregiver already has active job
    const activeJobCheck = await query(
      `SELECT ja.id FROM job_assignments ja
       JOIN jobs j ON j.id = ja.job_id
       WHERE ja.caregiver_id = $1
       AND ja.status = 'active'
       AND j.status IN ('assigned', 'in_progress')`,
      [caregiverId]
    );

    if (activeJobCheck.rows.length > 0) {
      throw new Error('Caregiver already has an active job');
    }

    // Use transaction for atomic operation
    return await transaction(async (client) => {
      // Update job post status
      await client.query(
        `UPDATE job_posts SET status = 'assigned', updated_at = NOW() WHERE id = $1`,
        [jobPostId]
      );

      // Create job instance
      const jobId = uuidv4();
      const jobResult = await client.query(
        `INSERT INTO jobs (id, job_post_id, hirer_id, status, assigned_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'assigned', NOW(), NOW(), NOW())
         RETURNING *`,
        [jobId, jobPostId, jobPost.hirer_id]
      );

      // Create assignment
      const assignmentId = uuidv4();
      const assignmentResult = await client.query(
        `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', NOW(), NOW(), NOW())
         RETURNING *`,
        [assignmentId, jobId, jobPostId, caregiverId]
      );

      // Create chat thread for job
      const threadId = uuidv4();
      await client.query(
        `INSERT INTO chat_threads (id, job_id, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [threadId, jobId]
      );

      // Add system message
      await client.query(
        `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, is_system_message, created_at)
         VALUES ($1, $2, NULL, 'system', 'ผู้ดูแลได้รับมอบหมายงานแล้ว', true, NOW())`,
        [uuidv4(), threadId]
      );

      return {
        job: jobResult.rows[0],
        assignment: assignmentResult.rows[0],
        chat_thread_id: threadId,
      };
    });
  }

  /**
   * Check in to job (assigned → in_progress)
   * @param {string} jobId - Job ID
   * @param {string} caregiverId - Caregiver ID
   * @param {object} gpsData - GPS coordinates
   * @returns {object} - Updated job
   */
  async checkIn(jobId, caregiverId, gpsData = {}) {
    // Get job data for validation
    const jobQuery = await query(
      `SELECT j.*, ja.caregiver_id, jp.lat, jp.lng, jp.geofence_radius_m
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       JOIN job_posts jp ON jp.id = j.job_post_id
       WHERE j.id = $1 OR jp.id = $1`,
      [jobId, jobId]
    );

    if (!jobQuery.rows[0]) {
      throw new Error('Job not found');
    }

    const jobData = jobQuery.rows[0];
    const actualJobId = jobData.id;

    // Validate GPS data if provided
    let gps = null;
    if (gpsData && gpsData.lat !== undefined && gpsData.lng !== undefined) {
      const lat = Number(gpsData.lat);
      const lng = Number(gpsData.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Invalid GPS coordinates');
      }
      const accuracyRaw = Number(gpsData.accuracy_m);
      const accuracy_m = Number.isFinite(accuracyRaw) ? accuracyRaw : 0;
      gps = {
        lat,
        lng,
        accuracy_m,
        confidence_score: Number.isFinite(Number(gpsData.confidence_score))
          ? Number(gpsData.confidence_score)
          : null,
      };

      // Validate geofence
      const jobLat = Number(jobData.lat);
      const jobLng = Number(jobData.lng);
      const radiusRaw = Number(jobData.geofence_radius_m);
      const geofenceRadius = Number.isFinite(radiusRaw) ? radiusRaw : 0;
      if (Number.isFinite(jobLat) && Number.isFinite(jobLng)) {
        const distance = getDistanceMeters(lat, lng, jobLat, jobLng);
        const allowedRadius = Math.min(1000, geofenceRadius > 0 ? geofenceRadius : 1000);
        const allowance = allowedRadius + Math.max(accuracy_m, 0);
        if (distance > allowance) {
          const roundedDistance = Math.round(distance);
          const roundedAllowance = Math.round(allowance);
          throw new Error(`GPS distance too far (${roundedDistance}m). Allowed ${roundedAllowance}m`);
        }
      }
    }

    return await this.executeTransition(
      actualJobId,
      JOB_STATES.IN_PROGRESS,
      caregiverId,
      { action: 'check_in', gps_data: gps },
      async (client, currentJob) => {
        // Authorization check
        if (currentJob.caregiver_id !== caregiverId) {
          throw new Error('Not authorized to check in to this job');
        }

        // Execute the transition
        await client.query(
          `UPDATE jobs SET status = $1, started_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = $3`,
          [JOB_STATES.IN_PROGRESS, actualJobId, JOB_STATES.ASSIGNED]
        );

        // Update assignment
        await client.query(
          `UPDATE job_assignments SET start_confirmed_at = NOW(), updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
          [actualJobId]
        );

        // Record GPS event
        if (gps) {
          await client.query(
            `INSERT INTO job_gps_events (id, job_id, caregiver_id, event_type, lat, lng, accuracy_m, confidence_score, created_at)
             VALUES ($1, $2, $3, 'check_in', $4, $5, $6, $7, NOW())`,
            [uuidv4(), actualJobId, caregiverId, gps.lat, gps.lng, gps.accuracy_m || 10.0, gps.confidence_score]
          );
        }

        return await this.getJobInstanceById(actualJobId);
      }
    );
  }

  /**
   * Check out from job (in_progress → completed)
   * @param {string} jobId - Job ID
   * @param {string} caregiverId - Caregiver ID
   * @param {object} gpsData - GPS coordinates
   * @returns {object} - Updated job
   */
  /**
   * Check out from job (in_progress → completed)
   * @param {string} jobId - Job ID
   * @param {string} caregiverId - Caregiver ID
   * @param {object} gpsData - GPS coordinates
   * @returns {object} - Updated job
   */
  async checkOut(jobId, caregiverId, gpsData = {}) {
    // Get job data for validation
    const jobQuery = await query(
      `SELECT j.*, ja.caregiver_id
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       WHERE j.id = $1 OR j.job_post_id = $1`,
      [jobId, jobId]
    );

    if (!jobQuery.rows[0]) {
      throw new Error('Job not found');
    }

    const jobData = jobQuery.rows[0];
    const actualJobId = jobData.id;

    return await this.executeTransition(
      actualJobId,
      JOB_STATES.COMPLETED,
      caregiverId,
      { action: 'check_out', gps_data: gpsData },
      async (client, currentJob) => {
        // Authorization check
        if (currentJob.caregiver_id !== caregiverId) {
          throw new Error('Not authorized to check out from this job');
        }

        // Execute the transition
        await client.query(
          `UPDATE jobs SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = $3`,
          [JOB_STATES.COMPLETED, actualJobId, JOB_STATES.IN_PROGRESS]
        );

        // Update job post status
        await client.query(
          `UPDATE job_posts SET status = $1, updated_at = NOW() WHERE id = $2`,
          [JOB_STATES.COMPLETED, currentJob.job_post_id]
        );

        // Update assignment
        await client.query(
          `UPDATE job_assignments SET status = 'completed', end_confirmed_at = NOW(), updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
          [actualJobId]
        );

        // Record GPS event
        if (gpsData.lat && gpsData.lng) {
          await client.query(
            `INSERT INTO job_gps_events (id, job_id, caregiver_id, event_type, lat, lng, accuracy_m, confidence_score, created_at)
             VALUES ($1, $2, $3, 'check_out', $4, $5, $6, $7, NOW())`,
            [uuidv4(), actualJobId, caregiverId, gpsData.lat, gpsData.lng, gpsData.accuracy_m || 10.0, gpsData.confidence_score || null]
          );
        }

        // Process payment settlement
        const jobPostResult = await client.query(
          `SELECT total_amount, platform_fee_amount FROM job_posts WHERE id = $1 FOR UPDATE`,
          [currentJob.job_post_id]
        );

        if (jobPostResult.rows.length === 0) {
          throw new Error('Job post not found');
        }

        const jobPost = jobPostResult.rows[0];

        const escrowWalletResult = await client.query(
          `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`,
          [actualJobId]
        );

        if (escrowWalletResult.rows.length === 0) {
          throw new Error('Escrow wallet not found');
        }

        const escrowWallet = escrowWalletResult.rows[0];
        const totalAmount = parseInt(jobPost.total_amount);
        const platformFee = parseInt(jobPost.platform_fee_amount);
        const caregiverPayment = totalAmount;
        const escrowHeld = parseInt(escrowWallet.held_balance);

        if (escrowHeld < caregiverPayment + platformFee) {
          throw new Error('Insufficient escrow balance for settlement');
        }

        let caregiverWalletResult = await client.query(
          `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver' FOR UPDATE`,
          [caregiverId]
        );

        if (caregiverWalletResult.rows.length === 0) {
          // Create caregiver wallet if it doesn't exist
          await client.query(
            `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, created_at, updated_at)
             VALUES ($1, $2, 'caregiver', 0, 0, NOW(), NOW())`,
            [uuidv4(), caregiverId]
          );
          caregiverWalletResult = await client.query(
            `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver' FOR UPDATE`,
            [caregiverId]
          );
        }

        const caregiverWallet = caregiverWalletResult.rows[0];

        // Update escrow wallet (release held balance)
        await client.query(
          `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
          [caregiverPayment + platformFee, escrowWallet.id]
        );

        // Update caregiver wallet (add available balance)
        await client.query(
          `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
          [caregiverPayment, caregiverWallet.id]
        );

        // Create ledger transactions
        await client.query(
          `INSERT INTO ledger_transactions (id, wallet_id, transaction_type, reference_type, reference_id, amount, metadata, created_at)
           VALUES ($1, $2, 'release', 'job', $3, $4, $5, NOW())`,
          [
            uuidv4(),
            escrowWallet.id,
            actualJobId,
            caregiverPayment + platformFee,
            JSON.stringify({ action: 'job_completion', caregiver_id: caregiverId })
          ]
        );

        await client.query(
          `INSERT INTO ledger_transactions (id, wallet_id, transaction_type, reference_type, reference_id, amount, metadata, created_at)
           VALUES ($1, $2, 'credit', 'job', $3, $4, $5, NOW())`,
          [
            uuidv4(),
            caregiverWallet.id,
            actualJobId,
            caregiverPayment,
            JSON.stringify({ action: 'job_completion', job_post_id: currentJob.job_post_id })
          ]
        );

        return await this.getJobInstanceById(actualJobId);
      }
    );
  }

  /**
   * Cancel job (various states → cancelled)
   * @param {string} jobId - Job ID
   * @param {string} userId - User ID requesting cancellation
   * @param {string} reason - Cancellation reason
   * @returns {object} - Updated job
   */
  async cancelJob(jobId, userId, reason = '') {
    return await this.executeTransition(
      jobId,
      JOB_STATES.CANCELLED,
      userId,
      { action: 'cancel_job', reason },
      async (client, currentJob) => {
        // Authorization check (hirer can cancel their own jobs)
        if (currentJob.hirer_id !== userId) {
          // Check if user is admin
          const userResult = await client.query(
            `SELECT role FROM users WHERE id = $1`,
            [userId]
          );
          if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
            throw new Error('Not authorized to cancel this job');
          }
        }

        // Only allow cancellation from certain states
        const cancellableStates = [JOB_STATES.POSTED, JOB_STATES.ASSIGNED, JOB_STATES.IN_PROGRESS];
        if (!cancellableStates.includes(currentJob.status)) {
          throw new InvalidTransitionError(currentJob.status, JOB_STATES.CANCELLED, jobId);
        }

        // Update job status
        await client.query(
          `UPDATE jobs SET status = $1, cancelled_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [JOB_STATES.CANCELLED, jobId]
        );

        // Update job post status
        await client.query(
          `UPDATE job_posts SET status = $1, updated_at = NOW() WHERE id = $2`,
          [JOB_STATES.CANCELLED, currentJob.job_post_id || jobId]
        );

        // Update assignment if exists
        await client.query(
          `UPDATE job_assignments SET status = 'cancelled', updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
          [jobId]
        );

        // TODO: Handle refund logic based on cancellation policy and state
        // This should release escrow funds according to business rules

        return await this.getJobInstanceById(jobId);
      }
    );
  }

  /**
   * Get a job instance by ID (from the jobs table, not job_posts)
   * @param {string} jobId - Job instance ID
   * @returns {object|null} - Job instance with assignment info
   */
  async getJobInstanceById(jobId) {
    const result = await query(
      `SELECT j.*, ja.caregiver_id, ja.status as assignment_status
       FROM jobs j
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       WHERE j.id = $1`,
      [jobId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get caregiver's assigned jobs
   * @param {string} caregiverId - Caregiver user ID
   * @param {object} options - Filter and pagination options
   * @returns {object} - Paginated jobs
   */
  async getCaregiverJobs(caregiverId, options = {}) {
    const { status, page = 1, limit = 20 } = options;

    let activeWhereClause = 'ja.caregiver_id = $1';
    const activeValues = [caregiverId];
    let activeParamIndex = 2;

    if (status) {
      activeWhereClause += ` AND j.status = $${activeParamIndex++}`;
      activeValues.push(status);
    }

    const activeResult = await queryWithRecipientFallback(
      [
        `SELECT j.*, jp.title, jp.description, jp.job_type, jp.hourly_rate,
                jp.total_hours, jp.total_amount, jp.scheduled_start_at, jp.scheduled_end_at,
                jp.address_line1, jp.district, jp.province, jp.patient_profile_id, pp.patient_display_name,
                jp.lat, jp.lng, jp.geofence_radius_m, jp.is_urgent,
                ja.status as assignment_status,
                ja.assigned_at as assignment_assigned_at,
                FALSE as awaiting_response
         FROM jobs j
         JOIN job_posts jp ON jp.id = j.job_post_id
         JOIN job_assignments ja ON ja.job_id = j.id AND ja.caregiver_id = $1
         LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
         LEFT JOIN patient_profiles pp ON pp.id = COALESCE(jpr.patient_id, jp.patient_profile_id)
         WHERE ${activeWhereClause}`,
        `SELECT j.*, jp.title, jp.description, jp.job_type, jp.hourly_rate,
                jp.total_hours, jp.total_amount, jp.scheduled_start_at, jp.scheduled_end_at,
                jp.address_line1, jp.district, jp.province,
                COALESCE(jpr.patient_id, pp_addr.patient_id) as patient_profile_id,
                COALESCE(pp.patient_display_name, pp_addr.patient_display_name) as patient_display_name,
                jp.lat, jp.lng, jp.geofence_radius_m, jp.is_urgent,
                ja.status as assignment_status,
                ja.assigned_at as assignment_assigned_at,
                FALSE as awaiting_response
         FROM jobs j
         JOIN job_posts jp ON jp.id = j.job_post_id
         JOIN job_assignments ja ON ja.job_id = j.id AND ja.caregiver_id = $1
         LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
         LEFT JOIN patient_profiles pp ON pp.id = jpr.patient_id
         LEFT JOIN LATERAL (
           SELECT
             CASE WHEN COUNT(*) = 1 THEN MIN(pp2.id) ELSE NULL END as patient_id,
             CASE WHEN COUNT(*) = 1 THEN MIN(pp2.patient_display_name) ELSE NULL END as patient_display_name
           FROM patient_profiles pp2
           WHERE pp2.hirer_id = jp.hirer_id
             AND pp2.is_active = TRUE
             AND COALESCE(LOWER(TRIM(pp2.address_line1)), '') = COALESCE(LOWER(TRIM(jp.address_line1)), '')
             AND COALESCE(LOWER(TRIM(pp2.district)), '') = COALESCE(LOWER(TRIM(jp.district)), '')
             AND COALESCE(LOWER(TRIM(pp2.province)), '') = COALESCE(LOWER(TRIM(jp.province)), '')
             AND COALESCE(TRIM((pp2.postal_code)::text), '') = COALESCE(TRIM((jp.postal_code)::text), '')
         ) pp_addr ON TRUE
         WHERE ${activeWhereClause}`,
        `SELECT j.*, jp.title, jp.description, jp.job_type, jp.hourly_rate,
                jp.total_hours, jp.total_amount, jp.scheduled_start_at, jp.scheduled_end_at,
                jp.address_line1, jp.district, jp.province, pp_addr.patient_id as patient_profile_id, pp_addr.patient_display_name,
                jp.lat, jp.lng, jp.geofence_radius_m, jp.is_urgent,
                ja.status as assignment_status,
                ja.assigned_at as assignment_assigned_at,
                FALSE as awaiting_response
         FROM jobs j
         JOIN job_posts jp ON jp.id = j.job_post_id
         JOIN job_assignments ja ON ja.job_id = j.id AND ja.caregiver_id = $1
         LEFT JOIN LATERAL (
           SELECT
             CASE WHEN COUNT(*) = 1 THEN MIN(pp.id) ELSE NULL END as patient_id,
             CASE WHEN COUNT(*) = 1 THEN MIN(pp.patient_display_name) ELSE NULL END as patient_display_name
           FROM patient_profiles pp
           WHERE pp.hirer_id = jp.hirer_id
             AND pp.is_active = TRUE
             AND COALESCE(LOWER(TRIM(pp.address_line1)), '') = COALESCE(LOWER(TRIM(jp.address_line1)), '')
             AND COALESCE(LOWER(TRIM(pp.district)), '') = COALESCE(LOWER(TRIM(jp.district)), '')
             AND COALESCE(LOWER(TRIM(pp.province)), '') = COALESCE(LOWER(TRIM(jp.province)), '')
             AND COALESCE(TRIM((pp.postal_code)::text), '') = COALESCE(TRIM((jp.postal_code)::text), '')
         ) pp_addr ON TRUE
         WHERE ${activeWhereClause}`,
        `SELECT j.*, jp.title, jp.description, jp.job_type, jp.hourly_rate,
                jp.total_hours, jp.total_amount, jp.scheduled_start_at, jp.scheduled_end_at,
                jp.address_line1, jp.district, jp.province, NULL::uuid as patient_profile_id, NULL::text as patient_display_name,
                jp.lat, jp.lng, jp.geofence_radius_m, jp.is_urgent,
                ja.status as assignment_status,
                ja.assigned_at as assignment_assigned_at,
                FALSE as awaiting_response
         FROM jobs j
         JOIN job_posts jp ON jp.id = j.job_post_id
         JOIN job_assignments ja ON ja.job_id = j.id AND ja.caregiver_id = $1
         WHERE ${activeWhereClause}`,
      ],
      activeValues
    );

    let pendingResult = { rows: [] };
    if (!status || status === 'assigned') {
      pendingResult = await queryWithRecipientFallback(
        [
          `SELECT
             jp.id,
             jp.id as job_post_id,
             jp.hirer_id,
             'assigned'::text as status,
             jp.updated_at as assigned_at,
             NULL::timestamptz as started_at,
             NULL::timestamptz as completed_at,
             NULL::timestamptz as cancelled_at,
             NULL::timestamptz as expired_at,
             NULL::timestamptz as job_closed_at,
             jp.created_at,
             jp.updated_at,
             jp.title,
             jp.description,
             jp.job_type,
             jp.hourly_rate,
             jp.total_hours,
             jp.total_amount,
             jp.scheduled_start_at,
             jp.scheduled_end_at,
             jp.address_line1,
             jp.district,
             jp.province,
             jp.patient_profile_id,
             pp.patient_display_name,
             jp.lat,
             jp.lng,
             jp.geofence_radius_m,
             jp.is_urgent,
             'active'::text as assignment_status,
             jp.updated_at as assignment_assigned_at,
             TRUE as awaiting_response
           FROM job_posts jp
           LEFT JOIN patient_profiles pp ON pp.id = jp.patient_profile_id
           WHERE jp.preferred_caregiver_id = $1
             AND jp.status = 'posted'
             AND NOT EXISTS (
               SELECT 1
               FROM jobs j2
               JOIN job_assignments ja2 ON ja2.job_id = j2.id AND ja2.status = 'active'
               WHERE j2.job_post_id = jp.id
             )`,
          `SELECT
             jp.id,
             jp.id as job_post_id,
             jp.hirer_id,
             'assigned'::text as status,
             jp.updated_at as assigned_at,
             NULL::timestamptz as started_at,
             NULL::timestamptz as completed_at,
             NULL::timestamptz as cancelled_at,
             NULL::timestamptz as expired_at,
             NULL::timestamptz as job_closed_at,
             jp.created_at,
             jp.updated_at,
             jp.title,
             jp.description,
             jp.job_type,
             jp.hourly_rate,
             jp.total_hours,
             jp.total_amount,
             jp.scheduled_start_at,
             jp.scheduled_end_at,
             jp.address_line1,
             jp.district,
             jp.province,
             pp_addr.patient_id as patient_profile_id,
             pp_addr.patient_display_name,
             jp.lat,
             jp.lng,
             jp.geofence_radius_m,
             jp.is_urgent,
             'active'::text as assignment_status,
             jp.updated_at as assignment_assigned_at,
             TRUE as awaiting_response
           FROM job_posts jp
           LEFT JOIN LATERAL (
             SELECT
               CASE WHEN COUNT(*) = 1 THEN MIN(pp.id) ELSE NULL END as patient_id,
               CASE WHEN COUNT(*) = 1 THEN MIN(pp.patient_display_name) ELSE NULL END as patient_display_name
             FROM patient_profiles pp
             WHERE pp.hirer_id = jp.hirer_id
               AND pp.is_active = TRUE
               AND COALESCE(LOWER(TRIM(pp.address_line1)), '') = COALESCE(LOWER(TRIM(jp.address_line1)), '')
               AND COALESCE(LOWER(TRIM(pp.district)), '') = COALESCE(LOWER(TRIM(jp.district)), '')
               AND COALESCE(LOWER(TRIM(pp.province)), '') = COALESCE(LOWER(TRIM(jp.province)), '')
               AND COALESCE(TRIM((pp.postal_code)::text), '') = COALESCE(TRIM((jp.postal_code)::text), '')
           ) pp_addr ON TRUE
           WHERE jp.preferred_caregiver_id = $1
             AND jp.status = 'posted'
             AND NOT EXISTS (
               SELECT 1
               FROM jobs j2
               JOIN job_assignments ja2 ON ja2.job_id = j2.id AND ja2.status = 'active'
               WHERE j2.job_post_id = jp.id
             )`,
          `SELECT
             jp.id,
             jp.id as job_post_id,
             jp.hirer_id,
             'assigned'::text as status,
             jp.updated_at as assigned_at,
             NULL::timestamptz as started_at,
             NULL::timestamptz as completed_at,
             NULL::timestamptz as cancelled_at,
             NULL::timestamptz as expired_at,
             NULL::timestamptz as job_closed_at,
             jp.created_at,
             jp.updated_at,
             jp.title,
             jp.description,
             jp.job_type,
             jp.hourly_rate,
             jp.total_hours,
             jp.total_amount,
             jp.scheduled_start_at,
             jp.scheduled_end_at,
             jp.address_line1,
             jp.district,
             jp.province,
             NULL::uuid as patient_profile_id,
             NULL::text as patient_display_name,
             jp.lat,
             jp.lng,
             jp.geofence_radius_m,
             jp.is_urgent,
             'active'::text as assignment_status,
             jp.updated_at as assignment_assigned_at,
             TRUE as awaiting_response
           FROM job_posts jp
           WHERE jp.preferred_caregiver_id = $1
             AND jp.status = 'posted'
             AND NOT EXISTS (
               SELECT 1
               FROM jobs j2
               JOIN job_assignments ja2 ON ja2.job_id = j2.id AND ja2.status = 'active'
               WHERE j2.job_post_id = jp.id
             )`,
        ],
        [caregiverId]
      );
    }

    const combinedRows = [...pendingResult.rows, ...activeResult.rows].sort((a, b) => {
      if (a.awaiting_response !== b.awaiting_response) {
        return a.awaiting_response ? -1 : 1;
      }
      const aTime = new Date(a.assignment_assigned_at || a.assigned_at || a.created_at || 0).getTime();
      const bTime = new Date(b.assignment_assigned_at || b.assigned_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedLimit = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (normalizedPage - 1) * normalizedLimit;
    const pagedRows = combinedRows.slice(offset, offset + normalizedLimit);

    const total = combinedRows.length;

    return {
      data: pagedRows,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  /**
   * Get valid transitions for a given state
   * @param {string} currentState - Current state
   * @returns {array} - Array of valid target states
   */
  getValidTransitions(currentState) {
    return VALID_TRANSITIONS[currentState] || [];
  }

  /**
   * Check if transition is valid
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} - True if transition is valid
   */
  isValidTransition(fromState, toState) {
    return isValidTransition(fromState, toState);
  }

  /**
   * Get all job states
   * @returns {object} - All job states constants
   */
  getJobStates() {
    return JOB_STATES;
  }

  // Export the error class for use in controllers
  static get InvalidTransitionError() {
    return InvalidTransitionError;
  }
}

const jobInstance = new Job();
export { InvalidTransitionError };
export default jobInstance;
