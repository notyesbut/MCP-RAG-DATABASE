/**
 * RAG₁ Data Ingestion API Routes
 * REST endpoints for intelligent data ingestion with MCP routing
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import multer from 'multer';
import { 
  ApiResponse, 
  IngestionRequest, 
  IngestionResponse, 
  AuthenticatedRequest,
  PaginatedResponse
} from '../../types/api.types';
import { DataRecord, MCPDomain } from '../../types/mcp.types';
import { logger } from '../../utils/logger';
import { requirePermission } from '../middleware/auth';
import { config } from '../../api/config/config';
import { asyncHandler, asyncAuthHandler } from '../utils/asyncHandler';
import { RAG1Controller } from '../../rag/ingest/rag1';
import { v4 as uuidv4 } from 'uuid';

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Export factory function that takes RAG1Controller
export function createIngestionRoutes(rag1Controller: RAG1Controller): Router {
  const router = Router();

// Ingestion-specific rate limiting
const ingestionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many ingestion requests, please try again later.',
    code: 'INGESTION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const ingestionSchema = z.object({
  data: z.any(),
  metadata: z.object({
    source: z.string().optional(),
    type: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    tags: z.array(z.string()).optional(),
    schema: z.record(z.string(), z.any()).optional()
  }).optional(),
  routing: z.object({
    preferredMCPs: z.array(z.string()).optional(),
    excludeMCPs: z.array(z.string()).optional(),
    distributionStrategy: z.enum(['single', 'replicated', 'sharded']).default('single')
  }).optional()
});

const batchIngestionSchema = z.object({
  items: z.array(ingestionSchema).min(1).max(100),
  options: z.object({
    parallelProcessing: z.boolean().default(true),
    failFast: z.boolean().default(false),
    generateReport: z.boolean().default(true)
  }).optional()
});

/**
 * @swagger
 * /api/v1/ingest/single:
 *   post:
 *     summary: Ingest a single data item
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IngestionRequest'
 *     responses:
 *       201:
 *         description: Data successfully ingested
 *       400:
 *         description: Invalid request data
 */
router.post('/single', 
  ingestionRateLimit,
  requirePermission(['ingest:write']),
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const validationResult = ingestionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const ingestionRequest = validationResult.data as IngestionRequest;
      
      if (!ingestionRequest.metadata) {
        ingestionRequest.metadata = {};
      }

      const ingestionResult = await rag1Controller.ingest(ingestionRequest.data, ingestionRequest.metadata, ingestionRequest.routing);

      const ingestionResponse: IngestionResponse = {
        id: ingestionResult.recordId,
        status: ingestionResult.success ? 'completed' : 'failed',
        mcpPlacements: ingestionResult.routing?.targetMCPs.map(mcpId => ({
          mcpId,
          mcpType: 'hot' as const, // TODO: Get actual type from MCP metadata
          recordId: ingestionResult.recordId,
          indexed: true
        })) || [],
        processingTime: ingestionResult.processingTime,
        ragAnalysis: {
          classification: ingestionResult.classification?.classification || 'unknown',
          confidence: ingestionResult.classification?.confidence || 0,
          suggestedMCPs: ingestionResult.routing?.targetMCPs || []
        }
      };

      const response: ApiResponse<IngestionResponse> = {
        success: true,
        data: ingestionResponse,
        message: 'Data successfully ingested',
        timestamp: new Date().toISOString(),
        requestId,
      };

      return res.status(201).json(response);

    } catch (error) {
      logger.error('Ingestion failed', {
        requestId,
        userId: req.user?.id,
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      return res.status(500).json({
        success: false,
        error: 'Ingestion failed',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId,
      } as ApiResponse);
    }
  })
);

/**
 * @swagger
 * /api/v1/ingest/batch:
 *   post:
 *     summary: Ingest multiple data items in batch
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchIngestionRequest'
 *     responses:
 *       201:
 *         description: Batch ingestion completed
 *       400:
 *         description: Invalid batch data
 */
router.post('/batch',
  ingestionRateLimit,
  requirePermission(['ingest:write', 'ingest:batch']),
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const validationResult = batchIngestionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid batch data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const { items, options } = validationResult.data;

      // Transform items to DataRecord format
      const dataRecords: DataRecord[] = items.map((item, index) => ({
        id: uuidv4(),
        data: item.data,
        domain: (item.metadata?.type || 'general') as MCPDomain,
        type: item.metadata?.type || 'data',
        timestamp: Date.now(),
        metadata: item.metadata || {},
        routing: item.routing
      }));

      const batchResult = await rag1Controller.ingestBatch(dataRecords, options);

      const successCount = batchResult.results.filter(r => r.success).length;

      return res.status(201).json({
        success: true,
        data: {
          batchId: batchResult.batchId,
          totalItems: items.length,
          successful: successCount,
          failed: items.length - successCount,
          results: batchResult.results
        },
        message: `Batch ingestion completed: ${successCount}/${items.length} successful`,
        timestamp: new Date().toISOString(),
        requestId,
      } as ApiResponse);

    } catch (error) {
      logger.error('Batch ingestion failed', {
        requestId,
        error: (error as Error).message
      });

      return res.status(500).json({
        success: false,
        error: 'Batch ingestion failed',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  })
);

