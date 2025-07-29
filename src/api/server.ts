// Production-ready Express.js API Server for Enterprise Multi-MCP Smart Database System
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { v4 as uuidv4 } from 'uuid';
import 'express-async-errors';

// Internal imports
import { config } from './config/config';
import { logger } from '../utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { requestLogger } from './middleware/requestLogger';
import { healthCheck } from './middleware/healthCheck';

// Route imports  
import { createIngestionRoutes } from './routes/ingestion';
import { createQueryRoutes } from './routes/query';
import { createAdminRoutes } from './routes/admin';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';

// Core system imports
import { MCPRegistry } from '../mcp/registry/MCPRegistry';
import { RAG1Controller } from '../rag/ingest/rag1';
import { RAG2Controller } from '../rag/query/rag2';
import { UserMCP } from '../core/specialized/user_mcp';
import { ChatMCP } from '../core/specialized/chat_mcp';
import { StatsMCP } from '../core/specialized/stats_mcp';
import { LogsMCP } from '../core/specialized/logs_mcp';
import { BaseMCP } from '../core/mcp/base_mcp';
import { MCPDomain, MCPConfig, MCPConfiguration, MCPType, MCPTier } from '../types/mcp.types';

// WebSocket handler
import { setupWebSocket } from './websocket/socketHandler';

// Types
import { ApiResponse } from '../types/api.types';

class ApiServer {
    private app: Application;
    private server: Server;
    private io: SocketIOServer;
    private port: number;
    
    // Core system components
    private mcpRegistry: MCPRegistry;
    private rag1Controller: RAG1Controller;
    private rag2Controller: RAG2Controller;
    private isInitialized = false;

