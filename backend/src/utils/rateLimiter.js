import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from './errors.js';

/**
 * Rate limiting configuration with environment-driven settings
 */

/**
 * Get configuration from environment with defaults
 */
const parseEnvInt = (value, defaultValue) => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const getConfig = (type = 'default') => {
  const isDev = process.env.NODE_ENV === 'development';
  
  const configs = {
    // Strict rate limiting for auth endpoints
    auth: {
      windowMs: parseEnvInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, (15 * 60 * 1000)), // 15 minutes
      max: parseEnvInt(process.env.RATE_LIMIT_AUTH_MAX, (isDev ? 100 : 5)), // 5 requests per 15 min in prod
      message: new TooManyRequestsError('Too many authentication attempts', {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((parseEnvInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, (15 * 60 * 1000))) / 1000 / 60) + ' minutes'
      }),
      standardHeaders: true,
      legacyHeaders: false,
    },
    
    // Medium rate limiting for OTP endpoints
    otp: {
      windowMs: parseEnvInt(process.env.RATE_LIMIT_OTP_WINDOW_MS, (15 * 60 * 1000)), // 15 minutes
      max: parseEnvInt(process.env.RATE_LIMIT_OTP_MAX, (isDev ? 50 : 3)), // 3 requests per 15 min in prod
      message: new TooManyRequestsError('Too many OTP requests', {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((parseEnvInt(process.env.RATE_LIMIT_OTP_WINDOW_MS, (15 * 60 * 1000))) / 1000 / 60) + ' minutes'
      }),
      standardHeaders: true,
      legacyHeaders: false,
    },
    
    // Very strict rate limiting for webhooks
    webhook: {
      windowMs: parseEnvInt(process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS, (60 * 1000)), // 1 minute
      max: parseEnvInt(process.env.RATE_LIMIT_WEBHOOK_MAX, (isDev ? 100 : 10)), // 10 requests per minute in prod, 100 in dev
      message: new TooManyRequestsError('Webhook rate limit exceeded', {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((parseEnvInt(process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS, (60 * 1000))) / 1000) + ' seconds'
      }),
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for allowed IPs if configured
      skip: (req) => {
        const allowedIPs = process.env.WEBHOOK_ALLOWED_IPS?.split(',').map(ip => ip.trim()).filter(Boolean);
        if (allowedIPs && allowedIPs.length > 0) {
          const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
          return allowedIPs.includes(clientIP);
        }
        return false;
      },
    },
    
    // File upload rate limiting
    upload: {
      windowMs: parseEnvInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS, (60 * 60 * 1000)), // 1 hour
      max: parseEnvInt(process.env.RATE_LIMIT_UPLOAD_MAX, (isDev ? 100 : 20)), // 20 uploads per hour in prod
      message: new TooManyRequestsError('Upload limit exceeded', {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((parseEnvInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS, (60 * 60 * 1000))) / 1000 / 60) + ' hours'
      }),
      standardHeaders: true,
      legacyHeaders: false,
    },
    
    // Default rate limiting for general API
    default: {
      windowMs: parseEnvInt(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS, (15 * 60 * 1000)), // 15 minutes
      max: parseEnvInt(process.env.RATE_LIMIT_DEFAULT_MAX, (isDev ? 1000 : 100)), // 100 requests per 15 min in prod
      message: new TooManyRequestsError('Rate limit exceeded', {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((parseEnvInt(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS, (15 * 60 * 1000))) / 1000 / 60) + ' minutes'
      }),
      standardHeaders: true,
      legacyHeaders: false,
    },
  };
  
  return configs[type] || configs.default;
};

/**
 * Custom rate limiter that uses our standardized error format
 */
const createRateLimiter = (type = 'default') => {
  const config = getConfig(type);
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    skip: config.skip,
    handler: (req, res) => {
      // Use our standardized error format
      if (config.message instanceof TooManyRequestsError) {
        return res.status(config.message.status).json(config.message.toJSON());
      }
      
      // Fallback for string messages
      const errorMessage = typeof config.message === 'string' ? config.message : 'Rate limit exceeded';
      const error = new TooManyRequestsError(errorMessage);
      res.status(error.status).json(error.toJSON());
    },
  });
};

/**
 * Predefined rate limiters for different endpoint types
 */
export const authLimiter = createRateLimiter('auth');
export const otpLimiter = createRateLimiter('otp');
export const webhookLimiter = createRateLimiter('webhook');
export const uploadLimiter = createRateLimiter('upload');
export const defaultLimiter = createRateLimiter('default');

/**
 * Rate limiter that doesn't interfere with WebSocket upgrades
 */
export const createSafeRateLimiter = (type = 'default') => {
  const config = getConfig(type);
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    skip: (req) => {
      // Skip WebSocket upgrade requests
      if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        return true;
      }
      
      // Apply webhook IP allowlist if configured
      if (type === 'webhook' && config.skip) {
        return config.skip(req);
      }
      
      return false;
    },
    handler: (req, res) => {
      if (config.message instanceof TooManyRequestsError) {
        return res.status(config.message.status).json(config.message.toJSON());
      }
      
      const errorMessage = typeof config.message === 'string' ? config.message : 'Rate limit exceeded';
      const error = new TooManyRequestsError(errorMessage);
      res.status(error.status).json(error.toJSON());
    },
  });
};

export default {
  authLimiter,
  otpLimiter,
  webhookLimiter,
  uploadLimiter,
  defaultLimiter,
  createRateLimiter,
  createSafeRateLimiter,
  getConfig,
};
