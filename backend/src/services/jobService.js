import Job from '../models/Job.js';
import User from '../models/User.js';
import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import { computeRiskLevel } from '../utils/risk.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * Job Service
 * Handles job business logic, validation, and financial operations
 */

/**
 * Trust level hierarchy for comparison
 */
const TRUST_LEVELS = ['L0', 'L1', 'L2', 'L3'];

/**
 * Check if user trust level meets requirement
 * @param {string} userLevel - User's trust level
 * @param {string} requiredLevel - Required trust level
 * @returns {boolean} - True if user meets requirement
 */
const meetsRequiredTrustLevel = (userLevel, requiredLevel) => {
  const userIndex = TRUST_LEVELS.indexOf(userLevel);
  const requiredIndex = TRUST_LEVELS.indexOf(requiredLevel);
  return userIndex >= requiredIndex;
};

/**
 * Create a new job post (draft)
 * @param {string} hirerId - Hirer user ID
 * @param {object} jobData - Job data
 * @returns {object} - Created job post
 */
export const createJob = async (hirerId, jobData) => {
  // Validate hirer
  const hirer = await User.findById(hirerId);
  if (!hirer) {
    throw new Error('Hirer not found');
  }

  if (hirer.role !== 'hirer') {
    throw new Error('Only hirers can create jobs');
  }

  if (hirer.status !== 'active') {
    throw new Error('Account is not active');
  }

  // Validate required fields
  const requiredFields = ['title', 'description', 'job_type', 'scheduled_start_at', 'scheduled_end_at', 'hourly_rate', 'total_hours', 'address_line1'];
  for (const field of requiredFields) {
    if (!jobData[field]) {
      throw new ValidationError(`Missing required field: ${field}`, { code: 'JOB_REQUIRED_FIELD', field, section: 'job_basic' });
    }
  }

  // Validate dates
  const startDate = new Date(jobData.scheduled_start_at);
  const endDate = new Date(jobData.scheduled_end_at);

  if (startDate >= endDate) {
    throw new ValidationError('End date must be after start date', { code: 'JOB_SCHEDULE_INVALID', field: 'scheduled_end_at', section: 'job_schedule' });
  }

  if (startDate <= new Date()) {
    throw new ValidationError('Start date must be in the future', { code: 'JOB_SCHEDULE_INVALID', field: 'scheduled_start_at', section: 'job_schedule' });
  }

  // Validate job type
  const validJobTypes = ['companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency'];
  if (!validJobTypes.includes(jobData.job_type)) {
    throw new ValidationError(`Invalid job type. Must be one of: ${validJobTypes.join(', ')}`, { code: 'JOB_TYPE_INVALID', field: 'job_type', section: 'job_basic' });
  }

  const taskOptions = new Set([
    'companionship',
    'meal_prep',
    'light_housekeeping',
    'mobility_assist',
    'transfer_assist',
    'bathing',
    'dressing',
    'toileting',
    'diaper_change',
    'feeding',
    'tube_feeding',
    'medication_reminder',
    'medication_administration',
    'vitals_check',
    'blood_sugar_check',
    'wound_dressing',
    'catheter_care',
    'oxygen_monitoring',
    'dementia_supervision',
  ]);
  const skillsOptions = new Set([
    'basic_first_aid',
    'dementia_care',
    'post_surgery_care',
    'safe_transfer',
    'wound_care',
    'catheter_care',
    'tube_feeding_care',
    'vitals_monitoring',
    'medication_management',
  ]);
  const equipmentOptions = new Set([
    'wheelchair',
    'walker',
    'hospital_bed',
    'patient_lift',
    'thermometer',
    'bp_monitor',
    'pulse_oximeter',
    'glucometer',
    'oxygen_concentrator',
    'feeding_tube_supplies',
    'wound_care_supplies',
  ]);
  const precautionsOptions = new Set([
    'fall_risk',
    'aspiration_risk',
    'infection_control',
    'pressure_ulcer_risk',
    'behavioral_risk',
    'allergy_precaution',
    'lifting_precaution',
  ]);

  const ensureArrayEnum = (value, allowed, key) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new ValidationError(`${key} must be an array`, { code: 'JOB_FLAGS_INVALID', field: key, section: 'job_requirements' });
    const out = [];
    const seen = new Set();
    for (const raw of value) {
      const v = String(raw || '').trim();
      if (!v) continue;
      if (!allowed.has(v)) throw new ValidationError(`${key} contains invalid value`, { code: 'JOB_FLAGS_INVALID', field: key, section: 'job_requirements' });
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  };

  const job_tasks_flags = ensureArrayEnum(jobData.job_tasks_flags, taskOptions, 'job_tasks_flags');
  const required_skills_flags = ensureArrayEnum(jobData.required_skills_flags, skillsOptions, 'required_skills_flags');
  const equipment_available_flags = ensureArrayEnum(jobData.equipment_available_flags, equipmentOptions, 'equipment_available_flags');
  const precautions_flags = ensureArrayEnum(jobData.precautions_flags, precautionsOptions, 'precautions_flags');

  if (job_tasks_flags.length === 0) {
    throw new ValidationError('Please select at least one job task', { code: 'JOB_TASKS_REQUIRED', field: 'job_tasks_flags', section: 'job_tasks' });
  }

  let preferred_caregiver_id = null;
  if (jobData.preferred_caregiver_id) {
    const caregiver = await User.findById(jobData.preferred_caregiver_id);
    if (!caregiver || caregiver.role !== 'caregiver' || caregiver.status !== 'active') {
      throw new ValidationError('Preferred caregiver is invalid or inactive', {
        code: 'PREFERRED_CAREGIVER_INVALID',
        field: 'preferred_caregiver_id',
        section: 'job_basic',
      });
    }
    preferred_caregiver_id = caregiver.id;
  }

  let patientProfile = null;
  if (jobData.patient_profile_id) {
    const pRes = await query(
      `SELECT *
       FROM patient_profiles
       WHERE id = $1 AND hirer_id = $2 AND is_active = true
       LIMIT 1`,
      [jobData.patient_profile_id, hirerId]
    );
    patientProfile = pRes.rows[0] || null;
    if (!patientProfile) {
      throw new NotFoundError('Care recipient not found', { code: 'PATIENT_NOT_FOUND', details: { section: 'patient', field: 'patient_profile_id' } });
    }
  }

  if (patientProfile) {
    const patientDevices = new Set(patientProfile.medical_devices_flags || []);
    const patientNeeds = new Set(patientProfile.care_needs_flags || []);
    const mobilityLevel = String(patientProfile.mobility_level || '');

    if (job_tasks_flags.includes('tube_feeding') && !patientDevices.has('feeding_tube')) {
      throw new ValidationError('Selected tube feeding task but patient has no feeding tube', {
        code: 'PATIENT_TASK_MISMATCH',
        field: 'job_tasks_flags',
        section: 'job_tasks',
        details: { related_task: 'tube_feeding', required_patient_device: 'feeding_tube' },
      });
    }
    if (job_tasks_flags.includes('transfer_assist') && !(patientNeeds.has('transfer_assist') || mobilityLevel === 'wheelchair' || mobilityLevel === 'bedbound')) {
      throw new ValidationError('Selected transfer assist task but patient profile does not indicate transfer needs', {
        code: 'PATIENT_TASK_MISMATCH',
        field: 'job_tasks_flags',
        section: 'job_tasks',
        details: { related_task: 'transfer_assist' },
      });
    }
    if (job_tasks_flags.includes('catheter_care') && !patientDevices.has('urinary_catheter')) {
      throw new ValidationError('Selected catheter care task but patient has no urinary catheter', {
        code: 'PATIENT_TASK_MISMATCH',
        field: 'job_tasks_flags',
        section: 'job_tasks',
        details: { related_task: 'catheter_care', required_patient_device: 'urinary_catheter' },
      });
    }
    if (job_tasks_flags.includes('oxygen_monitoring') && !patientDevices.has('oxygen')) {
      throw new ValidationError('Selected oxygen monitoring task but patient is not on oxygen', {
        code: 'PATIENT_TASK_MISMATCH',
        field: 'job_tasks_flags',
        section: 'job_tasks',
        details: { related_task: 'oxygen_monitoring', required_patient_device: 'oxygen' },
      });
    }
    if (job_tasks_flags.includes('wound_dressing') && !patientDevices.has('wound_dressing')) {
      throw new ValidationError('Selected wound dressing task but patient profile does not indicate wound dressing', {
        code: 'PATIENT_TASK_MISMATCH',
        field: 'job_tasks_flags',
        section: 'job_tasks',
        details: { related_task: 'wound_dressing', required_patient_device: 'wound_dressing' },
      });
    }
  }

  const computed = computeRiskLevel({ jobType: jobData.job_type, patientProfile, jobTasksFlags: job_tasks_flags });

  // Create job post
  const jobPost = await Job.createJobPost({
    hirer_id: hirerId,
    ...jobData,
    job_tasks_flags,
    required_skills_flags,
    equipment_available_flags,
    precautions_flags,
    preferred_caregiver_id,
    risk_level: computed.risk_level,
    risk_reason_codes: computed.reason_codes,
    risk_reason_detail: computed.detail,
  });

  return jobPost;
};

