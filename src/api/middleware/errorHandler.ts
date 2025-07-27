// Global Error Handler Middleware for Enterprise Multi-MCP Smart Database API
import { Request, Response, NextFunction } from 'express';
import { ApiResponse, CustomApiError } from '../../types/api.types';
import { logger, logError } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Global error handling middleware
 * Must be the last middleware in the application
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An internal server error occurred';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof CustomApiError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = (error as any).errors || error.message;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'FILE_UPLOAD_ERROR';
    message = 'File upload failed';
    details = {
      field: (error as any).field,
      limit: (error as any).limit
    };
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if (error.message && error.message.includes('ENOTFOUND')) {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if (error.message && error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    errorCode = 'CONNECTION_REFUSED';
    message = 'Unable to connect to required service';
  } else if (error.message && error.message.includes('timeout')) {
    statusCode = 504;
    errorCode = 'REQUEST_TIMEOUT';
    message = 'Request timeout';
  }

  // Log the error
  logError(error, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    statusCode,
    errorCode
  });

  // Prepare error response
  const errorResponse: ApiResponse = {
    success: false,
    error: message,
    message: process.env.NODE_ENV === 'development' ? error.message : message,
    timestamp: new Date().toISOString(),
    requestId,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      originalError: error.name 
    })
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const response: ApiResponse = {
    success: false,
    error: 'Resource not found',
    message: `The requested resource ${req.method} ${req.originalUrl} was not found`,
    timestamp: new Date().toISOString(),
    requestId
  };

  logger.warn('Resource not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId
  });

  res.status(404).json(response);
};

/**
 * Method not allowed handler
 */
export const methodNotAllowedHandler = (allowed: string[]) => {
  return (req: Request, res: Response): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    
    const response: ApiResponse = {
      success: false,
      error: 'Method not allowed',
      message: `Method ${req.method} is not allowed for this endpoint`,
      timestamp: new Date().toISOString(),
      requestId,
      details: {
        allowedMethods: allowed
      }
    };

    res.set('Allow', allowed.join(', '));
    res.status(405).json(response);
  };
};

/**
 * Rate limit exceeded handler
 */
export const rateLimitHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const response: ApiResponse = {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many requests from this IP address',
    timestamp: new Date().toISOString(),
    requestId,
    details: {
      retryAfter: res.get('Retry-After'),
      limit: res.get('X-RateLimit-Limit'),
      remaining: res.get('X-RateLimit-Remaining'),
      reset: res.get('X-RateLimit-Reset')
    }
  };

  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    requestId
  });

  res.status(429).json(response);
};

/**
 * Operational error class for known application errors
 */
export class OperationalError extends CustomApiError {
  constructor(message: string, statusCode: number = 400, code: string = 'OPERATIONAL_ERROR', details?: any) {
    super(message, statusCode, code, details);
    this.name = 'OperationalError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends CustomApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends CustomApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends CustomApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource not found error class
 */
export class NotFoundError extends CustomApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error class (e.g., duplicate resources)
 */
export class ConflictError extends CustomApiError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Service unavailable error class
 */
export class ServiceUnavailableError extends CustomApiError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

export default errorHandler;