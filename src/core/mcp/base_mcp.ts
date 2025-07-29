/**
 * Base MCP Implementation
 * Foundation for all Multi-Context Processors
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  MCPMetadata,
  MCPConfig,
  MCPCapabilities,
  DataRecord,
  PerformanceMetrics,
  MCPType,
  MCPTypeString,
  MCPPerformanceTier,
  MCPDomain,
  MCPStatus,
  AccessPattern,
  HealthStatus,
  MCPTier
} from '../../types/mcp.types';

export abstract class BaseMCP extends EventEmitter {
  public metadata: MCPMetadata;
  protected config: MCPConfig;
  protected capabilities: MCPCapabilities;
  protected records: Map<string, DataRecord> = new Map();
  protected indices: Map<string, Map<any, Set<string>>> = new Map();
  
  constructor(
    domain: MCPDomain,
    type: MCPType,
    config: Partial<MCPConfig> = {}
  ) {
    super();
    
    // Convert MCPType to MCPTypeString for metadata
    const typeString: MCPTypeString = this.convertToTypeString(type);
    
    // Determine performance tier based on type
    const performanceTier: MCPPerformanceTier = this.determinePerformanceTier(typeString);
    
    const mcpId = uuidv4();
    this.metadata = {
      id: mcpId,
      name: `${domain}-${mcpId}`,
      domain,
      type: typeString,
      performanceTier,
      healthStatus: 'healthy',
      status: 'active' as MCPStatus,
      created: Date.now(),
      accessFrequency: 0,
      accessCount: 0,
      lastAccessed: 0,
      recordCount: 0,
      averageRecordSize: 0,
      totalSize: 0,
      dataSize: 0,
      indexStrategies: [],
      endpoint: `mcp://${domain}/${mcpId}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: {
        maxRecords: config.maxRecords || 100000,
        maxSize: config.maxSize || (1024 * 1024 * 100),
        compressionEnabled: config.compressionEnabled || false,
        replicationFactor: config.replicationFactor || 1,
        cacheSize: config.cacheSize || 50,
        connectionPoolSize: config.connectionPoolSize || 10,
        queryTimeout: config.queryTimeout || 30000,
        backupFrequency: config.backupFrequency || 24,
        encryptionEnabled: config.encryptionEnabled || false,
        autoIndexing: config.autoIndexing || false,
        consistencyLevel: config.consistencyLevel || 'eventual',
        customProperties: config.customProperties || {}
      },
      metrics: {
        averageResponseTime: 0,
        avgReadLatency: 0,
        avgWriteLatency: 0,
        avgThroughput: 0,
        throughput: 0,
        queryThroughput: 0,
        cpuUtilization: 0,
        memoryUtilization: 0,
        diskUtilization: 0,
        errorRate: 0,
        networkIO: {
          bytesIn: 0,
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0
        },
        cacheHitRatio: 0,
        cacheHitRate: 0,
        activeConnections: 0,
        successfulOperations: 0,
        failedOperations: 0,
        totalOperations: 0,
        lastUpdated: Date.now()
      },
      migrationHistory: [],
      relatedMCPs: [],
      tags: []
    };

    this.config = {
      maxRecords: config.maxRecords || 100000,
      maxSize: config.maxSize || (1024 * 1024 * 100), // 100MB
      compressionEnabled: config.compressionEnabled || false,
      replicationFactor: config.replicationFactor || 1,
      cacheSize: config.cacheSize || 50,
      connectionPoolSize: config.connectionPoolSize || 10,
      queryTimeout: config.queryTimeout || 30000,
      backupFrequency: config.backupFrequency || 24,
      encryptionEnabled: config.encryptionEnabled || false,
      autoIndexing: config.autoIndexing || false,
      consistencyLevel: config.consistencyLevel || 'eventual',
      customProperties: config.customProperties || {}
    };

    this.capabilities = this.defineCapabilities();
    this.initializeIndices();
  }

  // Getter properties for compatibility
  get id(): string {
    return this.metadata.id;
  }

  get name(): string {
    return this.metadata.name;
  }

  getId(): string {
    return this.metadata.id;
  }

  getStatus(): MCPStatus {
    return this.metadata.status;
  }

  get tier(): MCPTier {
    // If tier is explicitly set, use it. Otherwise derive from performanceTier
    if (this.metadata.tier) {
      return this.metadata.tier;
    }
    // Map performance tier back to MCPTier
    switch (this.metadata.performanceTier) {
      case 'realtime': return MCPTier.HOT;
      case 'standard': return MCPTier.WARM;
      case 'batch': return MCPTier.COLD;
      case 'archive': return MCPTier.ARCHIVE;
      default: return MCPTier.WARM;
    }
  }

  // Abstract methods to be implemented by specific MCP types
  protected abstract defineCapabilities(): MCPCapabilities;
  protected abstract optimizeForDomain(): void;

  // Core MCP Operations
  async initialize(): Promise<void> {
    this.metadata.healthStatus = 'healthy';
    this.optimizeForDomain();
    this.emit('initialized', this.metadata);
  }

  async store(record: DataRecord): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Validate record size and capacity
      if (this.records.size >= this.config.maxRecords) {
        await this.performCleanup();
      }

      // Update record metadata
      if (!record.metadata) {
        record.metadata = {};
      }
      record.metadata.accessPattern = this.createAccessPattern(record);
      
      // Store record
      this.records.set(record.id, record);
      
      // Update indices
      await this.updateIndices(record);
      
      // Update metadata
      this.updateMetrics(startTime, 'write');
      this.metadata.recordCount = this.records.size;
      this.metadata.lastAccessed = Date.now();
      this.metadata.updatedAt = Date.now();
      
      this.emit('record_stored', { recordId: record.id, mcpId: this.metadata.id });
      return true;
      
    } catch (error) {
      this.handleError('store', error as Error);
      return false;
    }
  }

  async retrieve(id: string): Promise<DataRecord | null> {
    const startTime = Date.now();
    
    try {
      const record = this.records.get(id);
      
      if (record) {
        // Update access pattern
        if (!record.metadata) {
          record.metadata = {};
        }
        if (!record.metadata.accessPattern) {
          record.metadata.accessPattern = this.createAccessPattern(record);
        }
        record.metadata.accessPattern.lastAccessed = Date.now();
        record.metadata.accessPattern.frequency++;
        record.metadata.accessPattern.accessHistory.push(Date.now());
        
        // Keep only recent access history (last 100 accesses)
        if (record.metadata.accessPattern.accessHistory.length > 100) {
          record.metadata.accessPattern.accessHistory = 
            record.metadata.accessPattern.accessHistory.slice(-100);
        }
        
        this.updateMetrics(startTime, 'read');
        this.metadata.accessFrequency++;
        this.metadata.lastAccessed = Date.now();
        
        this.emit('record_retrieved', { recordId: id, mcpId: this.metadata.id });
      }
      
      return record || null;
      
    } catch (error) {
      this.handleError('retrieve', error as Error);
      return null;
    }
  }

  async query(filters: Record<string, any>): Promise<DataRecord[]> {
    const startTime = Date.now();
    
    try {
      const results: DataRecord[] = [];
      
      // Use indices when possible
      const indexedResults = await this.queryUsingIndices(filters);
      if (indexedResults.length > 0) {
        results.push(...indexedResults);
      } else {
        // Fallback to full scan
        for (const record of this.records.values()) {
          if (this.matchesFilters(record, filters)) {
            results.push(record);
          }
        }
      }
      
      // Update access patterns for retrieved records
      results.forEach(record => {
        if (!record.metadata) {
          record.metadata = {};
        }
        if (!record.metadata.accessPattern) {
          record.metadata.accessPattern = this.createAccessPattern(record);
        }
        record.metadata.accessPattern.lastAccessed = Date.now();
        record.metadata.accessPattern.frequency++;
      });
      
      this.updateMetrics(startTime, 'read');
      this.metadata.accessFrequency++;
      this.metadata.lastAccessed = Date.now();
      
      this.emit('query_executed', { 
        resultCount: results.length, 
        mcpId: this.metadata.id,
        filters 
      });
      
      return results;
      
    } catch (error) {
      this.handleError('query', error as Error);
      return [];
    }
  }

  async delete(id: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const record = this.records.get(id);
      if (!record) return false;
      
      // Remove from indices
      await this.removeFromIndices(record);
      
      // Remove record
      this.records.delete(id);
      
      // Update metadata
      this.updateMetrics(startTime, 'delete');
      this.metadata.recordCount = this.records.size;
      this.metadata.updatedAt = Date.now();
      
      this.emit('record_deleted', { recordId: id, mcpId: this.metadata.id });
      return true;
      
    } catch (error) {
      this.handleError('delete', error as Error);
      return false;
    }
  }

  // Metadata and Status
  getMetadata(): MCPMetadata {
    return { ...this.metadata };
  }

  getCapabilities(): MCPCapabilities {
    return { ...this.capabilities };
  }

  getConfiguration(): MCPConfig {
    return { ...this.config };
  }

  // Performance and Health
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  }> {
    const metrics = this.metadata.metrics;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.errorRate > 0.1) status = 'unhealthy';
    if (metrics.averageResponseTime > 1000) status = 'degraded';
    
    // Calculate uptime from creation time
    const uptime = Date.now() - this.metadata.createdAt;
    
    // Simulate memory, CPU, and disk usage based on record count and performance
    const memoryUsage = Math.min(90, (this.records.size / this.config.maxRecords) * 100);
    const cpuUsage = Math.min(80, metrics.averageResponseTime / 10);
    const diskUsage = Math.min(95, (this.metadata.totalSize || 0) / this.config.maxSize * 100);
    
    return { status, uptime, memoryUsage, cpuUsage, diskUsage };
  }

  async getMetrics(): Promise<{
    totalRecords: number;
    queryCount: number;
    lastAccess: string;
    avgQueryTime: number;
    avgReadLatency: number;
    avgWriteLatency: number;
    throughput: number;
    cacheHitRatio: number;
    cacheHitRate: number;
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
      totalRecords: this.records.size,
      queryCount: this.metadata.accessFrequency,
      lastAccess: new Date(this.metadata.lastAccessed).toISOString(),
      avgQueryTime: this.metadata.metrics.averageResponseTime,
      avgReadLatency: this.metadata.metrics.avgReadLatency || this.metadata.metrics.averageResponseTime,
      avgWriteLatency: this.metadata.metrics.averageResponseTime,
      throughput: this.metadata.metrics.throughput || this.metadata.metrics.avgThroughput,
      cacheHitRatio: this.metadata.metrics.cacheHitRatio,
      cacheHitRate: this.metadata.metrics.cacheHitRatio, // Alias for compatibility
      errorRate: this.metadata.metrics.errorRate,
      storageUsed: this.metadata.totalSize || 0,
      indexCount: this.indices.size,
      memoryUsage: health.memoryUsage,
      cpuUsage: health.cpuUsage,
      diskUsage: health.diskUsage,
      networkIO: { inbound: 0, outbound: 0 },
      queryLatency: { p50: 0, p95: 0, p99: 0 }
    };
  }

  // Migration Support
  async prepareForMigration(): Promise<DataRecord[]> {
    return Array.from(this.records.values());
  }

  async acceptMigration(records: DataRecord[]): Promise<boolean> {
    try {
      for (const record of records) {
        await this.store(record);
      }
      return true;
    } catch (error) {
      this.handleError('migration', error as Error);
      return false;
    }
  }

  // Private Helper Methods
  private createAccessPattern(record: DataRecord): AccessPattern {
    return {
      frequency: 0,
      lastAccessed: Date.now(),
      accessHistory: [Date.now()],
      predictedNextAccess: Date.now() + (24 * 60 * 60 * 1000), // 24 hours default
      accessType: 'write'
    };
  }

  private initializeIndices(): void {
    // Initialize common indices
    this.indices.set('domain', new Map());
    this.indices.set('timestamp', new Map());
  }

  private async updateIndices(record: DataRecord): Promise<void> {
    // Domain index
    if (record.metadata?.domain) {
      this.addToIndex('domain', record.metadata.domain, record.id);
    }
    
    // Timestamp index (by day)
    const day = Math.floor(record.timestamp / (24 * 60 * 60 * 1000));
    this.addToIndex('timestamp', day, record.id);
  }

  private addToIndex(indexName: string, key: any, recordId: string): void {
    const index = this.indices.get(indexName);
    if (!index) return;
    
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(recordId);
  }

  private async removeFromIndices(record: DataRecord): Promise<void> {
    // Remove from all indices
    for (const [indexName, index] of this.indices) {
      for (const [key, recordIds] of index) {
        recordIds.delete(record.id);
        if (recordIds.size === 0) {
          index.delete(key);
        }
      }
    }
  }

  private async queryUsingIndices(filters: Record<string, any>): Promise<DataRecord[]> {
    const results: DataRecord[] = [];
    
    // Try to use indices for common filter patterns
    if (filters.domain) {
      const index = this.indices.get('domain');
      const recordIds = index?.get(filters.domain);
      if (recordIds) {
        for (const id of recordIds) {
          const record = this.records.get(id);
          if (record && this.matchesFilters(record, filters)) {
            results.push(record);
          }
        }
      }
    }
    
    return results;
  }

  private matchesFilters(record: DataRecord, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'domain' && record.metadata?.domain !== value) return false;
      // Add more filter matching logic as needed
    }
    return true;
  }

  private updateMetrics(startTime: number, operation: string): void {
    const duration = Date.now() - startTime;
    const metrics = this.metadata.metrics;
    
    if (operation === 'read') {
      metrics.averageResponseTime = this.calculateMovingAverage(metrics.averageResponseTime, duration);
    } else if (operation === 'write') {
      // Update query throughput
      metrics.queryThroughput = this.calculateQueryThroughput();
    }
  }

  private calculateMovingAverage(current: number, newValue: number, weight: number = 0.1): number {
    return current * (1 - weight) + newValue * weight;
  }

  private calculateQueryThroughput(): number {
    // Calculate queries per second based on access frequency
    const now = Date.now();
    const timeSinceCreation = (now - this.metadata.createdAt) / 1000; // in seconds
    return timeSinceCreation > 0 ? this.metadata.accessFrequency / timeSinceCreation : 0;
  }

  private async performCleanup(): Promise<void> {
    // Remove oldest records based on access patterns
    const recordsArray = Array.from(this.records.values());
    recordsArray.sort((a, b) => (a.metadata?.accessPattern?.lastAccessed || 0) - (b.metadata?.accessPattern?.lastAccessed || 0));
    
    const toRemove = Math.floor(this.config.maxRecords * 0.1); // Remove 10%
    for (let i = 0; i < toRemove && i < recordsArray.length; i++) {
      await this.delete(recordsArray[i].id);
    }
  }

  private handleError(operation: string, error: Error): void {
    const metrics = this.metadata.metrics;
    metrics.errorRate = this.calculateMovingAverage(metrics.errorRate, 1, 0.05);
    
    this.emit('error', {
      operation,
      error: error.message,
      mcpId: this.metadata.id,
      timestamp: Date.now()
    });
  }

  // Removed duplicate getters - already defined above

  public async getLogs(options: { limit?: number; level?: string; }): Promise<any[]> {
    return [];
  }

  public async healthCheck(): Promise<any> {
    return this.getHealth();
  }

  public async backup(destination?: string): Promise<any> {
    const records = await this.prepareForMigration();
    return {
      success: true,
      destination: destination || 'default',
      recordCount: records.length,
      timestamp: Date.now()
    };
  }

  public async getCacheStats(): Promise<any> {
    return {
      hitRate: 0,
      missRate: 0,
      size: this.records.size,
      maxSize: this.config.maxRecords
    };
  }

  public async optimizeStorage(): Promise<any> {
    await this.optimize();
    return {
      success: true,
      optimizedRecords: this.records.size,
      timestamp: Date.now()
    };
  }

  // Additional required properties and methods
  public get domain(): MCPDomain {
    return this.metadata.domain;
  }

  public get type(): MCPType {
    // Convert tier to MCPType based on metadata.type
    return this.metadata.type === 'hot' ? MCPType.HOT : MCPType.COLD;
  }

  public async update(record: DataRecord): Promise<boolean> {
    // Update is essentially a store operation
    return this.store(record);
  }

  public async create(record: DataRecord): Promise<boolean> {
    // Create is essentially a store operation for new records
    return this.store(record);
  }

  public async setStatus(status: MCPStatus): Promise<void> {
    // Update MCP status and emit event
    const previousStatus = this.metadata.status;
    this.metadata.status = status;
    this.metadata.updatedAt = Date.now();
    this.emit('status_changed', { 
      mcpId: this.metadata.id, 
      previousStatus, 
      newStatus: status 
    });
  }

  public async shutdown(): Promise<void> {
    // Clean up resources
    this.metadata.healthStatus = 'unhealthy';
    this.records.clear();
    this.indices.clear();
    this.emit('shutdown', this.metadata);
  }

  // Helper methods for type conversion
  private convertToTypeString(type: MCPType | string): MCPTypeString {
    // Handle direct MCPTypeString values
    if (type === 'hot' || type === 'cold') {
      return type;
    }
    
    // Handle MCPType enum values
    if (type === MCPType.HOT) {
      return 'hot';
    }
    if (type === MCPType.COLD) {
      return 'cold';
    }
    
    // For domain-based types, determine hot/cold based on the domain
    switch (type) {
      case MCPType.USER:
      case MCPType.CHAT:
        return 'hot'; // User and chat data are frequently accessed
      case MCPType.STATS:
      case MCPType.LOGS:
        return 'cold'; // Stats and logs are less frequently accessed
      default:
        return 'cold'; // Default to cold for unknown types
    }
  }

  private determinePerformanceTier(type: MCPTypeString): MCPPerformanceTier {
    // Determine performance tier based on hot/cold classification
    if (type === 'hot') {
      return 'realtime';
    }
    return 'standard';
  }

  // Helper method to convert MCPTier to MCPPerformanceTier
  public static mapTierToPerformanceTier(tier: MCPTier): MCPPerformanceTier {
    switch (tier) {
      case MCPTier.HOT:
        return 'realtime';
      case MCPTier.WARM:
        return 'standard';
      case MCPTier.COLD:
        return 'batch';
      case MCPTier.ARCHIVE:
        return 'archive';
      default:
        return 'standard';
    }
  }

  // Additional methods that may be required by extending classes
  async optimize(): Promise<void> {
    // Base optimization - can be overridden by specific implementations
    await this.performCleanup();
  }

  async updateConfiguration(newConfig: Partial<MCPConfig>): Promise<boolean> {
    try {
      // Update configuration
      Object.assign(this.config, newConfig);
      Object.assign(this.metadata.configuration, newConfig);
      this.metadata.updatedAt = Date.now();
      this.emit('configuration_updated', { mcpId: this.metadata.id, config: this.config });
      return true;
    } catch (error) {
      this.handleError('updateConfiguration', error as Error);
      return false;
    }
  }

  // Index management methods
  async createIndex(indexName: string, fields: string[], options: any = {}): Promise<boolean> {
    try {
      // Create a new index
      const index = new Map<any, Set<string>>();
      this.indices.set(indexName, index);
      
      // Build index for existing records
      for (const record of this.records.values()) {
        const key = this.buildIndexKey(record, fields);
        if (key !== null) {
          this.addToIndex(indexName, key, record.id);
        }
      }
      
      this.emit('index_created', { indexName, fields, mcpId: this.metadata.id });
      return true;
    } catch (error) {
      this.handleError('createIndex', error as Error);
      return false;
    }
  }

  async clearCache(): Promise<void> {
    try {
      // Clear any cached data - in this base implementation, we don't have a separate cache
      // but subclasses might implement this differently
      this.emit('cache_cleared', { mcpId: this.metadata.id });
    } catch (error) {
      this.handleError('clearCache', error as Error);
    }
  }

  async updateMetadata(metadata: Partial<MCPMetadata>): Promise<boolean> {
    try {
      // Update metadata with provided values
      Object.assign(this.metadata, metadata);
      this.metadata.updatedAt = Date.now();
      this.emit('metadata_updated', { mcpId: this.metadata.id, metadata });
      return true;
    } catch (error) {
      this.handleError('updateMetadata', error as Error);
      return false;
    }
  }

  // Helper method to build index keys from records
  private buildIndexKey(record: DataRecord, fields: string[]): any {
    if (fields.length === 1) {
      const field = fields[0];
      if (field === 'domain') return record.domain;
      if (field === 'type') return record.type;
      if (field === 'timestamp') return Math.floor(record.timestamp / (24 * 60 * 60 * 1000));
      // Check metadata fields
      if (record.metadata && field in record.metadata) {
        return record.metadata[field];
      }
      // Check data fields
      if (typeof record.data === 'object' && field in record.data) {
        return record.data[field];
      }
      return null;
    } else {
      // Composite key for multi-field indexes
      const keyParts: any[] = [];
      for (const field of fields) {
        if (field === 'domain') keyParts.push(record.domain);
        else if (field === 'type') keyParts.push(record.type);
        else if (field === 'timestamp') keyParts.push(Math.floor(record.timestamp / (24 * 60 * 60 * 1000)));
        else if (record.metadata && field in record.metadata) keyParts.push(record.metadata[field]);
        else if (typeof record.data === 'object' && field in record.data) keyParts.push(record.data[field]);
        else keyParts.push(null);
      }
      return keyParts.join('|');
    }
  }
}