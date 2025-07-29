/**
 * Express.js extension type definitions for the Enterprise Multi-MCP Smart Database System
 * 
 * This file contains type definitions for Express.js extensions, middleware,
 * and custom request/response types used throughout the API layer.
 */

import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { User, ApiResponse, ApiError } from './api.types';

/**
 * Extended Express Request with common properties
 */
export interface ExtendedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  /** Request ID for tracing */
  requestId: string;
  
  /** Request timestamp */
  timestamp: number;
  
  /** Request context */
  context?: RequestContext;
  
  /** Performance tracking */
  performance?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

/**
 * Request context for enhanced request handling
 */
export interface RequestContext {
  /** Correlation ID for distributed tracing */
  correlationId: string;
  
  /** Client information */
  client: {
    /** IP address */
    ip: string;
    
    /** User agent */
    userAgent?: string;
    
    /** Client ID from headers */
    clientId?: string;
    
    /** API version requested */
    apiVersion?: string;
  };
  
  /** Request metadata */
  metadata: {
    /** Request source */
    source?: 'web' | 'mobile' | 'api' | 'internal';
    
    /** Request priority */
    priority?: 'low' | 'normal' | 'high' | 'critical';
    
    /** Custom headers */
    customHeaders?: Record<string, string>;
  };
  
  /** Feature flags for request */
  features?: Record<string, boolean>;
}

/**
 * Extended Express Response with helper methods
 */
export interface ExtendedResponse<ResBody = any, Locals extends Record<string, any> = Record<string, any>>
  extends Response<ResBody, Locals> {
  /** Send success response */
  sendSuccess: <T = any>(data: T, message?: string, metadata?: any) => void;
  
  /** Send error response */
  sendError: (error: string | Error | ApiError, statusCode?: number, details?: any) => void;
  
  /** Send paginated response */
  sendPaginated: <T = any>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message?: string
  ) => void;
  
  /** Set cache headers */
  setCacheHeaders: (maxAge: number, options?: CacheOptions) => void;
}

/**
 * Cache control options
 */
export interface CacheOptions {
  /** Cache visibility */
  visibility?: 'public' | 'private';
  
  /** Must revalidate */
  mustRevalidate?: boolean;
  
  /** No transform */
  noTransform?: boolean;
  
  /** Proxy revalidate */
  proxyRevalidate?: boolean;
  
  /** Shared max age for CDN */
  sMaxAge?: number;
  
  /** ETag value */
  etag?: string;
  
  /** Last modified timestamp */
  lastModified?: Date;
}

/**
 * Async middleware wrapper types
 */
export type AsyncRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  req: ExtendedRequest<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: ExtendedResponse<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

/**
 * Async error handler wrapper types
 */
export type AsyncErrorRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  err: any,
  req: ExtendedRequest<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: ExtendedResponse<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

/**
 * Middleware factory function type
 */
export type MiddlewareFactory<T = any> = (options?: T) => RequestHandler | ErrorRequestHandler;

/**
 * Route handler with validation
 */
export interface ValidatedRouteHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> {
  /** Validation schema for params */
  paramsSchema?: any;
  
  /** Validation schema for body */
  bodySchema?: any;
  
  /** Validation schema for query */
  querySchema?: any;
  
  /** The actual handler */
  handler: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery>;
  
  /** Middleware to run before handler */
  middleware?: RequestHandler[];
}

/**
 * Express application configuration
 */
export interface ExpressAppConfig {
  /** Port to listen on */
  port: number;
  
  /** Host to bind to */
  host: string;
  
  /** Environment */
  env: 'development' | 'test' | 'staging' | 'production';
  
  /** Trust proxy settings */
  trustProxy: boolean | string | number;
  
  /** Body parser limits */
  bodyParser: {
    json: {
      limit: string;
      strict: boolean;
    };
    urlencoded: {
      limit: string;
      extended: boolean;
    };
  };
  
