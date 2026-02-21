import express from "express";
import { requireAuth, requirePolicy } from "../middleware/auth.js";
import { query } from "../utils/db.js";
import Joi from "joi";
import {
  validateQuery,
  validateBody,
  commonSchemas,
} from "../utils/validation.js";

const router = express.Router();

/**
 * Public featured caregivers for landing page (no auth)
 * GET /api/caregivers/public/featured
 */
router.get("/public/featured", async (req, res) => {
  try {
    const limit = Math.min(6, Math.max(1, parseInt(req.query.limit) || 6));
    const hasPublicProfileColumn = await hasCaregiverPublicProfileColumn();
    const publicFilter = hasPublicProfileColumn
      ? `AND COALESCE(cp.is_public_profile, TRUE) = TRUE`
      : '';

    const result = await query(
      `SELECT
         u.id,
         u.trust_level,
         u.completed_jobs_count,
         cp.display_name,
         cp.bio,
         cp.specializations,
         cp.experience_years,
         COALESCE(rv.avg_rating, 0) AS avg_rating,
         COALESCE(rv.total_reviews, 0)::int AS total_reviews
       FROM users u
       LEFT JOIN caregiver_profiles cp ON cp.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT AVG(cr.rating)::numeric(3,2) AS avg_rating, COUNT(*)::int AS total_reviews
         FROM caregiver_reviews cr WHERE cr.caregiver_id = u.id
       ) rv ON true
       WHERE u.role = 'caregiver'
         AND u.status = 'active'
         AND cp.display_name IS NOT NULL
         AND cp.display_name <> ''
         AND u.email NOT LIKE '%mock%@careconnect.local'
         ${publicFilter}
       ORDER BY rv.total_reviews DESC NULLS LAST, u.trust_score DESC NULLS LAST
       LIMIT $1`,
      [limit],
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[Caregiver Public Featured] Error:", error);
    res.status(500).json({ success: false, error: "Failed to load featured caregivers" });
  }
});

const searchQuery = Joi.object({
  q: Joi.string().trim().max(200).allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  skills: Joi.string().trim().max(500).allow(""),
  trust_level: Joi.string().valid("L0", "L1", "L2", "L3").allow(""),
  min_experience_years: Joi.number().integer().min(0).max(60),
  available_day: Joi.number().integer().min(0).max(6),
});

const assignBody = Joi.object({
  job_post_id: commonSchemas.uuid.required(),
  caregiver_id: commonSchemas.uuid.required(),
});

async function hasCaregiverPublicProfileColumn() {
  const result = await query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caregiver_profiles'
        AND column_name = 'is_public_profile'
    ) AS has_column`,
  );
  return !!result.rows[0]?.has_column;
}

/**
 * Search caregivers (for hirers)
 * GET /api/caregivers/search
 */
router.get(
  "/search",
  requireAuth,
  requirePolicy("job:create"),
  validateQuery(searchQuery),
  async (req, res) => {
    try {
      const hasPublicProfileColumn = await hasCaregiverPublicProfileColumn();
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const q = String(req.query.q || "").trim();
      const skills = String(req.query.skills || "").trim();
      const trustLevel = String(req.query.trust_level || "").trim();
      const minExperienceYears =
        req.query.min_experience_years === undefined
          ? null
          : Number(req.query.min_experience_years);
      const availableDay =
        req.query.available_day === undefined
          ? null
          : Number(req.query.available_day);

      const where = [
        `u.role = 'caregiver'`,
        `u.status = 'active'`,
      ];
      if (hasPublicProfileColumn) {
        where.push(`COALESCE(cp.is_public_profile, TRUE) = TRUE`);
      }
      const values = [];
      let idx = 1;

      if (q) {
        values.push(`%${q}%`);
        where.push(
          `(u.id::text ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone_number ILIKE $${idx} OR COALESCE(cp.display_name, '') ILIKE $${idx})`,
        );
        idx++;
      }
      if (trustLevel) {
        values.push(trustLevel);
        where.push(`u.trust_level = $${idx++}`);
      }
      if (Number.isInteger(minExperienceYears) && minExperienceYears >= 0) {
        values.push(minExperienceYears);
        where.push(`COALESCE(cp.experience_years, 0) >= $${idx++}`);
      }
      if (skills) {
        const skillGroups = skills
          .split(";")
          .map((group) => group
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean))
          .filter((group) => group.length > 0);
        if (skillGroups.length > 0) {
          skillGroups.forEach((group) => {
            values.push(group);
            where.push(
              `(cp.specializations && $${idx++}::text[] OR cp.certifications && $${idx - 1}::text[])`,
            );
          });
        }
      }
      if (Number.isInteger(availableDay) && availableDay >= 0 && availableDay <= 6) {
        values.push(availableDay);
        where.push(`cp.available_days IS NOT NULL AND $${idx++}::int = ANY(cp.available_days)`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const publicProfileSelect = hasPublicProfileColumn
        ? `COALESCE(cp.is_public_profile, TRUE) AS is_public_profile`
        : `TRUE AS is_public_profile`;

      // Save WHERE-only values for count query before adding hirerId
      const whereValues = [...values];

      const hirerId = req.user?.id || null;
      const favJoinParam = hirerId ? `$${idx++}` : null;
      if (hirerId) values.push(hirerId);

      const result = await query(
        `SELECT
         u.id,
         u.email,
         u.phone_number,
         u.trust_level,
         u.trust_score,
         u.completed_jobs_count,
         u.created_at,
         cp.display_name,
         cp.bio,
         cp.certifications,
         cp.specializations,
         cp.experience_years,
         cp.available_from,
         cp.available_to,
         cp.available_days,
         ${publicProfileSelect},
         ${hirerId ? `(cf.id IS NOT NULL) AS is_favorited` : `FALSE AS is_favorited`},
         COALESCE(rv.avg_rating, 0) AS avg_rating,
         COALESCE(rv.total_reviews, 0)::int AS total_reviews
       FROM users u
       LEFT JOIN caregiver_profiles cp ON cp.user_id = u.id
       ${hirerId ? `LEFT JOIN caregiver_favorites cf ON cf.caregiver_id = u.id AND cf.hirer_id = ${favJoinParam}` : ''}
       LEFT JOIN LATERAL (
         SELECT AVG(cr.rating)::numeric(3,2) AS avg_rating, COUNT(*)::int AS total_reviews
         FROM caregiver_reviews cr WHERE cr.caregiver_id = u.id
       ) rv ON true
       ${whereSql}
       ORDER BY
         ${hirerId ? '(CASE WHEN cf.id IS NOT NULL THEN 0 ELSE 1 END) ASC,' : ''}
         (CASE WHEN u.email LIKE '%mock%@careconnect.local' THEN 1 ELSE 0 END) ASC,
         u.trust_score DESC NULLS LAST, u.completed_jobs_count DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset],
      );

      const countResult = await query(
        `SELECT COUNT(*)::int as total
       FROM users u
       LEFT JOIN caregiver_profiles cp ON cp.user_id = u.id
       ${whereSql}`,
        whereValues,
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
      console.error("[Caregiver Search] Error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to search caregivers" });
    }
  },
);