/**
 * @swagger
 * /api/v1/ingest/status/{id}:
 *   get:
 *     summary: Get ingestion status
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ingestion status retrieved
 *       404:
 *         description: Ingestion not found
 */
router.get('/status/:id',
  requirePermission(['ingest:read']),
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const status = await rag1Controller.getIngestionStatus(id);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Ingestion not found',
          message: `Ingestion with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      return res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve status',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  })
);

/**
 * @swagger
 * /api/v1/ingest/history:
 *   get:
 *     summary: Get ingestion history
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Ingestion history retrieved
 */
router.get('/history',
  requirePermission(['ingest:read']),
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

    try {
      const historyResult = await rag1Controller.getHistory({
        page,
        limit,
        ...(req.user?.id && { userId: req.user.id })
      });

      const response: PaginatedResponse<any> = {
        success: true,
        data: historyResult.data,
        pagination: historyResult.pagination,
        timestamp: new Date().toISOString(),
        requestId
      };

      return res.json(response);

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve history',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  })
);

/**
 * @swagger
 * /api/v1/ingest/validate:
 *   post:
 *     summary: Validate data before ingestion
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IngestionRequest'
 *     responses:
 *       200:
 *         description: Validation completed
 */
router.post('/validate',
  requirePermission(['ingest:validate']),
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const validationResult = ingestionSchema.safeParse(req.body);
      
      const response = {
        success: true,
        data: {
          valid: validationResult.success,
          errors: validationResult.success ? [] : validationResult.error.format(),
          suggestions: {
            recommendedMCPs: ['hot-mcp-001'],
            estimatedProcessingTime: '< 1 second',
            distributionStrategy: 'single'
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      };

      return res.json(response);

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Validation failed',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  })
);

  /**
   * @swagger
   * /api/v1/ingest/file:
   *   post:
   *     summary: Ingest data from file upload
   *     tags: [Ingestion]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               files:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *               metadata:
   *                 type: string
   *                 description: JSON string of metadata
   *     responses:
   *       201:
   *         description: File(s) uploaded and processed
   *       400:
 *         description: Invalid file or metadata
   */
  router.post('/file',
    ingestionRateLimit,
    requirePermission(['ingest:write', 'ingest:file']),
    upload.array('files', 10),
    asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string || uuidv4();

      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No files provided',
            timestamp: new Date().toISOString(),
            requestId
          } as ApiResponse);
        }

        let metadata = {};
        if (req.body.metadata) {
          try {
            metadata = JSON.parse(req.body.metadata);
          } catch (error) {
            return res.status(400).json({
              success: false,
              error: 'Invalid metadata',
              message: 'Metadata must be valid JSON',
              timestamp: new Date().toISOString(),
              requestId
            } as ApiResponse);
          }
        }

        const fileResults = await Promise.all(
          files.map(async (file) => {
            try {
              const data = file.buffer;
              const fileIngestion = await rag1Controller.ingest(data, {
                ...metadata,
                fileName: file.originalname,
                mimeType: file.mimetype,
              });

              return {
                fileName: file.originalname,
                success: true,
                ingestionId: fileIngestion.recordId,
              };
            } catch (error) {
              return {
                fileName: file.originalname,
                success: false,
                error: (error as Error).message
              };
            }
          })
        );

        const successCount = fileResults.filter(r => r.success).length;

        return res.status(201).json({
          success: true,
          data: {
            totalFiles: files.length,
            successful: successCount,
            failed: files.length - successCount,
            results: fileResults
          },
          message: `File ingestion completed: ${successCount}/${files.length} successful`,
          timestamp: new Date().toISOString(),
          requestId,
        } as ApiResponse);

      } catch (error) {
        logger.error('File ingestion failed', {
          requestId,
          error: (error as Error).message
        });

        return res.status(500).json({
          success: false,
          error: 'File ingestion failed',
          message: (error as Error).message,
          timestamp: new Date().toISOString(),
          requestId,
        } as ApiResponse);
      }
    }));
  );

  /**
   * @swagger
   * /api/v1/ingest/stream:
   *   post:
   *     summary: Start streaming ingestion session
   *     tags: [Ingestion]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sessionConfig:
   *                 type: object
   *     responses:
   *       201:
   *         description: Streaming session created
   */
  router.post('/stream',
    ingestionRateLimit,
    requirePermission(['ingest:write', 'ingest:stream']),
    asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
      const requestId = req.headers['x-request-id'] as string || uuidv4();

      try {
        const { sessionConfig } = req.body;

        const streamSession = await rag1Controller.createStream(sessionConfig);

        logger.info('Streaming ingestion session created', {
          requestId,
          userId: req.user?.id,
          sessionId: streamSession.id
        });

        return res.status(201).json({
          success: true,
          data: streamSession,
          message: 'Streaming session created successfully',
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);

      } catch (error) {
        logger.error('Failed to create streaming session', {
          requestId,
          error: (error as Error).message
        });

        return res.status(500).json({
          success: false,
          error: 'Failed to create streaming session',
          message: (error as Error).message,
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }
    }));
  );

  return router;
}

export default createIngestionRoutes;