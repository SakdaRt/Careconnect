import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

const router = Router();

const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details.map((d) => d.message).join(', '),
    });
  }
  next();
};

const reviewSchema = Joi.object({
  job_id: Joi.string().uuid().required(),
  caregiver_id: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow('', null),
});

/**
 * Create a review for a caregiver after job completion
 * POST /api/reviews
 */
router.post(
  '/',
  requireAuth,
  validateBody(reviewSchema),
  async (req, res) => {
    try {
      const reviewerId = req.user.id;
      const { job_id, caregiver_id, rating, comment } = req.body;

      // Verify the job exists and is completed
      const jobResult = await query(
        `SELECT jp.id as job_post_id, jp.hirer_id, jp.status as post_status,
                j.id as job_id, j.status as job_status
         FROM job_posts jp
         LEFT JOIN jobs j ON j.job_post_id = jp.id
         WHERE jp.id = $1 OR j.id = $1`,
        [job_id]
      );

      if (!jobResult.rows.length) {
        return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
      }

      const job = jobResult.rows[0];
      const actualJobId = job.job_id || job_id;
      const jobPostId = job.job_post_id;

      if (job.hirer_id !== reviewerId) {
        return res.status(403).json({ success: false, error: 'เฉพาะผู้ว่าจ้างเท่านั้นที่สามารถรีวิวได้' });
      }

      const jobStatus = job.job_status || job.post_status;
      if (jobStatus !== 'completed') {
        return res.status(400).json({ success: false, error: 'สามารถรีวิวได้เฉพาะงานที่เสร็จแล้วเท่านั้น' });
      }

      // Check if already reviewed
      const existing = await query(
        `SELECT id FROM caregiver_reviews WHERE job_id = $1 AND reviewer_id = $2`,
        [actualJobId, reviewerId]
      );

      if (existing.rows.length) {
        return res.status(409).json({ success: false, error: 'คุณรีวิวงานนี้ไปแล้ว' });
      }

      const id = uuidv4();
      await query(
        `INSERT INTO caregiver_reviews (id, job_id, job_post_id, reviewer_id, caregiver_id, rating, comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [id, actualJobId, jobPostId, reviewerId, caregiver_id, rating, comment || null]
      );

      res.status(201).json({
        success: true,
        data: { review: { id, job_id: actualJobId, caregiver_id, rating, comment } },
      });
    } catch (error) {
      console.error('[Review] Create error:', error);
      res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกรีวิวได้' });
    }
  }
);

/**
 * Get reviews for a caregiver
 * GET /api/reviews/caregiver/:caregiverId
 */
router.get('/caregiver/:caregiverId', requireAuth, async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT cr.*, hp.display_name as reviewer_name
       FROM caregiver_reviews cr
       LEFT JOIN hirer_profiles hp ON hp.user_id = cr.reviewer_id
       WHERE cr.caregiver_id = $1
       ORDER BY cr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [caregiverId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM caregiver_reviews WHERE caregiver_id = $1`,
      [caregiverId]
    );

    const avgResult = await query(
      `SELECT AVG(rating)::numeric(3,2) as avg_rating, COUNT(*)::int as total_reviews
       FROM caregiver_reviews WHERE caregiver_id = $1`,
      [caregiverId]
    );

    const total = countResult.rows[0]?.total || 0;
    const avgRating = parseFloat(avgResult.rows[0]?.avg_rating) || 0;
    const totalReviews = avgResult.rows[0]?.total_reviews || 0;

    res.json({
      success: true,
      data: {
        data: result.rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        avg_rating: avgRating,
        total_reviews: totalReviews,
      },
    });
  } catch (error) {
    console.error('[Review] Get caregiver reviews error:', error);
    res.status(500).json({ success: false, error: 'ไม่สามารถโหลดรีวิวได้' });
  }
});

/**
 * Check if a job has been reviewed
 * GET /api/reviews/job/:jobId
 */
router.get('/job/:jobId', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const reviewerId = req.user.id;

    const result = await query(
      `SELECT * FROM caregiver_reviews WHERE (job_id = $1 OR job_post_id = $1) AND reviewer_id = $2`,
      [jobId, reviewerId]
    );

    res.json({
      success: true,
      data: { review: result.rows[0] || null },
    });
  } catch (error) {
    console.error('[Review] Get job review error:', error);
    res.status(500).json({ success: false, error: 'ไม่สามารถโหลดรีวิวได้' });
  }
});

// ============================================================================
// Favorites
// ============================================================================

/**
 * Toggle favorite a caregiver
 * POST /api/favorites/toggle
 */
router.post(
  '/favorites/toggle',
  requireAuth,
  validateBody(Joi.object({ caregiver_id: Joi.string().uuid().required() })),
  async (req, res) => {
    try {
      const hirerId = req.user.id;
      const { caregiver_id } = req.body;

      const existing = await query(
        `SELECT id FROM caregiver_favorites WHERE hirer_id = $1 AND caregiver_id = $2`,
        [hirerId, caregiver_id]
      );

      if (existing.rows.length) {
        await query(`DELETE FROM caregiver_favorites WHERE id = $1`, [existing.rows[0].id]);
        return res.json({ success: true, data: { favorited: false } });
      }

      const id = uuidv4();
      await query(
        `INSERT INTO caregiver_favorites (id, hirer_id, caregiver_id, created_at) VALUES ($1, $2, $3, NOW())`,
        [id, hirerId, caregiver_id]
      );

      res.json({ success: true, data: { favorited: true } });
    } catch (error) {
      console.error('[Favorites] Toggle error:', error);
      res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกรายการโปรดได้' });
    }
  }
);

/**
 * Get my favorites
 * GET /api/favorites
 */
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const hirerId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT cf.*, u.id as user_id, u.email, u.trust_level, u.trust_score, u.completed_jobs_count,
              cp.display_name, cp.bio, cp.certifications, cp.specializations, cp.experience_years,
              (SELECT AVG(cr.rating)::numeric(3,2) FROM caregiver_reviews cr WHERE cr.caregiver_id = cf.caregiver_id) as avg_rating,
              (SELECT COUNT(*)::int FROM caregiver_reviews cr WHERE cr.caregiver_id = cf.caregiver_id) as total_reviews
       FROM caregiver_favorites cf
       JOIN users u ON u.id = cf.caregiver_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = cf.caregiver_id
       WHERE cf.hirer_id = $1
       ORDER BY cf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [hirerId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM caregiver_favorites WHERE hirer_id = $1`,
      [hirerId]
    );

    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      data: {
        data: result.rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('[Favorites] Get error:', error);
    res.status(500).json({ success: false, error: 'ไม่สามารถโหลดรายการโปรดได้' });
  }
});

/**
 * Check if a caregiver is favorited
 * GET /api/favorites/check/:caregiverId
 */
router.get('/favorites/check/:caregiverId', requireAuth, async (req, res) => {
  try {
    const hirerId = req.user.id;
    const { caregiverId } = req.params;

    const result = await query(
      `SELECT id FROM caregiver_favorites WHERE hirer_id = $1 AND caregiver_id = $2`,
      [hirerId, caregiverId]
    );

    res.json({ success: true, data: { favorited: result.rows.length > 0 } });
  } catch (error) {
    console.error('[Favorites] Check error:', error);
    res.status(500).json({ success: false, error: 'ไม่สามารถตรวจสอบรายการโปรดได้' });
  }
});

export default router;