/**
 * Assign a caregiver to a job post (hirer only)
 * POST /api/caregivers/assign
 */
router.post(
  "/assign",
  requireAuth,
  requirePolicy("job:create"),
  validateBody(assignBody),
  async (req, res) => {
    try {
      const hirerId = req.user.id;
      const { job_post_id, caregiver_id } = req.body;

      // Verify the job post belongs to this hirer
      const jobResult = await query(
        `SELECT jp.id, jp.status, jp.hirer_id, jp.scheduled_start_at, jp.scheduled_end_at, j.id as job_id, j.status as job_status
       FROM job_posts jp
       LEFT JOIN jobs j ON j.job_post_id = jp.id
       WHERE jp.id = $1`,
        [job_post_id],
      );

      if (!jobResult.rows.length) {
        return res.status(404).json({ success: false, error: "ไม่พบงานนี้" });
      }

      const job = jobResult.rows[0];
      if (job.hirer_id !== hirerId) {
        return res
          .status(403)
          .json({ success: false, error: "คุณไม่ใช่เจ้าของงานนี้" });
      }

      if (job.status === "cancelled") {
        return res
          .status(400)
          .json({ success: false, error: "งานนี้ถูกยกเลิกแล้ว" });
      }

      // Only allow direct assignment for unassigned (posted/draft) or completed jobs
      const allowedStatuses = ["draft", "posted", "completed"];
      if (!allowedStatuses.includes(job.status)) {
        return res
          .status(400)
          .json({ success: false, error: "สามารถมอบหมายได้เฉพาะงานที่ยังไม่ได้รับมอบหมาย หรืองานที่เสร็จแล้วเท่านั้น" });
      }

      // Verify caregiver exists and is active
      const cgResult = await query(
        `SELECT id, role, status, trust_level FROM users WHERE id = $1 AND role = 'caregiver' AND status = 'active'`,
        [caregiver_id],
      );

      if (!cgResult.rows.length) {
        return res
          .status(404)
          .json({ success: false, error: "ไม่พบผู้ดูแลนี้" });
      }

      if (job.scheduled_start_at && job.scheduled_end_at) {
        const conflictResult = await query(
          `SELECT jp.id
           FROM job_assignments ja
           JOIN jobs j ON j.id = ja.job_id
           JOIN job_posts jp ON jp.id = j.job_post_id
           WHERE ja.caregiver_id = $1
             AND ja.status = 'active'
             AND j.status IN ('assigned', 'in_progress')
             AND jp.id <> $4
             AND jp.scheduled_start_at < $3
             AND jp.scheduled_end_at > $2
           LIMIT 1`,
          [caregiver_id, job.scheduled_start_at, job.scheduled_end_at, job_post_id],
        );

        if (conflictResult.rows.length) {
          return res.status(409).json({
            success: false,
            error: "ผู้ดูแลมีงานที่มอบหมายแล้วในช่วงเวลาเดียวกัน",
          });
        }
      }

      // Update preferred_caregiver_id on the job post
      await query(
        `UPDATE job_posts SET preferred_caregiver_id = $1, updated_at = NOW() WHERE id = $2`,
        [caregiver_id, job_post_id],
      );

      // If there's a job instance, create/update assignment
      if (job.job_id) {
        // Check if assignment already exists
        const existingAssignment = await query(
          `SELECT id FROM job_assignments WHERE job_id = $1 AND status = 'active'`,
          [job.job_id],
        );

        if (existingAssignment.rows.length) {
          // Update existing assignment
          await query(
            `UPDATE job_assignments SET caregiver_id = $1, updated_at = NOW() WHERE job_id = $2 AND status = 'active'`,
            [caregiver_id, job.job_id],
          );
        } else {
          // Create new assignment
          const { v4: uuidv4 } = await import("uuid");
          await query(
            `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'active', NOW(), NOW(), NOW())`,
            [uuidv4(), job.job_id, job_post_id, caregiver_id],
          );
        }
      }

      res.json({ success: true, message: "มอบหมายผู้ดูแลสำเร็จ" });
    } catch (error) {
      console.error("[Caregiver Assign] Error:", error);
      res
        .status(500)
        .json({ success: false, error: "ไม่สามารถมอบหมายผู้ดูแลได้" });
    }
  },
);

