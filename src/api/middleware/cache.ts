/**
 * Redis Caching Middleware
 * High-performance caching layer for API responses and data
 */

import { Request, Response, NextFunction } from 'express';
import * as Redis from 'redis';
import { config } from '../config/config';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../types/api.types';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

// Create a specific type for our Redis client
type RedisClientType = ReturnType<typeof Redis.createClient>;

// Redis client instance
let redisClient: RedisClientType | null = null;
let isRedisConnected = false;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  try {
    const redisOptions = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 10000
      },
      database: config.redis.db,
      ...(config.redis.password && { password: config.redis.password })
    };

    redisClient = Redis.createClient(redisOptions);

    redisClient!.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient!.on('ready', () => {
      isRedisConnected = true;
      logger.info('✅ Redis client connected and ready');
    });

    redisClient!.on('error', (err) => {
      isRedisConnected = false;
      logger.error('Redis client error:', err);
    });

    redisClient!.on('end', () => {
      isRedisConnected = false;
      logger.warn('Redis client connection ended');
    });

    redisClient!.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    await redisClient!.connect();
    
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    // Continue without Redis if connection fails
    redisClient = null;
    isRedisConnected = false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, prefix: string = 'api'): string {
  const baseKey = `${prefix}:${req.method}:${req.originalUrl}`;
  
  // Include user ID for user-specific caching
  const userId = (req as any).user?.id;
  if (userId) {
    return `${baseKey}:user:${userId}`;
  }
  
  // Include query parameters and body for dynamic content
  const queryHash = createHash('md5').update(JSON.stringify(req.query)).digest('hex').slice(0, 8);
  const bodyHash = req.body ? createHash('md5').update(JSON.stringify(req.body)).digest('hex').slice(0, 8) : 'nobody';
  
  return `${baseKey}:q:${queryHash}:b:${bodyHash}`;
}

/**
 * Check if response should be cached
 */
function shouldCache(req: Request, res: Response): boolean {
  // Don't cache non-GET requests by default
  if (req.method !== 'GET') {
    return false;
  }
  
  // Don't cache error responses
  if (res.statusCode >= 400) {
    return false;
  }
  
  // Don't cache if explicitly disabled
  if (req.headers['cache-control'] === 'no-cache') {
    return false;
  }
  
  // Don't cache real-time or streaming endpoints
  const skipPaths = ['/health', '/metrics', '/status', '/stream'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return false;
  }
  
  return true;
}

/**
 * Cache middleware with TTL support
 */
export function cache(options: {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  skipPaths?: string[];
  userSpecific?: boolean;
  varyBy?: string[]; // Additional keys to vary cache by
} = {}) {
  const {
    ttl = 300, // 5 minutes default
    prefix = 'api',
    skipPaths = [],
    userSpecific = false,
    varyBy = []
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    // Skip caching if Redis is not available
    if (!redisClient || !isRedisConnected) {
      return next();
    }

    // Skip specific paths
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }

    // Generate cache key
    let cacheKey = generateCacheKey(req, prefix);
    
    // Add vary-by parameters
    if (varyBy.length > 0) {
      const varyHash = createHash('md5')
        .update(varyBy.map(key => req.headers[key] || '').join(':'))
        .digest('hex')
        .slice(0, 8);
      cacheKey += `:vary:${varyHash}`;
    }

    try {
      // Try to get from cache
      const cachedResponse = await redisClient.get(cacheKey);
      
      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse);
        
        logger.debug('Cache hit', {
          requestId,
          cacheKey,
          method: req.method,
          path: req.path
        });

        // Add cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'X-Cache-TTL': ttl.toString()
        });

        res.status(parsed.statusCode || 200).json(parsed.data);
        return;
      }

      // Cache miss - continue to next middleware
      logger.debug('Cache miss', {
        requestId,
        cacheKey,
        method: req.method,
        path: req.path
      });

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        // Check if we should cache this response
        if (shouldCache(req, res)) {
          const cacheData = {
            data,
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            timestamp: new Date().toISOString()
          };

          // Cache the response asynchronously
          redisClient!.setEx(cacheKey, ttl, JSON.stringify(cacheData)).catch(err => {
            logger.error('Failed to cache response', {
              requestId,
              cacheKey,
              error: err.message
            });
          });

          logger.debug('Response cached', {
            requestId,
            cacheKey,
            ttl
          });
        }

        // Add cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'X-Cache-TTL': ttl.toString()
        });

        return originalJson(data);
      };

      next();

    } catch (error) {
      logger.error('Cache middleware error', {
        requestId,
        error: (error as Error).message,
        cacheKey
      });
      
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(patterns: string | string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    if (!redisClient || !isRedisConnected) {
      return next();
    }

    try {
      const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
      
      for (const pattern of patternsArray) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
          logger.info('Cache invalidated', {
            requestId,
            pattern,
            keysDeleted: keys.length
          });
        }
      }

      next();

    } catch (error) {
      logger.error('Cache invalidation error', {
        requestId,
        error: (error as Error).message,
        patterns
      });
      
      next();
    }
  };
}

