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
         u.ban_login,
         u.ban_job_create,
         u.ban_job_accept,
         u.ban_withdraw,
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

export const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['email', 'phone_number', 'trust_level', 'trust_score', 'is_email_verified', 'is_phone_verified', 'two_factor_enabled', 'admin_note'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No valid fields to update' });
    }

    const target = await query(`SELECT id, role FROM users WHERE id = $1`, [id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

    updates.updated_at = new Date();
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const vals = [id, ...Object.values(updates)];
    const updated = await query(`UPDATE users SET ${setClauses} WHERE id = $1 RETURNING *`, vals);

    await logAdminAction(req.userId, 'user:edit', { target_user_id: id, fields: Object.keys(updates) });

    res.json({ success: true, message: 'อัปเดตข้อมูลแล้ว', data: { user: safeUser(updated.rows[0]) } });
  } catch (error) {
    console.error('[Admin Users] Edit user error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to edit user' });
  }
};

export const getUserWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const walletRes = await query(
      `SELECT w.*, u.email, u.phone_number, u.role
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1`,
      [id]
    );
    const bankRes = await query(
      `SELECT ba.id, ba.bank_code, b.full_name_th as bank_name, ba.account_number_last4, ba.account_name, ba.is_verified, ba.is_primary, ba.created_at
       FROM bank_accounts ba
       LEFT JOIN banks b ON b.code = ba.bank_code
       WHERE ba.user_id = $1 AND ba.is_active = true
       ORDER BY ba.is_primary DESC, ba.created_at DESC`,
      [id]
    );
    const recentTxRes = await query(
      `SELECT lt.id, lt.type, lt.amount, lt.reference_type, lt.reference_id, lt.description, lt.created_at,
              wf.wallet_type as from_wallet_type, wt.wallet_type as to_wallet_type
       FROM ledger_transactions lt
       LEFT JOIN wallets wf ON wf.id = lt.from_wallet_id
       LEFT JOIN wallets wt ON wt.id = lt.to_wallet_id
       WHERE wf.user_id = $1 OR wt.user_id = $1
       ORDER BY lt.created_at DESC LIMIT 20`,
      [id]
    );
    res.json({
      success: true,
      data: {
        wallets: walletRes.rows,
        bank_accounts: bankRes.rows,
        recent_transactions: recentTxRes.rows,
      },
    });
  } catch (error) {
    console.error('[Admin Users] Get wallet error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get user wallet' });
  }
};

export const setBan = async (req, res) => {
  try {
    const { id } = req.params;
    const ban_type = String(req.body?.ban_type || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const value = req.body?.value !== undefined ? !!req.body.value : true;

    const validBanTypes = ['suspend', 'delete', 'ban_login', 'ban_job_create', 'ban_job_accept', 'ban_withdraw'];
    if (!validBanTypes.includes(ban_type)) {
      return res.status(400).json({ error: 'Validation error', message: `Invalid ban_type. Must be one of: ${validBanTypes.join(', ')}` });
    }

    if (id === req.userId) {
      return res.status(400).json({ error: 'Bad request', message: 'Cannot ban yourself' });
    }

    const target = await query(`SELECT id, role, status FROM users WHERE id = $1`, [id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    if (target.rows[0].role === 'admin') return res.status(403).json({ error: 'Forbidden', message: 'Cannot ban admin account' });

    let updateFields = { updated_at: new Date() };
    let message = '';

    if (ban_type === 'suspend') {
      updateFields.status = value ? 'suspended' : 'active';
      message = value ? 'ระงับบัญชีแล้ว' : 'ปลดระงับบัญชีแล้ว';
    } else if (ban_type === 'delete') {
      updateFields.status = 'deleted';
      message = 'ลบบัญชีแล้ว (soft delete)';
    } else {
      const colMap = {
        ban_login: 'ban_login',
        ban_job_create: 'ban_job_create',
        ban_job_accept: 'ban_job_accept',
        ban_withdraw: 'ban_withdraw',
      };
      const col = colMap[ban_type];
      updateFields[col] = value;
      message = value ? `แบน ${ban_type} แล้ว` : `ยกเลิกแบน ${ban_type} แล้ว`;
    }

    const setClauses = Object.keys(updateFields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const vals = [id, ...Object.values(updateFields)];
    const updated = await query(`UPDATE users SET ${setClauses} WHERE id = $1 RETURNING *`, vals);

    await logAdminAction(req.userId, `user:ban:${ban_type}`, {
      target_user_id: id,
      ban_type,
      value,
      reason: reason || null,
    });

    const safe = updated.rows[0] ? safeUser(updated.rows[0]) : null;
    res.json({ success: true, message, data: { user: safe } });
  } catch (error) {
    console.error('[Admin Users] Set ban error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to set ban' });
  }
};

export const getReportsSummary = async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const fromClause = from ? `AND created_at >= '${from}'::timestamptz` : '';
    const toClause = to ? `AND created_at <= '${to}'::timestamptz` : '';

    const [userStats, jobStats, revenueStats, trustStats, newUsers7d, newJobs7d, disputeStats] = await Promise.all([
      query(`SELECT role, status, COUNT(*) as count FROM users GROUP BY role, status ORDER BY role, status`),
      query(`SELECT status, COUNT(*) as count, SUM(total_amount) as total_amount FROM job_posts GROUP BY status`),
      query(`SELECT
               SUM(CASE WHEN type='credit' AND reference_type='job' THEN amount ELSE 0 END) as total_job_revenue,
               SUM(CASE WHEN type='credit' AND reference_type='fee' THEN amount ELSE 0 END) as total_platform_fee,
               SUM(CASE WHEN type='credit' AND reference_type='topup' THEN amount ELSE 0 END) as total_topup,
               COUNT(CASE WHEN type='credit' AND reference_type='job' THEN 1 END) as job_payment_count
             FROM ledger_transactions ${from || to ? `WHERE 1=1 ${fromClause} ${toClause}` : ''}`),
      query(`SELECT trust_level, COUNT(*) as count FROM users WHERE role != 'admin' GROUP BY trust_level ORDER BY trust_level`),
      query(`SELECT DATE(created_at) as day, COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day`),
      query(`SELECT DATE(created_at) as day, COUNT(*) as count FROM job_posts WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day`),
      query(`SELECT status, COUNT(*) as count FROM disputes GROUP BY status`),
    ]);

    res.json({
      success: true,
      data: {
        users: userStats.rows,
        jobs: jobStats.rows,
        revenue: revenueStats.rows[0] || {},
        trust_distribution: trustStats.rows,
        new_users_7d: newUsers7d.rows,
        new_jobs_7d: newJobs7d.rows,
        disputes: disputeStats.rows,
      },
    });
  } catch (error) {
    console.error('[Admin Reports] Summary error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get reports summary' });
  }
};

export default { listUsers, getUser, setUserStatus, getUserWallet, setBan, getReportsSummary };

