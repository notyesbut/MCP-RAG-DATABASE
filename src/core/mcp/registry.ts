/**
 * MCP Registry - Central management system for all MCP instances
 * Handles lifecycle, routing, load balancing, and hot/cold classification
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMCP } from './base_mcp';
import { UserMCP } from '../specialized/user_mcp';
import { ChatMCP } from '../specialized/chat_mcp';
import { StatsMCP } from '../specialized/stats_mcp';
import { LogsMCP } from '../specialized/logs_mcp';
import { 
  MCPMetadata, 
  MCPConfig, 
  MCPQuery, 
  QueryResult, 
  HealthStatus,
  MigrationPlan,
  MCPType,
  MCPDomain, 
  MCPFactory,
  MCPInstance,
  MCPHealth,
  MCPStats,
  LogEntry
} from '../../types/mcp.types';

interface RegistryConfiguration {
  hotThreshold: number;          // Access frequency threshold for HOT classification
  coldThreshold: number;         // Access frequency threshold for COLD classification
  migrationCooldown: number;     // Minimum time between migrations (ms)
  healthCheckInterval: number;   // Health check frequency (ms)
  loadBalancingStrategy: 'round-robin' | 'weighted' | 'least-loaded' | 'random';
  autoScaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    scaleUpThreshold: number;    // CPU/memory threshold to scale up
    scaleDownThreshold: number;  // CPU/memory threshold to scale down
  };
  retention: {
    maxInactiveTime: number;     // Time before inactive MCP is archived (ms)
    compressionEnabled: boolean;
    archiveStorage: string;      // Storage location for archived MCPs
  };
}

// Extended config type for registry operations
interface MCPRegistryConfig extends MCPConfig {
  id: string;
  domain: MCPDomain;
  type: MCPType;
}

export class MCPRegistry extends EventEmitter {
  private instances: Map<string, MCPInstance> = new Map();
  private domainRouting: Map<MCPDomain, Set<string>> = new Map(); // domain -> mcpIds
  private typeRouting: Map<MCPType, Set<string>> = new Map(); // type -> mcpIds
  private loadBalancer: Map<MCPDomain, number> = new Map(); // Round-robin counter
  private migrationHistory: Map<string, MigrationPlan[]> = new Map();
  private healthMonitor: NodeJS.Timeout | null = null;
  private configuration: RegistryConfiguration;

  constructor(config?: Partial<RegistryConfiguration>) {
    super();
    
    this.configuration = {
      hotThreshold: 100,         // 100 accesses per hour
      coldThreshold: 10,         // 10 accesses per hour
      migrationCooldown: 3600000, // 1 hour
      healthCheckInterval: 30000, // 30 seconds
      loadBalancingStrategy: 'weighted',
      autoScaling: {
        enabled: true,
        minInstances: 1,
        maxInstances: 10,
        scaleUpThreshold: 0.8,   // 80% resource usage
        scaleDownThreshold: 0.3  // 30% resource usage
      },
      retention: {
        maxInactiveTime: 86400000, // 24 hours
        compressionEnabled: true,
        archiveStorage: './archive'
      },
      ...config
    };

    this.startHealthMonitoring();
    this.startAutoMigration();
  }

  // MCP Registration and Management
  async registerMCP(config: MCPRegistryConfig): Promise<string> {
    try {
      // Create MCP instance based on domain
      const mcp = await this.createMCPInstance(config);
      await mcp.initialize();

      const instance: MCPInstance = {
        id: mcp.getMetadata().id,
        metadata: mcp.getMetadata(),
        health: {
          status: 'healthy',
          lastChecked: Date.now(),
          uptime: 0,
          errorCount: 0,
          responseTime: 0
        },
        stats: {
          totalQueries: 0,
          totalWrites: 0,
          totalReads: 0,
          averageResponseTime: 0,
          throughput: 0,
          errorRate: 0,
          lastHourStats: {
            queries: 0,
            writes: 0,
            reads: 0,
            errors: 0
          }
        },
        mcp,
        // Implement BaseMCP interface methods
        type: mcp.type,
        domain: mcp.domain,
        initialize: () => mcp.initialize(),
        query: (q) => mcp.query(q),
        create: (r) => mcp.create(r),
        update: (r) => mcp.update(r),
        delete: (id) => mcp.delete(id),
        getMetrics: () => mcp.getMetrics(),
        getMetadata: () => mcp.getMetadata(),
        getCapabilities: () => mcp.getCapabilities(),
        shutdown: () => mcp.shutdown()
      } as MCPInstance;

      this.instances.set(config.id, instance);
      this.updateRouting(config.id, config.domain, config.type);

      // Set up event listeners
      this.setupMCPEventListeners(config.id, mcp);

      this.emit('mcp:registered', instance.metadata);
      return config.id;

    } catch (error) {
      this.emit('mcp:registration-failed', { config, error });
      throw error;
    }
  }

  async unregisterMCP(mcpId: string, graceful: boolean = true): Promise<boolean> {
    const instance = this.instances.get(mcpId);
    if (!instance) return false;

    try {
      if (graceful) {
        // Wait for ongoing operations to complete
        await this.drainMCP(mcpId);
      }

      await instance.mcp.shutdown();
      this.instances.delete(mcpId);
      this.removeFromRouting(mcpId, instance.metadata.domain, instance.metadata.type);

      this.emit('mcp:unregistered', instance.metadata);
      return true;

    } catch (error) {
      this.emit('mcp:unregistration-failed', { mcpId, error });
      return false;
    }
  }

  // Query Routing and Load Balancing
  async query(query: MCPQuery): Promise<QueryResult[]> {
    const targetMCPs = this.selectMCPsForQuery(query);
    if (targetMCPs.length === 0) {
      throw new Error(`No MCPs available for query: ${JSON.stringify(query)}`);
    }

    const results: QueryResult[] = [];
    const promises = targetMCPs.map(async (mcpId) => {
      try {
        const instance = this.instances.get(mcpId)!;
        const startTime = Date.now();
        
        const records = await instance.mcp.query(query.filters || {});
        
        // Update metrics
        this.updateInstanceMetrics(mcpId, Date.now() - startTime, false);
        
        // Return MCPQueryResult format
        const queryResult: QueryResult = {
          data: records,
          totalCount: records.length,
          metadata: {
            executionTime: Date.now() - startTime,
            mcpId,
            optimizationStrategy: 'standard',
            cacheHit: false,
            indexesUsed: []
          }
        };
        
        return queryResult;
      } catch (error) {
        this.updateInstanceMetrics(mcpId, 0, true);
        this.emit('query:error', { mcpId, query, error });
        throw error;
      }
    });

    try {
      const queryResults = await Promise.allSettled(promises);
      
      for (const result of queryResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Query failed:', result.reason);
        }
      }

      return results;
    } catch (error) {
      this.emit('query:batch-failed', { query, error });
      throw error;
    }
  }

  // MCP Creation Factory
  private async createMCPInstance(config: MCPRegistryConfig): Promise<BaseMCP> {
    switch (config.domain) {
      case 'user':
        return new UserMCP(config.domain, config.type, config);
      case 'chat':
        return new ChatMCP(config.domain, config.type, config);
      case 'stats':
        return new StatsMCP(config.domain, config.type, config);
      case 'logs':
        return new LogsMCP(config.domain, config.type, config);
      default:
        // Create a generic MCP for unknown domains
        throw new Error(`Unknown MCP domain: ${config.domain}`);
    }
  }

  // Query Routing Logic
  private selectMCPsForQuery(query: MCPQuery): string[] {
    const domain = query.domain;
    if (!domain) {
      // If no domain specified, query all MCPs
      return Array.from(this.instances.keys());
    }

    const domainMCPs = this.domainRouting.get(domain);
    if (!domainMCPs || domainMCPs.size === 0) {
      return [];
    }

    return this.applyLoadBalancing(Array.from(domainMCPs), domain);
  }

  private applyLoadBalancing(mcpIds: string[], domain: MCPDomain): string[] {
    switch (this.configuration.loadBalancingStrategy) {
      case 'round-robin':
        return this.roundRobinSelection(mcpIds, domain);
      case 'weighted':
        return this.weightedSelection(mcpIds);
      case 'least-loaded':
        return this.leastLoadedSelection(mcpIds);
      case 'random':
        return [mcpIds[Math.floor(Math.random() * mcpIds.length)]];
      default:
        return [mcpIds[0]];
    }
  }

  private roundRobinSelection(mcpIds: string[], domain: MCPDomain): string[] {
    const counter = this.loadBalancer.get(domain) || 0;
    const selectedIndex = counter % mcpIds.length;
    this.loadBalancer.set(domain, counter + 1);
    return [mcpIds[selectedIndex]];
  }

  private weightedSelection(mcpIds: string[]): string[] {
    // Weight by inverse of average query time and error rate
    const weights = mcpIds.map(mcpId => {
      const instance = this.instances.get(mcpId)!;
      const queryTime = Math.max(instance.averageQueryTime, 1);
      const errorRate = instance.errorCount / Math.max(instance.accessCount, 1);
      return (1 / queryTime) * (1 - errorRate);
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return [mcpIds[i]];
      }
    }

    return [mcpIds[0]];
  }

  private leastLoadedSelection(mcpIds: string[]): string[] {
    const loadMetrics = mcpIds.map(async mcpId => {
      const instance = this.instances.get(mcpId)!;
      const health = await instance.mcp.getHealth();
      return {
        mcpId,
        load: health.cpuUsage + health.memoryUsage + (instance.averageQueryTime / 1000)
      };
    });

    return Promise.all(loadMetrics).then(metrics => {
      metrics.sort((a, b) => a.load - b.load);
      return [metrics[0].mcpId];
    });
  }

  // Hot/Cold Classification and Migration
  private async classifyAndMigrate(): Promise<void> {
    const now = Date.now();
    const oneHour = 3600000;

    for (const [mcpId, instance] of this.instances) {
      const accessFrequency = instance.accessCount / ((now - instance.lastAccessed) / oneHour);
      const currentType = instance.metadata.type;
      let targetType: MCPType = currentType;

      // Determine target type based on access frequency
      if (accessFrequency >= this.configuration.hotThreshold) {
        targetType = 'hot';
      } else if (accessFrequency <= this.configuration.coldThreshold) {
        targetType = 'cold';
      }

      // Migrate if type should change
      if (targetType !== currentType) {
        await this.migrateMCP(mcpId, targetType);
      }
    }
  }

  private async migrateMCP(mcpId: string, targetType: MCPType): Promise<boolean> {
    const instance = this.instances.get(mcpId);
    if (!instance) return false;

    // Check migration cooldown
    const lastMigrations = this.migrationHistory.get(mcpId) || [];
    const lastMigration = lastMigrations[lastMigrations.length - 1];
    if (lastMigration && Date.now() - lastMigration.scheduledTime.getTime() < this.configuration.migrationCooldown) {
      return false;
    }

    try {
      const migrationPlan: MigrationPlan = {
        id: uuidv4(),
        source: mcpId,
        target: `${mcpId}-${targetType}`,
        strategy: 'copy',
        status: 'pending',
        progress: 0,
        startTime: Date.now(),
        estimatedDuration: 60000, // 1 minute estimate
        metadata: {
          targetType,
          reason: 'hot-cold-classification'
        }
      };

      // Create new configuration with target type
      const newConfig: MCPRegistryConfig = {
        ...instance.mcp.getConfiguration(),
        id: `${mcpId}-${targetType}`,
        domain: instance.metadata.domain,
        type: targetType
      };

      // Register new MCP instance
      const newMcpId = await this.registerMCP(newConfig);
      
      // Copy data from old to new MCP (simplified - would need full data migration)
      await this.copyMCPData(mcpId, newMcpId);

      // Update routing to point to new instance
      this.removeFromRouting(mcpId, instance.metadata.domain, instance.metadata.type);
      this.updateRouting(newMcpId, instance.metadata.domain, targetType);

      // Unregister old MCP
      await this.unregisterMCP(mcpId);

      // Record migration
      if (!this.migrationHistory.has(mcpId)) {
        this.migrationHistory.set(mcpId, []);
      }
      this.migrationHistory.get(mcpId)!.push(migrationPlan);

      this.emit('mcp:migrated', { from: mcpId, to: newMcpId, type: targetType });
      return true;

    } catch (error) {
      this.emit('mcp:migration-failed', { mcpId, targetType, error });
      return false;
    }
  }

  private async copyMCPData(sourceId: string, targetId: string): Promise<void> {
    // Simplified data copy - in production, this would be more sophisticated
    // involving streaming, batching, and consistency guarantees
    const sourceInstance = this.instances.get(sourceId);
    const targetInstance = this.instances.get(targetId);
    
    if (!sourceInstance || !targetInstance) {
      throw new Error('Source or target MCP not found for data copy');
    }

    // This is a placeholder - actual implementation would copy all records
    console.log(`Copying data from ${sourceId} to ${targetId}`);
  }

  // Routing Management
  private updateRouting(mcpId: string, domain: MCPDomain, type: MCPType): void {
    // Domain routing
    if (!this.domainRouting.has(domain)) {
      this.domainRouting.set(domain, new Set());
    }
    this.domainRouting.get(domain)!.add(mcpId);

    // Type routing
    if (!this.typeRouting.has(type)) {
      this.typeRouting.set(type, new Set());
    }
    this.typeRouting.get(type)!.add(mcpId);
  }

  private removeFromRouting(mcpId: string, domain: MCPDomain, type: MCPType): void {
    this.domainRouting.get(domain)?.delete(mcpId);
    this.typeRouting.get(type)?.delete(mcpId);
  }

  // Health Monitoring
  private startHealthMonitoring(): void {
    this.healthMonitor = setInterval(() => {
      this.performHealthChecks();
    }, this.configuration.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [mcpId, instance] of this.instances) {
      try {
        const health = await instance.mcp.getHealth();
        instance.isHealthy = this.evaluateHealth(health);
        
        if (!instance.isHealthy) {
          this.emit('mcp:unhealthy', { mcpId, health });
          await this.handleUnhealthyMCP(mcpId);
        }
      } catch (error) {
        instance.isHealthy = false;
        this.emit('mcp:health-check-failed', { mcpId, error });
      }
    }
  }

  private evaluateHealth(health: HealthStatus): boolean {
    // Define health criteria
    const maxCpuUsage = 90; // 90%
    const maxMemoryUsage = 90; // 90%

    return health.cpuUsage < maxCpuUsage &&
           health.memoryUsage < maxMemoryUsage;
  }

  private async handleUnhealthyMCP(mcpId: string): Promise<void> {
    const instance = this.instances.get(mcpId);
    if (!instance) return;

    // Temporarily remove from routing
    this.removeFromRouting(mcpId, instance.metadata.domain, instance.metadata.type);

    // Try to restart the MCP
    try {
      await instance.mcp.shutdown();
      await instance.mcp.initialize();
      
      instance.isHealthy = true;
      this.updateRouting(mcpId, instance.metadata.domain, instance.metadata.type);
      this.emit('mcp:recovered', { mcpId });
      
    } catch (error) {
      this.emit('mcp:recovery-failed', { mcpId, error });
      // Consider creating a replacement MCP
      await this.createReplacementMCP(mcpId);
    }
  }

  private async createReplacementMCP(failedMcpId: string): Promise<void> {
    const failedInstance = this.instances.get(failedMcpId);
    if (!failedInstance) return;

    const config = failedInstance.mcp.getConfiguration();
    const newConfig: MCPConfig = {
      ...config,
      id: `${config.id}-replacement-${Date.now()}`
    };

    try {
      await this.registerMCP(newConfig);
      this.emit('mcp:replaced', { failed: failedMcpId, replacement: newConfig.id });
    } catch (error) {
      this.emit('mcp:replacement-failed', { failedMcpId, error });
    }
  }

  // Auto-migration scheduler
  private startAutoMigration(): void {
    setInterval(() => {
      this.classifyAndMigrate();
    }, 3600000); // Every hour
  }

  // Utility Methods
  private async drainMCP(mcpId: string): Promise<void> {
    // Wait for ongoing operations to complete
    // This is a simplified implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private updateInstanceMetrics(mcpId: string, queryTime: number, isError: boolean): void {
    const instance = this.instances.get(mcpId);
    if (!instance) return;

    instance.lastAccessed = Date.now();
    instance.accessCount++;
    
    if (isError) {
      instance.errorCount++;
    } else {
      // Update average query time
      instance.averageQueryTime = (instance.averageQueryTime + queryTime) / 2;
    }
  }

  private setupMCPEventListeners(mcpId: string, mcp: BaseMCP): void {
    mcp.on('error', (error) => {
      this.emit('mcp:error', { mcpId, error });
    });

    mcp.on('health:updated', (health) => {
      this.emit('mcp:health-updated', { mcpId, health });
    });
  }

  // Public API Methods
  public getMCP(mcpId: string): BaseMCP | null {
    return this.instances.get(mcpId)?.mcp || null;
  }

  public getAllMCPs(): Map<string, BaseMCP> {
    const mcpMap = new Map<string, BaseMCP>();
    for (const [id, instance] of this.instances.entries()) {
      mcpMap.set(id, instance.mcp);
    }
    return mcpMap;
  }

  public getMCPsByDomain(domain: MCPDomain): MCPMetadata[] {
    const mcpIds = this.domainRouting.get(domain) || new Set();
    return Array.from(mcpIds)
      .map(mcpId => this.instances.get(mcpId)?.metadata)
      .filter(metadata => metadata !== undefined) as MCPMetadata[];
  }

  public getMCPsByType(type: MCPType): MCPMetadata[] {
    const mcpIds = this.typeRouting.get(type) || new Set();
    return Array.from(mcpIds)
      .map(mcpId => this.instances.get(mcpId)?.metadata)
      .filter(metadata => metadata !== undefined) as MCPMetadata[];
  }

  public getSystemMetrics(): MCPStats {
    const instances = Array.from(this.instances.values());
    const total = instances.length;
    const healthy = instances.filter(i => i.isHealthy).length;
    const hot = instances.filter(i => i.metadata.type === 'hot').length;
    const cold = instances.filter(i => i.metadata.type === 'cold').length;
    
    let totalQueries = 0;
    let totalQueryTime = 0;
    let totalErrors = 0;
    let totalMemoryUsage = 0;
    let totalCpuUsage = 0;
    let totalStorageUsed = 0;

    for (const instance of instances) {
      totalQueries += instance.accessCount;
      totalQueryTime += instance.averageQueryTime * instance.accessCount;
      totalErrors += instance.errorCount;
      const health = instance.mcp.getHealth();
      Promise.resolve(health).then(h => {
        totalMemoryUsage += h.memoryUsage;
        totalCpuUsage += h.cpuUsage;
        totalStorageUsed += h.diskUsage;
      });
    }

    return {
      total,
      healthy,
      hot,
      cold,
      avgQueryTime: totalQueries > 0 ? totalQueryTime / totalQueries : 0,
      queriesPerSecond: 0,
      ingestionsPerSecond: 0,
      cacheHitRate: 0,
      memoryUsage: totalMemoryUsage,
      cpuUsage: totalCpuUsage,
      storageUsed: totalStorageUsed,
      networkIO: { inbound: 0, outbound: 0 }
    };
  }

  public getLogs(options: { limit?: number; level?: string; }): LogEntry[] {
    return [];
  }

  public startMaintenance(id: string, operation: string, options: any): string {
    const maintenanceId = uuidv4();
    const instance = this.instances.get(id);
    if (instance) {
      instance.mcp.emit('maintenance', { id: maintenanceId, operation, options });
    }
    return maintenanceId;
  }

  public registerFactory(type: string, factory: MCPFactory): void {
    // This is a placeholder for the actual implementation
  }

  public async createMCP(options: { type: string, tier: string, config: any, tags: string[] }): Promise<string> {
    const id = uuidv4();
    const config: MCPRegistryConfig = {
      id,
      domain: options.type as MCPDomain,
      type: options.tier as MCPType,
      ...options.config
    };
    await this.registerMCP(config);
    return id;
  }

  // Lifecycle Management
  public async shutdown(): Promise<void> {
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor);
    }

    // Gracefully shutdown all MCPs
    const shutdownPromises = Array.from(this.instances.keys()).map(mcpId => 
      this.unregisterMCP(mcpId, true)
    );

    await Promise.allSettled(shutdownPromises);
    this.emit('registry:shutdown');
  }
}