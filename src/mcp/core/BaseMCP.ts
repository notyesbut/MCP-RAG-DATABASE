/**
 * Base MCP (Memory Capable Processor) Class
 * Core foundation for all MCP implementations in the smart database system
 */

import { EventEmitter } from 'events';

export interface MCPMetadata {
  id: string;
  name: string;
  type: MCPType;
  tier: MCPTier;
  created: Date;
  lastAccessed: Date;
  accessCount: number;
  dataSize: number;
  performance: MCPPerformance;
  tags: string[];
  version: string;
}

export interface MCPPerformance {
  avgQueryTime: number;
  throughput: number;
  cacheHitRatio: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

export enum MCPType {
  VECTOR = 'vector',
  GRAPH = 'graph', 
  DOCUMENT = 'document',
  TEMPORAL = 'temporal',
  SPATIAL = 'spatial',
  HYBRID = 'hybrid',
  USER = 'user',
  CHAT = 'chat',
  STATS = 'stats',
  LOGS = 'logs'
}

export enum MCPTier {
  HOT = 'hot',      // Frequently accessed, high performance
  WARM = 'warm',    // Moderate access, balanced performance
  COLD = 'cold'     // Archive, optimized for storage
}

export enum MCPStatus {
  ACTIVE = 'active',
  STANDBY = 'standby',
  MIGRATING = 'migrating',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

export interface MCPQuery {
  id: string;
  type: string;
  query: any;
  filters?: Record<string, any>;
  options?: MCPQueryOptions;
  timestamp: Date;
}

export interface MCPQueryOptions {
  limit?: number;
  offset?: number;
  similarity?: number;
  includeMetadata?: boolean;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface MCPResult {
  success: boolean;
  data?: any[];
  metadata?: any;
  error?: string;
  executionTime: number;
  fromCache: boolean;
  mcpId: string;
}

export abstract class BaseMCP extends EventEmitter {
  protected metadata: MCPMetadata;
  protected status: MCPStatus;
  protected cache: Map<string, any>;
  protected queryHistory: MCPQuery[];
  protected config: Record<string, any>;

  constructor(metadata: Partial<MCPMetadata>, config: Record<string, any> = {}) {
    super();
    
    this.metadata = {
      id: metadata.id || this.generateId(),
      name: metadata.name || `MCP-${this.generateId().slice(0, 8)}`,
      type: metadata.type || MCPType.HYBRID,
      tier: metadata.tier || MCPTier.WARM,
      created: metadata.created || new Date(),
      lastAccessed: metadata.lastAccessed || new Date(),
      accessCount: metadata.accessCount || 0,
      dataSize: metadata.dataSize || 0,
      performance: metadata.performance || this.getInitialPerformance(),
      tags: metadata.tags || [],
      version: metadata.version || '1.0.0'
    };

    this.status = MCPStatus.ACTIVE;
    this.cache = new Map();
    this.queryHistory = [];
    this.config = config;

    this.setupEventHandlers();
  }

  // Abstract methods that must be implemented by specific MCP types
  abstract insert(data: any[], options?: any): Promise<MCPResult>;
  abstract query(query: MCPQuery): Promise<MCPResult>;
  abstract update(id: string, data: any, options?: any): Promise<MCPResult>;
  abstract delete(id: string, options?: any): Promise<MCPResult>;
  abstract createIndex(definition: any): Promise<MCPResult>;

  // Common MCP operations
  async getMetadata(): Promise<MCPMetadata> {
    this.updateLastAccessed();
    return { ...this.metadata };
  }

  async updateMetadata(updates: Partial<MCPMetadata>): Promise<void> {
    this.metadata = { ...this.metadata, ...updates };
    this.emit('metadata-updated', this.metadata);
  }

  async getStatus(): Promise<MCPStatus> {
    return this.status;
  }

