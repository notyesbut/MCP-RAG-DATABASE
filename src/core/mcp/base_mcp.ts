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
  MCPDomain,
  MCPStatus,
  AccessPattern,
  HealthStatus
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
    
    this.metadata = {
      id: uuidv4(),
      domain,
      type,
      status: 'inactive',
      accessFrequency: 0,
      lastAccessed: 0,
      recordCount: 0,
      averageRecordSize: 0,
      totalSize: 0,
      indexStrategies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      migrationHistory: [],
      performanceMetrics: {
        avgReadLatency: 0,
        avgWriteLatency: 0,
        throughput: 0,
        errorRate: 0,
        cacheHitRate: 0,
        lastMeasured: Date.now()
      }
    };

    this.config = {
      maxRecords: 100000,
      maxSize: 1024 * 1024 * 100, // 100MB
      compressionEnabled: false,
      backupStrategy: 'scheduled',
      replicationFactor: 1,
      shardingStrategy: 'hash',
      ...config
    };

    this.capabilities = this.defineCapabilities();
    this.initializeIndices();
  }

  // Abstract methods to be implemented by specific MCP types
  protected abstract defineCapabilities(): MCPCapabilities;
  protected abstract optimizeForDomain(): void;

  // Core MCP Operations
  async initialize(): Promise<void> {
    this.metadata.status = 'active';
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
    const metrics = this.metadata.performanceMetrics;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.errorRate > 0.1) status = 'unhealthy';
    if (metrics.avgReadLatency > 1000 || metrics.avgWriteLatency > 2000) status = 'degraded';
    
    // Calculate uptime from creation time
    const uptime = Date.now() - this.metadata.createdAt;
    
    // Simulate memory, CPU, and disk usage based on record count and performance
    const memoryUsage = Math.min(90, (this.records.size / this.config.maxRecords) * 100);
    const cpuUsage = Math.min(80, metrics.avgReadLatency / 10);
    const diskUsage = Math.min(95, (this.metadata.totalSize || 0) / this.config.maxSize * 100);
    
    return { status, uptime, memoryUsage, cpuUsage, diskUsage };
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
      totalRecords: this.records.size,
      queryCount: this.metadata.accessFrequency,
      lastAccess: new Date(this.metadata.lastAccessed).toISOString(),
      avgQueryTime: this.metadata.performanceMetrics.avgReadLatency,
      errorRate: this.metadata.performanceMetrics.errorRate,
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
    const metrics = this.metadata.performanceMetrics;
    
    if (operation === 'read') {
      metrics.avgReadLatency = this.calculateMovingAverage(metrics.avgReadLatency, duration);
    } else if (operation === 'write') {
      metrics.avgWriteLatency = this.calculateMovingAverage(metrics.avgWriteLatency, duration);
    }
    
    metrics.lastMeasured = Date.now();
  }

  private calculateMovingAverage(current: number, newValue: number, weight: number = 0.1): number {
    return current * (1 - weight) + newValue * weight;
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
    const metrics = this.metadata.performanceMetrics;
    metrics.errorRate = this.calculateMovingAverage(metrics.errorRate, 1, 0.05);
    
    this.emit('error', {
      operation,
      error: error.message,
      mcpId: this.metadata.id,
      timestamp: Date.now()
    });
  }

  public get id(): string {
    return this.metadata.id;
  }

  public get name(): string {
    return this.metadata.domain;
  }

  public get tier(): MCPType {
    return this.metadata.type;
  }

  public async getLogs(options: { limit?: number; level?: string; }): Promise<any[]> {
    return [];
  }
}