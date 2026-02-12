import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../utils/db.js';
import { triggerUserTrustUpdate } from '../workers/trustLevelWorker.js';

const hashNationalId = (value) => {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

export const getKycStatusByUserId = async (userId) => {
  const result = await query(
    `SELECT id, user_id, provider_name, provider_session_id, provider_reference_id, status, result, national_id_hash, created_at, updated_at, verified_at, expires_at
     FROM user_kyc_info
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

export const submitMockKyc = async (userId, payload) => {
  const referenceId = uuidv4();
  const sessionId = uuidv4();
  const nationalIdHash = hashNationalId(payload?.national_id);

  const result = await query(
    `INSERT INTO user_kyc_info
      (user_id, provider_name, provider_session_id, provider_reference_id, status, result, national_id_hash, created_at, updated_at, verified_at)
     VALUES ($1, 'mock', $2, $3, 'approved', 'approved', $4, NOW(), NOW(), NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET provider_name = EXCLUDED.provider_name,
       provider_session_id = EXCLUDED.provider_session_id,
       provider_reference_id = EXCLUDED.provider_reference_id,
       status = EXCLUDED.status,
       result = EXCLUDED.result,
       national_id_hash = COALESCE(EXCLUDED.national_id_hash, user_kyc_info.national_id_hash),
       updated_at = NOW(),
       verified_at = NOW()
     RETURNING id, user_id, provider_name, provider_session_id, provider_reference_id, status, result, national_id_hash, created_at, updated_at, verified_at, expires_at`,
    [userId, sessionId, referenceId, nationalIdHash]
  );

  await triggerUserTrustUpdate(userId, 'kyc');

  return result.rows[0];
};
