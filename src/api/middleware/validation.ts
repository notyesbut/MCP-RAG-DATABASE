/**
 * Request Validation Middleware
 * Comprehensive validation middleware for API requests
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler';
import { ApiResponse } from '../../types/api.types';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';

/**
 * Generic validation middleware factory
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const dataToValidate = req[source];
      const validationResult = schema.safeParse(dataToValidate);

      if (!validationResult.success) {
        logger.warn('Request validation failed', {
          requestId,
          source,
          errors: validationResult.error.format(),
          path: req.path,
          method: req.method
        });

        const response: ApiResponse = {
          success: false,
          error: 'Validation failed',
          message: 'Request data validation failed',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        };

        res.status(400).json(response);
        return;
      }

      // Replace request data with validated and sanitized data
      req[source] = validationResult.data;
      next();

    } catch (error) {
      logger.error('Validation middleware error', {
        requestId,
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: 'An error occurred during validation',
        timestamp: new Date().toISOString(),
        requestId
      };

      res.status(500).json(response);
    }
  };
};

/**
 * Sanitization middleware
 */
export const sanitize = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize common injection patterns
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return typeof obj === 'string' ? sanitizeString(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Content-Type validation middleware
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const contentType = req.get('Content-Type');

    // Skip validation for GET requests or requests without body
    if (req.method === 'GET' || req.method === 'HEAD' || !contentType) {
      return next();
    }

    const isValidContentType = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isValidContentType) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid Content-Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        details: { provided: contentType, allowed: allowedTypes },
        timestamp: new Date().toISOString(),
        requestId
      };

      res.status(415).json(response);
      return;
    }

    next();
  };
};

/**
 * Request size validation middleware
 */
export const validateRequestSize = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);

    if (contentLength > maxSize) {
      const response: ApiResponse = {
        success: false,
        error: 'Request too large',
        message: `Request size exceeds maximum allowed size of ${maxSize} bytes`,
        details: { 
          provided: contentLength, 
          maximum: maxSize,
          providedMB: Math.round(contentLength / 1024 / 1024 * 100) / 100,
          maximumMB: Math.round(maxSize / 1024 / 1024 * 100) / 100
        },
        timestamp: new Date().toISOString(),
        requestId
      };

      res.status(413).json(response);
      return;
    }

    next();
  };
};

/**
 * API version validation middleware
 */
export const validateApiVersion = (supportedVersions: string[] = ['v1']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const version = req.params.version || (Array.isArray(req.headers['api-version']) ? req.headers['api-version'][0] : req.headers['api-version']) || 'v1';

    if (!supportedVersions.includes(version)) {
      const response: ApiResponse = {
        success: false,
        error: 'Unsupported API version',
        message: `API version '${version}' is not supported`,
        details: { 
          provided: version, 
          supported: supportedVersions 
        },
        timestamp: new Date().toISOString(),
        requestId
      };

      res.status(400).json(response);
      return;
    }

    req.params.version = version as string;
    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Pagination validation
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),

  // Date range validation
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'Start date must be before end date'
  }),

  // Search validation
  search: z.object({
    q: z.string().min(1).max(500),
    fields: z.array(z.string()).optional(),
    filters: z.record(z.string(), z.any()).optional()
  }),

  // File upload validation
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, 'Invalid MIME type'),
    size: z.number().min(1).max(50 * 1024 * 1024) // 50MB max
  })
};

/**
 * Specific validation middleware for common endpoints
 */
export const validatePagination = validate(commonSchemas.pagination, 'query');
export const validateUuid = (paramName: string = 'id') => 
  validate(z.object({ [paramName]: commonSchemas.uuid }), 'params');
export const validateDateRange = validate(commonSchemas.dateRange, 'query');
export const validateSearch = validate(commonSchemas.search, 'query');

/**
 * Composite validation middleware
 */
export const validateRequest = (options: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  contentType?: string[];
  maxSize?: number;
  sanitize?: boolean;
}) => {
  const middlewares: any[] = [];

  // Add sanitization if requested
  if (options.sanitize !== false) {
    middlewares.push(sanitize);
  }

  // Add content type validation
  if (options.contentType) {
    middlewares.push(validateContentType(options.contentType));
  }

  // Add size validation
  if (options.maxSize) {
    middlewares.push(validateRequestSize(options.maxSize));
  }

  // Add schema validations
  if (options.body) {
    middlewares.push(validate(options.body, 'body'));
  }
  if (options.query) {
    middlewares.push(validate(options.query, 'query'));
  }
  if (options.params) {
    middlewares.push(validate(options.params, 'params'));
  }

  return middlewares;
};

/**
 * Rate limiting for validation-heavy endpoints
 */
export const validationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: 'Too many validation requests',
    code: 'VALIDATION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for successful validations
    return res.statusCode < 400;
  }
});

export default {
  validate,
  sanitize,
  validateContentType,
  validateRequestSize,
  validateApiVersion,
  validateRequest,
  validatePagination,
  validateUuid,
  validateDateRange,
  validateSearch,
  commonSchemas,
  validationRateLimit
};