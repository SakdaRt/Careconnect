import { query } from '../utils/db.js';

const parseIntOr = (value, fallback) => {
  const num = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(num) ? num : fallback;
};

export const listLedgerTransactions = async (req, res) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const limit = Math.min(200, Math.max(1, parseIntOr(req.query.limit, 50)));
    const offset = (page - 1) * limit;

    const reference_type = String(req.query.reference_type || '').trim();
    const reference_id = String(req.query.reference_id || '').trim();
    const wallet_id = String(req.query.wallet_id || '').trim();
    const type = String(req.query.type || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const where = [];
    const values = [];
    let idx = 1;

    if (reference_type) {
      values.push(reference_type);
      where.push(`lt.reference_type = $${idx++}`);
    }
    if (reference_id) {
      values.push(reference_id);
      where.push(`lt.reference_id::text = $${idx++}`);
    }
    if (wallet_id) {
      values.push(wallet_id);
      where.push(`(lt.from_wallet_id = $${idx} OR lt.to_wallet_id = $${idx})`);
      idx += 1;
    }
    if (type) {
      values.push(type);
      where.push(`lt.type = $${idx++}`);
    }
    if (from) {
      values.push(from);
      where.push(`lt.created_at >= $${idx++}::timestamptz`);
    }
    if (to) {
      values.push(to);
      where.push(`lt.created_at <= $${idx++}::timestamptz`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         lt.*,
         wf.wallet_type as from_wallet_type,
         wt.wallet_type as to_wallet_type,
         uf.id as from_user_id,
         ut.id as to_user_id,
         uf.email as from_user_email,
         ut.email as to_user_email
       FROM ledger_transactions lt
       LEFT JOIN wallets wf ON wf.id = lt.from_wallet_id
       LEFT JOIN wallets wt ON wt.id = lt.to_wallet_id
       LEFT JOIN users uf ON uf.id = wf.user_id
       LEFT JOIN users ut ON ut.id = wt.user_id
       ${whereSql}
       ORDER BY lt.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int as total
       FROM ledger_transactions lt
       ${whereSql}`,
      values
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
    console.error('[Admin Ledger] List transactions error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to list ledger transactions' });
  }
};

export default { listLedgerTransactions };