/**
 * Publish job post (draft → posted)
 * @param {string} hirerId - Hirer user ID
 * @param {string} jobPostId - Job post ID
 * @returns {object} - Updated job post
 */
export const publishJob = async (hirerId, jobPostId) => {
  return await transaction(async (client) => {
    // Get job details
    const jobPost = await Job.findById(jobPostId);
    if (!jobPost) {
      throw new Error('Job post not found');
    }

    // Check ownership
    if (jobPost.hirer_id !== hirerId) {
      throw new Error('Not authorized to publish this job');
    }

    // Trust-based restriction: L0 hirer cannot publish high-risk jobs
    const hirerResult = await query(`SELECT trust_level FROM users WHERE id = $1`, [hirerId]);
    const hirerTrust = hirerResult.rows[0]?.trust_level || 'L0';
    if (hirerTrust === 'L0' && jobPost.risk_level === 'high_risk') {
      throw new ValidationError('L0 hirer cannot publish high-risk jobs', {
        code: 'HIRER_TRUST_RESTRICTION',
        section: 'job_risk',
      });
    }

    // Check wallet balance for job cost + platform fee
    const hirerWalletResult = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`,
      [hirerId]
    );
    if (hirerWalletResult.rows.length === 0) {
      throw new Error('Hirer wallet not found');
    }

    const hirerWallet = hirerWalletResult.rows[0];
    const totalCost = parseInt(jobPost.total_amount) + parseInt(jobPost.platform_fee_amount);
    let availableBalance = parseInt(hirerWallet.available_balance);
    const isDev = process.env.NODE_ENV !== 'production';

    if (availableBalance < totalCost && isDev) {
      const shortfall = totalCost - availableBalance;
      await client.query(
        `UPDATE wallets
         SET available_balance = available_balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [shortfall, hirerWallet.id]
      );
      await client.query(
        `INSERT INTO ledger_transactions (id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
         VALUES ($1, $2, $3, 'credit', 'dev_topup', $4, 'Dev auto topup for job publish', NOW())`,
        [uuidv4(), hirerWallet.id, shortfall, jobPostId]
      );
      const refreshed = await client.query(`SELECT available_balance FROM wallets WHERE id = $1`, [hirerWallet.id]);
      availableBalance = refreshed.rows.length ? parseInt(refreshed.rows[0].available_balance) : availableBalance;
    }

    if (availableBalance < totalCost) {
      throw new ValidationError('Insufficient balance', {
        code: 'INSUFFICIENT_BALANCE',
        details: { required: totalCost, available: availableBalance },
      });
    }

    await client.query(
      `UPDATE wallets
       SET available_balance = available_balance - $1,
           held_balance = held_balance + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [totalCost, hirerWallet.id]
    );

    await client.query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
       VALUES ($1, $2, $3, $4, 'hold', 'job', $5, 'Hold funds for job publish', NOW())`,
      [uuidv4(), hirerWallet.id, hirerWallet.id, totalCost, jobPostId]
    );

    // Publish job
    const updatedJob = await Job.publishJobPost(jobPostId, hirerId);
    return updatedJob;
  });
};

