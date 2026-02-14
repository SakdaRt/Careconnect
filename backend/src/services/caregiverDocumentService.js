import { query } from '../utils/db.js';

export const listDocumentsByUserId = async (userId) => {
  const result = await query(
    `SELECT id, user_id, document_type, title, description, issuer, issued_date, expiry_date,
            file_path, file_name, file_size, mime_type, created_at, updated_at
     FROM caregiver_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getDocumentById = async (docId) => {
  const result = await query(
    `SELECT id, user_id, document_type, title, description, issuer, issued_date, expiry_date,
            file_path, file_name, file_size, mime_type, created_at, updated_at
     FROM caregiver_documents
     WHERE id = $1`,
    [docId]
  );
  return result.rows[0] || null;
};

export const createDocument = async (userId, payload) => {
  const result = await query(
    `INSERT INTO caregiver_documents
      (user_id, document_type, title, description, issuer, issued_date, expiry_date,
       file_path, file_name, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      userId,
      payload.document_type,
      payload.title,
      payload.description || null,
      payload.issuer || null,
      payload.issued_date || null,
      payload.expiry_date || null,
      payload.file_path,
      payload.file_name,
      payload.file_size,
      payload.mime_type,
    ]
  );
  return result.rows[0];
};

export const deleteDocument = async (docId, userId) => {
  const result = await query(
    `DELETE FROM caregiver_documents WHERE id = $1 AND user_id = $2 RETURNING id, file_path`,
    [docId, userId]
  );
  return result.rows[0] || null;
};

/**
 * Check if a hirer has an active job assignment with a specific caregiver.
 * Returns true if the hirer has at least one job where this caregiver is assigned.
 */
export const hirerHasAssignmentWithCaregiver = async (hirerId, caregiverId) => {
  const result = await query(
    `SELECT 1
     FROM job_posts jp
     JOIN jobs j ON j.job_post_id = jp.id
     JOIN job_assignments ja ON ja.job_id = j.id
     WHERE jp.hirer_id = $1
       AND ja.caregiver_id = $2
       AND jp.status NOT IN ('cancelled')
     LIMIT 1`,
    [hirerId, caregiverId]
  );
  return result.rows.length > 0;
};
