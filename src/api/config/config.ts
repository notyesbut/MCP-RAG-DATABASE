// Configuration management for Enterprise Multi-MCP Smart Database API
import dotenv from 'dotenv';
import { ApiConfig } from '../../types/api.types';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
    'JWT_SECRET',
    'NODE_ENV'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Helper function to parse array from environment variable
const parseArray = (value: string | undefined, defaultValue: string[]): string[] => {
    if (!value) return defaultValue;
    return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Helper function to parse boolean from environment variable
const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
};

// Helper function to parse number from environment variable
const parseNumber = (value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Application configuration
export const config: ApiConfig = {
    // Server configuration
    port: parseNumber(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',

    // CORS configuration
    corsOrigins: parseArray(
        process.env.CORS_ORIGINS,
        process.env.NODE_ENV === 'production'
            ? ['https://app.enterprise-mcp.com']
            : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080']
    ),

    // Rate limiting configuration
    rateLimit: {
        global: {
            windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
            max: parseNumber(process.env.RATE_LIMIT_MAX_GLOBAL, 1000), // 1000 requests per window
            message: 'Too many requests from this IP, please try again later.',
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        },
        auth: {
            windowMs: parseNumber(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
            max: parseNumber(process.env.RATE_LIMIT_AUTH_MAX, 5), // 5 login attempts per window
            message: 'Too many authentication attempts, please try again later.',
            skipSuccessfulRequests: true,
            skipFailedRequests: false
        },
        query: {
            windowMs: parseNumber(process.env.RATE_LIMIT_QUERY_WINDOW_MS, 1 * 60 * 1000), // 1 minute
            max: parseNumber(process.env.RATE_LIMIT_QUERY_MAX, 100), // 100 queries per minute
            message: 'Too many query requests, please try again later.',
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        },
        ingestion: {
            windowMs: parseNumber(process.env.RATE_LIMIT_INGESTION_WINDOW_MS, 1 * 60 * 1000), // 1 minute
            max: parseNumber(process.env.RATE_LIMIT_INGESTION_MAX, 50), // 50 ingestions per minute
            message: 'Too many ingestion requests, please try again later.',
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        },
        admin: {
            windowMs: parseNumber(process.env.RATE_LIMIT_ADMIN_WINDOW_MS, 5 * 60 * 1000), // 5 minutes
            max: parseNumber(process.env.RATE_LIMIT_ADMIN_MAX, 20), // 20 admin requests per 5 minutes
            message: 'Too many admin requests, please try again later.',
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        }
    },

    // Authentication configuration
    auth: {
        jwtSecret: process.env.JWT_SECRET!,
        jwtExpiration: process.env.JWT_EXPIRATION || '24h',
        bcryptRounds: parseNumber(process.env.BCRYPT_ROUNDS, 12),
        sessionTimeout: parseNumber(process.env.SESSION_TIMEOUT, 24 * 60 * 60 * 1000) // 24 hours
    },

    // Redis configuration
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },

    // WebSocket configuration
    websocket: {
        pingTimeout: parseNumber(process.env.WS_PING_TIMEOUT, 60000), // 60 seconds
        pingInterval: parseNumber(process.env.WS_PING_INTERVAL, 25000), // 25 seconds
        maxConnections: parseNumber(process.env.WS_MAX_CONNECTIONS, 1000)
    },

    // File upload configuration
    upload: {
        maxFileSize: parseNumber(process.env.UPLOAD_MAX_FILE_SIZE, 10 * 1024 * 1024), // 10MB
        allowedMimeTypes: parseArray(
            process.env.UPLOAD_ALLOWED_MIME_TYPES,
            [
                'application/json',
                'text/csv',
                'text/plain',
                'application/xml',
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/gif'
            ]
        ),
        uploadPath: process.env.UPLOAD_PATH || './uploads'
    }
};

// Environment-specific configurations
if (process.env.NODE_ENV === 'development') {
    // Development-specific overrides
    config.corsOrigins.push('http://localhost:3000', 'http://localhost:3001');
}

if (process.env.NODE_ENV === 'test') {
    // Test-specific overrides
    config.port = parseNumber(process.env.TEST_PORT, 3001);
    config.auth.jwtExpiration = '1h';
    config.rateLimit.global.max = 10000; // Higher limits for testing
}

if (process.env.NODE_ENV === 'production') {
    // Production-specific validations and settings
    if (!process.env.REDIS_HOST) {
        throw new Error('REDIS_HOST is required in production environment');
    }

    if (config.auth.jwtSecret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters in production');
    }

    // Stricter rate limits in production
    config.rateLimit.global.max = 500;
    config.rateLimit.query.max = 50;
    config.rateLimit.ingestion.max = 25;
}

// Log configuration on startup (excluding sensitive values)
export const logConfig = () => {
    const safeConfig = {
        ...config,
        auth: {
            ...config.auth,
            jwtSecret: '[REDACTED]'
        },
        redis: {
            ...config.redis,
            password: config.redis.password ? '[REDACTED]' : undefined
        }
    };

    console.log('📋 API Configuration:', JSON.stringify(safeConfig, null, 2));
};

export default config;