/**
 * Get job feed for caregivers
 * @param {string} caregiverId - Caregiver user ID
 * @param {object} options - Filter options
 * @returns {object} - Paginated job posts
 */
export const getJobFeed = async (caregiverId, options = {}) => {
  // Validate caregiver
  const caregiver = await User.findById(caregiverId);
  if (!caregiver) {
    throw new Error('Caregiver not found');
  }

  if (caregiver.role !== 'caregiver') {
    throw new Error('Only caregivers can view job feed');
  }

  // Get jobs matching caregiver's trust level
  const jobs = await Job.getJobFeed(options);

  // Filter by trust level requirement
  const filteredJobs = jobs.data.filter(job => {
    if (job.preferred_caregiver_id && job.preferred_caregiver_id !== caregiverId) {
      return false;
    }
    return meetsRequiredTrustLevel(caregiver.trust_level, job.min_trust_level);
  });

  return {
    ...jobs,
    data: filteredJobs,
    total: filteredJobs.length,
  };
};

/**
 * Get hirer's jobs
 * @param {string} hirerId - Hirer user ID
 * @param {object} options - Filter options
 * @returns {object} - Paginated jobs
 */
export const getHirerJobs = async (hirerId, options = {}) => {
  return await Job.getHirerJobs(hirerId, options);
};

