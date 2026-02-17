import Joi from 'joi';
import { ValidationError } from './errors.js';

/**
 * Validation middleware factory
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const validationError = new ValidationError(
        'Invalid request data',
        {
          source,
          field: error.details[0]?.path?.join('.'),
          value: error.details[0]?.context?.value,
          message: error.details[0]?.message,
          allErrors: error.details.map(detail => ({
            field: detail.path?.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        }
      );
      return res.status(validationError.status).json(validationError.toJSON());
    }
    
    req[source] = value;
    next();
  };
};

/**
 * Body validation middleware
 */
export const validateBody = (schema) => validate(schema, 'body');

/**
 * Query validation middleware
 */
export const validateQuery = (schema) => validate(schema, 'query');

/**
 * Params validation middleware
 */
export const validateParams = (schema) => validate(schema, 'params');

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort_by: Joi.string().default('created_at'),
    sort_order: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),
  
  // Pagination keys for spreading into other schemas
  paginationKeys: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort_by: Joi.string().default('created_at'),
    sort_order: Joi.string().valid('ASC', 'DESC').default('DESC'),
  },
  
  // Date range
  dateRange: Joi.object({
    start_date: Joi.date().iso(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')),
  }),
  
  // User reference
  userRef: Joi.object({
    user_id: Joi.string().uuid().required(),
  }),
  
  // Job status
  jobStatus: Joi.string().valid(
    'draft', 'posted', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'
  ),
  
  // Payment status
  paymentStatus: Joi.string().valid(
    'pending', 'processing', 'completed', 'failed', 'refunded'
  ),
  
  // Role validation
  role: Joi.string().valid('admin', 'hirer', 'caregiver'),
  
  // Trust level
  trustLevel: Joi.string().valid('L0', 'L1', 'L2', 'L3'),
  
  // Account type
  accountType: Joi.string().valid('guest', 'member'),
};

/**
 * Auth validation schemas
 */
export const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: commonSchemas.role.required(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
  }),
  
  registerGuest: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: commonSchemas.role.required(),
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  
  refreshToken: Joi.object({
    refresh_token: Joi.string().required(),
  }),
  
  updateProfile: Joi.object({
    display_name: Joi.string().trim().min(1).max(255).required(),
    bio: Joi.string().allow('', null),
    experience_years: Joi.number().integer().min(0).allow(null),
    certifications: Joi.array().items(Joi.string().trim()).allow(null),
    specializations: Joi.array().items(Joi.string().trim()).allow(null),
    available_from: Joi.string().allow('', null),
    available_to: Joi.string().allow('', null),
    available_days: Joi.array().items(Joi.number().integer().min(0).max(6)).allow(null),
    is_public_profile: Joi.boolean().allow(null),
    address_line1: Joi.string().allow('', null),
    address_line2: Joi.string().allow('', null),
    district: Joi.string().allow('', null),
    province: Joi.string().allow('', null),
    postal_code: Joi.string().allow('', null),
    lat: Joi.number().allow(null),
    lng: Joi.number().allow(null),
  }),
  
  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(8).required(),
  }),
  
  sendOTP: Joi.object({
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).required(),
  }),
  
  verifyOTP: Joi.object({
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).required(),
    code: Joi.string().pattern(/^[0-9]{6}$/).required(),
  }),
};

/**
 * Job validation schemas
 */
export const jobSchemas = {
  createJob: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().min(1).max(2000).required(),
    job_type: Joi.string().valid('companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency').required(),
    risk_level: Joi.string().valid('low_risk', 'high_risk').allow('', null).optional(),
    scheduled_start_at: Joi.date().iso().required(),
    scheduled_end_at: Joi.date().iso().required(),
    address_line1: Joi.string().trim().min(1).max(500).required(),
    district: Joi.string().trim().max(200).allow('', null).optional(),
    province: Joi.string().trim().max(200).allow('', null).optional(),
    postal_code: Joi.string().trim().max(10).allow('', null).optional(),
    lat: Joi.number().min(-90).max(90).allow(null).optional(),
    lng: Joi.number().min(-180).max(180).allow(null).optional(),
    geofence_radius_m: Joi.number().integer().min(0).default(1000),
    hourly_rate: Joi.number().positive().required(),
    total_hours: Joi.number().positive().required(),
    is_urgent: Joi.boolean().default(false),
    preferred_caregiver_id: Joi.string().uuid().allow('', null).optional(),
    patient_profile_id: Joi.string().uuid().required(),
    job_tasks_flags: Joi.array().items(Joi.string()).default([]),
    required_skills_flags: Joi.array().items(Joi.string()).default([]),
    equipment_available_flags: Joi.array().items(Joi.string()).default([]),
    precautions_flags: Joi.array().items(Joi.string()).default([]),
  }),
  
  updateJob: Joi.object({
    title: Joi.string().trim().min(1).max(200),
    description: Joi.string().trim().min(1).max(2000),
    job_type: Joi.string().valid('companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency'),
    risk_level: Joi.string().valid('low_risk', 'high_risk').allow('', null),
    scheduled_start_at: Joi.date().iso(),
    scheduled_end_at: Joi.date().iso(),
    address_line1: Joi.string().trim().min(1).max(500),
    district: Joi.string().trim().max(200).allow('', null),
    province: Joi.string().trim().max(200).allow('', null),
    postal_code: Joi.string().trim().max(10).allow('', null),
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
    geofence_radius_m: Joi.number().integer().min(0),
    hourly_rate: Joi.number().positive(),
    total_hours: Joi.number().positive(),
    is_urgent: Joi.boolean(),
    preferred_caregiver_id: Joi.string().uuid().allow('', null),
    patient_profile_id: Joi.string().uuid().allow('', null),
    job_tasks_flags: Joi.array().items(Joi.string()),
    required_skills_flags: Joi.array().items(Joi.string()),
    equipment_available_flags: Joi.array().items(Joi.string()),
    precautions_flags: Joi.array().items(Joi.string()),
  }),
  
  jobQuery: Joi.object({
    status: commonSchemas.jobStatus,
    job_type: Joi.string().valid('companionship', 'personal_care', 'medical_monitoring', 'dementia_care', 'post_surgery', 'emergency'),
    risk_level: Joi.string().valid('low_risk', 'high_risk').allow('', null),
    is_urgent: Joi.boolean(),
    min_hourly_rate: Joi.number().positive(),
    max_hourly_rate: Joi.number().positive().min(Joi.ref('min_hourly_rate')),
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    radius_km: Joi.number().positive().default(10),
    ...commonSchemas.paginationKeys,
  }),
  
  jobParams: Joi.object({
    id: commonSchemas.uuid,
  }),
};