  async setStatus(status: MCPStatus): Promise<void> {
    const oldStatus = this.status;
    this.status = status;
    this.emit('status-changed', { oldStatus, newStatus: status, mcpId: this.metadata.id });
  }

  async getPerformanceMetrics(): Promise<MCPPerformance> {
    return { ...this.metadata.performance };
  }

  async updatePerformanceMetrics(metrics: Partial<MCPPerformance>): Promise<void> {
    this.metadata.performance = { ...this.metadata.performance, ...metrics };
    this.emit('performance-updated', this.metadata.performance);
  }

  // Methods required by admin.ts
  get id(): string {
    return this.metadata.id;
  }

  get name(): string {
    return this.metadata.name;
  }

  get tier(): MCPTier {
    return this.metadata.tier;
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  }> {
    const perf = this.metadata.performance;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (perf.errorRate > 0.1) status = 'unhealthy';
    if (perf.avgQueryTime > 1000) status = 'degraded';
    
    const uptime = Date.now() - this.metadata.created.getTime();
    
    return {
      status,
      uptime,
      memoryUsage: perf.memoryUsage,
      cpuUsage: perf.cpuUsage,
      diskUsage: (this.metadata.dataSize / (1024 * 1024 * 1024)) * 100 // Assume 1GB max
    };
  }

  async getMetrics(): Promise<{
    totalRecords: number;
    queryCount: number;
    lastAccess: string;
    avgQueryTime: number;
    errorRate: number;
    storageUsed: number;
    indexCount: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkIO?: { inbound: number; outbound: number };
    queryLatency?: { p50: number; p95: number; p99: number };
  }> {
    const health = await this.getHealth();
    return {
      totalRecords: this.metadata.dataSize,
      queryCount: this.metadata.accessCount,
      lastAccess: this.metadata.lastAccessed.toISOString(),
      avgQueryTime: this.metadata.performance.avgQueryTime,
      errorRate: this.metadata.performance.errorRate,
      storageUsed: this.metadata.dataSize,
      indexCount: 0, // Can be overridden by specific MCP types
      memoryUsage: health.memoryUsage,
      cpuUsage: health.cpuUsage,
      diskUsage: health.diskUsage,
      networkIO: { inbound: 0, outbound: 0 },
      queryLatency: { p50: 0, p95: 0, p99: 0 }
    };
  }

  async getLogs(options: { limit?: number; level?: string; }): Promise<any[]> {
    // Return empty array by default, can be overridden by specific MCP types
    return [];
  }

  getConfiguration(): Record<string, any> {
    return { ...this.config };
  }


  async clearCache(): Promise<void> {
    this.cache.clear();
    this.emit('cache-cleared', this.metadata.id);
  }

  async getCacheStats(): Promise<{ size: number; hitRatio: number }> {
    return {
      size: this.cache.size,
      hitRatio: this.metadata.performance.cacheHitRatio
    };
  }

  async getQueryHistory(limit: number = 100): Promise<MCPQuery[]> {
    return this.queryHistory.slice(-limit);
  }

  async optimizeStorage(): Promise<MCPResult> {
    this.emit('optimization-started', this.metadata.id);
    
    try {
      // Implementation would depend on specific MCP type
      const result = await this.performOptimization();
      
      this.emit('optimization-completed', { mcpId: this.metadata.id, result });
      return result;
    } catch (error) {
      this.emit('optimization-failed', { mcpId: this.metadata.id, error });
      throw error;
    }
  }

  async backup(destination: string): Promise<MCPResult> {
    this.emit('backup-started', { mcpId: this.metadata.id, destination });
    
    try {
      const result = await this.performBackup(destination);
      this.emit('backup-completed', { mcpId: this.metadata.id, destination, result });
      return result;
    } catch (error) {
      this.emit('backup-failed', { mcpId: this.metadata.id, destination, error });
      throw error;
    }
  }

