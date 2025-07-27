/**
 * Health Check Middleware
 * Provides health status of the API and its dependencies
 */

import { Request, Response, NextFunction } from 'express';
import { HealthCheckResponse, ServiceHealth } from '../../types/api.types';

// Simple health check middleware
export const healthCheck = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // If it's not the exact health endpoint, pass to next middleware
    if (req.path !== '/' && req.path !== '') {
        return next();
    }

    try {
        const startTime = Date.now();

        // Check various services
        const databaseHealth = await checkDatabase();
        const redisHealth = await checkRedis();
        const mcpHealth = await checkMCP();

        // Calculate overall status
        const services = { database: databaseHealth, redis: redisHealth, mcp: mcpHealth };
        const allHealthy = Object.values(services).every(s => s.status === 'up');
        const anyDown = Object.values(services).some(s => s.status === 'down');

        const status = anyDown ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded');

        const response: HealthCheckResponse = {
            status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services,
            metrics: {
                requestsPerMinute: 0, // Would be calculated from metrics
                averageResponseTime: 0, // Would be calculated from metrics
                errorRate: 0 // Would be calculated from metrics
            }
        };

        const responseTime = Date.now() - startTime;

        res.status(status === 'healthy' ? 200 : 503)
            .header('X-Response-Time', `${responseTime}ms`)
            .json(response);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Check database connectivity
async function checkDatabase(): Promise<ServiceHealth> {
    try {
        // TODO: Implement actual database ping
        // For now, return mock healthy status
        return {
            status: 'up',
            responseTime: 5,
            details: 'Database connection healthy'
        };
    } catch (error) {
        return {
            status: 'down',
            error: error instanceof Error ? error.message : 'Database connection failed',
            details: 'Failed to connect to database'
        };
    }
}

// Check Redis connectivity
async function checkRedis(): Promise<ServiceHealth> {
    try {
        // TODO: Implement actual Redis ping
        // For now, return mock healthy status
        return {
            status: 'up',
            responseTime: 2,
            details: 'Redis cache operational'
        };
    } catch (error) {
        return {
            status: 'down',
            error: error instanceof Error ? error.message : 'Redis connection failed',
            details: 'Failed to connect to Redis cache'
        };
    }
}

// Check MCP system health
async function checkMCP(): Promise<ServiceHealth> {
    try {
        // TODO: Implement actual MCP health check
        // For now, return mock healthy status
        return {
            status: 'up',
            responseTime: 10,
            details: 'MCP system operational - 5/10 MCPs active'
        };
    } catch (error) {
        return {
            status: 'down',
            error: error instanceof Error ? error.message : 'MCP system unavailable',
            details: 'Unable to connect to MCP system'
        };
    }
}