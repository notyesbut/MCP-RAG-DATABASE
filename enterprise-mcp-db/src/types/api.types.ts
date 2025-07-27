/**
 * API Type Definitions
 * Common types used throughout the API
 */

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    code?: string;
    details?: any;
    timestamp: string;
    requestId: string;
    pagination?: PaginationInfo;
    stack?: string;
}

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface QueryOptions {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    fields?: string[];
    filters?: Record<string, any>;
}

export interface AuthUser {
    id: string;
    email: string;
    username: string;
    roles: string[];
    permissions: string[];
}

export interface AuthRequest extends Request {
    user?: AuthUser;
    token?: string;
}

export interface WebSocketMessage {
    type: string;
    payload: any;
    timestamp: number;
    userId?: string;
    roomId?: string;
}

export interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    services: {
        database: ServiceHealth;
        redis: ServiceHealth;
        mcp: ServiceHealth;
    };
    metrics: {
        requestsPerMinute: number;
        averageResponseTime: number;
        errorRate: number;
    };
}

export interface ServiceHealth {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    error?: string;
    details?: any;
}

export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: Date;
}

export interface FileUpload {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
    path?: string;
}

export interface BatchOperation<T> {
    operation: 'create' | 'update' | 'delete';
    data: T;
    id?: string;
}

export interface BatchResult<T> {
    successful: T[];
    failed: Array<{
        operation: BatchOperation<T>;
        error: string;
    }>;
    stats: {
        total: number;
        successful: number;
        failed: number;
    };
}

export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message: string;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
}

export interface ApiConfig {
    // Server configuration
    port: number;
    host: string;

    // CORS configuration
    corsOrigins: string[];

    // Rate limiting configuration
    rateLimit: {
        global: RateLimitConfig;
        auth: RateLimitConfig;
        query: RateLimitConfig;
        ingestion: RateLimitConfig;
        admin: RateLimitConfig;
    };

    // Authentication configuration
    auth: {
        jwtSecret: string;
        jwtExpiration: string;
        bcryptRounds: number;
        sessionTimeout: number;
    };

    // Redis configuration
    redis: {
        host: string;
        port: number;
        password?: string;
        db: number;
    };

    // WebSocket configuration
    websocket: {
        pingTimeout: number;
        pingInterval: number;
        maxConnections: number;
    };

    // File upload configuration
    upload: {
        maxFileSize: number;
        allowedMimeTypes: string[];
        uploadPath: string;
    };
}