/**
 * Get caregiver's assigned jobs
 * @param {string} caregiverId - Caregiver user ID
 * @param {object} options - Filter options
 * @returns {object} - Paginated jobs
 */
export const getCaregiverJobs = async (caregiverId, options = {}) => {
  return await Job.getCaregiverJobs(caregiverId, options);
};

/**
 * Get job details by ID
 * @param {string} jobPostId - Job post ID
 * @param {string} userId - User ID requesting the job
 * @returns {object} - Job with details
 */
export const getJobById = async (jobPostId, userId) => {
  const job = await Job.getJobWithDetails(jobPostId);

  if (!job) {
    throw new Error('Job not found');
  }

  // Check authorization - hirer or assigned caregiver can see full details
  const isHirer = job.hirer_id === userId;
  const isAssignedCaregiver = job.caregiver_id === userId;

  // If posted job, any caregiver can see basic info
  if (job.status === 'posted') {
    const user = await User.findById(userId);
    if (user.role === 'caregiver') {
      if (job.preferred_caregiver_id && job.preferred_caregiver_id !== userId) {
        throw new Error('Not authorized to view this job');
      }
      // Return limited info for non-assigned caregivers
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        job_type: job.job_type,
        risk_level: job.risk_level,
        scheduled_start_at: job.scheduled_start_at,
        scheduled_end_at: job.scheduled_end_at,
        hourly_rate: job.hourly_rate,
        total_hours: job.total_hours,
        total_amount: job.total_amount,
        district: job.district,
        province: job.province,
        min_trust_level: job.min_trust_level,
        is_urgent: job.is_urgent,
        status: job.status,
      };
    }
  }

  if (!isHirer && !isAssignedCaregiver) {
    throw new Error('Not authorized to view this job');
  }

  return job;
};

/**
 * Accept a job (posted → assigned)
 * @param {string} jobPostId - Job post ID
 * @param {string} caregiverId - Caregiver user ID
 * @returns {object} - Created job and assignment
 */
