/**
 * Admin API Routes
 * MCP management and system administration endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { 
  ApiResponse, 
  MCPStatus, 
  SystemMetrics,
  AuthenticatedRequest
} from '../../types/api.types';
import { logger } from '../../utils/logger';
import { requireAdmin } from '../middleware/auth';
import { config } from '../../api/config/config';
import { MCPRegistry } from '../../mcp/registry/MCPRegistry';
import { RAG1Controller } from '../../rag/ingest/rag1';
import { RAG2Controller } from '../../rag/query/rag2';
import { MCPType, MCPTier, BaseMCP } from '../../mcp/core/BaseMCP';

// Helper to generate a unique request ID
const getRequestId = (req: Request): string => req.headers['x-request-id'] as string || uuidv4();

// Helper for consistent error responses
const handleError = (res: Response, error: unknown, message: string, statusCode: number, requestId: string) => {
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  logger.error(message, { requestId, error: errorMessage });
  
  const response: ApiResponse<null> = {
    success: false,
    error: message,
    message: errorMessage,
    timestamp: new Date().toISOString(),
    requestId,
    details: error instanceof ZodError ? error.format() : undefined,
  };
  
  res.status(statusCode).json(response);
};

// MCP configuration schema
const mcpConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(['hot', 'cold']),
  configuration: z.object({
    maxRecords: z.number().min(1),
    autoMigration: z.boolean(),
    replicationFactor: z.number().min(1).max(5),
    indexStrategies: z.array(z.string()).nonempty(),
  }),
  connectionString: z.string().optional(),
  priority: z.number().min(1).max(10).default(5),
});

type McpConfigPayload = z.infer<typeof mcpConfigSchema>;

// Mock data is defined outside handlers for efficiency
const MOCK_MCPS: MCPStatus[] = [
  {
    id: 'hot-mcp-001', name: 'Primary Hot Storage', type: 'hot', status: 'healthy',
    metrics: { recordCount: 150000, queryCount: 25000, lastAccess: new Date(Date.now() - 1000).toISOString(), avgResponseTime: 45, errorRate: 0.001, storageUsed: 2.5 * 1024 * 1024 * 1024, indexCount: 12 },
    configuration: { maxRecords: 200000, autoMigration: true, replicationFactor: 2, indexStrategies: ['btree', 'hash', 'fulltext'] }
  },
  {
    id: 'cold-mcp-001', name: 'Archive Cold Storage', type: 'cold', status: 'healthy',
    metrics: { recordCount: 2500000, queryCount: 1200, lastAccess: new Date(Date.now() - 60000).toISOString(), avgResponseTime: 850, errorRate: 0.005, storageUsed: 50 * 1024 * 1024 * 1024, indexCount: 8 },
    configuration: { maxRecords: 5000000, autoMigration: false, replicationFactor: 1, indexStrategies: ['btree', 'compressed'] }
  },
  {
    id: 'hot-mcp-002', name: 'Secondary Hot Storage', type: 'hot', status: 'degraded',
    metrics: { recordCount: 95000, queryCount: 8500, lastAccess: new Date(Date.now() - 30000).toISOString(), avgResponseTime: 120, errorRate: 0.015, storageUsed: 1.2 * 1024 * 1024 * 1024, indexCount: 10 },
    configuration: { maxRecords: 150000, autoMigration: true, replicationFactor: 1, indexStrategies: ['btree', 'hash'] }
  }
];

/**
 * Factory function to create and configure the admin API routes.
 * @param mcpRegistry - The MCP registry instance.
 * @param rag1Controller - Optional RAG1 controller for ingestion metrics.
 * @param rag2Controller - Optional RAG2 controller for query metrics.
 * @returns An Express router instance.
 */
