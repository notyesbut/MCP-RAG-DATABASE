/**
 * Health Check API Routes
 * System health monitoring and status endpoints
 */

import { Router, Request, Response } from 'express';
import { ApiResponse } from '../../types/api.types';
import { HealthCheckResult as BaseHealthCheckResult } from '../../types/registry.types';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Extended health check result for API responses
interface HealthCheckResult extends Omit<BaseHealthCheckResult, 'timestamp'> {
  timestamp: string;
  uptime: number;
  services: Record<string, {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    error?: string;
  }>;
}

const router = Router();

// Store startup time for uptime calculation
const startupTime = Date.now();

/**
 * Get system uptime in seconds
 */
const getUptime = (): number => {
  return Math.floor((Date.now() - startupTime) / 1000);
};

/**
 * Get memory usage information
 */
const getMemoryUsage = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    total: totalMemory,
    used: usedMemory,
    free: freeMemory,
    percentage: (usedMemory / totalMemory) * 100
  };
};

/**
 * Get CPU usage information
 */
const getCPUUsage = () => {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);

  return {
    cores: cpus.length,
    model: cpus[0].model,
    speed: cpus[0].speed,
    usage: usage
  };
};

/**
 * Check database connectivity (mock implementation)
 */
const checkDatabase = async (): Promise<'up' | 'down' | 'degraded'> => {
  try {
    // TODO: Implement actual database health check
    // This should ping your database and verify connectivity
    return Math.random() > 0.1 ? 'up' : 'degraded';
  } catch (error) {
    logger.error('Database health check failed', { error: (error as Error).message });
    return 'down';
  }
};

/**
 * Check Redis connectivity (mock implementation)
 */
const checkRedis = async (): Promise<'up' | 'down' | 'degraded'> => {
  try {
    // TODO: Implement actual Redis health check
    // This should ping Redis and verify connectivity
    return Math.random() > 0.05 ? 'up' : 'down';
  } catch (error) {
    logger.error('Redis health check failed', { error: (error as Error).message });
    return 'down';
  }
};

/**
 * Check MCP Registry status (mock implementation)
 */
const checkMCPRegistry = async (): Promise<'up' | 'down' | 'degraded'> => {
  try {
    // TODO: Implement actual MCP registry health check
    // This should verify that MCP services are accessible
    return Math.random() > 0.02 ? 'up' : 'degraded';
  } catch (error) {
    logger.error('MCP Registry health check failed', { error: (error as Error).message });
    return 'down';
  }
};

/**
 * Check RAG systems status (mock implementation)
 */
