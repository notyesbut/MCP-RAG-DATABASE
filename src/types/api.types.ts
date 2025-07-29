/**
 * @file TypeScript type definitions for the Enterprise Multi-MCP Smart Database System API.
 * @description This file contains all the core interfaces and types used throughout the API,
 * including authentication, API responses, data ingestion, queries, WebSockets,
 * administration, configuration, and error handling.
 */

import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { HealthCheckResult } from './registry.types';

// --- Authentication and User Types ---

/**
 * @interface User
 * @description Represents a system user.
 */
export interface User {
  /** Unique user identifier (UUID). */
  id: string;
  /** Username. */
  username: string;
  /** User's email address. */
  email: string;
  /** The user's role in the system. */
  role: 'admin' | 'user' | 'readonly';
  /** List of permissions assigned to the user. */
  permissions: string[];
  /** Timestamp of when the user account was created. */
  createdAt: Date;
  /** Timestamp of the user's last login (optional). */
  lastLogin?: Date;
  /** Hashed password (internal use only). */
  passwordHash?: string;
}

/**
 * @interface AuthenticatedRequest
 * @description Extends the standard Express Request object to include authenticated user information.
 */
export interface AuthenticatedRequest extends Request {
  /** The user object attached to the request after successful authentication. */
  user?: User;
  /** The JWT token extracted from the request. */
  token?: string;
}

/**
 * @interface AuthTokenPayload
 * @description Defines the structure of the JWT payload.
 */
export interface AuthTokenPayload extends JwtPayload {
  /** User ID. */
  userId: string;
  /** Username. */
  username: string;
  /** User role. */
  role: string;
  /** List of permissions. */
  permissions: string[];
}

// --- API Response Types ---

/**
 * @interface ApiResponse
 * @description A standard wrapper for all API responses.
 * @template T - The type of data contained in the `data` field.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId: string;
  details?: any;
}

/**
 * @interface PaginatedResponse
 * @description Extends ApiResponse for paginated responses.
 * @template T - The type of items in the data array.
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination metadata. */
  pagination: {
    /** Current page number. */
    page: number;
    /** Number of items per page. */
    limit: number;
    /** Total number of items. */
    total: number;
    /** Total number of pages. */
    totalPages: number;
    /** Indicates if there is a next page. */
    hasNext: boolean;
    /** Indicates if there is a previous page. */
    hasPrev: boolean;
  };
}

// --- Data Ingestion Types ---

/**
 * @interface IngestionRequest
 * @description Defines the structure for a data ingestion request.
 */
export interface IngestionRequest {
  /** The data to be ingested. */
  data: any;
  /** Metadata describing the data. */
  metadata?: {
    source?: string;
    type?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    schema?: Record<string, any>;
  };
  /** Data routing parameters for MCPs (Multi-Capability Providers). */
  routing?: {
    preferredMCPs?: string[];
    excludeMCPs?: string[];
    distributionStrategy?: 'single' | 'replicated' | 'sharded';
  };
}

/**
 * @interface IngestionResponse
 * @description The response to a data ingestion request.
 */
export interface IngestionResponse {
  /** Unique ID for the ingestion operation. */
  id: string;
  /** The current status of the operation. */
  status: 'accepted' | 'processing' | 'completed' | 'failed';
  /** Information about data placement in MCPs. */
  mcpPlacements: {
    mcpId: string;
    mcpType: 'hot' | 'cold';
    recordId: string;
    indexed: boolean;
  }[];
  /** Processing time in milliseconds. */
  processingTime: number;
  /** Results from RAG (Retrieval-Augmented Generation) analysis. */
  ragAnalysis: {
    classification: string;
    confidence: number;
    suggestedMCPs: string[];
  };
}

// --- Query Types ---

/**
 * @interface QueryRequest
 * @description Defines the structure for a data query request.
 */
export interface QueryRequest {
  /** Natural language query string. */
  query: string;
  /** Context for the query. */
  context?: {
    user?: string;
    session?: string;
    filters?: Record<string, any>;
    preferences?: {
      maxResults?: number;
      timeout?: number;
      includeMCPSource?: boolean;
      aggregationLevel?: 'minimal' | 'standard' | 'detailed';
    };
  };
  /** Additional query execution options. */
  options?: {
    explain?: boolean; // Include the query execution plan
    cache?: boolean; // Use cached results if available
    realtime?: boolean; // Force real-time execution
  };
}

/**
 * @interface QueryResponse
 * @description The response to a data query.
 */