/**
 * Get a single caregiver's public profile
 * GET /api/caregivers/:id
 */
router.get(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const { id: caregiverId } = req.params;
      const hirerId = req.user?.id || null;

      const result = await query(
        `SELECT
           u.id,
           u.email,
           u.phone_number,
           u.trust_level,
           u.trust_score,
           u.completed_jobs_count,
           u.created_at,
           cp.display_name,
           cp.bio,
           cp.certifications,
           cp.specializations,
           cp.experience_years,
           cp.available_from,
           cp.available_to,
           cp.available_days,
           COALESCE(cp.is_public_profile, TRUE) AS is_public_profile,
           ${hirerId ? `(SELECT EXISTS(SELECT 1 FROM caregiver_favorites cf WHERE cf.caregiver_id = u.id AND cf.hirer_id = $2)) AS is_favorited` : `FALSE AS is_favorited`},
           COALESCE(rv.avg_rating, 0) AS avg_rating,
           COALESCE(rv.total_reviews, 0)::int AS total_reviews
         FROM users u
         LEFT JOIN caregiver_profiles cp ON cp.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT AVG(cr.rating)::numeric(3,2) AS avg_rating, COUNT(*)::int AS total_reviews
           FROM caregiver_reviews cr WHERE cr.caregiver_id = u.id
         ) rv ON true
         WHERE u.id = $1 AND u.role = 'caregiver' AND u.status = 'active'`,
        hirerId ? [caregiverId, hirerId] : [caregiverId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, error: "ไม่พบผู้ดูแลนี้" });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("[Caregiver Profile] Error:", error);
      res.status(500).json({ success: false, error: "ไม่สามารถโหลดข้อมูลผู้ดูแลได้" });
    }
  },
);

export default router;