/**
 * Wallet validation schemas
 */
export const walletSchemas = {
  addBankAccount: Joi.object({
    bank_code: Joi.string().trim().min(1).required(),
    bank_name: Joi.string().allow('', null),
    account_number: Joi.string().trim().min(4).required(),
    account_name: Joi.string().trim().min(1).required(),
    set_primary: Joi.boolean().default(false),
  }),
  
  topup: Joi.object({
    amount: Joi.number().positive().required(),
    payment_method: Joi.string().valid('promptpay', 'card', 'bank_transfer').required(),
  }),
  
  withdraw: Joi.object({
    amount: Joi.number().positive().required(),
    bank_account_id: Joi.string().uuid().required(),
  }),
  
  adminAddFunds: Joi.object({
    user_id: commonSchemas.uuid.required(),
    amount: Joi.number().required(),
    transaction_type: Joi.string().valid('admin_credit', 'admin_debit').required(),
    description: Joi.string().trim().max(500).required(),
  }),
  
  adminReject: Joi.object({
    reason: Joi.string().trim().min(1).max(500).required(),
  }),
  
  walletQuery: Joi.object({
    ...commonSchemas.paginationKeys,
    transaction_type: Joi.string(),
    start_date: Joi.date().iso(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')),
  }),
};

/**
 * Payment validation schemas
 */
export const paymentSchemas = {
  paymentQuery: Joi.object({
    status: commonSchemas.paymentStatus,
    ...commonSchemas.paginationKeys,
  }),
  
  paymentParams: Joi.object({
    payment_id: commonSchemas.uuid,
  }),
};

/**
 * Message validation schemas
 */
export const messageSchemas = {
  sendMessage: Joi.object({
    thread_id: commonSchemas.uuid.required(),
    content: Joi.string().trim().min(1).max(2000).required(),
    message_type: Joi.string().valid('text', 'image', 'file').default('text'),
  }),
  
  messageQuery: Joi.object({
    thread_id: commonSchemas.uuid.required(),
    ...commonSchemas.paginationKeys,
  }),
  
  threadParams: Joi.object({
    thread_id: commonSchemas.uuid,
  }),
};

/**
 * Dispute validation schemas
 */
export const disputeSchemas = {
  createDispute: Joi.object({
    job_id: commonSchemas.uuid.required(),
    dispute_type: Joi.string().valid('care_quality', 'payment', 'scheduling', 'behavior', 'other').required(),
    description: Joi.string().trim().min(10).max(2000).required(),
    evidence: Joi.array().items(Joi.object({
      type: Joi.string().valid('image', 'document', 'message').required(),
      url: Joi.string().uri().required(),
      description: Joi.string().trim().max(500),
    })).default([]),
  }),
  
  disputeQuery: Joi.object({
    status: Joi.string().valid('open', 'investigating', 'resolved', 'dismissed'),
    ...commonSchemas.paginationKeys,
  }),
  
  disputeParams: Joi.object({
    dispute_id: commonSchemas.uuid,
  }),
  
  addMessage: Joi.object({
    message: Joi.string().trim().min(1).max(2000).required(),
    evidence: Joi.array().items(Joi.object({
      type: Joi.string().valid('image', 'document', 'message').required(),
      url: Joi.string().uri().required(),
      description: Joi.string().trim().max(500),
    })).default([]),
  }),
};

/**
 * KYC validation schemas
 */
export const kycSchemas = {
  submitKyc: Joi.object({
    full_name: Joi.string().trim().min(1).max(100).required(),
    national_id: Joi.string().trim().min(8).max(20).required(),
    document_type: Joi.string().valid('national_id', 'passport', 'driving_license').required(),
    document_front_url: Joi.string().uri().required(),
    document_back_url: Joi.string().uri().allow('', null),
    selfie_url: Joi.string().uri().required(),
  }),
};
