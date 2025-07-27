/**
 * MCP Orchestrator - Main coordination system for the MCP ecosystem
 * Integrates all MCP components into a unified intelligent database system
 */

import { EventEmitter } from 'events';
import { BaseMCP, MCPType, MCPTier, MCPQuery, MCPResult, MCPMetadata } from './core/BaseMCP';
import { MCPRegistry, MCPRegistryConfig, MCPCreationRequest } from './registry/MCPRegistry';
import { TierClassifier, ClassificationResult } from './classification/TierClassifier';
import { MCPMigrationEngine, MigrationPlan } from './migration/MCPMigrationEngine';
import { MCPCommunicationHub, DistributedQuery, QueryDistributionStrategy } from './communication/MCPCommunicationHub';

export interface MCPOrchestratorConfig {
  registry: Partial<MCPRegistryConfig>;
  autoClassification: {
    enabled: boolean;
    interval: number;        // milliseconds
    minConfidence: number;   // 0-1
    minBenefit: number;      // 0-1
  };
  autoMigration: {
    enabled: boolean;
    maxConcurrent: number;
    scheduleOptimization: boolean;
  };
  communication: {
    healthCheckInterval: number;
    performanceMetricsInterval: number;
    topologyOptimizationInterval: number;
  };
  monitoring: {
    enabled: boolean;
    metricsRetention: number;  // days
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      diskUsage: number;
    };
  };
}

export interface SystemMetrics {
  totalMCPs: number;
  activeMCPs: number;
  totalDataSize: number;
  totalQueries: number;
  avgResponseTime: number;
  systemHealth: number;      // 0-1 score
  tierDistribution: Record<MCPTier, number>;
  typeDistribution: Record<MCPType, number>;
  lastUpdated: Date;
}

export interface Alert {
  id: string;
  level: AlertLevel;
  component: string;
  message: string;
  timestamp: Date;
  metadata: any;
  acknowledged: boolean;
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export class MCPOrchestrator extends EventEmitter {
  private registry: MCPRegistry;
  private classifier: TierClassifier;
  private migrationEngine: MCPMigrationEngine;
  private communicationHub: MCPCommunicationHub;
  private config: MCPOrchestratorConfig;
  private isInitialized: boolean;
  private backgroundTasks: NodeJS.Timer[];
  private systemMetrics: SystemMetrics;
  private alerts: Alert[];
  private queryCache: Map<string, { result: MCPResult; timestamp: number }>;

  constructor(config: Partial<MCPOrchestratorConfig> = {}) {
    super();
    
    this.isInitialized = false;
    this.backgroundTasks = [];
    this.alerts = [];
    this.queryCache = new Map();
    
    this.config = {
      registry: config.registry || {},
      autoClassification: {
        enabled: true,
        interval: 3600000, // 1 hour
        minConfidence: 0.7,
        minBenefit: 0.3,
        ...config.autoClassification
      },
      autoMigration: {
        enabled: true,
        maxConcurrent: 3,
        scheduleOptimization: true,
        ...config.autoMigration
      },
      communication: {
        healthCheckInterval: 60000,    // 1 minute
        performanceMetricsInterval: 30000, // 30 seconds
        topologyOptimizationInterval: 300000, // 5 minutes
        ...config.communication
      },
      monitoring: {
        enabled: true,
        metricsRetention: 30, // 30 days
        alertThresholds: {
          errorRate: 0.05,     // 5%
          responseTime: 1000,  // 1 second
          diskUsage: 0.85      // 85%
        },
        ...config.monitoring
      }
    };

    this.systemMetrics = this.getInitialMetrics();
    
    // Initialize components
    this.registry = new MCPRegistry(this.config.registry);
    this.classifier = new TierClassifier();
    this.migrationEngine = new MCPMigrationEngine(this.classifier, this.config.autoMigration.maxConcurrent);
    this.communicationHub = new MCPCommunicationHub();
    
    this.setupEventHandlers();
  }

  // System Initialization
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Orchestrator already initialized');
    }

    this.emit('initialization-started');
    
