// Production Logger for Enterprise Multi-MCP Smart Database System
import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = './logs';

// Define custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'gray'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]`;
    
    // Add service context if available
    if (metadata.service) {
      msg += ` [${metadata.service}]`;
    }
    
    // Add request ID if available
    if (metadata.requestId) {
      msg += ` [${metadata.requestId}]`;
    }
    
    msg += `: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      const cleanMetadata = { ...metadata };
      delete cleanMetadata.service;
      delete cleanMetadata.requestId;
      
      if (Object.keys(cleanMetadata).length > 0) {
        msg += `\n${JSON.stringify(cleanMetadata, null, 2)}`;
      }
    }
    
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: customFormat,
  defaultMeta: {
    service: 'enterprise-mcp-api'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      handleExceptions: true,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      )
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      handleExceptions: true,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      )
    }),
    
    // HTTP access logs
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      )
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Remove console transport in production
  logger.remove(logger.transports[0]);
  
  // Add production-specific transports
  logger.add(new winston.transports.Console({
    level: 'warn',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create child loggers for different services
export const createServiceLogger = (serviceName: string) => {
  return logger.child({ service: serviceName });
};

// HTTP request logger
export const httpLogger = createServiceLogger('http');

// Database logger
export const dbLogger = createServiceLogger('database');

// MCP logger
export const mcpLogger = createServiceLogger('mcp');

// RAG logger
export const ragLogger = createServiceLogger('rag');

// WebSocket logger
export const wsLogger = createServiceLogger('websocket');

// Auth logger
export const authLogger = createServiceLogger('auth');

// Performance logger
export const perfLogger = createServiceLogger('performance');

// Helper functions for structured logging
export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
};

export const logRequest = (req: any, res: any, duration: number) => {
  httpLogger.http('Request processed', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.headers['x-request-id']
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  perfLogger.info(`${operation} completed`, {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};

export default logger;