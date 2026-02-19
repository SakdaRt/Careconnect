/**
 * Trust Level Worker
 *
 * Background job that recalculates user trust scores and levels.
 * Should be run periodically via cron job or scheduler.
 *
 * Trust Levels:
 * - L0 (Unverified): Just registered
 * - L1 (Basic): Email/Phone verified
 * - L2 (Verified): KYC approved
 * - L3 (Trusted): High trust score (>=80) + Bank verified
 *
 * Trust Score (0-100) calculated from:
 * - Completed jobs (+)
 * - Good reviews (+)
 * - Punctuality (+)
 * - GPS compliance (+)
 * - Cancellations (-)
 * - Poor reviews (-)
 */

import { query, transaction } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

// Score weights
const SCORE_WEIGHTS = {
  COMPLETED_JOB: 5,           // +5 per completed job (max contribution 30)
  GOOD_REVIEW: 3,             // +3 per 4-5 star review
  AVERAGE_REVIEW: 1,          // +1 per 3 star review
  BAD_REVIEW: -5,             // -5 per 1-2 star review
  CANCELLATION: -10,          // -10 per cancellation
  GPS_VIOLATION: -3,          // -3 per GPS violation
  ON_TIME_CHECKIN: 2,         // +2 per on-time check-in (max contribution 20)
  PROFILE_COMPLETE: 10,       // +10 for complete profile
  RESPONSE_TIME_BONUS: 5,     // +5 for fast average response time
};

/**
 * Calculate trust score for a user
 * @param {string} userId - User ID
 * @returns {object} - Score breakdown and total
 */
async function calculateTrustScore(userId) {
  const breakdown = {
    completedJobs: 0,
    reviews: 0,
    cancellations: 0,
    gpsViolations: 0,
    punctuality: 0,
    profileComplete: 0,
    responseTime: 0,
  };

  // Get completed jobs count
  const completedJobsResult = await query(
    `SELECT COUNT(*) as count FROM job_assignments
     WHERE caregiver_id = $1 AND status = 'completed'`,
    [userId]
  );
  const completedJobs = parseInt(completedJobsResult.rows[0].count) || 0;
  breakdown.completedJobs = Math.min(completedJobs * SCORE_WEIGHTS.COMPLETED_JOB, 30);

  // Get reviews from caregiver_reviews table
  try {
    const reviewsResult = await query(
      `SELECT rating FROM caregiver_reviews WHERE caregiver_id = $1`,
      [userId]
    );
    let reviewPoints = 0;
    for (const row of reviewsResult.rows) {
      const r = parseInt(row.rating);
      if (r >= 4) reviewPoints += SCORE_WEIGHTS.GOOD_REVIEW;
      else if (r === 3) reviewPoints += SCORE_WEIGHTS.AVERAGE_REVIEW;
      else reviewPoints += SCORE_WEIGHTS.BAD_REVIEW;
    }
    breakdown.reviews = Math.max(Math.min(reviewPoints, 20), -20);
  } catch {
    breakdown.reviews = 0;
  }

  // Get cancellations (as caregiver)
  const cancellationsResult = await query(
    `SELECT COUNT(*) as count FROM job_assignments
     WHERE caregiver_id = $1 AND status = 'cancelled'`,
    [userId]
  );
  const cancellations = parseInt(cancellationsResult.rows[0].count) || 0;
  breakdown.cancellations = Math.max(cancellations * SCORE_WEIGHTS.CANCELLATION, -30);

  // Get GPS violations (events with fraud_indicators)
  const gpsViolationsResult = await query(
    `SELECT COUNT(*) as count FROM job_gps_events
     WHERE caregiver_id = $1 AND array_length(fraud_indicators, 1) > 0`,
    [userId]
  );
  const gpsViolations = parseInt(gpsViolationsResult.rows[0]?.count) || 0;
  breakdown.gpsViolations = Math.max(gpsViolations * SCORE_WEIGHTS.GPS_VIOLATION, -15);

  // Get on-time check-ins
  const onTimeResult = await query(
    `SELECT COUNT(*) as count FROM job_gps_events g
     JOIN jobs j ON j.id = g.job_id
     JOIN job_posts jp ON jp.id = j.job_post_id
     WHERE g.caregiver_id = $1
       AND g.event_type = 'check_in'
       AND g.created_at <= jp.scheduled_start_at + INTERVAL '15 minutes'`,
    [userId]
  );
  const onTimeCheckins = parseInt(onTimeResult.rows[0].count) || 0;
  breakdown.punctuality = Math.min(onTimeCheckins * SCORE_WEIGHTS.ON_TIME_CHECKIN, 20);

  // Check if profile is complete (caregiver)
  const profileResult = await query(
    `SELECT display_name, bio, experience_years FROM caregiver_profiles
     WHERE user_id = $1`,
    [userId]
  );
  if (profileResult.rows[0]) {
    const profile = profileResult.rows[0];
    if (profile.display_name && profile.bio && profile.experience_years) {
      breakdown.profileComplete = SCORE_WEIGHTS.PROFILE_COMPLETE;
    }
  }

  // Calculate total score (0-100)
  const rawScore = 50 + // Base score
    breakdown.completedJobs +
    breakdown.reviews +
    breakdown.cancellations +
    breakdown.gpsViolations +
    breakdown.punctuality +
    breakdown.profileComplete +
    breakdown.responseTime;

  const totalScore = Math.max(0, Math.min(100, rawScore));

  return {
    breakdown,
    totalScore,
  };
}

