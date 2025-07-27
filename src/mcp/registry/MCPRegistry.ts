/**
 * MCP Registry - Central management system for all MCPs
 * Handles dynamic creation, lifecycle management, and coordination
 */

import { EventEmitter } from 'events';
import { BaseMCP, MCPType, MCPTier, MCPStatus, MCPMetadata, MCPResult } from '../core/BaseMCP';

export interface MCPRegistryConfig {
  maxMCPs: number;
  autoScaling: boolean;
  defaultTier: MCPTier;
  performanceThresholds: {
    hotTier: { accessCount: number; avgQueryTime: number };
    coldTier: { accessCount: number; lastAccessedDays: number };
  };
  cleanupInterval: number;
  backupPath: string;
}

export interface MCPCreationRequest {
  name: string;
  type: MCPType;
  tier?: MCPTier;
  config?: Record<string, any>;
  tags?: string[];
  initialData?: any[];
}

export interface MCPRegistryStats {
  totalMCPs: number;
  activeMCPs: number;
  mcpsByType: Record<MCPType, number>;
  mcpsByTier: Record<MCPTier, number>;
  totalDataSize: number;
  avgPerformance: {
    queryTime: number;
    throughput: number;
    cacheHitRatio: number;
    errorRate: number;
  };
}

export class MCPRegistry extends EventEmitter {
  private mcps: Map<string, BaseMCP>;
  private mcpFactories: Map<MCPType, (metadata: Partial<MCPMetadata>, config: Record<string, any>) => BaseMCP>;
  private config: MCPRegistryConfig;
  private cleanupTimer: NodeJS.Timer | null;
  private performanceMonitor: NodeJS.Timer | null;

  constructor(config: Partial<MCPRegistryConfig> = {}) {
    super();
    
    this.mcps = new Map();
    this.mcpFactories = new Map();
    this.cleanupTimer = null;
    this.performanceMonitor = null;
    
    this.config = {
      maxMCPs: config.maxMCPs || 100,
      autoScaling: config.autoScaling ?? true,
      defaultTier: config.defaultTier || MCPTier.WARM,
      performanceThresholds: config.performanceThresholds || {
        hotTier: { accessCount: 1000, avgQueryTime: 100 },
        coldTier: { accessCount: 10, lastAccessedDays: 30 }
      },
      cleanupInterval: config.cleanupInterval || 3600000, // 1 hour
      backupPath: config.backupPath || './mcp-backups'
    };

    this.startBackgroundTasks();
    this.setupEventHandlers();
  }

  // MCP Factory Registration
  registerMCPFactory(type: MCPType, factory: (metadata: Partial<MCPMetadata>, config: Record<string, any>) => BaseMCP): void {
    this.mcpFactories.set(type, factory);
    this.emit('factory-registered', { type });
  }

  registerFactory(type: MCPType, factory: (config: Record<string, any>) => BaseMCP): void {
    // Adapter for legacy API
    this.registerMCPFactory(type, (metadata, config) => factory(config));
  }

  // MCP Creation and Lifecycle
  async createMCP(request: MCPCreationRequest): Promise<string> {
    this.validateCreationRequest(request);
    
    if (this.mcps.size >= this.config.maxMCPs) {
      throw new Error(`Registry at capacity: ${this.config.maxMCPs} MCPs`);
    }

    const factory = this.mcpFactories.get(request.type);
    if (!factory) {
      throw new Error(`No factory registered for MCP type: ${request.type}`);
    }

    const metadata: Partial<MCPMetadata> = {
      name: request.name,
      type: request.type,
      tier: request.tier || this.config.defaultTier,
      tags: request.tags || [],
      created: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      dataSize: 0
    };

    const mcp = factory(metadata, request.config || {});
    const mcpMetadata = await mcp.getMetadata();
    const mcpId = mcpMetadata.id;

    // Setup MCP event handlers
    this.setupMCPEventHandlers(mcp);

    // Add initial data if provided
    if (request.initialData && request.initialData.length > 0) {
      await mcp.insert(request.initialData);
    }

    this.mcps.set(mcpId, mcp);
    
    this.emit('mcp-created', { mcpId, type: request.type, tier: metadata.tier });
    
    return mcpId;
  }

  async getMCP(mcpId: string): Promise<BaseMCP | null> {
    return this.mcps.get(mcpId) || null;
  }

  getMCP(mcpId: string): BaseMCP | null {
    // Synchronous version for compatibility
    return this.mcps.get(mcpId) || null;
  }

