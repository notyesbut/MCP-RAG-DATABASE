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
import { HotMCP } from './hot_mcp';
import { ColdMCP } from './cold_mcp';
import { 
  MCPMetadata, 
  MCPConfig, 
  MCPQuery, 
  QueryResult, 
  HealthStatus,
  MigrationPlan,
  MCPTypeString,
  MCPType,
  MCPDomain, 
  MCPFactory,
  MCPInstance,
  MCPHealth,
  MCPStats,
  LogEntry,
  MCPRegistryConfig
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

export class MCPRegistry extends EventEmitter {
  private instances: Map<string, MCPInstance> = new Map();
  private domainRouting: Map<MCPDomain, Set<string>> = new Map(); // domain -> mcpIds
  private typeRouting: Map<MCPTypeString, Set<string>> = new Map(); // type -> mcpIds
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
          errorCount: 0,
          responseTime: 0,
          successRate: 100,
          details: {
            database: true,
            network: true,
            memory: true,
            cpu: true
          },
          cpuUsage: 0
        },
        stats: {
          totalOperations: 0,
          totalRecords: 0,
          successfulOperations: 0,
          failedOperations: 0,
          averageResponseTime: 0,
          throughput: 0,
          activeConnections: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          diskUsage: 0,
          networkIO: {
            bytesIn: 0,
            bytesOut: 0
          }
        },
        mcp,
        // Implement BaseMCP interface methods  
        get type() { return mcp.getMetadata().type; },
        domain: mcp.domain,
        initialize: () => mcp.initialize(),
        store: (r) => mcp.store(r),
        retrieve: (id) => mcp.retrieve(id),
        query: (q) => mcp.query(q),
        create: (r) => mcp.create(r),
        update: (r) => mcp.update(r),
        delete: (id) => mcp.delete(id),
        getHealth: () => mcp.getHealth(),
        getMetrics: () => mcp.getMetrics(),
        getLogs: async (options) => mcp.getLogs(options),
        getConfiguration: () => mcp.getConfiguration(),
        getMetadata: () => mcp.getMetadata(),
        getCapabilities: () => mcp.getCapabilities(),
        shutdown: () => mcp.shutdown(),
        // Additional MCPInstance properties
        averageQueryTime: 0,
        errorCount: 0,
        accessCount: 0,
        lastAccessed: Date.now()
      };

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

      if (instance.mcp) {
        await instance.mcp.shutdown();
      }
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
    const targetMCPs = await this.selectMCPsForQuery(query);
    if (targetMCPs.length === 0) {
      throw new Error(`No MCPs available for query: ${JSON.stringify(query)}`);
    }

    const results: QueryResult[] = [];
    const promises = targetMCPs.map(async (mcpId) => {
      try {
        const instance = this.instances.get(mcpId)!;
        const startTime = Date.now();
        
        const records = instance.mcp ? await instance.mcp.query(query.filters || {}) : [];
        
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
            indexesUsed: [],
            resourceUsage: {
              cpu: 0,
              memory: 0,
              io: 0
            }
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
    // First, determine if we should create a HOT or COLD tier MCP based on type
    if (config.type === 'hot') {
      return new HotMCP(config.domain, MCPType.HOT, config);
    } else if (config.type === 'cold') {
      return new ColdMCP(config.domain, MCPType.COLD, config);
    }
    
    // Then create domain-specific MCPs with intelligent hot/cold classification
    switch (config.domain) {
      case 'user':
        // User data is typically hot (frequently accessed)
        const userType = config.type === 'cold' ? MCPType.COLD : MCPType.HOT;
        return new UserMCP(config.domain, userType, config);
      case 'chat':
        // Chat data is typically hot (real-time access)
        const chatType = config.type === 'cold' ? MCPType.COLD : MCPType.HOT;
        return new ChatMCP(config.domain, chatType, config);
      case 'stats':
        // Stats can be hot or cold depending on usage
        const statsType = this.determineOptimalType(config, 'stats');
        return new StatsMCP(config.domain, statsType, config);
      case 'logs':
        // Logs are typically cold (archival access)
        const logsType = config.type === 'hot' ? MCPType.HOT : MCPType.COLD;
        return new LogsMCP(config.domain, logsType, config);
      default:
        // Create a generic MCP for unknown domains, defaulting to COLD for cost efficiency
        const genericType = config.type === 'hot' ? MCPType.HOT : MCPType.COLD;
        if (genericType === MCPType.HOT) {
          return new HotMCP(config.domain, MCPType.HOT, config);
        } else {
          return new ColdMCP(config.domain, MCPType.COLD, config);
        }
    }
  }

  // Intelligent type determination based on access patterns and configuration
  private determineOptimalType(config: MCPRegistryConfig, domain: string): MCPType {
    // Check if type is explicitly specified
    if (config.type === 'hot') return MCPType.HOT;
    if (config.type === 'cold') return MCPType.COLD;
    
    // Intelligent defaults based on domain characteristics
    switch (domain) {
      case 'user':
      case 'chat':
        return MCPType.HOT; // Frequently accessed
      case 'logs':
        return MCPType.COLD; // Archival access
      case 'stats':
        // Stats can be either - check configuration hints
        if (config.maxRecords && config.maxRecords < 10000) {
          return MCPType.HOT; // Small datasets are likely frequently accessed
        }
        return MCPType.COLD; // Large datasets default to cold
      default:
        return MCPType.COLD; // Conservative default
    }
  }

  // Query Routing Logic
  private async selectMCPsForQuery(query: MCPQuery): Promise<string[]> {
    const domain = query.domain;
    if (!domain) {
      // If no domain specified, query all MCPs
      return Array.from(this.instances.keys());
    }

    const domainMCPs = this.domainRouting.get(domain);
    if (!domainMCPs || domainMCPs.size === 0) {
      return [];
    }

    return await this.applyLoadBalancing(Array.from(domainMCPs), domain);
  }

  private async applyLoadBalancing(mcpIds: string[], domain: MCPDomain): Promise<string[]> {
    switch (this.configuration.loadBalancingStrategy) {
      case 'round-robin':
        return this.roundRobinSelection(mcpIds, domain);
      case 'weighted':
        return this.weightedSelection(mcpIds);
      case 'least-loaded':
        return await this.leastLoadedSelection(mcpIds);
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
      const queryTime = Math.max(instance.averageQueryTime || 1, 1);
      const errorRate = (instance.errorCount || 0) / Math.max(instance.accessCount || 1, 1);
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

  private async leastLoadedSelection(mcpIds: string[]): Promise<string[]> {
    const loadMetrics = mcpIds.map(async mcpId => {
      const instance = this.instances.get(mcpId)!;
      if (!instance.mcp) return { mcpId, load: Infinity };
      const health = await instance.mcp.getHealth();
      return {
        mcpId,
        load: health.cpuUsage + health.memoryUsage + ((instance.averageQueryTime || 0) / 1000)
      };
    });

    const resolvedMetrics = await Promise.all(loadMetrics);
    resolvedMetrics.sort((a, b) => a.load - b.load);
    return [resolvedMetrics[0].mcpId];
  }

  // Hot/Cold Classification and Migration with Enhanced Intelligence
  private async classifyAndMigrate(): Promise<void> {
    const now = Date.now();
    const oneHour = 3600000;
    const migrationCandidates: Array<{mcpId: string, currentType: MCPTypeString, targetType: MCPTypeString, score: number}> = [];

    for (const [mcpId, instance] of this.instances) {
      const timeSinceLastAccess = now - (instance.lastAccessed || now);
      const accessFrequency = (instance.accessCount || 0) / Math.max((timeSinceLastAccess / oneHour), 1);
      const currentType = instance.metadata.type;
      
      // Calculate classification score using multiple factors
      const classificationScore = this.calculateClassificationScore(instance, accessFrequency, timeSinceLastAccess);
      let targetType: MCPTypeString = currentType;

      // Enhanced classification logic with thresholds and domain intelligence
      if (classificationScore.hotScore > this.configuration.hotThreshold && currentType !== 'hot') {
        targetType = 'hot';
      } else if (classificationScore.coldScore > this.configuration.coldThreshold && currentType !== 'cold') {
        targetType = 'cold';
      }

      // Add to migration candidates if type should change
      if (targetType !== currentType) {
        migrationCandidates.push({
          mcpId,
          currentType,
          targetType,
          score: targetType === 'hot' ? classificationScore.hotScore : classificationScore.coldScore
        });
      }
    }

    // Sort candidates by score and migrate top candidates first
    migrationCandidates.sort((a, b) => b.score - a.score);
    
    // Limit concurrent migrations to prevent system overload
    const maxConcurrentMigrations = 3;
    const migrationsToPerform = migrationCandidates.slice(0, maxConcurrentMigrations);

    // Perform migrations
    for (const candidate of migrationsToPerform) {
      await this.migrateMCP(candidate.mcpId, candidate.targetType);
    }

    // Emit classification analysis results
    this.emit('classification_analysis', {
      totalInstances: this.instances.size,
      migrationCandidates: migrationCandidates.length,
      migrationsPerformed: migrationsToPerform.length,
      timestamp: now
    });
  }

  // Calculate sophisticated classification score based on multiple factors
  private calculateClassificationScore(instance: MCPInstance, accessFrequency: number, timeSinceLastAccess: number): {hotScore: number, coldScore: number} {
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    
    // Base scores from access frequency
    let hotScore = Math.min(accessFrequency / this.configuration.hotThreshold, 2.0);
    let coldScore = Math.max(2.0 - (accessFrequency / this.configuration.coldThreshold), 0);

    // Factor in recency of access
    const recencyFactor = Math.max(0, 1 - (timeSinceLastAccess / oneWeek));
    hotScore *= (0.5 + 0.5 * recencyFactor); // Recent access boosts hot score
    coldScore *= (0.5 + 0.5 * (1 - recencyFactor)); // Old access boosts cold score

    // Factor in data size (larger datasets lean towards cold)
    const recordCount = instance.stats.totalRecords || 0;
    if (recordCount > 50000) {
      coldScore *= 1.3;
      hotScore *= 0.8;
    } else if (recordCount < 5000) {
      hotScore *= 1.2;
      coldScore *= 0.9;
    }

    // Factor in domain characteristics
    const domain = instance.metadata.domain;
    switch (domain) {
      case 'user':
      case 'chat':
        hotScore *= 1.2; // These domains prefer hot storage
        break;
      case 'logs':
        coldScore *= 1.3; // Logs prefer cold storage
        break;
      case 'stats':
        // Stats depend on access patterns
        if (accessFrequency > 10) {
          hotScore *= 1.1;
        } else {
          coldScore *= 1.1;
        }
        break;
    }

    // Factor in error rates (unhealthy instances might benefit from migration)
    const errorRate = instance.health.errorCount / Math.max(instance.stats.totalOperations, 1);
    if (errorRate > 0.05) { // 5% error rate
      // Prefer migration to potentially more suitable tier
      if (instance.metadata.type === 'hot') {
        coldScore *= 1.2;
      } else {
        hotScore *= 1.2;
      }
    }

    return {
      hotScore: Math.max(0, hotScore),
      coldScore: Math.max(0, coldScore)
    };
  }

  private async migrateMCP(mcpId: string, targetType: MCPTypeString): Promise<boolean> {
    const instance = this.instances.get(mcpId);
    if (!instance) return false;

    // Check migration cooldown
    const lastMigrations = this.migrationHistory.get(mcpId) || [];
    const lastMigration = lastMigrations[lastMigrations.length - 1];
    if (lastMigration && lastMigration.scheduledTime && Date.now() - lastMigration.scheduledTime < this.configuration.migrationCooldown) {
      return false;
    }

    try {
      const migrationPlan: MigrationPlan = {
        id: uuidv4(),
        source: mcpId,
        target: `${mcpId}-${targetType}`,
        recordCount: instance.stats.totalRecords || 0,
        estimatedDuration: 60000, // 1 minute estimate
        strategy: 'copy',
        steps: [],
        priority: 'medium',
        status: 'pending',
        progress: 0,
        startTime: Date.now(),
        metadata: {
          targetType,
          reason: 'hot-cold-classification'
        }
      };

      // Create new configuration with target type
      const newConfig: MCPRegistryConfig = {
        ...(instance.mcp ? instance.mcp.getConfiguration() : {}),
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

  // Enhanced data migration with real data movement, validation, and rollback capability
  private async copyMCPData(sourceId: string, targetId: string): Promise<void> {
    const sourceInstance = this.instances.get(sourceId);
    const targetInstance = this.instances.get(targetId);
    
    if (!sourceInstance || !targetInstance || !sourceInstance.mcp || !targetInstance.mcp) {
      throw new Error('Source or target MCP not found for data copy');
    }

    let copiedRecords = 0;
    let totalRecords = 0;
    const batchSize = 100;
    const copiedRecordIds: string[] = [];

    try {
      this.emit('data_migration_started', {
        sourceId,
        targetId,
        timestamp: Date.now()
      });

      // Get all records from source MCP
      const allRecords = await sourceInstance.mcp.prepareForMigration();
      totalRecords = allRecords.length;

      // Copy records in batches for efficiency and memory management
      for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            // Adapt record for target MCP type
            const adaptedRecord = this.adaptRecordForTarget(record, targetInstance.metadata.type);
            
            // Store in target MCP
            const success = await targetInstance.mcp.store(adaptedRecord);
            
            if (success) {
              copiedRecords++;
              copiedRecordIds.push(record.id);
              
              // Update progress
              if (copiedRecords % 50 === 0) {
                this.emit('data_migration_progress', {
                  sourceId,
                  targetId,
                  progress: copiedRecords / totalRecords,
                  copiedRecords,
                  totalRecords
                });
              }
            } else {
              throw new Error(`Failed to store record ${record.id} in target MCP`);
            }
          } catch (recordError) {
            // Log individual record failure but continue
            this.emit('data_migration_record_failed', {
              sourceId,
              targetId,
              recordId: record.id,
              error: recordError,
              progress: copiedRecords / totalRecords
            });
          }
        }

        // Small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Validate data integrity
      await this.validateDataMigration(sourceInstance.mcp, targetInstance.mcp, copiedRecordIds);

      this.emit('data_migration_completed', {
        sourceId,
        targetId,
        copiedRecords,
        totalRecords,
        successRate: copiedRecords / totalRecords,
        timestamp: Date.now()
      });

    } catch (error) {
      // Attempt rollback on failure
      await this.rollbackDataMigration(targetInstance.mcp, copiedRecordIds);
      
      this.emit('data_migration_failed', {
        sourceId,
        targetId,
        copiedRecords,
        totalRecords,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  // Adapt record properties based on target MCP type (HOT vs COLD)
  private adaptRecordForTarget(record: any, targetType: MCPTypeString): any {
    const adaptedRecord = { ...record };
    
    if (!adaptedRecord.metadata) {
      adaptedRecord.metadata = {};
    }

    // Add migration metadata
    adaptedRecord.metadata.migrationInfo = {
      migratedAt: Date.now(),
      migratedTo: targetType,
      migrationReason: 'hot-cold-classification'
    };

    // Adapt based on target type
    if (targetType === 'hot') {
      // Optimize for hot access patterns
      adaptedRecord.metadata.optimizedForHot = true;
      adaptedRecord.metadata.cacheable = true;
      adaptedRecord.metadata.indexPriority = 'high';
    } else if (targetType === 'cold') {
      // Optimize for cold storage
      adaptedRecord.metadata.optimizedForCold = true;
      adaptedRecord.metadata.compressionEligible = true;
      adaptedRecord.metadata.archiveCandidate = true;
    }

    return adaptedRecord;
  }

  // Validate that migration was successful by spot-checking data integrity
  private async validateDataMigration(sourceMCP: any, targetMCP: any, recordIds: string[]): Promise<void> {
    const sampleSize = Math.min(10, Math.floor(recordIds.length * 0.1)); // Check 10% or max 10 records
    const sampleIds = recordIds.slice(0, sampleSize);
    
    for (const recordId of sampleIds) {
      const sourceRecord = await sourceMCP.retrieve(recordId);
      const targetRecord = await targetMCP.retrieve(recordId);
      
      if (!targetRecord) {
        throw new Error(`Migration validation failed: Record ${recordId} not found in target MCP`);
      }
      
      // Basic integrity check (compare core data)
      if (sourceRecord && sourceRecord.data && targetRecord.data) {
        const sourceDataKey = JSON.stringify(sourceRecord.data).slice(0, 100);
        const targetDataKey = JSON.stringify(targetRecord.data).slice(0, 100);
        
        if (sourceDataKey !== targetDataKey) {
          throw new Error(`Migration validation failed: Data mismatch for record ${recordId}`);
        }
      }
    }
  }

  // Rollback migration by removing copied records from target
  private async rollbackDataMigration(targetMCP: any, copiedRecordIds: string[]): Promise<void> {
    let rolledBackCount = 0;
    
    for (const recordId of copiedRecordIds) {
      try {
        await targetMCP.delete(recordId);
        rolledBackCount++;
      } catch (error) {
        // Log rollback failures but continue
        this.emit('rollback_record_failed', {
          recordId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    this.emit('data_migration_rolled_back', {
      totalRecords: copiedRecordIds.length,
      rolledBackRecords: rolledBackCount,
      timestamp: Date.now()
    });
  }

  // Routing Management
  private updateRouting(mcpId: string, domain: MCPDomain, type: MCPTypeString): void {
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

  private removeFromRouting(mcpId: string, domain: MCPDomain, type: MCPTypeString): void {
    this.domainRouting.get(domain)?.delete(mcpId);
    this.typeRouting.get(type)?.delete(mcpId);
  }

  // Enhanced Health Monitoring with Predictive Analysis and Auto-Recovery
  private startHealthMonitoring(): void {
    this.healthMonitor = setInterval(() => {
      this.performHealthChecks();
    }, this.configuration.healthCheckInterval);

    // Start predictive health monitoring
    setInterval(() => {
      this.performPredictiveHealthAnalysis();
    }, this.configuration.healthCheckInterval * 5); // Every 5 health check cycles
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.instances.entries()).map(async ([mcpId, instance]) => {
      try {
        if (instance.mcp) {
          const health = await instance.mcp.getHealth();
          const metrics = await instance.mcp.getMetrics();
          
          // Comprehensive health evaluation
          const healthScore = this.calculateHealthScore(health, metrics, instance);
          const healthStatus = this.determineHealthStatus(healthScore);
          
          const previousStatus = instance.health.status;
          instance.health = {
            ...instance.health,
            status: healthStatus,
            lastChecked: Date.now(),
            responseTime: Date.now() - Date.now(), // Simplified for now
            errorCount: instance.errorCount || 0,
            successRate: this.calculateSuccessRate(instance),
            details: {
              database: healthScore.databaseHealth > 0.8,
              network: healthScore.networkHealth > 0.8,
              memory: health.memoryUsage < 90,
              cpu: health.cpuUsage < 90
            },
            cpuUsage: health.cpuUsage
          };

          // Detect health status changes
          if (previousStatus !== healthStatus) {
            this.emit('mcp:health-changed', {
              mcpId,
              previousStatus,
              newStatus: healthStatus,
              healthScore,
              timestamp: Date.now()
            });
          }
          
          // Handle unhealthy instances
          if (healthStatus !== 'healthy') {
            await this.handleUnhealthyMCP(mcpId, healthScore);
          }
        }
      } catch (error) {
        instance.health.status = 'unreachable';
        instance.health.lastChecked = Date.now();
        this.emit('mcp:health-check-failed', { mcpId, error });
        await this.handleUnhealthyMCP(mcpId, { overallScore: 0, critical: true });
      }
    });

    await Promise.allSettled(healthPromises);
  }

  // Calculate comprehensive health score based on multiple factors
  private calculateHealthScore(health: any, metrics: any, instance: MCPInstance): any {
    let cpuScore = Math.max(0, 1 - (health.cpuUsage / 100));
    let memoryScore = Math.max(0, 1 - (health.memoryUsage / 100));
    let diskScore = Math.max(0, 1 - (health.diskUsage / 100));
    
    // Response time score (lower is better)
    let responseTimeScore = Math.max(0, 1 - (metrics.avgQueryTime / 5000)); // 5 second threshold
    
    // Error rate score (lower is better)
    let errorRateScore = Math.max(0, 1 - (metrics.errorRate * 10));
    
    // Throughput score (higher is better, but with diminishing returns)
    let throughputScore = Math.min(1, metrics.queryCount / 1000); // 1000 queries as optimal
    
    // Network/connectivity score
    let networkScore = instance.health.details?.network ? 1 : 0;
    
    // Database connectivity score
    let databaseScore = instance.health.details?.database ? 1 : 0;

    // Calculate weighted overall score
    const overallScore = (
      cpuScore * 0.15 +
      memoryScore * 0.15 +
      diskScore * 0.1 +
      responseTimeScore * 0.2 +
      errorRateScore * 0.2 +
      throughputScore * 0.1 +
      networkScore * 0.05 +
      databaseScore * 0.05
    );

    return {
      overallScore,
      cpuScore,
      memoryScore,
      diskScore,
      responseTimeScore,
      errorRateScore,
      throughputScore,
      networkHealth: networkScore,
      databaseHealth: databaseScore,
      critical: overallScore < 0.3
    };
  }

  // Determine health status based on comprehensive score
  private determineHealthStatus(healthScore: any): 'healthy' | 'degraded' | 'unhealthy' | 'unreachable' {
    if (healthScore.critical) {
      return 'unhealthy';
    } else if (healthScore.overallScore >= 0.8) {
      return 'healthy';
    } else if (healthScore.overallScore >= 0.5) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  // Predictive health analysis to prevent issues before they occur
  private async performPredictiveHealthAnalysis(): Promise<void> {
    const predictions: Array<{mcpId: string, riskLevel: 'low' | 'medium' | 'high', factors: string[]}> = [];

    for (const [mcpId, instance] of this.instances) {
      try {
        const riskAssessment = await this.assessHealthRisks(instance);
        
        if (riskAssessment.riskLevel !== 'low') {
          predictions.push({
            mcpId,
            riskLevel: riskAssessment.riskLevel,
            factors: riskAssessment.factors
          });

          // Take preventive action for high-risk instances
          if (riskAssessment.riskLevel === 'high') {
            await this.takePreventiveAction(mcpId, riskAssessment);
          }
        }
      } catch (error) {
        this.emit('predictive-health-error', { mcpId, error });
      }
    }

    if (predictions.length > 0) {
      this.emit('health-risk-predictions', {
        predictions,
        timestamp: Date.now()
      });
    }
  }

  // Assess health risks using trending data and patterns
  private async assessHealthRisks(instance: MCPInstance): Promise<{riskLevel: 'low' | 'medium' | 'high', factors: string[]}> {
    const factors: string[] = [];
    let riskScore = 0;

    // Check trending CPU usage
    if (instance.health.cpuUsage && instance.health.cpuUsage > 70) {
      factors.push('High CPU usage trending upward');
      riskScore += instance.health.cpuUsage > 85 ? 3 : 2;
    }

    // Check memory usage trends
    if (instance.stats.memoryUsage > 1024 * 1024 * 1024) { // 1GB
      factors.push('High memory usage');
      riskScore += 2;
    }

    // Check error rate trends
    const errorRate = instance.errorCount ? instance.errorCount / instance.stats.totalOperations : 0;
    if (errorRate > 0.02) { // 2% error rate
      factors.push('Increasing error rate');
      riskScore += errorRate > 0.05 ? 3 : 2;
    }

    // Check access patterns for overload
    if (instance.accessCount && instance.accessCount > 10000) {
      factors.push('High access frequency may lead to overload');
      riskScore += 1;
    }

    // Check disk usage
    if (instance.stats.diskUsage > instance.stats.totalRecords * 1000) { // Rough estimate
      factors.push('High disk usage');
      riskScore += 1;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 6) {
      riskLevel = 'high';
    } else if (riskScore >= 3) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, factors };
  }

  // Take preventive action for high-risk instances
  private async takePreventiveAction(mcpId: string, riskAssessment: any): Promise<void> {
    const instance = this.instances.get(mcpId);
    if (!instance) return;

    this.emit('preventive-action-started', {
      mcpId,
      riskLevel: riskAssessment.riskLevel,
      factors: riskAssessment.factors,
      timestamp: Date.now()
    });

    try {
      // Scale resources if possible
      if (riskAssessment.factors.includes('High CPU usage') || 
          riskAssessment.factors.includes('High memory usage')) {
        await this.scaleInstanceResources(mcpId);
      }

      // Redistribute load if overloaded
      if (riskAssessment.factors.includes('High access frequency may lead to overload')) {
        await this.redistributeLoad(mcpId);
      }

      // Trigger optimization
      if (instance.mcp && typeof instance.mcp.optimize === 'function') {
        await instance.mcp.optimize();
      }

      this.emit('preventive-action-completed', {
        mcpId,
        actions: 'Resource scaling and load redistribution',
        timestamp: Date.now()
      });

    } catch (error) {
      this.emit('preventive-action-failed', {
        mcpId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  // Scale instance resources (simplified implementation)
  private async scaleInstanceResources(mcpId: string): Promise<void> {
    // In a real implementation, this would interact with container orchestration
    // or cloud auto-scaling services
    this.emit('resource-scaling', {
      mcpId,
      action: 'scale-up',
      timestamp: Date.now()
    });
  }

  // Redistribute load by creating additional instances
  private async redistributeLoad(mcpId: string): Promise<void> {
    const instance = this.instances.get(mcpId);
    if (!instance) return;

    // Create additional instance for load distribution
    const newConfig: MCPRegistryConfig = {
      ...instance.mcp?.getConfiguration() || {},
      id: `${mcpId}-loadbalance-${Date.now()}`,
      domain: instance.metadata.domain,
      type: instance.metadata.type
    };

    try {
      const newInstanceId = await this.registerMCP(newConfig);
      this.emit('load-redistribution', {
        originalMcpId: mcpId,
        newMcpId: newInstanceId,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('load-redistribution-failed', {
        mcpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private calculateSuccessRate(instance: MCPInstance): number {
    const total = instance.stats.totalOperations || 0;
    const successful = instance.stats.successfulOperations || 0;
    return total > 0 ? (successful / total) * 100 : 100;
  }

  private evaluateHealth(health: { cpuUsage: number; memoryUsage: number }): boolean {
    // Define health criteria
    const maxCpuUsage = 90; // 90%
    const maxMemoryUsage = 90; // 90%

    return health.cpuUsage < maxCpuUsage &&
           health.memoryUsage < maxMemoryUsage;
  }

  // Enhanced unhealthy MCP handling with multiple recovery strategies
  private async handleUnhealthyMCP(mcpId: string, healthScore?: any): Promise<void> {
    const instance = this.instances.get(mcpId);
    if (!instance) return;

    this.emit('mcp:recovery-started', {
      mcpId,
      healthScore,
      strategy: 'auto-recovery',
      timestamp: Date.now()
    });

    // Temporarily remove from routing to prevent further issues
    this.removeFromRouting(mcpId, instance.metadata.domain, instance.metadata.type);

    try {
      // Choose recovery strategy based on health score
      const recoveryStrategy = this.determineRecoveryStrategy(healthScore);
      let recovered = false;

      switch (recoveryStrategy) {
        case 'restart':
          recovered = await this.attemptMCPRestart(mcpId);
          break;
        case 'resource-boost':
          recovered = await this.attemptResourceBoost(mcpId);
          break;
        case 'gradual-recovery':
          recovered = await this.attemptGradualRecovery(mcpId);
          break;
        case 'full-replacement':
          recovered = await this.attemptFullReplacement(mcpId);
          break;
        default:
          recovered = await this.attemptMCPRestart(mcpId);
      }

      if (recovered) {
        // Restore to routing with monitoring
        this.updateRouting(mcpId, instance.metadata.domain, instance.metadata.type);
        instance.health.status = 'healthy';
        
        this.emit('mcp:recovered', {
          mcpId,
          strategy: recoveryStrategy,
          timestamp: Date.now()
        });
        
        // Set up enhanced monitoring for recently recovered instance
        this.setupEnhancedMonitoring(mcpId);
      } else {
        throw new Error(`Recovery failed with strategy: ${recoveryStrategy}`);
      }

    } catch (error) {
      this.emit('mcp:recovery-failed', {
        mcpId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });

      // Last resort: create replacement MCP
      await this.createReplacementMCP(mcpId);
    }
  }

  // Determine optimal recovery strategy based on health indicators
  private determineRecoveryStrategy(healthScore?: any): 'restart' | 'resource-boost' | 'gradual-recovery' | 'full-replacement' {
    if (!healthScore) {
      return 'restart';
    }

    if (healthScore.critical) {
      return 'full-replacement';
    } else if (healthScore.overallScore < 0.4) {
      return 'resource-boost';
    } else if (healthScore.overallScore < 0.6) {
      return 'gradual-recovery';
    } else {
      return 'restart';
    }
  }

  // Attempt simple restart recovery
  private async attemptMCPRestart(mcpId: string): Promise<boolean> {
    const instance = this.instances.get(mcpId);
    if (!instance || !instance.mcp) return false;

    try {
      await instance.mcp.shutdown();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      await instance.mcp.initialize();
      
      // Verify recovery
      const health = await instance.mcp.getHealth();
      return health.status === 'healthy';
      
    } catch (error) {
      return false;
    }
  }

  // Attempt recovery by boosting resources
  private async attemptResourceBoost(mcpId: string): Promise<boolean> {
    const instance = this.instances.get(mcpId);
    if (!instance || !instance.mcp) return false;

    try {
      // Increase resource allocation (simplified)
      const config = instance.mcp.getConfiguration();
      const boostedConfig = {
        ...config,
        cacheSize: (config.cacheSize || 50) * 1.5,
        connectionPoolSize: (config.connectionPoolSize || 10) * 1.2,
        queryTimeout: (config.queryTimeout || 30000) * 1.5
      };

      // Apply boosted configuration
      if (typeof instance.mcp.updateConfiguration === 'function') {
        await instance.mcp.updateConfiguration(boostedConfig);
      }

      await this.attemptMCPRestart(mcpId);
      
      // Verify recovery
      const health = await instance.mcp.getHealth();
      return health.status === 'healthy';
      
    } catch (error) {
      return false;
    }
  }

  // Attempt gradual recovery by reducing load
  private async attemptGradualRecovery(mcpId: string): Promise<boolean> {
    const instance = this.instances.get(mcpId);
    if (!instance || !instance.mcp) return false;

    try {
      // Temporarily reduce instance load
      instance.metadata.healthStatus = 'degraded';
      
      // Create temporary load balancer instance
      await this.redistributeLoad(mcpId);
      
      // Wait for stabilization
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Attempt restart with reduced load
      const recovered = await this.attemptMCPRestart(mcpId);
      
      if (recovered) {
        instance.metadata.healthStatus = 'healthy';
      }
      
      return recovered;
      
    } catch (error) {
      return false;
    }
  }

  // Attempt full replacement of MCP instance
  private async attemptFullReplacement(mcpId: string): Promise<boolean> {
    try {
      await this.createReplacementMCP(mcpId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Set up enhanced monitoring for recovered instances
  private setupEnhancedMonitoring(mcpId: string): void {
    const monitoringDuration = 3600000; // 1 hour of enhanced monitoring
    const checkInterval = 30000; // Check every 30 seconds
    
    const enhancedMonitor = setInterval(async () => {
      const instance = this.instances.get(mcpId);
      if (!instance || !instance.mcp) {
        clearInterval(enhancedMonitor);
        return;
      }

      try {
        const health = await instance.mcp.getHealth();
        const metrics = await instance.mcp.getMetrics();
        
        // Check for signs of degradation
        if (health.status !== 'healthy' || metrics.errorRate > 0.01) {
          this.emit('mcp:recovery-degradation-detected', {
            mcpId,
            health,
            metrics,
            timestamp: Date.now()
          });
          
          // Take preventive action
          await this.takePreventiveAction(mcpId, { riskLevel: 'medium', factors: ['Post-recovery monitoring'] });
        }
      } catch (error) {
        this.emit('enhanced-monitoring-error', { mcpId, error });
      }
    }, checkInterval);

    // Stop enhanced monitoring after duration
    setTimeout(() => {
      clearInterval(enhancedMonitor);
      this.emit('enhanced-monitoring-completed', {
        mcpId,
        duration: monitoringDuration,
        timestamp: Date.now()
      });
    }, monitoringDuration);
  }

  private async createReplacementMCP(failedMcpId: string): Promise<void> {
    const failedInstance = this.instances.get(failedMcpId);
    if (!failedInstance || !failedInstance.mcp) return;

    const config = failedInstance.mcp.getConfiguration();
    const newConfig: MCPRegistryConfig = {
      ...config,
      id: `${failedMcpId}-replacement-${Date.now()}`,
      domain: config.domain || 'general',
      type: config.type || 'hot'
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
    instance.accessCount = (instance.accessCount || 0) + 1;
    
    if (isError) {
      instance.errorCount = (instance.errorCount || 0) + 1;
    } else {
      // Update average query time
      instance.averageQueryTime = ((instance.averageQueryTime || 0) + queryTime) / 2;
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
      if (instance.mcp) {
        mcpMap.set(id, instance.mcp);
      }
    }
    return mcpMap;
  }

  public getMCPsByDomain(domain: MCPDomain): MCPMetadata[] {
    const mcpIds = this.domainRouting.get(domain) || new Set();
    return Array.from(mcpIds)
      .map(mcpId => this.instances.get(mcpId)?.metadata)
      .filter(metadata => metadata !== undefined) as MCPMetadata[];
  }

  public getMCPsByType(type: MCPTypeString): MCPMetadata[] {
    const mcpIds = this.typeRouting.get(type) || new Set();
    return Array.from(mcpIds)
      .map(mcpId => this.instances.get(mcpId)?.metadata)
      .filter(metadata => metadata !== undefined) as MCPMetadata[];
  }

  public getSystemMetrics(): MCPStats {
    const instances = Array.from(this.instances.values());
    const total = instances.length;
    const healthy = instances.filter(i => i.health.status === 'healthy').length;
    const hot = instances.filter(i => i.metadata.type === 'hot').length;
    const cold = instances.filter(i => i.metadata.type === 'cold').length;
    
    let totalQueries = 0;
    let totalQueryTime = 0;
    let totalErrors = 0;
    let totalMemoryUsage = 0;
    let totalCpuUsage = 0;
    let totalStorageUsed = 0;

    for (const instance of instances) {
      totalQueries += instance.accessCount || 0;
      totalQueryTime += (instance.averageQueryTime || 0) * (instance.accessCount || 0);
      totalErrors += instance.errorCount || 0;
      if (instance.mcp) {
        const health = instance.mcp.getHealth();
        Promise.resolve(health).then(h => {
          totalMemoryUsage += h.memoryUsage;
          totalCpuUsage += h.cpuUsage;
          totalStorageUsed += h.diskUsage;
        });
      }
    }

    return {
      totalOperations: totalQueries,
      totalRecords: total,
      successfulOperations: totalQueries - totalErrors,
      failedOperations: totalErrors,
      averageResponseTime: totalQueries > 0 ? totalQueryTime / totalQueries : 0,
      throughput: 0,
      activeConnections: 0,
      memoryUsage: totalMemoryUsage,
      cpuUsage: totalCpuUsage,
      diskUsage: totalStorageUsed,
      networkIO: {
        bytesIn: 0,
        bytesOut: 0
      }
    };
  }

  public async getLogs(options: { limit?: number; level?: string; }): Promise<LogEntry[]> {
    return [];
  }

  public startMaintenance(id: string, operation: string, options: any): string {
    const maintenanceId = uuidv4();
    const instance = this.instances.get(id);
    if (instance && instance.mcp && 'emit' in instance.mcp && typeof instance.mcp.emit === 'function') {
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
      type: options.tier as MCPTypeString,
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