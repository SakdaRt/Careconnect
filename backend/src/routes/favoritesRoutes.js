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

/**
 * Toggle favorite a caregiver
 * POST /api/favorites/toggle
 */
router.post(
  '/toggle',
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
router.get('/', requireAuth, async (req, res) => {
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
router.get('/check/:caregiverId', requireAuth, async (req, res) => {
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