    try {
      // Register MCP factories
      await this.registerMCPFactories();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      // Initialize monitoring
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }
      
      this.isInitialized = true;
      this.emit('initialization-completed');
      
    } catch (error) {
      this.emit('initialization-failed', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.emit('shutdown-started');
    
    try {
      // Stop background tasks
      this.backgroundTasks.forEach(task => clearInterval(task));
      this.backgroundTasks = [];
      
      // Shutdown components
      await this.registry.shutdown();
      
      this.isInitialized = false;
      this.emit('shutdown-completed');
      
    } catch (error) {
      this.emit('shutdown-failed', error);
      throw error;
    }
  }

  // MCP Management
  async createMCP(request: MCPCreationRequest): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    const mcpId = await this.registry.createMCP(request);
    const mcp = await this.registry.getMCP(mcpId);
    
    if (mcp) {
      // Register with communication hub
      await this.communicationHub.registerMCP(mcp);
      
      // Register with migration engine
      this.migrationEngine.registerMCP(mcpId, mcp);
      
      this.emit('mcp-created', { mcpId, request });
    }
    
    return mcpId;
  }

  async getMCP(mcpId: string): Promise<BaseMCP | null> {
    return this.registry.getMCP(mcpId);
  }

  async getAllMCPs(): Promise<Map<string, BaseMCP>> {
    return this.registry.getAllMCPs();
  }

  async removeMCP(mcpId: string, backup: boolean = true): Promise<void> {
    // Unregister from components
    await this.communicationHub.unregisterMCP(mcpId);
    this.migrationEngine.unregisterMCP(mcpId);
    
    // Remove from registry
    await this.registry.removeMCP(mcpId, backup);
    
    this.emit('mcp-removed', { mcpId });
  }

  // Intelligent Query Processing
  async executeQuery(query: MCPQuery, options: {
    useDistribution?: boolean;
    strategy?: QueryDistributionStrategy;
    cacheResults?: boolean;
    timeout?: number;
  } = {}): Promise<MCPResult> {
    // Check cache first if enabled
    if (options.cacheResults) {
      const cached = this.getCachedResult(query);
      if (cached) {
        return cached;
      }
    }

    let result: MCPResult;
    
    if (options.useDistribution) {
      // Use distributed query processing
      const distributedResult = await this.communicationHub.executeDistributedQuery(
        query, 
        options.strategy
      );
      result = distributedResult.aggregatedResult;
    } else {
      // Route to optimal MCP
      const targetMcp = await this.selectOptimalMCP(query);
      if (!targetMcp) {
        throw new Error('No suitable MCP found for query');
      }
      
      result = await targetMcp.query(query.filters);
    }

    // Cache result if enabled
    if (options.cacheResults && result.success) {
      this.cacheResult(query, result);
    }

    this.emit('query-executed', { query, result, options });
    return result;
  }

  // Auto Classification and Migration
  async runAutoClassification(): Promise<Map<string, ClassificationResult>> {
    if (!this.config.autoClassification.enabled) {
      return new Map();
    }

    const mcps = await this.getAllMCPs();
    const classifications = new Map<string, ClassificationResult>();
    
    for (const [mcpId, mcp] of mcps) {
      try {
        const metadata = await mcp.getMetadata();
        const performance = await mcp.getMetrics();
        const accessHistory = this.getAccessHistory(mcpId);
        
        const classification = await this.classifier.classifyMCP(metadata, performance, accessHistory);
        classifications.set(mcpId, classification);
        
        // Trigger auto-migration if conditions are met
        if (this.config.autoMigration.enabled &&
            classification.confidence >= this.config.autoClassification.minConfidence &&
            classification.expectedBenefit >= this.config.autoClassification.minBenefit &&
            classification.recommendedTier !== metadata.type) {
          
          await this.migrationEngine.autoMigrate(mcpId, classification);
        }
        
      } catch (error) {
        this.createAlert(AlertLevel.ERROR, `classification-${mcpId}`, 
          `Failed to classify MCP ${mcpId}: ${error}`, { mcpId, error });
      }
    }
    
    this.emit('auto-classification-completed', classifications);
    return classifications;
  }

  // System Health and Monitoring
  async getSystemHealth(): Promise<SystemMetrics> {
    const registryStats = await this.registry.getSystemMetrics();
    const healthStatus = await this.communicationHub.performHealthCheck();
    const performanceMetrics = await this.communicationHub.collectPerformanceMetrics();
    
    // Calculate system health score
    const healthyMcps = Array.from(healthStatus.values()).filter(healthy => healthy).length;
    const healthScore = healthyMcps / Math.max(1, healthStatus.size);
    
    // Calculate average response time
    const responseTimes = Array.from(performanceMetrics.values()).map(m => m.avgQueryTime);
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
    
    this.systemMetrics = {
      totalMCPs: registryStats.total,
      activeMCPs: registryStats.healthy,
      totalDataSize: registryStats.storageUsed,
      totalQueries: this.getTotalQueryCount(),
      avgResponseTime,
      systemHealth: healthScore,
      tierDistribution: registryStats.tierDistribution,
      typeDistribution: registryStats.typeDistribution,
      lastUpdated: new Date()
    };
    
    return this.systemMetrics;
  }

  async performSystemOptimization(): Promise<void> {
    this.emit('optimization-started');
    
    try {
      // Optimize registry tiers
      await this.registry.optimizeAllTiers();
      
      // Optimize communication topology
      await this.communicationHub.optimizeTopology();
      
      // Clean up completed migrations
      // Implementation would clean up migration history
      
      // Clear old cache entries
      this.cleanupCache();
      
      this.emit('optimization-completed');
      
    } catch (error) {
      this.createAlert(AlertLevel.ERROR, 'system-optimization', 
        `System optimization failed: ${error}`, { error });
      throw error;
    }
  }

  // Alert Management
  getAlerts(level?: AlertLevel): Alert[] {
    if (level) {
      return this.alerts.filter(alert => alert.level === level);
    }
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
    }
  }

  clearAlerts(): void {
    this.alerts = [];
    this.emit('alerts-cleared');
  }

  // Configuration Management
  updateConfig(updates: Partial<MCPOrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  getConfig(): MCPOrchestratorConfig {
    return { ...this.config };
  }

  // Private helper methods
  private async registerMCPFactories(): Promise<void> {
    // Register factories for different MCP types
    // This would be implemented with actual MCP implementations
    
    // Example factory registration
    this.registry.registerFactory(MCPType.VECTOR, (config) => {
      // Return actual vector MCP implementation
      throw new Error('Vector MCP factory not implemented');
    });
    
    this.registry.registerFactory(MCPType.GRAPH, (config) => {
      // Return actual graph MCP implementation
      throw new Error('Graph MCP factory not implemented');
    });
    
    // Additional factories would be registered here
  }

  private setupEventHandlers(): void {
    // Registry events
    this.registry.on('mcp-created', (event) => {
      this.emit('mcp-created', event);
    });
    
    this.registry.on('mcp-error', (event) => {
      this.createAlert(AlertLevel.ERROR, `mcp-${event.mcpId}`, 
        `MCP error: ${event.error}`, event);
    });
    
    // Migration events
    this.migrationEngine.on('migration-completed', (event) => {
      this.emit('migration-completed', event);
    });
    
    this.migrationEngine.on('migration-failed', (event) => {
      this.createAlert(AlertLevel.ERROR, `migration-${event.plan.id}`, 
        `Migration failed: ${event.error}`, event);
    });
    
    // Communication events
    this.communicationHub.on('mcp-unregistered', (event) => {
      this.createAlert(AlertLevel.WARNING, `communication-${event.mcpId}`, 
        `MCP disconnected from communication hub`, event);
    });
  }

  private startBackgroundTasks(): void {
    // Auto-classification task
    if (this.config.autoClassification.enabled) {
      const classificationTask = setInterval(() => {
        this.runAutoClassification().catch(error => {
          this.createAlert(AlertLevel.ERROR, 'auto-classification', 
            `Auto-classification failed: ${error}`, { error });
        });
      }, this.config.autoClassification.interval);
      
      this.backgroundTasks.push(classificationTask);
    }
    
    // System optimization task
    const optimizationTask = setInterval(() => {
      this.performSystemOptimization().catch(error => {
        this.createAlert(AlertLevel.ERROR, 'system-optimization', 
          `System optimization failed: ${error}`, { error });
      });
    }, 3600000); // Every hour
    
    this.backgroundTasks.push(optimizationTask);
  }

  private startMonitoring(): void {
    // Health monitoring
    const healthTask = setInterval(async () => {
      try {
        const metrics = await this.getSystemHealth();
        
        // Check thresholds and create alerts
        if (metrics.avgResponseTime > this.config.monitoring.alertThresholds.responseTime) {
          this.createAlert(AlertLevel.WARNING, 'performance', 
            `High average response time: ${metrics.avgResponseTime}ms`, { metrics });
        }
        
        if (metrics.systemHealth < 0.8) {
          this.createAlert(AlertLevel.WARNING, 'health', 
            `Low system health score: ${metrics.systemHealth}`, { metrics });
        }
        
      } catch (error) {
        this.createAlert(AlertLevel.ERROR, 'monitoring', 
          `Health monitoring failed: ${error}`, { error });
      }
    }, this.config.communication.healthCheckInterval);
    
    this.backgroundTasks.push(healthTask);
  }

  private async selectOptimalMCP(query: MCPQuery): Promise<BaseMCP | null> {
    const mcps = await this.getAllMCPs();
    
    if (mcps.size === 0) {
      return null;
    }
    
    // Simple selection based on tier and performance
    const mcpArray = Array.from(mcps.values());
    
    // Prefer hot tier for better performance
    const hotMcps = await Promise.all(
      mcpArray.map(async mcp => ({
        mcp,
        metadata: await mcp.getMetadata(),
        performance: await mcp.getMetrics()
      }))
    );
    
    const sortedMcps = hotMcps.sort((a, b) => {
      // Sort by tier first (hot > warm > cold), then by performance
      const tierOrder: Record<MCPTier, number> = { hot: 0, warm: 1, cold: 2 };
      const tierDiff = tierOrder[a.metadata.type] - tierOrder[b.metadata.type];
      
      if (tierDiff !== 0) {
        return tierDiff;
      }
      
      return a.performance.avgReadLatency - b.performance.avgReadLatency;
    });
    
    return sortedMcps[0]?.mcp || null;
  }

  private getCachedResult(query: MCPQuery): MCPResult | null {
    const cacheKey = this.generateCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes TTL
      return { ...cached.result, fromCache: true };
    }
    
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    
    return null;
  }

  private cacheResult(query: MCPQuery, result: MCPResult): void {
    const cacheKey = this.generateCacheKey(query);
    this.queryCache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }
  }

  private generateCacheKey(query: MCPQuery): string {
    return `${query.domain}_${JSON.stringify(query.filters)}`;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const ttl = 300000; // 5 minutes
    
    for (const [key, cached] of this.queryCache) {
      if (now - cached.timestamp > ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  private getAccessHistory(mcpId: string): number[] {
    // Simplified - would return actual access history from metrics
    return new Array(24).fill(0).map(() => Math.floor(Math.random() * 100));
  }

  private getTotalQueryCount(): number {
    // Simplified - would return actual query count from metrics
    return 0;
  }

  private createAlert(level: AlertLevel, component: string, message: string, metadata: any = {}): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      component,
      message,
      timestamp: new Date(),
      metadata,
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, this.alerts.length - 1000);
    }
    
    this.emit('alert-created', alert);
  }

  private getInitialMetrics(): SystemMetrics {
    return {
      totalMCPs: 0,
      activeMCPs: 0,
      totalDataSize: 0,
      totalQueries: 0,
      avgResponseTime: 0,
      systemHealth: 1.0,
      tierDistribution: { hot: 0, warm: 0, cold: 0 },
      typeDistribution: { vector: 0, graph: 0, document: 0, temporal: 0, spatial: 0, hybrid: 0 },
      lastUpdated: new Date()
    };
  }
}

export default MCPOrchestrator;