const checkRAGSystems = async (): Promise<'up' | 'down' | 'degraded'> => {
  try {
    // TODO: Implement actual RAG systems health check
    // This should verify RAG₁ and RAG₂ components are functional
    return Math.random() > 0.03 ? 'up' : 'degraded';
  } catch (error) {
    logger.error('RAG Systems health check failed', { error: (error as Error).message });
    return 'down';
  }
};

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  try {
    const uptime = getUptime();
    const memory = getMemoryUsage();
    const cpu = getCPUUsage();

    // Basic health check - just verify the service is running
    const isHealthy = uptime > 0 && memory.percentage < 95 && cpu.usage < 95;

    if (isHealthy) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        requestId
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime,
        issues: [
          ...(memory.percentage >= 95 ? ['High memory usage'] : []),
          ...(cpu.usage >= 95 ? ['High CPU usage'] : [])
        ],
        requestId
      });
    }
  } catch (error) {
    logger.error('Health check failed', { 
      requestId, 
      error: (error as Error).message 
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      requestId
    });
  }
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with all dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheckResult'
 *       503:
 *         description: One or more services are unhealthy
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  try {
    // Run all health checks in parallel
    const [database, redis, mcpRegistry, ragSystems] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkMCPRegistry(),
      checkRAGSystems()
    ]);

    const uptime = getUptime();
    const memory = getMemoryUsage();
    const cpu = getCPUUsage();
    const responseTime = Date.now() - startTime;

    // Determine overall system status
    const serviceStatuses = { database, redis, mcpRegistry, ragSystems };
    const hasDownServices = Object.values(serviceStatuses).includes('down');
    const hasDegradedServices = Object.values(serviceStatuses).includes('degraded');
    
    // Convert to expected services format
    const services = {
      database: { status: database },
      redis: { status: redis },
      mcpRegistry: { status: mcpRegistry },
      ragSystems: { status: ragSystems }
    };
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (hasDownServices) {
      status = 'unhealthy';
    } else if (hasDegradedServices || memory.percentage > 90 || cpu.usage > 90) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    const healthResult: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      services,
      responseTime,
      details: {
        uptime,
        memory: memory.percentage,
        cpu: cpu.usage
      },
      metrics: {
        memoryUsage: memory.percentage,
        cpuUsage: cpu.usage,
        diskUsage: 0, // Placeholder - should be implemented
        networkLatency: responseTime,
        activeConnections: 0, // Placeholder - should be implemented
        queueDepth: 0, // Placeholder - should be implemented
        errorRate: 0, // Placeholder - should be implemented
        throughput: 0 // Placeholder - should be implemented
      }
    };

    const response: ApiResponse<HealthCheckResult> = {
      success: status !== 'unhealthy',
      data: healthResult,
      message: `System is ${status}`,
      timestamp: new Date().toISOString(),
      requestId
    };

    // Return appropriate HTTP status
    const statusCode = status === 'healthy' ? 200 : 
                      status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);

    logger.info('Detailed health check completed', {
      requestId,
      status,
      responseTime,
      services
    });

  } catch (error) {
    logger.error('Detailed health check failed', {
      requestId,
      error: (error as Error).message,
      stack: (error as Error).stack
    });

    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime: Date.now() - startTime
    } as ApiResponse);
  }
});

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Kubernetes liveness probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 *       503:
 *         description: Service is not responding
 */
router.get('/liveness', (req: Request, res: Response) => {
  // Simple liveness check - just verify the process is running
  const uptime = getUptime();
  
  if (uptime > 0) {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime
    });
  } else {
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Kubernetes readiness probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready to handle requests
 *       503:
 *         description: Service is not ready
 */
router.get('/readiness', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  try {
    // Check if critical dependencies are available
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);

    const criticalServicesUp = database !== 'down' && redis !== 'down';
    const memory = getMemoryUsage();
    
    // Service is ready if critical services are up and memory usage is reasonable
    const isReady = criticalServicesUp && memory.percentage < 95;

    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          database,
          redis
        },
        memoryUsage: memory.percentage
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        issues: [
          ...(database === 'down' ? ['Database unavailable'] : []),
          ...(redis === 'down' ? ['Redis unavailable'] : []),
          ...(memory.percentage >= 95 ? ['High memory usage'] : [])
        ],
        requestId
      });
    }

  } catch (error) {
    logger.error('Readiness check failed', {
      requestId,
      error: (error as Error).message
    });

    res.status(503).json({
      status: 'not-ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: System metrics endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System metrics retrieved
 */
router.get('/metrics', (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  try {
    const memory = getMemoryUsage();
    const cpu = getCPUUsage();
    const uptime = getUptime();

    const metrics = {
      system: {
        uptime,
        platform: os.platform(),
        architecture: os.arch(),
        nodeVersion: process.version,
        totalMemory: memory.total,
        freeMemory: memory.free,
        loadAverage: os.loadavg()
      },
      process: {
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime()
      },
      performance: {
        memoryUsagePercent: memory.percentage,
        cpuUsagePercent: cpu.usage,
        cpuCores: cpu.cores
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
      requestId
    } as ApiResponse);

  } catch (error) {
    logger.error('Metrics retrieval failed', {
      requestId,
      error: (error as Error).message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
      requestId
    } as ApiResponse);
  }
});

export default router;