/**
 * Determine appropriate trust level for a user
 * @param {string} userId - User ID
 * @param {number} trustScore - Current trust score
 * @returns {string} - Trust level (L0, L1, L2, L3)
 */
async function determineTrustLevel(userId, trustScore) {
  // Get user verification status and current trust level
  const userResult = await query(
    `SELECT is_email_verified, is_phone_verified, trust_level FROM users WHERE id = $1`,
    [userId]
  );

  if (!userResult.rows[0]) {
    return 'L0';
  }

  const user = userResult.rows[0];
  const emailVerified = !!user.is_email_verified;
  const phoneVerified = !!user.is_phone_verified;

  // Check KYC status
  const kycResult = await query(
    `SELECT status FROM user_kyc_info WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const kycApproved = kycResult.rows[0]?.status === 'approved';

  // Check bank verification
  const bankResult = await query(
    `SELECT is_verified FROM bank_accounts WHERE user_id = $1 AND is_verified = true LIMIT 1`,
    [userId]
  );
  const bankVerified = bankResult.rows.length > 0;

  const currentLevel = user.trust_level || 'L0';

  const hasL3Prereqs = phoneVerified && kycApproved && bankVerified;
  const hasL2Prereqs = phoneVerified && kycApproved;

  // Determine level with hysteresis (L2 ↔ L3 only)
  if (hasL3Prereqs && trustScore >= 80) {
    return 'L3';
  }

  if (currentLevel === 'L3' && hasL3Prereqs && trustScore >= 75) {
    return 'L3';
  }

  if (hasL2Prereqs) {
    return 'L2';
  }

  if (phoneVerified) {
    return 'L1';
  }

  if (emailVerified) {
    return 'L0';
  }

  return 'L0';
}

/**
 * Update trust score and level for a single user
 * @param {string} userId - User ID
 * @returns {object} - Update result
 */
async function updateUserTrust(userId) {
  try {
    // Calculate new trust score
    const { breakdown, totalScore } = await calculateTrustScore(userId);

    // Get current values
    const currentResult = await query(
      `SELECT trust_score, trust_level FROM users WHERE id = $1`,
      [userId]
    );

    if (!currentResult.rows[0]) {
      return { success: false, error: 'User not found' };
    }

    const currentScore = currentResult.rows[0].trust_score;
    const currentLevel = currentResult.rows[0].trust_level;

    // Determine new trust level
    const newLevel = await determineTrustLevel(userId, totalScore);

    // Only update if changed
    if (totalScore !== currentScore || newLevel !== currentLevel) {
      await transaction(async (client) => {
        // Update user
        await client.query(
          `UPDATE users SET trust_score = $1, trust_level = $2, updated_at = NOW() WHERE id = $3`,
          [totalScore, newLevel, userId]
        );

        // Record in history
        const delta = totalScore - currentScore;
        await client.query(
          `INSERT INTO trust_score_history (id, user_id, delta, score_before, score_after, trust_level_before, trust_level_after, reason_code, reason_detail, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            uuidv4(),
            userId,
            delta,
            currentScore,
            totalScore,
            currentLevel,
            newLevel,
            'worker_recalculation',
            JSON.stringify(breakdown),
          ]
        );

        await client.query(
          `INSERT INTO audit_events (id, user_id, event_type, action, old_level, new_level, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            uuidv4(),
            userId,
            'trust_level_change',
            'worker_recalculation',
            currentLevel,
            newLevel,
            JSON.stringify({ trust_score: totalScore, trust_score_delta: delta }),
          ]
        );
      });

      return {
        success: true,
        userId,
        previousScore: currentScore,
        newScore: totalScore,
        previousLevel: currentLevel,
        newLevel,
        breakdown,
      };
    }

    return {
      success: true,
      userId,
      noChange: true,
      score: totalScore,
      level: newLevel,
    };
  } catch (error) {
    // Error updating user - log silently for production
    // logger.error(`[Trust Worker] Error updating user ${userId}:`, error)
    return { success: false, userId, error: error.message };
  }
}

/**
 * Run trust level worker for all caregivers
 * @returns {object} - Summary of updates
 */
async function runTrustLevelWorker() {
  // Starting trust level calculation
  const startTime = Date.now();

  // Get all caregiver users
  const usersResult = await query(
    `SELECT id FROM users WHERE role = 'caregiver' AND status = 'active'`
  );

  const results = {
    total: usersResult.rows.length,
    updated: 0,
    unchanged: 0,
    errors: 0,
    details: [],
  };

  for (const user of usersResult.rows) {
    const result = await updateUserTrust(user.id);

    if (result.success) {
      if (result.noChange) {
        results.unchanged++;
      } else {
        results.updated++;
        results.details.push(result);
      }
    } else {
      results.errors++;
    // Failed for user - log silently for production
    // logger.error(`[Trust Worker] Failed for user ${user.id}:`, result.error)
    }
  }

  const duration = Date.now() - startTime;
  // Completed trust level calculation
  // Duration: ${duration}ms, Updated: ${results.updated}, Unchanged: ${results.unchanged}, Errors: ${results.errors}

  return results;
}

/**
 * Update trust for a specific user (can be called after job completion, review, etc.)
 * @param {string} userId - User ID
 */
async function triggerUserTrustUpdate(userId, source = 'event') {
  // Triggered update for user ${userId} from ${source}
  const startTime = Date.now();
  const result = await updateUserTrust(userId);
  const durationMs = Date.now() - startTime;
  try {
    await query(
      `INSERT INTO audit_events (id, user_id, event_type, action, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        uuidv4(),
        userId,
        'trust_recompute',
        source,
        JSON.stringify({ duration_ms: durationMs, success: !!result?.success }),
      ]
    );
  } catch (error) {
    console.error('[Trust Worker] Failed to write recompute audit log:', error);
  }
  return result;
}

export {
  runTrustLevelWorker,
  updateUserTrust,
  triggerUserTrustUpdate,
  calculateTrustScore,
  determineTrustLevel,
};

// If run directly as a script
if (process.argv[1]?.includes('trustLevelWorker.js')) {
  runTrustLevelWorker()
    .then((results) => {
      console.log('[Trust Worker] Results:', JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Trust Worker] Fatal error:', error);
      process.exit(1);
    });
}