export interface QueryResponse {
  /** Unique ID for the query. */
  id: string;
  /** Array of results. */
  results: any[];
  /** The query execution plan. */
  executionPlan: {
    parsedQuery: {
      intent: string[];
      entities: Record<string, any>;
      filters: Record<string, any>;
    };
    targetMCPs: string[];
    queryStrategy: string;
    estimatedCost: number;
  };
  /** Metadata about the query execution. */
  metadata: {
    totalResults: number;
    executionTime: number;
    mcpResponseTimes: Record<string, number>;
    cacheHit: boolean;
    aggregationStrategy: string;
  };
}

// --- WebSocket Types ---

/**
 * @interface WebSocketMessage
 * @description Structure of a message transmitted over WebSocket.
 */
export interface WebSocketMessage {
  /** The type of the message. */
  type: 'query' | 'ingestion' | 'notification' | 'heartbeat' | 'error';
  /** The message payload. */
  payload: any;
  /** Request ID (for matching responses). */
  requestId?: string;
  /** Timestamp of when the message was sent. */
  timestamp: string;
}

/**
 * @interface RealtimeQuerySubscription
 * @description Defines a subscription to a real-time query.
 */
export interface RealtimeQuerySubscription {
  /** Unique ID for the subscription. */
  id: string;
  /** The query string. */
  query: string;
  /** Filters for the query (optional). */
  filters?: Record<string, any>;
  /** Update interval in milliseconds (optional). */
  updateInterval?: number;
  /** The WebSocket client ID. */
  clientId: string;
}

// --- Admin Types ---

/**
 * @interface MCPStatusInfo
 * @description Contains status and metric information for a single MCP.
 */
export interface MCPStatusInfo {
  id: string;
  name: string;
  type: 'hot' | 'cold';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  metrics: {
    recordCount: number;
    queryCount: number;
    lastAccess: string;
    avgResponseTime: number;
    errorRate: number;
    storageUsed: number;
    indexCount: number;
  };
  configuration: {
    maxRecords: number;
    autoMigration: boolean;
    replicationFactor: number;
    indexStrategies: string[];
  };
}

/**
 * @interface SystemMetrics
 * @description Contains overall system performance and health metrics.
 */
export interface SystemMetrics {
  timestamp: string;
  mcps: {
    total: number;
    hot: number;
    cold: number;
    healthy: number;
  };
  performance: {
    avgQueryTime: number;
    avgIngestionTime: number;
    throughput: {
      queriesPerSecond: number;
      ingestionsPerSecond: number;
    };
    cacheHitRate: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    storageUsed: number;
    networkIO: {
      inbound: number;
      outbound: number;
    };
  };
}

// --- Rate Limiting Types ---

/**
 * @interface RateLimitConfig
 * @description Configuration for rate-limiting middleware.
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// --- Validation Types ---

/**
 * @interface ValidationError
 * @description Describes a single validation error.
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

/**
 * @interface ValidationResult
 * @description The result of a validation process.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

// --- Configuration Types ---

/**
 * @interface ApiConfig
 * @description Global application configuration.
 */
export interface ApiConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimit: {
    global: RateLimitConfig;
    auth: RateLimitConfig;
    query: RateLimitConfig;
    ingestion: RateLimitConfig;
    admin: RateLimitConfig;
  };
  auth: {
    jwtSecret: string;
    jwtExpiration: string;
    bcryptRounds: number;
    sessionTimeout: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  websocket: {
    pingTimeout: number;
    pingInterval: number;
    maxConnections: number;
  };
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    uploadPath: string;
  };
}

// --- Error Types ---

/**
 * @interface ApiError
 * @description Base interface for custom API errors.
 */
export interface ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;
  isOperational: boolean;
}

/**
 * @class CustomApiError
 * @description Custom error class for standardized error handling in the application.
 */
export class CustomApiError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
      message: string,
      statusCode: number = 500,
      code: string = 'INTERNAL_ERROR',
      details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes predictable errors from software bugs
    this.name = 'CustomApiError';

    // Maintains a proper stack trace for V8 (Node.js).
    // This line is specific to the Node.js environment.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomApiError);
    }
  }
}

// --- Health Check Types ---

/**
 * @interface ServiceHealth
 * @description Represents the health status of a single service.
 */
export interface ServiceHealth {
  name?: string;
  status: 'up' | 'down' | 'degraded';
  details?: string;
  responseTime?: number;
  error?: string;
}

/**
 * @interface HealthCheckResponse
 * @description The response structure for the system health check endpoint.
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    mcp: ServiceHealth;
    [key: string]: ServiceHealth;
  };
  metrics: {
    responseTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    requestsPerMinute?: number;
    averageResponseTime?: number;
    errorRate?: number;
  };
  error?: string;
  message?: string;
}

// Re-export from registry.types
export { HealthCheckResult };