export const acceptJob = async (jobPostId, caregiverId) => {
  // Validate caregiver
  const caregiver = await User.findById(caregiverId);
  if (!caregiver) {
    throw new Error('Caregiver not found');
  }

  if (caregiver.role !== 'caregiver') {
    throw new Error('Only caregivers can accept jobs');
  }

  if (caregiver.status !== 'active') {
    throw new Error('Account is not active');
  }

  // Use transaction for atomic financial + assignment operation
  return await transaction(async (client) => {
    const jobPostResult = await client.query(
      `SELECT *
       FROM job_posts
       WHERE id = $1
       FOR UPDATE`,
      [jobPostId]
    );

    if (jobPostResult.rows.length === 0) {
      throw new Error('Job post not found');
    }

    const jobPost = jobPostResult.rows[0];

    if (jobPost.status !== 'posted') {
      throw new Error(`Cannot accept job in status: ${jobPost.status}`);
    }

    if (!meetsRequiredTrustLevel(caregiver.trust_level, jobPost.min_trust_level)) {
      throw new Error(`Insufficient trust level. Required: ${jobPost.min_trust_level}, Your level: ${caregiver.trust_level}`);
    }

    if (jobPost.preferred_caregiver_id && jobPost.preferred_caregiver_id !== caregiverId) {
      throw new ValidationError('This job is reserved for another caregiver', {
        code: 'JOB_PREFERRED_CAREGIVER_ONLY',
        section: 'job_access',
      });
    }

    // Enforce caregiver certifications for L2+ and job-specific requirements
    const profileRes = await client.query(
      `SELECT certifications FROM caregiver_profiles WHERE user_id = $1 LIMIT 1`,
      [caregiverId]
    );
    const caregiverCerts = Array.isArray(profileRes.rows[0]?.certifications) ? profileRes.rows[0].certifications : [];

    if (jobPost.min_trust_level === 'L2' || jobPost.min_trust_level === 'L3') {
      if (caregiverCerts.length === 0) {
        throw new ValidationError('Caregiver must provide certifications for L2+ jobs', {
          code: 'CERTIFICATIONS_REQUIRED',
          section: 'caregiver_profile',
        });
      }
    }

    const requiredCerts = Array.isArray(jobPost.required_certifications) ? jobPost.required_certifications : [];
    if (requiredCerts.length > 0) {
      const caregiverSet = new Set(caregiverCerts.map((s) => String(s || '').trim().toLowerCase()));
      const missing = requiredCerts.filter((c) => !caregiverSet.has(String(c || '').trim().toLowerCase()));
      if (missing.length > 0) {
        throw new ValidationError('Missing required certifications for this job', {
          code: 'CERTIFICATIONS_MISSING',
          section: 'caregiver_profile',
          details: { missing },
        });
      }
    }

    const conflictRes = await client.query(
      `SELECT j.id
       FROM job_assignments ja
       JOIN jobs j ON j.id = ja.job_id
       JOIN job_posts jp ON jp.id = j.job_post_id
       WHERE ja.caregiver_id = $1
         AND ja.status = 'active'
         AND j.status IN ('assigned', 'in_progress')
         AND jp.scheduled_start_at < $3
         AND jp.scheduled_end_at > $2
       LIMIT 1`,
      [caregiverId, jobPost.scheduled_start_at, jobPost.scheduled_end_at]
    );

    if (conflictRes.rows.length > 0) {
      throw new ValidationError('Job schedule overlaps with an active assignment', {
        code: 'JOB_TIME_CONFLICT',
        field: 'scheduled_start_at',
        section: 'job_schedule',
        details: { conflict_job_id: conflictRes.rows[0].id },
      });
    }

    // Get hirer wallet and hold funds
    const hirerWalletResult = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`,
      [jobPost.hirer_id]
    );

    if (hirerWalletResult.rows.length === 0) {
      throw new Error('Hirer wallet not found');
    }

    const hirerWallet = hirerWalletResult.rows[0];
    const totalAmount = parseInt(jobPost.total_amount) + parseInt(jobPost.platform_fee_amount);

    const availableBalance = parseInt(hirerWallet.available_balance);
    const heldBalance = parseInt(hirerWallet.held_balance);
    const useHeld = heldBalance >= totalAmount;

    if (!useHeld && availableBalance < totalAmount) {
      throw new Error('Insufficient balance in hirer wallet');
    }

    if (useHeld) {
      await client.query(
        `UPDATE wallets
         SET held_balance = held_balance - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [totalAmount, hirerWallet.id]
      );
    } else {
      // Move funds from hirer wallet into escrow (do not double-hold on hirer wallet)
      await client.query(
        `UPDATE wallets
         SET available_balance = available_balance - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [totalAmount, hirerWallet.id]
      );
    }

    // Update job post status
    const jobPostUpdate = await client.query(
      `UPDATE job_posts
       SET status = 'assigned', updated_at = NOW()
       WHERE id = $1 AND status = 'posted'
       RETURNING id`,
      [jobPostId]
    );

    if (jobPostUpdate.rows.length === 0) {
      throw new Error('Job post was already assigned');
    }

    // Create job instance first (needed for escrow wallet foreign key)
    const jobId = uuidv4();
    await client.query(
      `INSERT INTO jobs (id, job_post_id, hirer_id, status, assigned_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'assigned', NOW(), NOW(), NOW())`,
      [jobId, jobPostId, jobPost.hirer_id]
    );

    // Create escrow wallet for this job (now with job_id)
    const escrowWalletId = uuidv4();
    await client.query(
      `INSERT INTO wallets (id, job_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
       VALUES ($1, $2, 'escrow', 0, $3, 'THB', NOW(), NOW())`,
      [escrowWalletId, jobId, totalAmount]
    );

    // Create job hold ledger transaction
    const holdTxId = uuidv4();
    await client.query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
       VALUES ($1, $2, $3, $4, 'hold', 'job', $5, 'Job escrow hold', NOW())`,
      [holdTxId, hirerWallet.id, escrowWalletId, totalAmount, jobId]
    );

    // Create assignment
    const assignmentId = uuidv4();
    await client.query(
      `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW(), NOW())`,
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
       VALUES ($1, $2, NULL, 'system', 'Job has been assigned. Payment has been secured in escrow.', true, NOW())`,
      [uuidv4(), threadId]
    );

    return {
      job_id: jobId,
      job_post_id: jobPostId,
      assignment_id: assignmentId,
      chat_thread_id: threadId,
      escrow_wallet_id: escrowWalletId,
      escrow_amount: totalAmount,
    };
  });
};

/**
 * Check in to job (assigned → in_progress)
 * @param {string} jobId - Job ID
 * @param {string} caregiverId - Caregiver user ID
 * @param {object} gpsData - GPS coordinates
 * @returns {object} - Updated job
 */
export const checkIn = async (jobId, caregiverId, gpsData = {}) => {
  return await Job.checkIn(jobId, caregiverId, gpsData);
};

/**
 * Check out from job (in_progress → completed)
 * Handles financial settlement
 * @param {string} jobId - Job ID
 * @param {string} caregiverId - Caregiver user ID
 * @param {object} gpsData - GPS coordinates
 * @returns {object} - Updated job
 */
export const checkOut = async (jobId, caregiverId, gpsData = {}) => {
  // Use transaction for checkout + financial settlement
  return await transaction(async (client) => {
    let jobResult = await client.query(
      `SELECT j.*, ja.caregiver_id, ja.status AS assignment_status, jp.total_amount, jp.platform_fee_amount
       FROM jobs j
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN LATERAL (
         SELECT caregiver_id, status
         FROM job_assignments
         WHERE job_id = j.id
         ORDER BY assigned_at DESC NULLS LAST, created_at DESC
         LIMIT 1
       ) ja ON true
       WHERE j.id = $1
       FOR UPDATE`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      jobResult = await client.query(
        `SELECT j.*, ja.caregiver_id, ja.status AS assignment_status, jp.total_amount, jp.platform_fee_amount
         FROM jobs j
         JOIN job_posts jp ON jp.id = j.job_post_id
         LEFT JOIN LATERAL (
           SELECT caregiver_id, status
           FROM job_assignments
           WHERE job_id = j.id
           ORDER BY assigned_at DESC NULLS LAST, created_at DESC
           LIMIT 1
         ) ja ON true
         WHERE j.job_post_id = $1
         FOR UPDATE`,
        [jobId]
      );
    }

    if (jobResult.rows.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobResult.rows[0];
    const actualJobId = job.id;

    if (job.caregiver_id !== caregiverId) {
      throw new Error('Not authorized to check out from this job');
    }

    if (job.status === 'completed') {
      return { job_id: actualJobId, status: 'completed', already_completed: true };
    }

    if (job.status !== 'in_progress') {
      throw new Error(`Cannot check out from job in status: ${job.status}`);
    }

    // Update job status
    const updatedJob = await client.query(
      `UPDATE jobs
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'in_progress'
       RETURNING id`,
      [actualJobId]
    );

    if (updatedJob.rows.length === 0) {
      return { job_id: actualJobId, status: 'completed', already_completed: true };
    }

    // Update job post status
    await client.query(
      `UPDATE job_posts SET status = 'completed', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [job.job_post_id]
    );

    // Update assignment
    await client.query(
      `UPDATE job_assignments SET status = 'completed', end_confirmed_at = NOW(), updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
      [actualJobId]
    );

    // Record GPS event
    if (gpsData.lat && gpsData.lng) {
      await client.query(
        `INSERT INTO job_gps_events (id, job_id, caregiver_id, event_type, lat, lng, accuracy_m, created_at)
         VALUES ($1, $2, $3, 'check_out', $4, $5, $6, NOW())`,
        [uuidv4(), actualJobId, caregiverId, gpsData.lat, gpsData.lng, gpsData.accuracy_m || 10.0]
      );
    }

    // Financial settlement
    // Get escrow wallet
    const escrowWalletResult = await client.query(
      `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`,
      [actualJobId]
    );

    if (escrowWalletResult.rows.length === 0) {
      throw new Error('Escrow wallet not found');
    }

    const escrowWallet = escrowWalletResult.rows[0];
    const totalAmount = parseInt(job.total_amount);
    const platformFee = parseInt(job.platform_fee_amount);
    const caregiverPayment = totalAmount; // Caregiver gets total_amount, platform fee is separate
    const escrowHeld = parseInt(escrowWallet.held_balance);

    if (escrowHeld < caregiverPayment + platformFee) {
      throw new Error('Insufficient escrow balance for settlement');
    }

    // Get or create caregiver wallet
    let caregiverWalletResult = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'caregiver' FOR UPDATE`,
      [caregiverId]
    );

    if (caregiverWalletResult.rows.length === 0) {
      // Create caregiver wallet if doesn't exist
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

    // Get or create platform wallet
    let platformWalletResult = await client.query(
      `SELECT * FROM wallets WHERE wallet_type = 'platform' AND user_id IS NULL FOR UPDATE`
    );

    if (platformWalletResult.rows.length === 0) {
      // Create platform wallet if doesn't exist
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

    // Transfer to caregiver
    await client.query(
      `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
      [caregiverPayment, escrowWallet.id]
    );

    await client.query(
      `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
      [caregiverPayment, caregiverWallet.id]
    );

    // Record caregiver payment
    await client.query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
       VALUES ($1, $2, $3, $4, 'release', 'job', $5, 'Payment for completed job', NOW())`,
      [uuidv4(), escrowWallet.id, caregiverWallet.id, caregiverPayment, actualJobId]
    );

    // Transfer platform fee
    await client.query(
      `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
      [platformFee, escrowWallet.id]
    );

    await client.query(
      `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
      [platformFee, platformWallet.id]
    );

    // Record platform fee
    await client.query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
       VALUES ($1, $2, $3, $4, 'debit', 'fee', $5, 'Platform service fee', NOW())`,
      [uuidv4(), escrowWallet.id, platformWallet.id, platformFee, actualJobId]
    );

    // Add system message
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

    return {
      job_id: actualJobId,
      status: 'completed',
      caregiver_payment: caregiverPayment,
      platform_fee: platformFee,
    };
  });
};

/**
 * Cancel job
 * @param {string} jobPostId - Job post ID
 * @param {string} userId - User ID (hirer or caregiver)
 * @param {string} reason - Cancellation reason
 * @returns {object} - Updated job
 */
export const cancelJob = async (jobPostId, userId, reason) => {
  const job = await Job.getJobWithDetails(jobPostId);

  if (!job) {
    throw new Error('Job not found');
  }

  const resolvedJobPostId = job.id;
  const isHirer = job.hirer_id === userId;
  const isCaregiver = job.caregiver_id === userId;

  if (!isHirer && !isCaregiver) {
    throw new Error('Not authorized to cancel this job');
  }

  const currentStatus = job.job_status || job.status;
  const cancellableStatuses = ['draft', 'posted', 'assigned', 'in_progress'];

  if (!cancellableStatuses.includes(currentStatus)) {
    throw new Error(`Cannot cancel job in status: ${currentStatus}`);
  }

  // Use transaction for cancellation + refund
  return await transaction(async (client) => {
    // Update job post status
    await client.query(
      `UPDATE job_posts SET status = 'cancelled', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [resolvedJobPostId]
    );

    if (!job.job_id && currentStatus === 'posted') {
      const totalCost = parseInt(job.total_amount) + parseInt(job.platform_fee_amount);
      const hirerWalletResult = await client.query(
        `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`,
        [job.hirer_id]
      );

      if (hirerWalletResult.rows.length > 0) {
        const hirerWallet = hirerWalletResult.rows[0];
        const heldBalance = parseInt(hirerWallet.held_balance);

        if (heldBalance >= totalCost && totalCost > 0) {
          await client.query(
            `UPDATE wallets
             SET held_balance = held_balance - $1,
                 available_balance = available_balance + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [totalCost, hirerWallet.id]
          );

          await client.query(
            `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
             VALUES ($1, $2, $3, $4, 'release', 'job', $5, 'Release held funds for cancelled job', NOW())`,
            [uuidv4(), hirerWallet.id, hirerWallet.id, totalCost, resolvedJobPostId]
          );
        }
      }
    }

    // If job instance exists
    if (job.job_id) {
      await client.query(
        `UPDATE jobs SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [job.job_id]
      );

      await client.query(
        `UPDATE job_assignments SET status = 'cancelled', updated_at = NOW() WHERE job_id = $1 AND status = 'active'`,
        [job.job_id]
      );

      // Handle refund if escrow exists
      const escrowWalletResult = await client.query(
        `SELECT * FROM wallets WHERE job_id = $1 AND wallet_type = 'escrow' FOR UPDATE`,
        [job.job_id]
      );

      if (escrowWalletResult.rows.length > 0) {
        const escrowWallet = escrowWalletResult.rows[0];
        const escrowAmount = parseInt(escrowWallet.held_balance);

        if (escrowAmount > 0) {
          // Get hirer wallet
          const hirerWalletResult = await client.query(
            `SELECT * FROM wallets WHERE user_id = $1 AND wallet_type = 'hirer' FOR UPDATE`,
            [job.hirer_id]
          );

          if (hirerWalletResult.rows.length > 0) {
            const hirerWallet = hirerWalletResult.rows[0];

            // Refund to hirer
            await client.query(
              `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
              [escrowAmount, escrowWallet.id]
            );

            await client.query(
              `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
              [escrowAmount, hirerWallet.id]
            );

            // Record refund
            await client.query(
              `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, type, reference_type, reference_id, description, created_at)
               VALUES ($1, $2, $3, $4, 'reversal', 'refund', $5, 'Refund for cancelled job', NOW())`,
              [uuidv4(), escrowWallet.id, hirerWallet.id, escrowAmount, job.job_id]
            );
          }
        }
      }

      // Add system message
      const threadResult = await client.query(
        `SELECT id FROM chat_threads WHERE job_id = $1 LIMIT 1`,
        [job.job_id]
      );

      if (threadResult.rows.length > 0) {
        const cancelledBy = isHirer ? 'hirer' : 'caregiver';
        await client.query(
          `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, is_system_message, created_at)
           VALUES ($1, $2, NULL, 'system', $3, true, NOW())`,
          [uuidv4(), threadResult.rows[0].id, `Job cancelled by ${cancelledBy}. Reason: ${reason}`]
        );
      }
    }

    return {
      job_post_id: resolvedJobPostId,
      job_id: job.job_id,
      status: 'cancelled',
      reason,
      refunded: !!job.job_id,
    };
  });
};

/**
 * Get job statistics for dashboard
 * @returns {object} - Job statistics
 */
export const getJobStats = async () => {
  const result = await query(`
    SELECT
      COUNT(*) as total_jobs,
      COUNT(*) FILTER (WHERE status = 'draft') as draft_jobs,
      COUNT(*) FILTER (WHERE status = 'posted') as posted_jobs,
      COUNT(*) FILTER (WHERE status = 'assigned') as assigned_jobs,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
      COUNT(*) FILTER (WHERE is_urgent = true AND status = 'posted') as urgent_jobs
    FROM job_posts
  `);

  return result.rows[0];
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
