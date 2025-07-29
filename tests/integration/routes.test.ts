import request from 'supertest';
import express from 'express';
import authRouter from '../../src/api/routes/auth';
import createIngestionRoutes from '../../src/api/routes/ingestion';
import { createQueryRoutes } from '../../src/api/routes/query';
import authenticateToken, { requirePermission, optionalAuth } from '../../src/api/middleware/auth';
import jwt from 'jsonwebtoken';
import { logger } from '../../src/utils/logger';
import { config } from '../../src/api/config/config';

// Mock middleware
jest.mock('../../src/api/middleware/auth');
jest.mock('../../src/utils/logger');
jest.mock('../../src/api/config/config');

// Mock dependencies
jest.mock('../../src/rag/ingest/rag1');
jest.mock('../../src/rag/query/rag2');
jest.mock('../../src/mcp/registry/MCPRegistry');

import { RAG1Controller } from '../../src/rag/ingest/rag1';
import { RAG2Controller } from '../../src/rag/query/rag2';
import { MCPRegistry } from '../../src/mcp/registry/MCPRegistry';

describe('API Routes Integration Tests', () => {
  let app: express.Application;
  let mockToken: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication
    (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { userId: 'test-user-id', email: 'test@example.com' };
      next();
    });
    
    // Mock requirePermission middleware
    (requirePermission as jest.Mock).mockImplementation(() => (req: any, res: any, next: any) => {
      next();
    });
    
    // Mock optionalAuth middleware
    (optionalAuth as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      // For optional auth, we just add user if token is provided
      if (req.headers.authorization) {
        req.user = { userId: 'test-user-id', email: 'test@example.com' };
      }
      next();
    });
    
    // Mock logger
    (logger as any) = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    
    // Mock config
    (config as any).rateLimit = {
      ingestion: { windowMs: 60000, max: 100 },
      query: { windowMs: 60000, max: 200 }
    };
    (config as any).upload = {
      maxFileSize: 10485760,
      allowedMimeTypes: ['application/json', 'text/plain']
    };

    // Generate mock token
    mockToken = jwt.sign(
      { userId: 'test-user-id', email: 'test@example.com' },
      'test-secret-key',
      { expiresIn: '1h' }
    );

    // Mount routers
    app.use('/api/auth', authRouter);
    
    // Create mock instances
    const mockMCPRegistry = {
      createMCP: jest.fn(),
      getMCP: jest.fn(),
      getAllMCPs: jest.fn(),
      removeMCP: jest.fn()
    };
    
    const mockRAG1Controller = {
      ingest: jest.fn().mockResolvedValue({ 
        recordId: 'test-record-id',
        success: true,
        mcpTarget: 'test-mcp',
        processingTime: 100
      }),
      ingestBatch: jest.fn().mockResolvedValue({ 
        success: true,
        successCount: 2,
        errorCount: 0,
        records: [],
        errors: [],
        totalProcessingTime: 200
      }),
      getMetrics: jest.fn().mockResolvedValue({ 
        totalIngested: 100,
        totalClassified: 100,
        totalRouted: 100,
        averageProcessingTime: 50,
        avgIngestionTime: 50,
        ingestionsPerSecond: 10,
        classificationAccuracy: 0.95,
        routingSuccessRate: 0.98,
        dynamicMCPsCreated: 5,
        patternsLearned: 20,
        errors: 0
      }),
      createStream: jest.fn().mockResolvedValue({
        sessionId: 'stream-session-123',
        streamUrl: 'wss://stream.example.com/session-123',
        capabilities: ['realtime', 'batch'],
        maxBatchSize: 1000
      }),
      streamData: jest.fn().mockResolvedValue({
        success: true,
        recordsProcessed: 1
      })
    };
    
    const mockRAG2Controller = {
      query: jest.fn().mockResolvedValue({ 
        success: true,
        results: [],
        totalResults: 0,
        mcpSources: [],
        processingTime: 100,
        confidence: 0.95
      }),
      queryBulk: jest.fn().mockResolvedValue([]),
      getQueryHistory: jest.fn().mockResolvedValue({ queries: [] })
    };
    
    // Mock the constructors
    (MCPRegistry as jest.MockedClass<typeof MCPRegistry>).mockImplementation(() => mockMCPRegistry as any);
    (RAG1Controller as jest.MockedClass<typeof RAG1Controller>).mockImplementation(() => mockRAG1Controller as any);
    (RAG2Controller as jest.MockedClass<typeof RAG2Controller>).mockImplementation(() => mockRAG2Controller as any);
    
    // Create controller instances
    const rag1Instance = new RAG1Controller(mockMCPRegistry as any);
    const rag2Instance = new RAG2Controller(mockMCPRegistry as any);
    
    app.use('/api/ingestion', createIngestionRoutes(rag1Instance));
    app.use('/api/query', createQueryRoutes(rag2Instance));
  });

  describe('Auth Routes', () => {
    it('should handle login request', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBeLessThan(500); // Should not have server errors
    });

    it('should handle register request', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User'
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should handle refresh token request', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'mock-refresh-token'
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should handle logout request', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Ingestion Routes', () => {
    it('should handle document ingestion', async () => {
      const response = await request(app)
        .post('/api/ingestion/single')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          data: {
            content: 'Test document content',
            metadata: { title: 'Test Doc' }
          }
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should handle stream ingestion', async () => {
      const response = await request(app)
        .post('/api/ingestion/stream')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          sessionConfig: {
            name: 'test-stream',
            bufferSize: 100
          }
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should handle bulk ingestion', async () => {
      const response = await request(app)
        .post('/api/ingestion/batch')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          records: [
            { content: 'Doc 1', metadata: { id: '1' } },
            { content: 'Doc 2', metadata: { id: '2' } }
          ]
        });

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Query Routes', () => {
    it('should handle natural language query', async () => {
      const response = await request(app)
        .post('/api/query/natural')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          query: 'Find all documents about TypeScript'
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should handle query with options', async () => {
      const response = await request(app)
        .post('/api/query/natural')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          query: 'Get recent documents',
          options: {
            limit: 10,
            includeMetadata: true
          }
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should handle query history request', async () => {
      const response = await request(app)
        .get('/api/query/history')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should require authentication for protected routes', async () => {
      // Reset mock to simulate no auth
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/query/natural')
        .send({ query: 'test' });

      expect(response.status).toBe(401);
    });
  });
});

// Specific tests for the TypeScript error lines
describe('TypeScript Error Line Tests', () => {
  describe('Auth Route Syntax', () => {
    it('should compile auth routes without syntax errors', () => {
      // This test will fail if there are syntax errors
      expect(() => require('../../src/api/routes/auth')).not.toThrow();
    });
  });

  describe('Ingestion Route Syntax', () => {
    it('should compile ingestion routes without syntax errors', () => {
      expect(() => require('../../src/api/routes/ingestion')).not.toThrow();
    });
  });

  describe('Query Route Syntax', () => {
    it('should compile query routes without syntax errors', () => {
      expect(() => require('../../src/api/routes/query')).not.toThrow();
    });
  });
});