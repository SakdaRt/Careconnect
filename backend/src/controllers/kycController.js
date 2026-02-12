import { getKycStatusByUserId, submitMockKyc } from '../services/kycService.js';

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
};

export default kycController;
