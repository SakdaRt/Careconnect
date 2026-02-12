import BaseModel from './BaseModel.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Valid job status transitions
 * draft → posted → assigned → in_progress → completed
 *                     ↓           ↓            ↓
 *                 cancelled   cancelled    cancelled
 *                     ↓
 *                 expired
 */
const VALID_TRANSITIONS = {
  draft: ['posted'],
  posted: ['assigned', 'cancelled', 'expired'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
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
      geofence_radius_m = 100,
      hourly_rate,
      total_hours,
      min_trust_level = 'L1',
      required_certifications = [],
      is_urgent = false,
      job_tasks_flags = [],
      required_skills_flags = [],
      equipment_available_flags = [],
      precautions_flags = [],
    } = jobData;

    // Calculate total amount and platform fee
    const total_amount = Math.round(hourly_rate * total_hours);
    const platform_fee_percent = 10;
    const platform_fee_amount = Math.round(total_amount * (platform_fee_percent / 100));

    const newJobPost = await this.create({
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
      is_urgent,
      status: 'draft',
      replacement_chain_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return newJobPost;
  }

  /**
   * Publish job post (draft → posted)
   * @param {string} jobPostId - Job post ID
   * @param {string} hirerId - Hirer ID for ownership check
   * @returns {object} - Updated job post
   */
  async publishJobPost(jobPostId, hirerId) {
    const jobPost = await this.findById(jobPostId);

    if (!jobPost) {
      throw new Error('Job post not found');
    }

    if (jobPost.hirer_id !== hirerId) {
      throw new Error('Not authorized to publish this job');
    }

    if (jobPost.status !== 'draft') {
      throw new Error(`Cannot publish job in status: ${jobPost.status}`);
    }

    return await this.updateById(jobPostId, {
      status: 'posted',
      posted_at: new Date(),
      updated_at: new Date(),
    });
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

    let whereClause = 'hirer_id = $1';
    const values = [hirerId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM job_posts
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM job_posts WHERE ${whereClause}`,
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
    const result = await query(
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
        hp.display_name as hirer_name
       FROM job_posts jp
       LEFT JOIN jobs j ON j.job_post_id = jp.id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       LEFT JOIN job_patient_requirements jpr ON jpr.job_id = j.id
       LEFT JOIN patient_profiles pp ON pp.id = jpr.patient_id
       LEFT JOIN hirer_profiles hp ON hp.user_id = jp.hirer_id
       WHERE jp.id = $1 OR j.id = $1`,
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
         VALUES ($1, $2, NULL, 'system', 'Job has been assigned', true, NOW())`,
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
    // Try to find by jobs.id first, then by job_posts.id
    let job = await query(
      `SELECT j.*, ja.caregiver_id, jp.lat, jp.lng, jp.geofence_radius_m
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       JOIN job_posts jp ON jp.id = j.job_post_id
       WHERE j.id = $1`,
      [jobId]
    );

    if (!job.rows[0]) {
      // Try by job_posts.id
      job = await query(
        `SELECT j.*, ja.caregiver_id, jp.lat, jp.lng, jp.geofence_radius_m
         FROM jobs j
         JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         JOIN job_posts jp ON jp.id = j.job_post_id
         WHERE jp.id = $1`,
        [jobId]
      );
    }

    if (!job.rows[0]) {
      throw new Error('Job not found');
    }

    // Use actual job id for subsequent operations
    const actualJobId = job.rows[0].id;

    const jobData = job.rows[0];

    if (jobData.caregiver_id !== caregiverId) {
      throw new Error('Not authorized to check in to this job');
    }

    if (jobData.status !== 'assigned') {
      throw new Error(`Cannot check in to job in status: ${jobData.status}`);
    }

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

      const jobLat = Number(jobData.lat);
      const jobLng = Number(jobData.lng);
      const radiusRaw = Number(jobData.geofence_radius_m);
      const radius_m = Number.isFinite(radiusRaw) ? radiusRaw : 0;
      if (Number.isFinite(jobLat) && Number.isFinite(jobLng) && radius_m > 0) {
        const distance = getDistanceMeters(lat, lng, jobLat, jobLng);
        if (distance > radius_m + Math.max(accuracy_m, 0)) {
          throw new Error('GPS location is outside job geofence');
        }
      }
    }

    await transaction(async (client) => {
      // Update job status
      await client.query(
        `UPDATE jobs SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [actualJobId]
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
    });

    return await this.getJobInstanceById(actualJobId);
  }

  /**
   * Check out from job (in_progress → completed)
   * @param {string} jobId - Job ID
   * @param {string} caregiverId - Caregiver ID
   * @param {object} gpsData - GPS coordinates
   * @returns {object} - Updated job
   */
  async checkOut(jobId, caregiverId, gpsData = {}) {
    // Try to find by jobs.id first
    let job = await query(
      `SELECT j.*, ja.caregiver_id
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       WHERE j.id = $1`,
      [jobId]
    );

    // If not found, try by job_posts.id
    if (!job.rows[0]) {
      job = await query(
        `SELECT j.*, ja.caregiver_id
         FROM jobs j
         JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         WHERE j.job_post_id = $1`,
        [jobId]
      );
    }

    if (!job.rows[0]) {
      throw new Error('Job not found');
    }

    const jobData = job.rows[0];
    const actualJobId = jobData.id;

    if (jobData.caregiver_id !== caregiverId) {
      throw new Error('Not authorized to check out from this job');
    }

    if (jobData.status !== 'in_progress') {
      throw new Error(`Cannot check out from job in status: ${jobData.status}`);
    }

    await transaction(async (client) => {
      // Update job status
      await client.query(
        `UPDATE jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [actualJobId]
      );

      // Update job post status
      await client.query(
        `UPDATE job_posts SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [jobData.job_post_id]
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

      const jobPostResult = await client.query(
        `SELECT total_amount, platform_fee_amount FROM job_posts WHERE id = $1 FOR UPDATE`,
        [jobData.job_post_id]
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
        const caregiverWalletId = uuidv4();
        await client.query(
          `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
           VALUES ($1, $2, 'caregiver', 0, 0, 'THB', NOW(), NOW())`,
          [caregiverWalletId, caregiverId]
        );
        caregiverWalletResult = await client.query(
          `SELECT * FROM wallets WHERE id = $1`,
          [caregiverWalletId]
        );
      }

      const caregiverWallet = caregiverWalletResult.rows[0];

      let platformWalletResult = await client.query(
        `SELECT * FROM wallets WHERE wallet_type = 'platform' AND user_id IS NULL FOR UPDATE`
      );

      if (platformWalletResult.rows.length === 0) {
        const platformWalletId = uuidv4();
        await client.query(
          `INSERT INTO wallets (id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
           VALUES ($1, 'platform', 0, 0, 'THB', NOW(), NOW())`,
          [platformWalletId]
        );
        platformWalletResult = await client.query(
          `SELECT * FROM wallets WHERE id = $1`,
          [platformWalletId]
        );
      }

      const platformWallet = platformWalletResult.rows[0];

      await client.query(
        `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
        [caregiverPayment, escrowWallet.id]
      );

      await client.query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [caregiverPayment, caregiverWallet.id]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, 'release', 'job', $5, 'Payment for completed job', NOW())`,
        [uuidv4(), escrowWallet.id, caregiverWallet.id, caregiverPayment, actualJobId]
      );

      await client.query(
        `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
        [platformFee, escrowWallet.id]
      );

      await client.query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [platformFee, platformWallet.id]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, 'debit', 'fee', $5, 'Platform service fee', NOW())`,
        [uuidv4(), escrowWallet.id, platformWallet.id, platformFee, actualJobId]
      );

      const threadResult = await client.query(
        `SELECT id FROM chat_threads WHERE job_id = $1 LIMIT 1`,
        [actualJobId]
      );

      if (threadResult.rows.length > 0) {
        await client.query(
          `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, is_system_message, created_at)
           VALUES ($1, $2, NULL, 'system', 'Job completed. Payment has been released to caregiver.', true, NOW())`,
          [uuidv4(), threadResult.rows[0].id]
        );
      }
    });

    return await this.getJobInstanceById(actualJobId);
  }

  /**
   * Cancel job
   * @param {string} jobPostId - Job post ID
   * @param {string} userId - User ID (hirer or caregiver)
   * @param {string} reason - Cancellation reason
   * @returns {object} - Updated job
   */
  async cancelJob(jobPostId, userId, _reason) {
    const jobPost = await this.getJobWithDetails(jobPostId);

    if (!jobPost) {
      throw new Error('Job not found');
    }

    // Check authorization
    const isHirer = jobPost.hirer_id === userId;
    const isCaregiver = jobPost.caregiver_id === userId;

    if (!isHirer && !isCaregiver) {
      throw new Error('Not authorized to cancel this job');
    }

    // Check if can be cancelled
    const cancellableStatuses = ['posted', 'assigned', 'in_progress'];
    const currentStatus = jobPost.job_status || jobPost.status;

    if (!cancellableStatuses.includes(currentStatus)) {
      throw new Error(`Cannot cancel job in status: ${currentStatus}`);
    }

    await transaction(async (client) => {
      // Update job post status
      await client.query(
        `UPDATE job_posts SET status = 'cancelled', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [jobPostId]
      );

      // If job instance exists, update it too
      if (jobPost.job_id) {
        await client.query(
          `UPDATE jobs SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [jobPost.job_id]
        );

        // Update assignment
        await client.query(
          `UPDATE job_assignments SET status = 'cancelled', updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
          [jobPost.job_id]
        );
      }

      // TODO: Handle financial implications (refund, penalty)
    });

    return await this.findById(jobPostId);
  }

  /**
   * Get job instance by ID
   * @param {string} jobId - Job ID
   * @returns {object|null} - Job instance
   */
  async getJobInstanceById(jobId) {
    const result = await query(
      `SELECT j.*, jp.title, jp.description, jp.hourly_rate, jp.total_hours, jp.total_amount,
              jp.address_line1, jp.district, jp.province,
              ja.caregiver_id, cp.display_name as caregiver_name
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       WHERE j.id = $1`,
      [jobId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get caregiver's assigned jobs
   * @param {string} caregiverId - Caregiver ID
   * @param {object} options - Filter options
   * @returns {object} - Paginated jobs
   */
  async getCaregiverJobs(caregiverId, options = {}) {
    const { status, page = 1, limit = 20 } = options;

    let whereClause = 'ja.caregiver_id = $1';
    const values = [caregiverId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND j.status = $${paramIndex++}`;
      values.push(status);
    }

    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT j.*, jp.title, jp.description, jp.hourly_rate, jp.total_amount,
              jp.scheduled_start_at, jp.scheduled_end_at,
              jp.address_line1, jp.district, jp.province
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       JOIN job_assignments ja ON ja.job_id = j.id
       WHERE ${whereClause}
       ORDER BY j.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id
       WHERE ${whereClause}`,
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
   * Check if status transition is valid
   * @param {string} fromStatus - Current status
   * @param {string} toStatus - Target status
   * @returns {boolean} - True if valid
   */
  isValidTransition(fromStatus, toStatus) {
    return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
  }
}

export default new Job();
