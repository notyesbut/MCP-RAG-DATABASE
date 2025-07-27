// Enterprise Health Monitoring System for Multi-MCP Smart Database
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  metadata?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: Date;
  services: HealthCheckResult[];
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  dependencies: {
    database: HealthCheckResult;
    cache: HealthCheckResult;
    external_apis: HealthCheckResult[];
  };
}

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  services: string[];
  thresholds: {
    cpu: number;
    memory: number;
    disk: number;
    latency: number;
  };
}

export class HealthMonitor extends EventEmitter {
  private config: HealthCheckConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: Date;
  private lastHealthReport: SystemHealthReport | null = null;
  private healthHistory: HealthCheckResult[] = [];
  private maxHistorySize = 1000;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super();
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
      services: ['mcp-registry', 'rag1-controller', 'rag2-controller', 'database', 'cache'],
      thresholds: {
        cpu: 80,     // 80% CPU threshold
        memory: 85,  // 85% memory threshold
        disk: 90,    // 90% disk threshold
        latency: 1000 // 1 second latency threshold
      },
      ...config
    };
    this.startTime = new Date();
  }

  /**
   * Start continuous health monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('Health monitoring already started');
      return;
    }

    logger.info('🔍 Starting health monitoring system');
    
    // Perform initial health check
    this.performHealthCheck();

    // Schedule regular health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);

    this.emit('monitoring-started');
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('🛑 Health monitoring stopped');
      this.emit('monitoring-stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    
    try {
      // Collect all health data in parallel
      const [
        serviceChecks,
        systemMetrics,
        dependencyChecks
      ] = await Promise.all([
        this.checkServices(),
        this.getSystemMetrics(),
        this.checkDependencies()
      ]);

      // Calculate overall health status
      const overallStatus = this.calculateOverallHealth(serviceChecks, dependencyChecks);

      const healthReport: SystemHealthReport = {
        overall: overallStatus,
        uptime: Date.now() - this.startTime.getTime(),
        timestamp: new Date(),
        services: serviceChecks,
        metrics: systemMetrics,
        dependencies: dependencyChecks
      };

      // Store history
      this.lastHealthReport = healthReport;
      this.addToHistory(serviceChecks);

      // Emit health status events
      this.emit('health-check-completed', healthReport);
      
      if (overallStatus !== 'healthy') {
        this.emit('health-degraded', healthReport);
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ Health check completed in ${duration}ms - Status: ${overallStatus.toUpperCase()}`);

      return healthReport;

    } catch (error) {
      logger.error('❌ Health check failed:', error);
      const errorReport: SystemHealthReport = {
        overall: 'unhealthy',
        uptime: Date.now() - this.startTime.getTime(),
        timestamp: new Date(),
        services: [],
        metrics: { cpu: 0, memory: 0, disk: 0, network: 0 },
        dependencies: {
          database: { service: 'database', status: 'unhealthy', error: 'Health check failed', timestamp: new Date() },
          cache: { service: 'cache', status: 'unhealthy', error: 'Health check failed', timestamp: new Date() },
          external_apis: []
        }
      };

      this.emit('health-check-failed', error);
      return errorReport;
    }
  }

  /**
   * Check individual services
   */
  private async checkServices(): Promise<HealthCheckResult[]> {
    const serviceChecks = await Promise.allSettled(
      this.config.services.map(service => this.checkService(service))
    );

    return serviceChecks.map((result, index) => {
      const serviceName = this.config.services[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          service: serviceName,
          status: 'unhealthy' as const,
          error: result.reason?.message || 'Service check failed',
          timestamp: new Date()
        };
      }
    });
  }

  /**
   * Check individual service health
   */
  private async checkService(serviceName: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      switch (serviceName) {
        case 'mcp-registry':
          return await this.checkMCPRegistry();
        case 'rag1-controller':
          return await this.checkRAG1Controller();
        case 'rag2-controller':
          return await this.checkRAG2Controller();
        case 'database':
          return await this.checkDatabase();
        case 'cache':
          return await this.checkCache();
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        service: serviceName,
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Check MCP Registry health
   */
  private async checkMCPRegistry(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    // Simulate MCP Registry health check
    // In real implementation, this would check registry connectivity, MCP count, etc.
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async check
    
    const latency = Date.now() - startTime;
    const isHealthy = latency < this.config.thresholds.latency;
    
    return {
      service: 'mcp-registry',
      status: isHealthy ? 'healthy' : 'degraded',
      latency,
      metadata: {
        active_mcps: Math.floor(Math.random() * 10) + 5, // Mock data
        total_mcps: Math.floor(Math.random() * 15) + 10,
        memory_usage: Math.floor(Math.random() * 50) + 30
      },
      timestamp: new Date()
    };
  }

  /**
   * Check RAG1 Controller health
   */
  private async checkRAG1Controller(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    // Simulate RAG1 health check
    await new Promise(resolve => setTimeout(resolve, 15));
    
    const latency = Date.now() - startTime;
    const isHealthy = latency < this.config.thresholds.latency;
    
    return {
      service: 'rag1-controller',
      status: isHealthy ? 'healthy' : 'degraded',
      latency,
      metadata: {
        ingestion_rate: Math.floor(Math.random() * 1000) + 500, // requests/min
        classification_accuracy: 0.95 + Math.random() * 0.04,
        queue_size: Math.floor(Math.random() * 100)
      },
      timestamp: new Date()
    };
  }

  /**
   * Check RAG2 Controller health
   */
  private async checkRAG2Controller(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    // Simulate RAG2 health check
    await new Promise(resolve => setTimeout(resolve, 12));
    
    const latency = Date.now() - startTime;
    const isHealthy = latency < this.config.thresholds.latency;
    
    return {
      service: 'rag2-controller',
      status: isHealthy ? 'healthy' : 'degraded',
      latency,
      metadata: {
        query_rate: Math.floor(Math.random() * 500) + 200, // queries/min
        cache_hit_rate: 0.85 + Math.random() * 0.1,
        avg_response_time: Math.floor(Math.random() * 100) + 50
      },
      timestamp: new Date()
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simulate database health check
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const latency = Date.now() - startTime;
      const isHealthy = latency < this.config.thresholds.latency;
      
      return {
        service: 'database',
        status: isHealthy ? 'healthy' : 'degraded',
        latency,
        metadata: {
          connection_pool_size: Math.floor(Math.random() * 50) + 10,
          active_connections: Math.floor(Math.random() * 30) + 5,
          query_performance: Math.floor(Math.random() * 50) + 25
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Check cache (Redis) connectivity
   */
  private async checkCache(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simulate cache health check
      await new Promise(resolve => setTimeout(resolve, 8));
      
      const latency = Date.now() - startTime;
      const isHealthy = latency < this.config.thresholds.latency;
      
      return {
        service: 'cache',
        status: isHealthy ? 'healthy' : 'degraded',
        latency,
        metadata: {
          memory_usage: Math.floor(Math.random() * 70) + 20,
          hit_rate: 0.80 + Math.random() * 0.15,
          connected_clients: Math.floor(Math.random() * 20) + 5
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'cache',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Cache connection failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get system metrics (CPU, Memory, Disk, Network)
   */
  private async getSystemMetrics(): Promise<{ cpu: number; memory: number; disk: number; network: number }> {
    // Simulate system metrics collection
    // In production, use actual system monitoring libraries
    return {
      cpu: Math.floor(Math.random() * 60) + 20,     // 20-80% CPU usage
      memory: Math.floor(Math.random() * 50) + 30,  // 30-80% memory usage
      disk: Math.floor(Math.random() * 40) + 40,    // 40-80% disk usage
      network: Math.floor(Math.random() * 30) + 10  // 10-40% network usage
    };
  }

  /**
   * Check external dependencies
   */
  private async checkDependencies(): Promise<{
    database: HealthCheckResult;
    cache: HealthCheckResult;
    external_apis: HealthCheckResult[];
  }> {
    const [database, cache] = await Promise.all([
      this.checkDatabase(),
      this.checkCache()
    ]);

    // Mock external API checks
    const external_apis: HealthCheckResult[] = [
      {
        service: 'auth-service',
        status: 'healthy',
        latency: Math.floor(Math.random() * 100) + 50,
        timestamp: new Date()
      },
      {
        service: 'analytics-service',
        status: 'healthy',
        latency: Math.floor(Math.random() * 150) + 75,
        timestamp: new Date()
      }
    ];

    return { database, cache, external_apis };
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(
    services: HealthCheckResult[],
    dependencies: { database: HealthCheckResult; cache: HealthCheckResult; external_apis: HealthCheckResult[] }
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const allChecks = [
      ...services,
      dependencies.database,
      dependencies.cache,
      ...dependencies.external_apis
    ];

    const unhealthyCount = allChecks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = allChecks.filter(check => check.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Add health check results to history
   */
  private addToHistory(results: HealthCheckResult[]): void {
    this.healthHistory.push(...results);
    
    // Keep only recent history
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get current health status
   */
  public getCurrentHealth(): SystemHealthReport | null {
    return this.lastHealthReport;
  }

  /**
   * Get health history
   */
  public getHealthHistory(limit?: number): HealthCheckResult[] {
    if (limit) {
      return this.healthHistory.slice(-limit);
    }
    return [...this.healthHistory];
  }

  /**
   * Get uptime in milliseconds
   */
  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Check if system is healthy
   */
  public isHealthy(): boolean {
    return this.lastHealthReport?.overall === 'healthy';
  }

  /**
   * Get service-specific health
   */
  public getServiceHealth(serviceName: string): HealthCheckResult | null {
    if (!this.lastHealthReport) return null;
    
    return this.lastHealthReport.services.find(service => service.service === serviceName) || null;
  }

  /**
   * Force immediate health check
   */
  public async forceHealthCheck(): Promise<SystemHealthReport> {
    logger.info('🔍 Forcing immediate health check');
    return await this.performHealthCheck();
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();