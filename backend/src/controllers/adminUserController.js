import User from '../models/User.js';
import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

const logAdminAction = async (adminUserId, action, details = {}) => {
  try {
    await query(
      `INSERT INTO audit_events (id, user_id, event_type, action, details, created_at)
       VALUES ($1, $2, 'admin_action', $3, $4, NOW())`,
      [uuidv4(), adminUserId, action, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('[Admin Audit] Failed to log action:', err);
  }
};

const parseIntOr = (value, fallback) => {
  const num = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(num) ? num : fallback;
};

const safeUser = (row) => {
  if (!row) return null;
  const copy = { ...row };
  delete copy.password_hash;
  return copy;
};

export const listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, parseIntOr(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();

    const where = [];
    const values = [];
    let idx = 1;

    if (role) {
      values.push(role);
      where.push(`u.role = $${idx++}`);
    }
    if (status) {
      values.push(status);
      where.push(`u.status = $${idx++}`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(
        `(u.id::text ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone_number ILIKE $${idx} OR COALESCE(hp.display_name, cp.display_name, '') ILIKE $${idx})`
      );
      idx += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         u.id,
         u.email,
         u.phone_number,
         u.account_type,
         u.role,
         u.status,
         u.trust_level,
         u.trust_score,
         u.is_email_verified,
         u.is_phone_verified,
         u.two_factor_enabled,
         u.completed_jobs_count,
         u.first_job_waiver_used,
         u.created_at,
         u.updated_at,
         COALESCE(hp.display_name, cp.display_name) as display_name
       FROM users u
       LEFT JOIN hirer_profiles hp ON hp.user_id = u.id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = u.id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total
       FROM users u
       LEFT JOIN hirer_profiles hp ON hp.user_id = u.id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = u.id
       ${whereSql}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      data: {
        data: result.rows.map(safeUser),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('[Admin Users] List users error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to list users',
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.getUserWithProfile(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    const displayName = user.profile?.display_name || null;
    res.json({
      success: true,
      data: { user: { ...safeUser(user), display_name: displayName } },
    });
  } catch (error) {
    console.error('[Admin Users] Get user error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get user',
    });
  }
};

export const setUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || '').trim();
    const reason = String(req.body?.reason || '').trim();

    if (!status || !['active', 'suspended', 'deleted'].includes(status)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid status',
      });
    }

    if (id === req.userId && status !== 'active') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Cannot change your own status',
      });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    if (target.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot change status of admin account',
      });
    }

    let updated;
    if (status === 'suspended') updated = await User.suspendUser(id, reason);
    else if (status === 'active') updated = await User.reactivateUser(id);
    else updated = await User.softDeleteUser(id);

    await logAdminAction(req.userId, 'user:status', {
      target_user_id: id,
      new_status: status,
      reason: reason || null,
    });

    res.json({
      success: true,
      message: 'User status updated',
      data: { user: safeUser(updated) },
    });
  } catch (error) {
    console.error('[Admin Users] Set status error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update user status',
    });
  }
};

export default { listUsers, getUser, setUserStatus };

