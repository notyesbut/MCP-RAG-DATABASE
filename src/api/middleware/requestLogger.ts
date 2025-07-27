/**
 * Request Logging Middleware
 * Comprehensive HTTP request/response logging with performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

// Interface for enhanced request object
interface EnhancedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Determine if request should be logged based on path
 */
const shouldLogRequest = (path: string): boolean => {
  // Skip logging for certain paths to reduce noise
  const skipPaths = [
    '/health',
    '/health/liveness', 
    '/health/readiness',
    '/favicon.ico',
    '/robots.txt'
  ];

  return !skipPaths.includes(path);
};

/**
 * Get client IP address with proxy support
 */
const getClientIp = (req: Request): string => {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

/**
 * Sanitize request body to remove sensitive information
 */
const sanitizeBody = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  
  // List of fields to sanitize
  const sensitiveFields = [
    'password', 
    'confirmPassword', 
    'currentPassword', 
    'newPassword',
    'token', 
    'accessToken', 
    'refreshToken',
    'apiKey',
    'secret',
    'privateKey'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***';
    }
  });

  return sanitized;
};

// Add request ID to requests
export const addRequestId = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};

// Create Morgan middleware with enhanced format
const morganFormat = ':method :url :status :res[content-length] - :response-time ms';

// Create a stream object for Morgan to write to our logger
const loggerStream = {
    write: (message: string) => {
        // Remove trailing newline from Morgan's output
        logger.info(message.trim());
    }
};

export const httpLogger = morgan(morganFormat, {
    stream: loggerStream,
    skip: (req: Request) => {
        // Skip health check logs in production
        return process.env.NODE_ENV === 'production' && !shouldLogRequest(req.url);
    }
});

// Enhanced request logger
export const enhancedRequestLogger = (req: EnhancedRequest, res: Response, next: NextFunction): void => {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Only log if path should be logged
  if (!shouldLogRequest(req.path)) {
    return next();
  }

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
    timestamp: new Date().toISOString()
  });

  // Capture original end function
  const originalEnd = res.end;
  let hasLogged = false;

  // Function to log response
  const logResponse = () => {
    if (hasLogged) return;
    hasLogged = true;

    const responseTime = Date.now() - req.startTime!;
    
    const responseData = {
      requestId,
      statusCode: res.statusCode,
      responseTime,
      contentType: res.getHeader('content-type'),
      contentLength: res.getHeader('content-length'),
      timestamp: new Date().toISOString()
    };

    // Choose log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with error', responseData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', responseData);
    } else if (responseTime > 5000) {
      logger.warn('Slow request completed', responseData);
    } else {
      logger.info('Request completed', responseData);
    }
  };

  // Override response end method
  res.end = function(chunk?: any, encoding?: any) {
    logResponse();
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Custom request logger for debugging
export const debugLogger = (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'development') {
        logger.debug('Debug request info', {
            method: req.method,
            url: req.url,
            headers: req.headers,
            query: req.query,
            body: sanitizeBody(req.body),
            ip: getClientIp(req),
            requestId: req.headers['x-request-id']
        });
    }
    next();
};

/**
 * Simple request logger for development
 */
export const simpleRequestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const logMessage = `${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`;
    
    if (res.statusCode >= 400) {
      console.error(`❌ ${logMessage}`);
    } else {
      console.log(`✅ ${logMessage}`);
    }
  });

  next();
};

// Combined request logger middleware
export const requestLogger = [addRequestId, httpLogger, enhancedRequestLogger];

// Export the enhanced logger as default
export default enhancedRequestLogger;