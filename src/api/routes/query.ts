/**
 * RAG₂ Query API Routes
 * REST endpoints for natural language database queries
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { 
  ApiResponse, 
  QueryRequest, 
  QueryResponse, 
  AuthenticatedRequest,
  PaginatedResponse
} from '../../types/api.types';
import { logger } from '../../utils/logger';
import { requirePermission, optionalAuth } from '../middleware/auth';
import { config } from '../../api/config/config';
import { RAG2Controller } from '../../rag/query/rag2';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, asyncAuthHandler } from '../utils/asyncHandler';

// Query-specific rate limiting
const queryRateLimit = rateLimit({
  windowMs: config.rateLimit.query.windowMs,
  max: config.rateLimit.query.max,
  message: {
    success: false,
    error: 'Too many query requests, please try again later.',
    code: 'QUERY_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const querySchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  context: z.object({
    user: z.string().optional(),
    session: z.string().optional(),
    filters: z.record(z.string(), z.any()).optional(),
    preferences: z.object({
      maxResults: z.number().min(1).max(1000).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
      includeMCPSource: z.boolean().optional(),
      aggregationLevel: z.enum(['minimal', 'standard', 'detailed']).optional()
    }).optional()
  }).optional(),
  options: z.object({
    explain: z.boolean().optional(),
    cache: z.boolean().optional(),
    realtime: z.boolean().optional()
  }).optional()
});

const bulkQuerySchema = z.object({
  queries: z.array(z.string().min(1)).min(1).max(10),
  context: z.object({
    user: z.string().optional(),
    session: z.string().optional(),
    preferences: z.object({
      maxResults: z.number().optional(),
      timeout: z.number().optional()
    }).optional()
  }).optional()
});

export function createQueryRoutes(rag2Controller: RAG2Controller): Router {
  const router = Router();

  /**
   * POST /api/query/natural
   * Main endpoint for natural language queries
   */
  router.post('/natural', queryRateLimit, optionalAuth, asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      const validationResult = querySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const queryRequest = validationResult.data as QueryRequest;
      const result = await rag2Controller.query(queryRequest.query, queryRequest.context, queryRequest.options);
      
      // Transform QueryResult to QueryResponse
      const queryResponse: QueryResponse = {
        id: result.executionId,
        results: result.data.primary || [],
        executionPlan: {
          parsedQuery: {
            intent: [],
            entities: {},
            filters: {}
          },
          targetMCPs: result.data.metadata.sources.map(s => s.mcpId),
          queryStrategy: 'default',
          estimatedCost: 0
        },
        metadata: {
          totalResults: result.data.metadata.totalRecords,
          executionTime: result.duration,
          mcpResponseTimes: result.data.metadata.sources.reduce((acc, s) => ({ ...acc, [s.mcpId]: s.queryTime }), {}),
          cacheHit: result.caching.cached,
          aggregationStrategy: result.data.metadata.aggregationApplied || 'default'
        }
      };
      
      return res.json({
        success: true,
        data: queryResponse,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse<QueryResponse>);
    } catch (error) {
      logger.error('Natural query processing failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process natural language query',
        details: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    })
  );

  /**
   * POST /api/query/test
   * Test endpoint for query interpretation without execution
   */
  router.post('/test', optionalAuth, asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Query string is required',
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const interpretation = await rag2Controller.plan(query);
      
      return res.json({
        success: true,
        data: interpretation,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Interpretation failed',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    })
  );

  /**
   * GET /api/query/examples
   * Get supported query examples
   */
  router.get('/examples', (req: Request, res: Response) => {
    const examples = rag2Controller.getExamples();
    
    return res.json({
      success: true,
      data: examples,
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  });

  /**
   * GET /api/query/history
   * Get query history for the current user/session
   */
  router.get('/history', optionalAuth, asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const history = await rag2Controller.getHistory(req.user?.id, limit);

      return res.json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve history',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    })
  );

  /**
   * GET /api/query/performance
   * Get performance insights and metrics
   */
  router.get('/performance', requirePermission(['admin']), asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      const insights = await rag2Controller.getMetrics();
      
      return res.json({
        success: true,
        data: insights,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance data',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    })
  );

  /**
   * POST /api/query/bulk
   * Process multiple queries in batch
   */
  router.post('/bulk', queryRateLimit, optionalAuth, asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      const validationResult = bulkQuerySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid bulk query data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const { queries, context } = validationResult.data;

      const results = await rag2Controller.queryBulk(queries, context);

      const successCount = results.filter(r => r.success).length;
      
      return res.json({
        success: true,
        data: {
          results,
          summary: {
            total: queries.length,
            successful: successCount,
            failed: queries.length - successCount,
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Bulk query processing failed',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    })
  );

  /**
   * DELETE /api/query/cache
   * Clear query cache (admin endpoint)
   */
  router.delete('/cache', requirePermission(['admin']), asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      await rag2Controller.clearCache();
      
      return res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    })
  );

  /**
   * GET /api/query/health
   * Health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    try {
      const health = await rag2Controller.healthCheck();
      
      return res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    } catch (error) {
      return res.status(503).json({
        success: false,
        error: 'Health check failed',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  });

  return router;
}
