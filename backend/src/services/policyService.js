import { query } from '../utils/db.js';

export const getPolicyAcceptances = async (userId) => {
  try {
    const result = await query(
      `SELECT role, policy_accepted_at, version_policy_accepted
       FROM user_policy_acceptances
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows.reduce((acc, row) => {
      acc[row.role] = {
        policy_accepted_at: row.policy_accepted_at,
        version_policy_accepted: row.version_policy_accepted,
      };
      return acc;
    }, {});
  } catch (error) {
    if (error?.code === '42P01') {
      return {};
    }
    throw error;
  }
};

export const acceptPolicy = async (userId, role, version) => {
  const result = await query(
    `INSERT INTO user_policy_acceptances (user_id, role, policy_accepted_at, version_policy_accepted)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (user_id, role)
     DO UPDATE SET policy_accepted_at = NOW(), version_policy_accepted = EXCLUDED.version_policy_accepted
     RETURNING role, policy_accepted_at, version_policy_accepted`,
    [userId, role, version]
  );

  return result.rows[0];
};