export function createAdminRoutes(
  mcpRegistry: MCPRegistry, 
  rag1Controller?: RAG1Controller, 
  rag2Controller?: RAG2Controller
): Router {
  const router = Router();

  const adminRateLimit = rateLimit({
    windowMs: config.rateLimit.admin.windowMs,
    max: config.rateLimit.admin.max,
    message: { success: false, error: 'Too many admin requests, please try again later.', code: 'ADMIN_RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.use(adminRateLimit);
  router.use(requireAdmin);

  /**
   * @swagger
   * /api/v1/admin/mcps:
   *   get:
   *     summary: List all MCPs with status and filtering
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [healthy, degraded, unhealthy, offline] }
   *       - in: query
   *         name: type
   *         schema: { type: string, enum: [hot, cold] }
   *     responses:
   *       200: { description: "MCP list retrieved successfully" }
   *       500: { description: "Internal server error" }
   */
  router.get('/mcps', async (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);
    const { status: statusFilter, type: typeFilter } = req.query;

    try {
      const mcpMap = await mcpRegistry.getAllMCPs();
      const mcpList = Array.from(mcpMap.values());
      let mcpStatuses: MCPStatus[] = [];

      if (mcpList.length > 0) {
        mcpStatuses = await Promise.all(
          mcpList.map(async (mcp: BaseMCP) => {
            const health = await mcp.getHealth();
            const metrics = await mcp.getMetrics();
            return {
              id: mcp.id,
              name: mcp.name,
              type: mcp.tier as 'hot' | 'cold',
              status: health.status,
              metrics: {
                recordCount: metrics.totalRecords,
                queryCount: metrics.queryCount,
                lastAccess: metrics.lastAccess,
                avgResponseTime: metrics.avgQueryTime,
                errorRate: metrics.errorRate,
                storageUsed: metrics.storageUsed,
                indexCount: metrics.indexCount,
              },
              configuration: {
                maxRecords: mcp.getConfiguration().maxRecords || 1000000,
                autoMigration: mcp.getConfiguration().autoMigration || true,
                replicationFactor: mcp.getConfiguration().replicationFactor || 1,
                indexStrategies: mcp.getConfiguration().indexStrategies || ['btree', 'hash']
              },
            };
          })
        );
      }

      let data = mcpStatuses.length > 0 ? mcpStatuses : MOCK_MCPS;

      if (statusFilter) data = data.filter(mcp => mcp.status === statusFilter);
      if (typeFilter) data = data.filter(mcp => mcp.type === typeFilter);

      logger.info('MCP list requested', { requestId, userId: req.user?.id, statusFilter, typeFilter, resultCount: data.length });

      const response: ApiResponse<MCPStatus[]> = {
        success: true,
        data,
        message: `Found ${data.length} MCPs`,
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.json(response);

    } catch (error) {
      handleError(res, error, 'Failed to retrieve MCP list', 500, requestId);
    }
  });

  /**
   * @swagger
   * /api/v1/admin/mcps/{id}:
   *   get:
   *     summary: Get detailed information for a specific MCP
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: "MCP details retrieved" }
   *       404: { description: "MCP not found" }
   *       500: { description: "Internal server error" }
   */
  router.get('/mcps/:id', async (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);
    const { id } = req.params;

    try {
      const mcp = await mcpRegistry.getMCP(id);
      if (!mcp) {
        return handleError(res, new Error(`MCP with ID ${id} not found.`), 'MCP not found', 404, requestId);
      }

      const health = await mcp.getHealth();
      const metrics = await mcp.getMetrics();
      const recentLogs = await mcp.getLogs({ limit: 10 });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          id: mcp.id,
          name: mcp.name,
          type: mcp.tier as 'hot' | 'cold',
          status: health.status,
          configuration: mcp.getConfiguration(),
          detailedMetrics: {
            uptime: health.uptime,
            memoryUsage: metrics.memoryUsage,
            cpuUsage: metrics.cpuUsage,
            diskUsage: metrics.diskUsage,
            networkIO: metrics.networkIO || { inbound: 0, outbound: 0 },
            queryLatency: metrics.queryLatency || { p50: 0, p95: 0, p99: 0 },
          },
          recentLogs: recentLogs.map((log: any) => ({ timestamp: log.timestamp, level: log.level, message: log.message })),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.json(response);

    } catch (error) {
      handleError(res, error, 'Failed to retrieve MCP details', 500, requestId);
    }
  });

  /**
   * @swagger
   * /api/v1/admin/mcps:
   *   post:
   *     summary: Register a new MCP instance
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/McpConfigPayload' }
   *     responses:
   *       201: { description: "MCP registered successfully" }
   *       400: { description: "Invalid configuration provided" }
   *       500: { description: "Failed to register MCP" }
   */
  router.post('/mcps', async (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);

    try {
      const mcpConfig = mcpConfigSchema.parse(req.body);

      const newMCPId = await mcpRegistry.createMCP({
        name: mcpConfig.name,
        type: mcpConfig.type === 'hot' ? MCPType.USER : MCPType.LOGS,
        tier: mcpConfig.type === 'hot' ? MCPTier.HOT : MCPTier.COLD,
        config: mcpConfig.configuration,
        tags: [mcpConfig.type, 'api-created'],
        initialData: [],
      });
      
      logger.info('New MCP registered', { requestId, userId: req.user?.id, mcpId: newMCPId, name: mcpConfig.name, type: mcpConfig.type });

      const response: ApiResponse<any> = {
        success: true,
        data: { id: newMCPId, ...mcpConfig, status: 'initializing', createdAt: new Date().toISOString() },
        message: 'MCP registered successfully',
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.status(201).json(response);

    } catch (error) {
      if (error instanceof ZodError) {
        return handleError(res, error, 'Invalid MCP configuration', 400, requestId);
      }
      handleError(res, error, 'Failed to register MCP', 500, requestId);
    }
  });

  /**
   * @swagger
   * /api/v1/admin/mcps/{id}/maintenance:
   *   post:
   *     summary: Perform a maintenance operation on an MCP
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               operation: { type: string, enum: [reindex, vacuum, migrate, backup] }
   *               options: { type: object }
   *     responses:
   *       200: { description: "Maintenance operation started successfully" }
   *       400: { description: "Invalid maintenance operation" }
   *       500: { description: "Failed to start maintenance" }
   */
  router.post('/mcps/:id/maintenance', async (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);
    const { id } = req.params;
    const { operation, options } = req.body;

    try {
      const validOperations = ['reindex', 'vacuum', 'migrate', 'backup'];
      if (!validOperations.includes(operation)) {
        return handleError(res, new Error(`Operation must be one of: ${validOperations.join(', ')}`), 'Invalid maintenance operation', 400, requestId);
      }

      const maintenanceId = await mcpRegistry.startMaintenance(id, operation, options);

      logger.info('Maintenance operation started', { requestId, userId: req.user?.id, mcpId: id, operation, maintenanceId });

      const response: ApiResponse<any> = {
        success: true,
        data: { maintenanceId, operation, status: 'started', estimatedDuration: '5-15 minutes', startedAt: new Date().toISOString() },
        message: `${operation} operation started successfully`,
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.json(response);

    } catch (error) {
      handleError(res, error, 'Failed to start maintenance operation', 500, requestId);
    }
  });

  /**
   * @swagger
   * /api/v1/admin/metrics:
   *   get:
   *     summary: Get aggregated system-wide metrics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: timeRange
   *         schema: { type: string, enum: [1h, 24h, 7d, 30d], default: '24h' }
   *     responses:
   *       200: { description: "System metrics retrieved" }
   *       500: { description: "Failed to retrieve metrics" }
   */
  router.get('/metrics', async (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);
    const timeRange = req.query.timeRange as string || '24h';

    try {
      const mcpStats = await mcpRegistry.getSystemMetrics();
      const rag1Stats = rag1Controller ? await rag1Controller.getMetrics() : null;
      const rag2Stats = rag2Controller ? await rag2Controller.getMetrics() : null;
      
      const systemMetrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        mcps: {
          total: mcpStats.total,
          hot: mcpStats.hot,
          cold: mcpStats.cold,
          healthy: mcpStats.healthy,
        },
        performance: {
          avgQueryTime: rag2Stats?.avgQueryTime || 0,
          avgIngestionTime: rag1Stats?.avgIngestionTime || 0,
          throughput: {
            queriesPerSecond: rag2Stats?.queriesPerSecond || 0,
            ingestionsPerSecond: rag1Stats?.ingestionsPerSecond || 0,
          },
          cacheHitRate: rag2Stats?.cacheHitRate || 0,
        },
        resources: {
          memoryUsage: mcpStats.memoryUsage,
          cpuUsage: mcpStats.cpuUsage,
          storageUsed: mcpStats.storageUsed,
          networkIO: mcpStats.networkIO || { inbound: 0, outbound: 0 },
        },
      };

      const response: ApiResponse<SystemMetrics> = {
        success: true,
        data: systemMetrics,
        message: `System metrics for ${timeRange}`,
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.json(response);

    } catch (error) {
      handleError(res, error, 'Failed to retrieve system metrics', 500, requestId);
    }
  });

  /**
   * @swagger
   * /api/v1/admin/logs:
   *   get:
   *     summary: Retrieve and filter system logs
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: level
   *         schema: { type: string, enum: [debug, info, warn, error] }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 100, maximum: 1000 }
   *     responses:
   *       200: { description: "System logs retrieved" }
   *       500: { description: "Failed to retrieve logs" }
   */
  router.get('/logs', async (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);
    const level = req.query.level as string | undefined;
    const limit = Math.min(1000, parseInt(req.query.limit as string, 10) || 100);

    try {
      const logOptions = level ? { level, limit } : { limit };
      const logPromises = [mcpRegistry.getLogs(logOptions)];
      if (rag1Controller) logPromises.push(rag1Controller.getLogs(logOptions));
      if (rag2Controller) logPromises.push(rag2Controller.getLogs(logOptions));

      const logs = (await Promise.all(logPromises)).flat();
      
      const sortedLogs = logs
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      const response: ApiResponse<any[]> = {
        success: true,
        data: sortedLogs,
        message: `Retrieved ${sortedLogs.length} log entries`,
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.json(response);

    } catch (error) {
      handleError(res, error, 'Failed to retrieve system logs', 500, requestId);
    }
  });

  /**
   * @swagger
   * /api/v1/admin/system/backup:
   *   post:
   *     summary: Initiate a system-wide backup
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               type: { type: string, enum: [full, incremental, metadata], default: 'full' }
   *               compression: { type: boolean, default: true }
   *     responses:
   *       202: { description: "Backup process started" }
   *       500: { description: "Failed to start backup" }
   */
  router.post('/system/backup', (req: AuthenticatedRequest, res: Response) => {
    const requestId = getRequestId(req);
    const { type = 'full', compression = true } = req.body;

    try {
      const backupId = uuidv4();
      // In a real application, this would trigger an async background job
      logger.info('System backup initiated', { requestId, userId: req.user?.id, backupId, type, compression });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          backupId,
          type,
          compression,
          status: 'started',
          startedAt: new Date().toISOString(),
          estimatedDuration: type === 'full' ? '30-60 minutes' : '5-15 minutes',
        },
        message: 'System backup process initiated successfully',
        timestamp: new Date().toISOString(),
        requestId,
      };
      res.status(202).json(response);

    } catch (error) {
      handleError(res, error, 'Failed to start system backup', 500, requestId);
    }
  });

  return router;
}