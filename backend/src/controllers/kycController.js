import { getKycStatusByUserId, submitMockKyc, submitKyc } from '../services/kycService.js';

const kycController = {
  async getStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const kyc = await getKycStatusByUserId(userId);
      res.json({ success: true, data: { kyc } });
    } catch (error) {
      next(error);
    }
  },

  async submitMock(req, res, next) {
    try {
      const userId = req.user.id;
      const { full_name, national_id, document_type } = req.body || {};

      if (!full_name || !national_id || !document_type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          code: 'KYC_REQUIRED_FIELDS',
        });
      }

      const kyc = await submitMockKyc(userId, { full_name, national_id, document_type });
      res.status(201).json({ success: true, data: { kyc } });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Full KYC submission with document images + selfie.
   * Expects multipart/form-data with fields:
   *   - full_name, national_id, document_type
   *   - document_front (file), document_back (file, optional), selfie (file)
   * Simulates sending to a KYC provider and auto-approves if all data is valid.
   */
  async submit(req, res, next) {
    try {
      const userId = req.user.id;
      const { full_name, national_id, document_type } = req.body || {};

      // Validate text fields
      if (!full_name || !full_name.trim()) {
        return res.status(400).json({ success: false, error: 'กรุณากรอกชื่อ-นามสกุล', code: 'KYC_MISSING_NAME' });
      }
      if (!national_id || !national_id.trim()) {
        return res.status(400).json({ success: false, error: 'กรุณากรอกเลขบัตรประชาชน', code: 'KYC_MISSING_ID' });
      }
      if (!document_type) {
        return res.status(400).json({ success: false, error: 'กรุณาเลือกประเภทเอกสาร', code: 'KYC_MISSING_DOC_TYPE' });
      }

      // Validate national ID format (13 digits for Thai ID)
      const cleanId = national_id.replace(/\s|-/g, '');
      if (document_type === 'national_id' && !/^\d{13}$/.test(cleanId)) {
        return res.status(400).json({ success: false, error: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก', code: 'KYC_INVALID_ID' });
      }

      // Validate files
      const files = req.files || {};
      const documentFront = files.document_front?.[0];
      const selfie = files.selfie?.[0];

      if (!documentFront) {
        return res.status(400).json({ success: false, error: 'กรุณาอัปโหลดรูปเอกสาร (ด้านหน้า)', code: 'KYC_MISSING_DOC_FRONT' });
      }
      if (!selfie) {
        return res.status(400).json({ success: false, error: 'กรุณาถ่ายรูปใบหน้า', code: 'KYC_MISSING_SELFIE' });
      }

      // Simulate KYC provider processing (log what would be sent)
      const documentBack = files.document_back?.[0];
      console.log(`[KYC] Simulating provider submission for user ${userId}:`);
      console.log(`  Name: ${full_name}, ID: ${cleanId.slice(0, 4)}****${cleanId.slice(-4)}, Type: ${document_type}`);
      console.log(`  Document front: ${documentFront.originalname} (${(documentFront.size / 1024).toFixed(1)} KB)`);
      if (documentBack) console.log(`  Document back: ${documentBack.originalname} (${(documentBack.size / 1024).toFixed(1)} KB)`);
      console.log(`  Selfie: ${selfie.originalname} (${(selfie.size / 1024).toFixed(1)} KB)`);
      console.log(`[KYC] Provider simulation: AUTO-APPROVED`);

      // Submit and auto-approve
      const kyc = await submitKyc(userId, {
        full_name: full_name.trim(),
        national_id: cleanId,
        document_type,
      });

      res.status(201).json({ success: true, data: { kyc } });
    } catch (error) {
      next(error);
    }
  },
};

export default kycController;