  /** Compression options */
  compression: {
    enabled: boolean;
    level: number;
    threshold: string;
  };
  
  /** Static file serving */
  static?: {
    path: string;
    options: {
      maxAge: string;
      etag: boolean;
      lastModified: boolean;
    };
  };
  
  /** Session configuration */
  session?: {
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      maxAge: number;
      sameSite: boolean | 'lax' | 'strict' | 'none';
    };
  };
}

/**
 * Route configuration
 */
export interface RouteConfig {
  /** Route path */
  path: string;
  
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  
  /** Route handler */
  handler: AsyncRequestHandler;
  
  /** Route middleware */
  middleware?: RequestHandler[];
  
  /** Route metadata */
  metadata?: {
    /** Route description */
    description?: string;
    
    /** Route tags for documentation */
    tags?: string[];
    
    /** Is route deprecated */
    deprecated?: boolean;
    
    /** Required permissions */
    permissions?: string[];
    
    /** Rate limit override */
    rateLimit?: {
      windowMs: number;
      max: number;
    };
  };
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Include stack trace in development */
  includeStackTrace: boolean;
  
  /** Log errors */
  logErrors: boolean;
  
  /** Custom error formatters */
  formatters?: {
    /** Format validation errors */
    validation?: (errors: any[]) => ApiError;
    
    /** Format database errors */
    database?: (error: any) => ApiError;
    
    /** Format authentication errors */
    authentication?: (error: any) => ApiError;
    
    /** Format generic errors */
    generic?: (error: any) => ApiError;
  };
  
  /** Error type mappings to status codes */
  statusCodeMappings?: Record<string, number>;
}

/**
 * Middleware context passed between middleware
 */
export interface MiddlewareContext {
  /** Skip remaining middleware */
  skip?: boolean;
  
  /** Shared data between middleware */
  shared: Record<string, any>;
  
  /** Timing information */
  timing: {
    [key: string]: {
      start: number;
      end?: number;
      duration?: number;
    };
  };
  
  /** Flags set by middleware */
  flags: Set<string>;
}

/**
 * Express locals with typed properties
 */
export interface TypedLocals {
  /** Current user */
  user?: User;
  
  /** Request context */
  context?: RequestContext;
  
  /** Middleware context */
  middleware?: MiddlewareContext;
  
  /** Request start time */
  startTime?: number;
  
  /** Custom locals */
  [key: string]: any;
}

/**
 * Type guards for Express types
 */
export const ExpressTypeGuards = {
  /**
   * Check if request is extended request
   */
  isExtendedRequest: (req: any): req is ExtendedRequest => {
    return req &&
      typeof req.requestId === 'string' &&
      typeof req.timestamp === 'number';
  },

  /**
   * Check if response is extended response
   */
  isExtendedResponse: (res: any): res is ExtendedResponse => {
    return res &&
      typeof res.sendSuccess === 'function' &&
      typeof res.sendError === 'function' &&
      typeof res.sendPaginated === 'function';
  },

  /**
   * Check if error is API error
   */
  isApiError: (error: any): error is ApiError => {
    return error &&
      typeof error.statusCode === 'number' &&
      typeof error.code === 'string' &&
      typeof error.isOperational === 'boolean';
  }
};

/**
 * Utility types for route handlers
 */
export namespace RouteHandlerTypes {
  /** GET request handler */
  export type GetHandler<P = any, Q = any> = AsyncRequestHandler<P, any, never, Q>;
  
  /** POST request handler */
  export type PostHandler<P = any, B = any> = AsyncRequestHandler<P, any, B, any>;
  
  /** PUT request handler */
  export type PutHandler<P = any, B = any> = AsyncRequestHandler<P, any, B, any>;
  
  /** PATCH request handler */
  export type PatchHandler<P = any, B = any> = AsyncRequestHandler<P, any, B, any>;
  
  /** DELETE request handler */
  export type DeleteHandler<P = any> = AsyncRequestHandler<P, any, never, any>;
}