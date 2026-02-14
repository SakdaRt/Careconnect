/**
 * Standardized Error Response Utilities
 * Provides consistent error format across all API endpoints
 */

export class ApiError extends Error {
  constructor(message, { status = 500, code = 'SERVER_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    const response = {
      error: {
        code: this.code,
        message: this.message,
      }
    };
    
    if (this.details) {
      response.error.details = this.details;
    }
    
    return response;
  }
}

export class ValidationError extends ApiError {
  constructor(message, { code = 'VALIDATION_ERROR', field = null, section = null, details = null } = {}) {
    super(message, { status: 400, code, details: { field, section, ...details } });
  }
}

export class NotFoundError extends ApiError {
  constructor(message, { code = 'NOT_FOUND', details = null } = {}) {
    super(message, { status: 404, code, details });
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required', { code = 'UNAUTHORIZED', details = null } = {}) {
    super(message, { status: 401, code, details });
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access denied', { code = 'FORBIDDEN', details = null } = {}) {
    super(message, { status: 403, code, details });
  }
}

export class ConflictError extends ApiError {
  constructor(message, { code = 'DUPLICATE_RESOURCE', details = null } = {}) {
    super(message, { status: 409, code, details });
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message, { code = 'RATE_LIMIT_EXCEEDED', details = null } = {}) {
    super(message, { status: 429, code, details });
  }
}

/**
 * Error codes for different types of errors
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST_BODY: 'INVALID_REQUEST_BODY',
  INVALID_QUERY_PARAMS: 'INVALID_QUERY_PARAMS',
  INVALID_PATH_PARAMS: 'INVALID_PATH_PARAMS',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource Not Found
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  
  // Business Logic
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
};

/**
 * Express error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  // If it's our custom ApiError, use it directly
  if (err instanceof ApiError) {
    return res.status(err.status).json(err.toJSON());
  }

  // Handle Joi validation errors
  if (err.isJoi) {
    const validationError = new ValidationError(
      'Invalid request data',
      {
        source: 'body',
        field: err.details[0]?.path?.join('.'),
        value: err.details[0]?.context?.value,
        message: err.details[0]?.message,
        allErrors: err.details.map(detail => ({
          field: detail.path?.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      }
    );
    return res.status(validationError.status).json(validationError.toJSON());
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const authError = new UnauthorizedError('Invalid authentication token', { code: 'INVALID_TOKEN' });
    return res.status(authError.status).json(authError.toJSON());
  }

  if (err.name === 'TokenExpiredError') {
    const authError = new UnauthorizedError('Authentication token has expired', { code: 'TOKEN_EXPIRED' });
    return res.status(authError.status).json(authError.toJSON());
  }

  // Handle database errors
  if (err.code === '23505') { // Unique violation
    const conflictError = new ConflictError('Resource already exists', {
      constraint: err.constraint,
      detail: err.detail
    });
    return res.status(conflictError.status).json(conflictError.toJSON());
  }

  if (err.code?.startsWith('23')) { // Other database integrity errors
    const conflictError = new ConflictError('Database constraint violation', {
      code: err.code,
      detail: err.detail
    });
    return res.status(conflictError.status).json(conflictError.toJSON());
  }

  // Default internal server error - maintain backward compatibility
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = isDevelopment ? err.message : 'Internal server error';
  
  // Check if this looks like an old-style error response
  if (typeof err === 'object' && err.message && !err.code) {
    // Old format: {error: "message"}
    return res.status(500).json({
      error: message
    });
  }
  
  // New format for new errors
  const internalError = new ApiError(
    message,
    {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      details: isDevelopment ? {
        stack: err.stack,
        name: err.name,
        code: err.code
      } : null
    }
  );

  res.status(internalError.status).json(internalError.toJSON());
};
