import fs from 'fs';
import path from 'path';
import {
  listDocumentsByUserId,
  getDocumentById,
  createDocument,
  deleteDocument,
  hirerHasAssignmentWithCaregiver,
} from '../services/caregiverDocumentService.js';

const caregiverDocumentController = {
  /**
   * GET /api/caregiver-documents
   * List current caregiver's own documents
   */
  async listMine(req, res, next) {
    try {
      const docs = await listDocumentsByUserId(req.user.id);
      res.json({ success: true, data: docs });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/caregiver-documents
   * Upload a new certification document (caregiver only)
   */
  async upload(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'กรุณาอัปโหลดไฟล์เอกสาร' });
      }

      const { document_type, title, description, issuer, issued_date, expiry_date } = req.body || {};

      if (!document_type || !title) {
        // Clean up uploaded file
        if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ success: false, error: 'กรุณาระบุประเภทเอกสารและชื่อเอกสาร' });
      }

      const relativePath = path.relative(
        path.resolve(process.env.UPLOAD_DIR || '/app/uploads'),
        file.path
      ).replace(/\\/g, '/');

      const doc = await createDocument(req.user.id, {
        document_type: document_type.trim(),
        title: title.trim(),
        description: description?.trim() || null,
        issuer: issuer?.trim() || null,
        issued_date: issued_date || null,
        expiry_date: expiry_date || null,
        file_path: relativePath,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
      });

      res.status(201).json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/caregiver-documents/:id
   * Delete own document
   */
  async remove(req, res, next) {
    try {
      const deleted = await deleteDocument(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'ไม่พบเอกสาร' });
      }

      // Remove file from disk
      const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
      const fullPath = path.join(uploadDir, deleted.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      res.json({ success: true, data: { id: deleted.id } });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/caregiver-documents/by-caregiver/:caregiverId
   * Hirer views a caregiver's documents — only if they have a job assignment together
   */
  async listByCaregiver(req, res, next) {
    try {
      const hirerId = req.user.id;
      const caregiverId = req.params.caregiverId;

      // Admin can always view
      if (req.user.role !== 'admin') {
        const hasAssignment = await hirerHasAssignmentWithCaregiver(hirerId, caregiverId);
        if (!hasAssignment) {
          return res.status(403).json({
            success: false,
            error: 'คุณสามารถดูเอกสารของผู้ดูแลได้เฉพาะเมื่อมีงานร่วมกัน',
          });
        }
      }

      const docs = await listDocumentsByUserId(caregiverId);
      res.json({ success: true, data: docs });
    } catch (error) {
      next(error);
    }
  },
};

export default caregiverDocumentController;