  async restore(source: string): Promise<MCPResult> {
    this.emit('restore-started', { mcpId: this.metadata.id, source });
    
    try {
      const result = await this.performRestore(source);
      this.emit('restore-completed', { mcpId: this.metadata.id, source, result });
      return result;
    } catch (error) {
      this.emit('restore-failed', { mcpId: this.metadata.id, source, error });
      throw error;
    }
  }

  // Health check and monitoring
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check basic status
    if (this.status === MCPStatus.ERROR) {
      issues.push('MCP is in error state');
    }
    
    // Check performance metrics
    if (this.metadata.performance.errorRate > 0.05) {
      issues.push('High error rate detected');
    }
    
    if (this.metadata.performance.avgQueryTime > 1000) {
      issues.push('Query performance degraded');
    }
    
    // Check cache performance
    if (this.metadata.performance.cacheHitRatio < 0.5) {
      issues.push('Low cache hit ratio');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  // Migration support
  async prepareForMigration(): Promise<{ snapshot: any; metadata: MCPMetadata }> {
    this.emit('migration-preparation-started', this.metadata.id);
    
    const snapshot = await this.createSnapshot();
    
    return {
      snapshot,
      metadata: { ...this.metadata }
    };
  }

  async migrateFrom(snapshot: any, metadata: MCPMetadata): Promise<MCPResult> {
    this.emit('migration-started', { mcpId: this.metadata.id, from: metadata.id });
    
    try {
      const result = await this.restoreFromSnapshot(snapshot);
      this.metadata = { ...metadata, id: this.metadata.id };
      
      this.emit('migration-completed', { mcpId: this.metadata.id, from: metadata.id });
      return result;
    } catch (error) {
      this.emit('migration-failed', { mcpId: this.metadata.id, from: metadata.id, error });
      throw error;
    }
  }

  // Protected helper methods
  protected generateId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected updateLastAccessed(): void {
    this.metadata.lastAccessed = new Date();
    this.metadata.accessCount++;
  }

  protected addToQueryHistory(query: MCPQuery): void {
    this.queryHistory.push(query);
    
    // Keep only last 1000 queries
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }
  }

  protected getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  protected setCache(key: string, data: any, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }

  protected setupEventHandlers(): void {
    this.on('query-executed', (query: MCPQuery, result: MCPResult) => {
      this.updatePerformanceFromQuery(query, result);
    });

    this.on('error', (error) => {
      this.setStatus(MCPStatus.ERROR);
    });
  }

  protected updatePerformanceFromQuery(query: MCPQuery, result: MCPResult): void {
    const currentPerf = this.metadata.performance;
    
    // Update average query time (moving average)
    currentPerf.avgQueryTime = (currentPerf.avgQueryTime * 0.9) + (result.executionTime * 0.1);
    
    // Update cache hit ratio
    if (result.fromCache) {
      currentPerf.cacheHitRatio = (currentPerf.cacheHitRatio * 0.95) + (1 * 0.05);
    } else {
      currentPerf.cacheHitRatio = (currentPerf.cacheHitRatio * 0.95) + (0 * 0.05);
    }
    
    // Update error rate
    if (!result.success) {
      currentPerf.errorRate = (currentPerf.errorRate * 0.95) + (1 * 0.05);
    } else {
      currentPerf.errorRate = (currentPerf.errorRate * 0.95) + (0 * 0.05);
    }
  }

  private getInitialPerformance(): MCPPerformance {
    return {
      avgQueryTime: 0,
      throughput: 0,
      cacheHitRatio: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  // Abstract methods for subclass implementation
  protected abstract performOptimization(): Promise<MCPResult>;
  protected abstract performBackup(destination: string): Promise<MCPResult>;
  protected abstract performRestore(source: string): Promise<MCPResult>;
  protected abstract createSnapshot(): Promise<any>;
  protected abstract restoreFromSnapshot(snapshot: any): Promise<MCPResult>;
}

export default BaseMCP;