    constructor() {
        this.app = express();
        this.port = config.port;
        this.server = createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: config.corsOrigins,
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: config.websocket.pingTimeout,
            pingInterval: config.websocket.pingInterval
        });
        this.mcpRegistry = new MCPRegistry();
        this.rag1Controller = new RAG1Controller(this.mcpRegistry);
        this.rag2Controller = new RAG2Controller(this.mcpRegistry);
        this.initializeMiddleware();
        this.initializeSwagger();
        this.initializeErrorHandling();
        this.createHttpServer();
    }

    private initializeMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                },
            },
            crossOriginEmbedderPolicy: false,
        }));

        // CORS configuration
        this.app.use(cors({
            origin: config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        }));

        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use(...requestLogger);

        // Global rate limiting
        this.app.use(rateLimit({
            windowMs: config.rateLimit.global.windowMs,
            max: config.rateLimit.global.max,
            message: {
                success: false,
                error: 'Too many requests from this IP, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1', // Skip localhost
        }));

        // Health check middleware (before auth)
        this.app.use('/health', healthCheck);
    }

    private initializeSwagger(): void {
        const swaggerOptions = {
            definition: {
                openapi: '3.0.0',
                info: {
                    title: 'Enterprise Multi-MCP Smart Database API',
                    version: '1.0.0',
                    description: 'Production-ready intelligent database system with multi-MCP architecture and RAG intelligence',
                    contact: {
                        name: 'API Support',
                        email: 'api-support@company.com'
                    },
                    license: {
                        name: 'MIT',
                        url: 'https://opensource.org/licenses/MIT'
                    }
                },
                servers: [
                    {
                        url: `http://localhost:${this.port}`,
                        description: 'Development server'
                    },
                    {
                        url: `https://api.enterprise-mcp.com`,
                        description: 'Production server'
                    }
                ],
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT'
                        }
                    }
                },
                security: [{
                    bearerAuth: []
                }]
            },
            apis: ['./src/api/routes/*.ts', './src/api/controllers/*.ts'],
        };

        const swaggerSpec = swaggerJsdoc(swaggerOptions);
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            explorer: true,
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'Enterprise MCP API Documentation'
        }));

        // Serve swagger.json
        this.app.get('/api-docs.json', (req: Request, res: Response) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });
    }

    private initializeRoutes(): void {
        // API version prefix
        const apiV1 = '/api/v1';

        // Welcome endpoint
        this.app.get('/', (req: Request, res: Response) => {
            const response: ApiResponse = {
                success: true,
                message: 'Enterprise Multi-MCP Smart Database API - Running',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string || 'no-id',
                data: {
                    version: '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    documentation: '/api-docs',
                    healthCheck: '/health',
                    websocket: '/socket.io'
                }
            };
            res.json(response);
        });

        // Health routes (no auth required)
        this.app.use('/health', healthRoutes);

        // Authentication routes (no auth required for login/register)
        this.app.use(`${apiV1}/auth`, authRoutes);

        // Protected API routes with dependency injection
        if (this.rag1Controller && this.rag2Controller) {
            this.app.use(`${apiV1}/ingest`, authMiddleware, createIngestionRoutes(this.rag1Controller));
            this.app.use(`${apiV1}/query`, authMiddleware, createQueryRoutes(this.rag2Controller));
            this.app.use(`${apiV1}/admin`, authMiddleware, createAdminRoutes(this.mcpRegistry, this.rag1Controller, this.rag2Controller));
        } else {
            // Fallback routes if controllers not initialized
            this.app.use(`${apiV1}/ingest`, authMiddleware, (req: Request, res: Response) => {
                res.status(503).json({
                    error: 'Service temporarily unavailable',
                    message: 'RAG₁ Controller not initialized'
                });
            });
            this.app.use(`${apiV1}/query`, authMiddleware, (req: Request, res: Response) => {
                res.status(503).json({
                    error: 'Service temporarily unavailable', 
                    message: 'RAG₂ Controller not initialized'
                });
            });
        }

        // 404 handler for API routes
        this.app.use('/api', (req: Request, res: Response) => {
            const response: ApiResponse = {
                success: false,
                error: 'API endpoint not found',
                message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string || 'no-id'
            };
            res.status(404).json(response);
        });
    }

    private initializeErrorHandling(): void {
        // Global error handler (must be last middleware)
        this.app.use(errorHandler);
    }

    private createHttpServer(): void {
        // Setup WebSocket handlers
        setupWebSocket(this.io);
    }

    /**
     * Initialize all core systems (RAG₁, RAG₂, MCP Registry)
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn('API Server already initialized');
            return;
        }

        try {
            logger.info('🔄 Initializing Enterprise Multi-MCP Smart Database System...');
            
            // Step 1: Initialize MCP Registry
            logger.info('📋 Initializing MCP Registry...');

            // Step 2: Register MCP factories for specialized MCPs
            logger.info('🏭 Registering specialized MCP factories...');
            this.registerMCPFactories();
            
            // Step 3: Create initial specialized MCPs
            logger.info('🗂️ Creating initial specialized MCPs...');
            await this.createInitialMCPs();

            // Step 4: Initialize RAG₁ Controller
            logger.info('🧠 Initializing RAG₁ Intelligent Ingestion Controller...');
            await this.rag1Controller.initialize();

            // Step 5: Initialize RAG₂ Controller  
            logger.info('🔍 Initializing RAG₂ Natural Language Query Controller...');

            // Step 6: Initialize routes with controllers
            logger.info('🛣️ Initializing API routes with RAG controllers...');
            this.initializeRoutes();

            this.isInitialized = true;
            logger.info('✅ Enterprise Multi-MCP Smart Database System initialized successfully!');
            
        } catch (error) {
            logger.error('❌ Failed to initialize core systems:', error);
            throw error;
        }
    }

    /**
     * Register MCP factories for different types
     */
    private registerMCPFactories(): void {
        // Register UserMCP factory
        this.mcpRegistry.registerMCPFactory(MCPType.USER, (metadata: any, config: any) => {
            // UserMCP expects hot/cold type from mcp.types
            const mcpConfig = config as MCPConfiguration;
            const temperatureType = metadata.tier === 'hot' ? MCPType.HOT : MCPType.COLD;
            const userMCP = new UserMCP('user' as MCPDomain, temperatureType, mcpConfig);
            return this.createMCPAdapter(userMCP, MCPType.USER, metadata);
        });

        // Register ChatMCP factory
        this.mcpRegistry.registerMCPFactory(MCPType.CHAT, (metadata: any, config: any) => {
            // ChatMCP expects hot/cold type from mcp.types
            const mcpConfig = config as MCPConfiguration;
            const temperatureType = metadata.tier === 'hot' ? MCPType.HOT : MCPType.COLD;
            const chatMCP = new ChatMCP('chat' as MCPDomain, temperatureType, mcpConfig);
            return this.createMCPAdapter(chatMCP, MCPType.CHAT, metadata);
        });

        // Register StatsMCP factory
        this.mcpRegistry.registerMCPFactory(MCPType.STATS, (metadata: any, config: any) => {
            // StatsMCP expects hot/cold type from mcp.types
            const mcpConfig = config as MCPConfiguration;
            const temperatureType = metadata.tier === 'warm' ? MCPType.COLD : MCPType.HOT;
            const statsMCP = new StatsMCP('analytics' as MCPDomain, temperatureType, mcpConfig);
            return this.createMCPAdapter(statsMCP, MCPType.STATS, metadata);
        });

        // Register LogsMCP factory
        this.mcpRegistry.registerMCPFactory(MCPType.LOGS, (metadata: any, config: any) => {
            // ChatMCP expects hot/cold type from mcp.types
            const mcpConfig = config as MCPConfiguration;
            const temperatureType = metadata.tier === 'cold' ? MCPType.COLD : MCPType.HOT;
            const logsMCP = new LogsMCP('analytics' as MCPDomain, temperatureType, mcpConfig);
            return this.createMCPAdapter(logsMCP, MCPType.LOGS, metadata);
        });

        logger.info('✅ All MCP factories registered successfully');
    }

    /**
     * Create adapter to bridge specialized MCPs with MCPRegistry expectations
     */
    private createMCPAdapter(specializedMCP: any, type: MCPType, metadata: Partial<any>): BaseMCP {
        // Create a wrapper that implements the BaseMCP interface expected by MCPRegistry
        const adapter = Object.create(specializedMCP);
        
        // Add missing methods that MCPRegistry's BaseMCP expects
        adapter.insert = async (data: any[], options?: any) => {
            // Convert to DataRecord format expected by specialized MCP
            for (const item of data) {
                await specializedMCP.store({
                    id: item.id || uuidv4(),
                    data: item,
                    domain: specializedMCP.domain,
                    type: type.toString(),
                    timestamp: Date.now(),
                    metadata: options
                });
            }
            return {
                success: true,
                data: data,
                executionTime: 0,
                fromCache: false,
                mcpId: specializedMCP.metadata.id
            };
        };

        // Map query method
        adapter.query = async (query: any) => {
            const result = await specializedMCP.query(query.filters || query);
            return {
                success: true,
                data: result,
                executionTime: 0,
                fromCache: false,
                mcpId: specializedMCP.metadata.id
            };
        };

        // Map update method
        adapter.update = async (id: string, data: any, options?: any) => {
            await specializedMCP.update({ id, data, ...options });
            return {
                success: true,
                data: [data],
                executionTime: 0,
                fromCache: false,
                mcpId: specializedMCP.metadata.id
            };
        };

        // Map delete method
        adapter.delete = async (id: string, options?: any) => {
            await specializedMCP.delete(id);
            return {
                success: true,
                data: [],
                executionTime: 0,
                fromCache: false,
                mcpId: specializedMCP.metadata.id
            };
        };

        // Add createIndex if not present
        adapter.createIndex = async (definition: any) => {
            return {
                success: true,
                data: [],
                executionTime: 0,
                fromCache: false,
                mcpId: specializedMCP.metadata.id
            };
        };

        // Ensure metadata compatibility
        adapter.getMetadata = async () => {
            const meta = await specializedMCP.getMetadata();
            return {
                ...meta,
                type: type,
                tier: 'warm' as const,
                created: new Date(meta.createdAt || Date.now()),
                lastAccessed: new Date(meta.lastAccessed || Date.now()),
                performance: {
                    avgQueryTime: meta.metrics?.averageResponseTime || 0,
                    throughput: meta.metrics?.queryThroughput || 0,
                    cacheHitRatio: meta.metrics?.cacheHitRatio || 0,
                    errorRate: meta.metrics?.errorRate || 0,
                    cpuUsage: meta.metrics?.cpuUtilization || 0,
                    memoryUsage: meta.metrics?.memoryUtilization || 0
                }
            };
        };

        return adapter as BaseMCP;
    }

    /**
     * Create initial specialized MCPs
     */
    private async createInitialMCPs(): Promise<void> {
        try {
            // Create User MCP (HOT tier for frequent access)
            await this.mcpRegistry.createMCP({
                name: 'user-mcp',
                domain: 'user',
                type: MCPType.USER,
                tier: MCPTier.HOT,
                config: {
                    maxRecords: 1000000,
                    maxSize: 100 * 1024 * 1024 * 1024, // 100GB
                    cacheSize: 512, // 512MB cache
                    connectionPoolSize: 100,
                    queryTimeout: 30000,
                    backupFrequency: 24,
                    compressionEnabled: false,
                    encryptionEnabled: true,
                    autoIndexing: true,
                    replicationFactor: 2,
                    consistencyLevel: 'strong' as const,
                    customProperties: {}
                },
                tags: ['user', 'authentication', 'profiles', 'hot']
            });

            // Create Chat MCP (HOT tier for real-time messaging)
            await this.mcpRegistry.createMCP({
                name: 'chat-mcp',
                domain: 'chat',
                type: MCPType.CHAT,
                tier: MCPTier.HOT,
                config: {
                    maxRecords: 1000000,
                    maxSize: 50 * 1024 * 1024 * 1024, // 50GB
                    cacheSize: 256,
                    connectionPoolSize: 200,
                    queryTimeout: 30000,
                    backupFrequency: 12,
                    compressionEnabled: true,
                    encryptionEnabled: false,
                    autoIndexing: true,
                    replicationFactor: 1,
                    consistencyLevel: 'eventual' as const,
                    customProperties: {}
                },
                tags: ['chat', 'messages', 'realtime', 'hot']
            });

            // Create Stats MCP (WARM tier for analytics)
            await this.mcpRegistry.createMCP({
                name: 'stats-mcp',
                domain: 'analytics',
                type: MCPType.STATS,
                tier: MCPTier.WARM,
                config: {
                    maxRecords: 5000000,
                    maxSize: 200 * 1024 * 1024 * 1024, // 200GB
                    cacheSize: 128,
                    connectionPoolSize: 50,
                    queryTimeout: 60000,
                    backupFrequency: 24,
                    compressionEnabled: true,
                    encryptionEnabled: false,
                    autoIndexing: true,
                    replicationFactor: 1,
                    consistencyLevel: 'eventual' as const,
                    customProperties: {}
                },
                tags: ['analytics', 'metrics', 'stats', 'warm']
            });

            // Create Logs MCP (COLD tier for archival)
            await this.mcpRegistry.createMCP({
                name: 'logs-mcp',
                domain: 'logs',
                type: MCPType.LOGS,
                tier: MCPTier.COLD,
                config: {
                    maxRecords: 10000000,
                    maxSize: 1000 * 1024 * 1024 * 1024, // 1TB
                    cacheSize: 64,
                    connectionPoolSize: 25,
                    queryTimeout: 120000,
                    backupFrequency: 168, // weekly
                    compressionEnabled: true,
                    encryptionEnabled: true,
                    autoIndexing: false,
                    replicationFactor: 1,
                    consistencyLevel: 'weak' as const,
                    customProperties: {}
                },
                tags: ['logs', 'audit', 'archive', 'cold']
            });

            logger.info(`✅ Created initial MCPs`);
                
        } catch (error) {
            logger.error('❌ Failed to create initial MCPs:', error);
            throw error;
        }
    }

    public async start(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // Initialize core systems first
                if (!this.isInitialized) {
                    await this.initialize();
                }

                this.server.listen(this.port, config.host, () => {
                    logger.info(`🚀 Enterprise Multi-MCP API Server started`);
                    logger.info(`📍 Server running on http://${config.host}:${this.port}`);
                    logger.info(`📚 API Documentation: http://${config.host}:${this.port}/api-docs`);
                    logger.info(`💓 Health Check: http://${config.host}:${this.port}/health`);
                    logger.info(`🔌 WebSocket: ws://${config.host}:${this.port}/socket.io`);
                    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
                    logger.info(`🧠 RAG₁ Intelligent Ingestion: ACTIVE`);
                    logger.info(`🔍 RAG₂ Natural Language Queries: ACTIVE`);
                    logger.info(`🗂️ Multi-MCP Registry: ${this.mcpRegistry ? 'ACTIVE' : 'INACTIVE'}`);
                    resolve();
                });

                // Handle server errors
                this.server.on('error', (error: Error) => {
                    logger.error('Server error:', error);
                    reject(error);
                });

                // Graceful shutdown handlers
                process.on('SIGTERM', this.gracefulShutdown.bind(this));
                process.on('SIGINT', this.gracefulShutdown.bind(this));
                process.on('uncaughtException', (error) => {
                    logger.error('Uncaught Exception:', error);
                    this.gracefulShutdown();
                });
                process.on('unhandledRejection', (reason, promise) => {
                    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
                    this.gracefulShutdown();
                });

            } catch (error) {
                logger.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger.info('Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private async gracefulShutdown(): Promise<void> {
        logger.info('Received shutdown signal, closing server gracefully...');

        try {
            // Shutdown core systems
            if (this.rag1Controller) {
                logger.info('🔄 Shutting down RAG₁ Controller...');
                await this.rag1Controller.shutdown();
            }

            if (this.mcpRegistry) {
                logger.info('🔄 Shutting down MCP Registry...');
                await this.mcpRegistry.shutdown();
            }

            // Close WebSocket connections
            this.io.close(() => {
                logger.info('WebSocket server closed');
            });

            // Close HTTP server
            this.server.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });

        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        }

        // Force shutdown after 30 seconds
        setTimeout(() => {
            logger.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 30000);
    }

    public getApp(): Application {
        return this.app;
    }

    public getServer() {
        return this.server;
    }

    public getIO(): SocketIOServer {
        return this.io;
    }
}

// Export server instance
export const apiServer = new ApiServer();

// Start server if this file is run directly
if (require.main === module) {
    apiServer.start().catch((error) => {
        logger.error('Failed to start API server:', error);
        process.exit(1);
    });
}