  async registerMCP(config: any): Promise<string> {
    // Adapter for legacy API - create MCP based on config
    const request: MCPCreationRequest = {
      name: config.id || `mcp-${Date.now()}`,
      type: this.mapDomainToType(config.domain),
      tier: config.type === 'hot' ? MCPTier.HOT : config.type === 'cold' ? MCPTier.COLD : MCPTier.WARM,
      config: {
        maxRecords: config.maxRecords,
        compressionEnabled: config.compressionEnabled,
        replicationFactor: config.replicationFactor,
        backupFrequency: config.backupFrequency
      },
      tags: [config.domain, config.type]
    };
    
    const mcpId = await this.createMCP(request);
    
    // Override the ID with the requested one for legacy compatibility
    if (config.id) {
      const mcp = this.mcps.get(mcpId);
      if (mcp) {
        this.mcps.delete(mcpId);
        this.mcps.set(config.id, mcp);
        await mcp.updateMetadata({ id: config.id, name: config.id });
        return config.id;
      }
    }
    
    return mcpId;
  }

  private mapDomainToType(domain: string): MCPType {
    switch (domain) {
      case 'user': return MCPType.HYBRID;
      case 'chat': return MCPType.DOCUMENT;
      case 'stats': return MCPType.TEMPORAL;
      case 'logs': return MCPType.DOCUMENT;
      default: return MCPType.HYBRID;
    }
  }

  async getAllMCPs(): Promise<Map<string, BaseMCP>> {
    return new Map(this.mcps);
  }

  async getMCPsByType(type: MCPType): Promise<Map<string, BaseMCP>> {
    const result = new Map();
    
    for (const [id, mcp] of this.mcps) {
      const metadata = await mcp.getMetadata();
      if (metadata.type === type) {
        result.set(id, mcp);
      }
    }
    
    return result;
  }

  async getMCPsByTier(tier: MCPTier): Promise<Map<string, BaseMCP>> {
    const result = new Map();
    
    for (const [id, mcp] of this.mcps) {
      const metadata = await mcp.getMetadata();
      if (metadata.tier === tier) {
        result.set(id, mcp);
      }
    }
    
    return result;
  }

  async getMCPsByTag(tag: string): Promise<Map<string, BaseMCP>> {
    const result = new Map();
    
    for (const [id, mcp] of this.mcps) {
      const metadata = await mcp.getMetadata();
      if (metadata.tags.includes(tag)) {
        result.set(id, mcp);
      }
    }
    
    return result;
  }

  async getMCPsByDomain(domain: string): Promise<Map<string, BaseMCP>> {
    const result = new Map();
    
    for (const [id, mcp] of this.mcps) {
      const metadata = await mcp.getMetadata();
      // Check if MCP has a domain tag matching the requested domain
      if (metadata.tags.includes(domain)) {
        result.set(id, mcp);
      }
    }
    
    return result;
  }

  getMCPsByType(type: string): BaseMCP[] {
    const result: BaseMCP[] = [];
    
    for (const [id, mcp] of this.mcps) {
      // For synchronous compatibility
      result.push(mcp);
    }
    
    return result;
  }

  async removeMCP(mcpId: string, backup: boolean = true): Promise<void> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    if (backup) {
      await this.backupMCP(mcpId);
    }

    // Set status to archived
    await mcp.setStatus(MCPStatus.ARCHIVED);
    
    // Remove from registry
    this.mcps.delete(mcpId);
    
