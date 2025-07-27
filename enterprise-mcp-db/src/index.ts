/**
 * Enterprise Multi-MCP Smart Database System
 * 
 * Revolutionary database replacement technology that uses Multi-Modal Control Protocol (MCP)
 * for intelligent data management, real-time processing, and enterprise-scale operations.
 * 
 * @version 1.0.0
 * @author Enterprise MCP Development Team
 */

import { config } from 'dotenv';
import { SmartDatabaseCore } from '@core/SmartDatabaseCore';
import { APIServer } from '@api/APIServer';
import { SecurityManager } from '@security/SecurityManager';
import { MonitoringSystem } from '@monitoring/MonitoringSystem';
import { Logger } from '@utils/Logger';

// Load environment configuration
config();

/**
 * Main application entry point
 * Initializes and orchestrates all system components
 */
class EnterpriseMCPDatabase {
  private core: SmartDatabaseCore;
  private apiServer: APIServer;
  private security: SecurityManager;
  private monitoring: MonitoringSystem;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('EnterpriseMCPDatabase');
    this.logger.info('🚀 Initializing Enterprise Multi-MCP Smart Database System');
  }

  /**
   * Initialize all system components in proper order
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('📊 Phase 1: Security initialization');
      this.security = new SecurityManager();
      await this.security.initialize();

      this.logger.info('🧠 Phase 2: Smart database core initialization');
      this.core = new SmartDatabaseCore();
      await this.core.initialize();

      this.logger.info('🌐 Phase 3: API server initialization');
      this.apiServer = new APIServer(this.core, this.security);
      await this.apiServer.initialize();

      this.logger.info('📈 Phase 4: Monitoring system initialization');
      this.monitoring = new MonitoringSystem();
      await this.monitoring.initialize();

      this.logger.info('✅ Enterprise MCP Database System fully initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize system:', error);
      throw error;
    }
  }

  /**
   * Start the database system and all services
   */
  async start(): Promise<void> {
    try {
      await this.initialize();

      // Start core database engine
      await this.core.start();
      
      // Start API server
      await this.apiServer.start();
      
      // Start monitoring
      await this.monitoring.start();

      const port = process.env.PORT || 8080;
      this.logger.info(`🎯 Enterprise MCP Database System is running on port ${port}`);
      this.logger.info('🔗 MCP Protocol endpoints available');
      this.logger.info('📊 Monitoring dashboard available');
      this.logger.info('🛡️ Security systems active');
      
    } catch (error) {
      this.logger.error('💥 Failed to start system:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown of all system components
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Initiating graceful shutdown...');
    
    try {
      if (this.monitoring) await this.monitoring.stop();
      if (this.apiServer) await this.apiServer.stop();
      if (this.core) await this.core.stop();
      if (this.security) await this.security.cleanup();
      
      this.logger.info('✅ System shutdown completed successfully');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
    }
  }
}

// Handle process signals for graceful shutdown
const app = new EnterpriseMCPDatabase();

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
app.start().catch((error) => {
  console.error('💥 Failed to start application:', error);
  process.exit(1);
});

export default EnterpriseMCPDatabase;