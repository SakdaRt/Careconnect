export class ApiError extends Error {
  constructor(message, { status = 500, code = 'SERVER_ERROR', details = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
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