    this.emit('mcp-removed', { mcpId, backup });
  }

  // Performance Management and Tier Optimization
  async optimizeAllTiers(): Promise<void> {
    this.emit('tier-optimization-started');
    
    const hotCandidates: string[] = [];
    const coldCandidates: string[] = [];
    
    for (const [mcpId, mcp] of this.mcps) {
      const metadata = await mcp.getMetadata();
      const performance = await mcp.getMetrics();
      
      // Check for hot tier promotion
      if (metadata.tier !== MCPTier.HOT && 
          metadata.accessCount >= this.config.performanceThresholds.hotTier.accessCount &&
          performance.avgReadLatency <= this.config.performanceThresholds.hotTier.avgQueryTime) {
        hotCandidates.push(mcpId);
      }
      
      // Check for cold tier demotion
      if (metadata.tier !== MCPTier.COLD &&
          metadata.accessCount <= this.config.performanceThresholds.coldTier.accessCount &&
          this.daysSinceAccess(metadata.lastAccessed) >= this.config.performanceThresholds.coldTier.lastAccessedDays) {
        coldCandidates.push(mcpId);
      }
    }
    
    // Execute tier changes
    for (const mcpId of hotCandidates) {
      await this.promoteMCPToHot(mcpId);
    }
    
    for (const mcpId of coldCandidates) {
      await this.demoteMCPToCold(mcpId);
    }
    
    this.emit('tier-optimization-completed', {
      promoted: hotCandidates.length,
      demoted: coldCandidates.length
    });
  }

  async promoteMCPToHot(mcpId: string): Promise<void> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) return;
    
    await mcp.updateMetadata({ tier: MCPTier.HOT });
    this.emit('mcp-promoted', { mcpId, tier: MCPTier.HOT });
  }

  async demoteMCPToCold(mcpId: string): Promise<void> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) return;
    
    await mcp.updateMetadata({ tier: MCPTier.COLD });
    this.emit('mcp-demoted', { mcpId, tier: MCPTier.COLD });
  }

  // Health and Monitoring
  async getRegistryStats(): Promise<MCPRegistryStats> {
    const stats: MCPRegistryStats = {
      totalMCPs: this.mcps.size,
      activeMCPs: 0,
      mcpsByType: {} as Record<MCPType, number>,
      mcpsByTier: {} as Record<MCPTier, number>,
      totalDataSize: 0,
      avgPerformance: {
        queryTime: 0,
        throughput: 0,
        cacheHitRatio: 0,
        errorRate: 0
      }
    };

    // Initialize counters
    Object.values(MCPType).forEach(type => stats.mcpsByType[type] = 0);
    Object.values(MCPTier).forEach(tier => stats.mcpsByTier[tier] = 0);

    let totalQueryTime = 0;
    let totalThroughput = 0;
    let totalCacheHitRatio = 0;
    let totalErrorRate = 0;

    for (const [mcpId, mcp] of this.mcps) {
      const metadata = await mcp.getMetadata();
      const status = await mcp.getStatus();
      const performance = await mcp.getMetrics();

      if (status === MCPStatus.ACTIVE) {
        stats.activeMCPs++;
      }

      stats.mcpsByType[metadata.type]++;
      stats.mcpsByTier[metadata.tier]++;
      stats.totalDataSize += metadata.dataSize;

      totalQueryTime += performance.avgReadLatency;
      totalThroughput += performance.throughput;
      totalCacheHitRatio += performance.cacheHitRate;
      totalErrorRate += performance.errorRate;
    }

    // Calculate averages
    if (this.mcps.size > 0) {
      stats.avgPerformance.queryTime = totalQueryTime / this.mcps.size;
      stats.avgPerformance.throughput = totalThroughput / this.mcps.size;
      stats.avgPerformance.cacheHitRatio = totalCacheHitRatio / this.mcps.size;
      stats.avgPerformance.errorRate = totalErrorRate / this.mcps.size;
    }

    return stats;
  }

  async performHealthCheck(): Promise<{ healthy: boolean; issues: Array<{ mcpId: string; issues: string[] }> }> {
    const allIssues: Array<{ mcpId: string; issues: string[] }> = [];
    
    for (const [mcpId, mcp] of this.mcps) {
      const healthCheck = await mcp.healthCheck();
      
      if (!healthCheck.healthy) {
        allIssues.push({
          mcpId,
          issues: healthCheck.issues
        });
      }
    }
    
    return {
      healthy: allIssues.length === 0,
      issues: allIssues
    };
  }

  // Backup and Recovery
  async backupMCP(mcpId: string): Promise<void> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    const backupPath = `${this.config.backupPath}/${mcpId}_${Date.now()}.backup`;
    await mcp.backup(backupPath);
    
    this.emit('mcp-backed-up', { mcpId, backupPath });
  }

  async backupAll(): Promise<void> {
    this.emit('registry-backup-started');
    
    const backupPromises = Array.from(this.mcps.keys()).map(mcpId => 
      this.backupMCP(mcpId).catch(error => 
        this.emit('backup-error', { mcpId, error })
      )
    );
    
    await Promise.all(backupPromises);
    
    this.emit('registry-backup-completed');
  }

  // Cleanup and Maintenance
  async cleanup(): Promise<void> {
    this.emit('cleanup-started');
    
    // Clean up caches
    for (const [mcpId, mcp] of this.mcps) {
      const cacheStats = await mcp.getCacheStats();
      
      // Clear cache if hit ratio is too low
      if (cacheStats.hitRatio < 0.3) {
        await mcp.clearCache();
        this.emit('cache-cleared', { mcpId });
      }
    }
    
    // Optimize storage for all MCPs
    const optimizationPromises = Array.from(this.mcps.values()).map(mcp =>
      mcp.optimizeStorage().catch(error =>
        this.emit('optimization-error', { mcpId: mcp.getMetadata(), error })
      )
    );
    
    await Promise.all(optimizationPromises);
    
    this.emit('cleanup-completed');
  }

  async shutdown(): Promise<void> {
    this.emit('registry-shutdown-started');
    
    // Stop background tasks
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
    }
    
    // Backup all MCPs before shutdown
    await this.backupAll();
    
    // Set all MCPs to standby
    const shutdownPromises = Array.from(this.mcps.values()).map(mcp =>
      mcp.setStatus(MCPStatus.STANDBY)
    );
    
    await Promise.all(shutdownPromises);
    
    this.emit('registry-shutdown-completed');
  }

  // Private helper methods
  private validateCreationRequest(request: MCPCreationRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('MCP name is required');
    }
    
    if (!Object.values(MCPType).includes(request.type)) {
      throw new Error(`Invalid MCP type: ${request.type}`);
    }
    
    if (request.tier && !Object.values(MCPTier).includes(request.tier)) {
      throw new Error(`Invalid MCP tier: ${request.tier}`);
    }
  }

  private setupMCPEventHandlers(mcp: BaseMCP): void {
    mcp.on('status-changed', (event) => {
      this.emit('mcp-status-changed', event);
    });
    
    mcp.on('performance-updated', (performance) => {
      this.emit('mcp-performance-updated', { mcpId: mcp.getMetadata(), performance });
    });
    
    mcp.on('error', (error) => {
      this.emit('mcp-error', { mcpId: mcp.getMetadata(), error });
    });
  }

  private setupEventHandlers(): void {
    this.on('mcp-created', () => {
      if (this.config.autoScaling) {
        this.checkAutoScaling();
      }
    });
  }

  private startBackgroundTasks(): void {
    // Cleanup task
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => 
        this.emit('cleanup-error', error)
      );
    }, this.config.cleanupInterval);
    
    // Performance monitoring and tier optimization
    this.performanceMonitor = setInterval(() => {
      this.optimizeAllTiers().catch(error =>
        this.emit('optimization-error', error)
      );
    }, this.config.cleanupInterval * 2); // Every 2 hours
  }

  private checkAutoScaling(): void {
    // Auto-scaling logic would be implemented here
    // For now, just emit an event
    this.emit('auto-scaling-check', { currentMCPs: this.mcps.size, maxMCPs: this.config.maxMCPs });
  }

  private daysSinceAccess(lastAccessed: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastAccessed.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Admin methods required by admin.ts
  async startMaintenance(mcpId: string, operation: string, options?: any): Promise<string> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) {
      throw new Error(`MCP ${mcpId} not found`);
    }
    
    const maintenanceId = `maint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Start maintenance operation asynchronously
    this.performMaintenance(mcp, operation, options).catch(error => {
      this.emit('maintenance-error', { mcpId, maintenanceId, operation, error });
    });
    
    this.emit('maintenance-started', { mcpId, maintenanceId, operation });
    return maintenanceId;
  }

  async getSystemMetrics(): Promise<{
    total: number;
    hot: number;
    cold: number;
    healthy: number;
    memoryUsage: number;
    cpuUsage: number;
    storageUsed: number;
    networkIO?: { inbound: number; outbound: number };
  }> {
    const stats = await this.getStats();
    let healthy = 0;
    let totalMemory = 0;
    let totalCpu = 0;
    let totalStorage = 0;
    
    for (const mcp of this.mcps.values()) {
      const health = await mcp.getHealth();
      if (health.status === 'healthy') healthy++;
      totalMemory += health.memoryUsage;
      totalCpu += health.cpuUsage;
      totalStorage += (await mcp.getMetrics()).storageUsed;
    }
    
    return {
      total: stats.totalMCPs,
      hot: stats.mcpsByTier[MCPTier.HOT] || 0,
      cold: stats.mcpsByTier[MCPTier.COLD] || 0,
      healthy,
      memoryUsage: totalMemory / Math.max(1, stats.totalMCPs),
      cpuUsage: totalCpu / Math.max(1, stats.totalMCPs),
      storageUsed: totalStorage,
      networkIO: { inbound: 0, outbound: 0 }
    };
  }

  async getLogs(options: { level?: string; limit?: number }): Promise<any[]> {
    const logs: any[] = [];
    const limit = options.limit || 100;
    
    // Collect logs from all MCPs
    for (const mcp of this.mcps.values()) {
      const mcpLogs = await mcp.getLogs(options);
      logs.push(...mcpLogs);
    }
    
    // Sort by timestamp and limit
    return logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  private async performMaintenance(mcp: BaseMCP, operation: string, options?: any): Promise<void> {
    // Implement maintenance operations
    switch (operation) {
      case 'reindex':
        // Trigger reindexing
        await mcp.createIndex({ type: 'full-reindex', ...options });
        break;
      case 'vacuum':
        // Trigger vacuum/cleanup
        await mcp.clearCache();
        break;
      case 'migrate':
        // Trigger migration
        const targetTier = options?.targetTier || MCPTier.COLD;
        await this.migrateMCP(mcp.id, targetTier);
        break;
      case 'backup':
        // Trigger backup
        // Implementation would go here
        break;
      default:
        throw new Error(`Unknown maintenance operation: ${operation}`);
    }
  }
}

export default MCPRegistry;