/**
 * Query result caching for RAG₂ system
 */
export function cacheQueryResults(ttl: number = 600) { // 10 minutes default for queries
  return cache({
    ttl,
    prefix: 'query',
    userSpecific: true,
    varyBy: ['accept-language', 'user-agent']
  });
}

/**
 * MCP status caching
 */
export function cacheMCPStatus(ttl: number = 60) { // 1 minute for status
  return cache({
    ttl,
    prefix: 'mcp',
    userSpecific: false
  });
}

/**
 * User session caching
 */
export function cacheUserSession(ttl: number = 1800) { // 30 minutes for sessions
  return cache({
    ttl,
    prefix: 'session',
    userSpecific: true
  });
}

/**
 * Rate limit caching (store rate limit data)
 */
export async function getRateLimitData(key: string): Promise<{count: number, resetTime: number} | null> {
  if (!redisClient || !isRedisConnected) {
    return null;
  }

  try {
    const data = await redisClient.get(`ratelimit:${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Rate limit cache read error:', error);
    return null;
  }
}

export async function setRateLimitData(key: string, data: {count: number, resetTime: number}, ttl: number): Promise<void> {
  if (!redisClient || !isRedisConnected) {
    return;
  }

  try {
    await redisClient.setEx(`ratelimit:${key}`, ttl, JSON.stringify(data));
  } catch (error) {
    logger.error('Rate limit cache write error:', error);
  }
}

/**
 * Cache statistics and monitoring
 */
export async function getCacheStats(): Promise<{
  memoryUsage: string;
  keyCount: number;
  hitRate?: number;
  connected: boolean;
}> {
  if (!redisClient || !isRedisConnected) {
    return {
      memoryUsage: '0B',
      keyCount: 0,
      connected: false
    };
  }

  try {
    const info = await redisClient.info('memory');
    const keyCount = await redisClient.dbSize();
    
    // Extract memory usage from info string
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : '0B';

    return {
      memoryUsage,
      keyCount,
      connected: true
    };

  } catch (error) {
    logger.error('Cache stats error:', error);
    return {
      memoryUsage: '0B',
      keyCount: 0,
      connected: false
    };
  }
}

/**
 * Cache warming for frequently accessed data
 */
export async function warmCache(endpoints: Array<{
  path: string;
  method?: string;
  data?: any;
  ttl?: number;
}>): Promise<void> {
  if (!redisClient || !isRedisConnected) {
    return;
  }

  logger.info('Starting cache warming', { endpointCount: endpoints.length });

  for (const endpoint of endpoints) {
    try {
      const cacheKey = `${endpoint.method || 'GET'}:${endpoint.path}`;
      const ttl = endpoint.ttl || 300;
      
      if (endpoint.data) {
        await redisClient.setEx(cacheKey, ttl, JSON.stringify(endpoint.data));
        logger.debug('Cache warmed', { cacheKey, ttl });
      }
    } catch (error) {
      logger.error('Cache warming error', {
        endpoint: endpoint.path,
        error: (error as Error).message
      });
    }
  }
}

/**
 * Middleware to add cache headers for manual cache control
 */
export function setCacheHeaders(maxAge: number = 300) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      'ETag': createHash('md5').update(req.originalUrl).digest('hex').slice(0, 16),
      'Vary': 'Accept-Encoding, Authorization'
    });
    next();
  };
}

export default {
  initializeRedis,
  closeRedis,
  cache,
  invalidateCache,
  cacheQueryResults,
  cacheMCPStatus,
  cacheUserSession,
  getRateLimitData,
  setRateLimitData,
  getCacheStats,
  warmCache,
  setCacheHeaders
};