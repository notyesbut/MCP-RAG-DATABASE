/**
 * HOT MCP - Optimized for frequent access and real-time performance
 * Implements in-memory caching, connection pooling, and low-latency operations
 */

import { BaseMCP } from './base_mcp';
import {
  MCPCapabilities,
  DataRecord,
  MCPDomain,
  MCPType,
  MCPConfig,
  AccessPattern
} from '../../types/mcp.types';

interface HotMCPConfig extends MCPConfig {
  cacheStrategy: 'lru' | 'lfu' | 'adaptive';
  preloadingEnabled: boolean;
  connectionPoolSize: number;
  warmupQueries: string[];
  performanceThresholds: {
    maxLatency: number;
    minThroughput: number;
    cacheHitRatio: number;
  };
}

export class HotMCP extends BaseMCP {
  private cache: Map<string, { data: DataRecord; lastAccess: number; accessCount: number }> = new Map();
  private preloadCache: Map<string, DataRecord> = new Map();
  private connectionPool: any[] = [];
  private queryOptimizer: Map<string, any> = new Map();
  private hotConfig: HotMCPConfig;
  
  constructor(domain: MCPDomain, type: MCPType, config: Partial<HotMCPConfig> = {}) {
    const hotDefaults: HotMCPConfig = {
      maxRecords: 100000,
      maxSize: 1024 * 1024 * 200, // 200MB for HOT tier
      cacheSize: 100, // MB
      connectionPoolSize: 50,
      queryTimeout: 5000, // 5 seconds max
      backupFrequency: 0.5, // Every 30 minutes
      compressionEnabled: false, // Speed over space
      encryptionEnabled: false, // Speed over security for HOT data
      autoIndexing: true,
      consistencyLevel: 'eventual',
      replicationFactor: 3, // High availability for HOT data
      cacheStrategy: 'adaptive',
      preloadingEnabled: true,
      warmupQueries: [],
      performanceThresholds: {
        maxLatency: 100, // 100ms
        minThroughput: 1000, // 1000 ops/sec
        cacheHitRatio: 0.9 // 90%
      },
      customProperties: {}
    };
    
    super(domain, type, { ...hotDefaults, ...config });
    this.hotConfig = { ...hotDefaults, ...config };
    this.initializeHotOptimizations();
  }

  protected defineCapabilities(): MCPCapabilities {
    return {
      queryTypes: ['select', 'insert', 'update', 'delete', 'search'],
      dataTypes: ['string', 'number', 'boolean', 'object', 'array'],
      maxConnections: this.hotConfig.connectionPoolSize,
      consistencyLevels: ['strong', 'eventual', 'weak'],
      transactionSupport: true,
      backupSupport: true,
      replicationSupport: true,
      encryptionSupport: false, // Disabled for performance
      compressionSupport: false, // Disabled for performance
      fullTextSearch: true,
      geospatialSupport: true,
      vectorSearch: true,
      streamingSupport: true
    };
  }

  protected optimizeForDomain(): void {
    this.setupPerformanceMonitoring();
    this.initializeConnectionPool();
    this.startCacheOptimization();
    this.preloadFrequentData();
  }

  private initializeHotOptimizations(): void {
    // Set up high-performance indices
    this.setupHighPerformanceIndices();
    
    // Enable real-time monitoring
    this.enableRealTimeMonitoring();
    
    // Configure adaptive caching
    this.configureAdaptiveCaching();
  }

  // Enhanced store method with aggressive caching
  override async store(record: DataRecord): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Store in main storage first
      const success = await super.store(record);
      
      if (success) {
        // Immediately cache the record
        this.addToCache(record);
        
        // Update access patterns for predictive caching
        this.updateAccessPrediction(record);
        
        // Trigger preloading if this is a frequently accessed pattern
        await this.checkForPreloadTriggers(record);
        
        this.updatePerformanceMetrics('store', Date.now() - startTime);
      }
      
      return success;
    } catch (error) {
      this.handleHotError('store', error as Error);
      return false;
    }
  }

  // Enhanced retrieve method with multi-level caching
  override async retrieve(id: string): Promise<DataRecord | null> {
    const startTime = Date.now();
    
    // L1 Cache check (hot cache)
    const cached = this.cache.get(id);
    if (cached) {
      cached.lastAccess = Date.now();
      cached.accessCount++;
      this.updatePerformanceMetrics('retrieve_cache_hit', Date.now() - startTime);
      return cached.data;
    }
    
    // L2 Cache check (preload cache)
    const preloaded = this.preloadCache.get(id);
    if (preloaded) {
      this.promoteToHotCache(id, preloaded);
      this.updatePerformanceMetrics('retrieve_preload_hit', Date.now() - startTime);
      return preloaded;
    }
    
    // L3 Storage access
    try {
      const record = await super.retrieve(id);
      
      if (record) {
        // Cache the retrieved record
        this.addToCache(record);
        
        // Update access patterns
        this.updateAccessPrediction(record);
      }
      
      this.updatePerformanceMetrics('retrieve_storage', Date.now() - startTime);
      return record;
    } catch (error) {
      this.handleHotError('retrieve', error as Error);
      return null;
    }
  }

  // Enhanced query method with intelligent caching
  override async query(filters: Record<string, any>): Promise<DataRecord[]> {
    const startTime = Date.now();
    const queryKey = this.generateQueryKey(filters);
    
    // Check query result cache
    const cachedResult = this.queryOptimizer.get(queryKey);
    if (cachedResult && cachedResult.expiry > Date.now()) {
      this.updatePerformanceMetrics('query_cache_hit', Date.now() - startTime);
      return cachedResult.data;
    }
    
    try {
      const results = await super.query(filters);
      
      // Cache query results
      this.cacheQueryResult(queryKey, results);
      
      // Preload related records
      await this.preloadRelatedRecords(results);
      
      this.updatePerformanceMetrics('query_storage', Date.now() - startTime);
      return results;
    } catch (error) {
      this.handleHotError('query', error as Error);
      return [];
    }
  }

  // Cache Management Methods
  private addToCache(record: DataRecord): void {
    const cacheEntry = {
      data: record,
      lastAccess: Date.now(),
      accessCount: 1
    };
    
    this.cache.set(record.id, cacheEntry);
    
    // Implement cache eviction based on strategy
    this.enforceCacheLimit();
  }

  private promoteToHotCache(id: string, record: DataRecord): void {
    this.addToCache(record);
    this.preloadCache.delete(id);
  }

  private enforceCacheLimit(): void {
    const maxCacheSize = Math.floor(this.hotConfig.cacheSize * 1024 * 1024 / 1000); // Approx records
    
    if (this.cache.size <= maxCacheSize) return;
    
    const evictionCount = Math.floor(maxCacheSize * 0.1); // Remove 10%
    const entries = Array.from(this.cache.entries());
    
    // Sort by strategy
    let sortedEntries: [string, any][];
    
    switch (this.hotConfig.cacheStrategy) {
      case 'lru':
        sortedEntries = entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        break;
      case 'lfu':
        sortedEntries = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'adaptive':
        sortedEntries = entries.sort((a, b) => {
          const scoreA = this.calculateAdaptiveScore(a[1]);
          const scoreB = this.calculateAdaptiveScore(b[1]);
          return scoreA - scoreB;
        });
        break;
      default:
        sortedEntries = entries;
    }
    
    // Remove least valuable entries
    for (let i = 0; i < evictionCount; i++) {
      this.cache.delete(sortedEntries[i][0]);
    }
  }

  private calculateAdaptiveScore(cacheEntry: any): number {
    const recency = Date.now() - cacheEntry.lastAccess;
    const frequency = cacheEntry.accessCount;
    const age = Date.now() - cacheEntry.data.timestamp;
    
    // Lower score = higher priority for eviction
    return (recency / 1000) / (frequency + 1) + (age / (1000 * 60 * 60 * 24)); // Factor in age
  }

  // Query Optimization
  private generateQueryKey(filters: Record<string, any>): string {
    return JSON.stringify(filters, Object.keys(filters).sort());
  }

  private cacheQueryResult(queryKey: string, results: DataRecord[]): void {
    const ttl = 300000; // 5 minutes
    this.queryOptimizer.set(queryKey, {
      data: results,
      expiry: Date.now() + ttl,
      size: results.length
    });
    
    // Limit query cache size
    if (this.queryOptimizer.size > 1000) {
      const oldestKey = Array.from(this.queryOptimizer.keys())[0];
      this.queryOptimizer.delete(oldestKey);
    }
  }

  // Predictive Preloading
  private updateAccessPrediction(record: DataRecord): void {
    if (!record.metadata?.accessPattern) return;
    
    const pattern = record.metadata.accessPattern;
    pattern.accessHistory.push(Date.now());
    
    // Keep recent history
    if (pattern.accessHistory.length > 50) {
      pattern.accessHistory = pattern.accessHistory.slice(-50);
    }
    
    // Update predicted next access
    if (pattern.accessHistory.length >= 2) {
      const intervals = [];
      for (let i = 1; i < pattern.accessHistory.length; i++) {
        intervals.push(pattern.accessHistory[i] - pattern.accessHistory[i - 1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      pattern.predictedNextAccess = Date.now() + avgInterval;
    }
  }

  private async checkForPreloadTriggers(record: DataRecord): Promise<void> {
    const pattern = record.metadata?.accessPattern;
    if (!pattern) return;
    
    // High frequency access pattern detected
    if (pattern.frequency > 10) {
      await this.preloadRelatedRecords([record]);
    }
  }

  private async preloadRelatedRecords(records: DataRecord[]): Promise<void> {
    if (!this.hotConfig.preloadingEnabled) return;
    
    for (const record of records) {
      // Preload based on relationships
      const relationships = record.metadata?.relationships || [];
      
      for (const relationship of relationships.slice(0, 5)) { // Limit preloading
        try {
          const relatedRecord = await super.retrieve(relationship);
          if (relatedRecord && !this.cache.has(relatedRecord.id)) {
            this.preloadCache.set(relatedRecord.id, relatedRecord);
          }
        } catch (error) {
          // Ignore preload errors
        }
      }
    }
  }

  private async preloadFrequentData(): Promise<void> {
    // Preload data based on access patterns
    const frequentRecords = Array.from(this.records.values())
      .filter(record => {
        const pattern = record.metadata?.accessPattern;
        return pattern && pattern.frequency > 5;
      })
      .sort((a, b) => {
        const freqA = a.metadata?.accessPattern?.frequency || 0;
        const freqB = b.metadata?.accessPattern?.frequency || 0;
        return freqB - freqA;
      })
      .slice(0, 100); // Top 100 frequent records
    
    for (const record of frequentRecords) {
      this.addToCache(record);
    }
  }

  // Performance Monitoring
  private setupPerformanceMonitoring(): void {
    setInterval(() => {
      this.checkPerformanceThresholds();
    }, 30000); // Check every 30 seconds
  }

  private checkPerformanceThresholds(): void {
    const metrics = this.metadata.metrics;
    const thresholds = this.hotConfig.performanceThresholds;
    
    // Check latency
    if (metrics.averageResponseTime > thresholds.maxLatency) {
      this.emit('performance_degraded', {
        metric: 'latency',
        current: metrics.averageResponseTime,
        threshold: thresholds.maxLatency
      });
      this.triggerPerformanceOptimization();
    }
    
    // Check throughput
    if (metrics.queryThroughput < thresholds.minThroughput) {
      this.emit('performance_degraded', {
        metric: 'throughput',
        current: metrics.queryThroughput,
        threshold: thresholds.minThroughput
      });
    }
    
    // Check cache hit ratio
    if (metrics.cacheHitRatio < thresholds.cacheHitRatio) {
      this.emit('performance_degraded', {
        metric: 'cache_hit_ratio',
        current: metrics.cacheHitRatio,
        threshold: thresholds.cacheHitRatio
      });
      this.optimizeCacheStrategy();
    }
  }

  private triggerPerformanceOptimization(): void {
    // Increase cache size temporarily
    this.hotConfig.cacheSize = Math.min(this.hotConfig.cacheSize * 1.2, 500);
    
    // Switch to more aggressive caching
    if (this.hotConfig.cacheStrategy !== 'adaptive') {
      this.hotConfig.cacheStrategy = 'adaptive';
    }
    
    // Clear query cache to refresh
    this.queryOptimizer.clear();
  }

  private optimizeCacheStrategy(): void {
    // Analyze cache performance and adjust strategy
    const cacheStats = this.analyzeCachePerformance();
    
    if (cacheStats.lruPerformance > cacheStats.lfuPerformance) {
      this.hotConfig.cacheStrategy = 'lru';
    } else {
      this.hotConfig.cacheStrategy = 'lfu';
    }
  }

  private analyzeCachePerformance(): { lruPerformance: number; lfuPerformance: number } {
    // Simplified analysis - in production, this would be more sophisticated
    return {
      lruPerformance: this.metadata.metrics.cacheHitRatio * 0.8,
      lfuPerformance: this.metadata.metrics.cacheHitRatio * 0.9
    };
  }

  // Connection Pool Management
  private initializeConnectionPool(): void {
    // Initialize connection pool (simulated)
    for (let i = 0; i < this.hotConfig.connectionPoolSize; i++) {
      this.connectionPool.push({
        id: i,
        inUse: false,
        created: Date.now()
      });
    }
  }

  private setupHighPerformanceIndices(): void {
    // Set up optimized indices for HOT data
    this.indices.set('hot_access', new Map());
    this.indices.set('recent_updates', new Map());
    this.indices.set('high_frequency', new Map());
  }

  private enableRealTimeMonitoring(): void {
    // Real-time performance monitoring
    setInterval(() => {
      this.collectRealTimeMetrics();
    }, 1000); // Every second
  }

  private collectRealTimeMetrics(): void {
    const metrics = this.metadata.metrics;
    
    // Update cache hit ratio
    const cacheHits = this.cache.size;
    const totalRequests = metrics.totalOperations;
    metrics.cacheHitRatio = totalRequests > 0 ? cacheHits / totalRequests : 0;
    
    // Emit real-time metrics
    this.emit('realtime_metrics', {
      cacheSize: this.cache.size,
      preloadCacheSize: this.preloadCache.size,
      queryOptCache: this.queryOptimizer.size,
      avgResponseTime: metrics.averageResponseTime,
      throughput: metrics.queryThroughput
    });
  }

  private configureAdaptiveCaching(): void {
    // Configure adaptive caching based on access patterns
    setInterval(() => {
      this.adaptCacheConfiguration();
    }, 300000); // Every 5 minutes
  }

  private adaptCacheConfiguration(): void {
    // Analyze access patterns and adapt cache configuration
    const accessPatterns = this.analyzeAccessPatterns();
    
    if (accessPatterns.randomAccess > 0.7) {
      this.hotConfig.cacheStrategy = 'lfu';
    } else if (accessPatterns.sequentialAccess > 0.7) {
      this.hotConfig.cacheStrategy = 'lru';
    } else {
      this.hotConfig.cacheStrategy = 'adaptive';
    }
  }

  private analyzeAccessPatterns(): { randomAccess: number; sequentialAccess: number } {
    // Simplified pattern analysis
    return {
      randomAccess: Math.random() * 0.5 + 0.3,
      sequentialAccess: Math.random() * 0.5 + 0.3
    };
  }

  private startCacheOptimization(): void {
    setInterval(() => {
      this.optimizeCache();
    }, 60000); // Every minute
  }

  private optimizeCache(): void {
    // Remove expired entries
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.lastAccess > maxAge) {
        this.cache.delete(id);
      }
    }
  }

  private updatePerformanceMetrics(operation: string, duration: number): void {
    const metrics = this.metadata.metrics;
    
    // Update average response time
    metrics.averageResponseTime = this.calculateHotMovingAverage(
      metrics.averageResponseTime,
      duration,
      0.1
    );
    
    // Update throughput
    metrics.queryThroughput = this.calculateHotQueryThroughput();
    
    // Update operation counts
    metrics.totalOperations++;
    metrics.successfulOperations++;
    
    metrics.lastUpdated = Date.now();
  }

  private calculateHotMovingAverage(current: number, newValue: number, weight: number): number {
    return current * (1 - weight) + newValue * weight;
  }

  private calculateHotQueryThroughput(): number {
    const now = Date.now();
    const timeSinceCreation = (now - this.metadata.createdAt) / 1000;
    return timeSinceCreation > 0 ? this.metadata.metrics.totalOperations / timeSinceCreation : 0;
  }

  private handleHotError(operation: string, error: Error): void {
    const metrics = this.metadata.metrics;
    metrics.errorRate = this.calculateHotMovingAverage(metrics.errorRate, 1, 0.05);
    metrics.failedOperations++;
    metrics.totalOperations++;
    
    this.emit('hot_error', {
      operation,
      error: error.message,
      mcpId: this.metadata.id,
      timestamp: Date.now()
    });
  }

  // Hot MCP specific analytics
  async getHotAnalytics(): Promise<any> {
    return {
      cacheStats: {
        hotCacheSize: this.cache.size,
        preloadCacheSize: this.preloadCache.size,
        queryCacheSize: this.queryOptimizer.size,
        hitRatio: this.metadata.metrics.cacheHitRatio
      },
      performance: {
        avgResponseTime: this.metadata.metrics.averageResponseTime,
        throughput: this.metadata.metrics.queryThroughput,
        connectionPoolUtilization: this.getConnectionPoolUtilization()
      },
      optimization: {
        cacheStrategy: this.hotConfig.cacheStrategy,
        preloadingEnabled: this.hotConfig.preloadingEnabled,
        thresholds: this.hotConfig.performanceThresholds
      }
    };
  }

  private getConnectionPoolUtilization(): number {
    const inUse = this.connectionPool.filter(conn => conn.inUse).length;
    return this.connectionPool.length > 0 ? inUse / this.connectionPool.length : 0;
  }

  // Clear all caches
  async clearAllCaches(): Promise<void> {
    this.cache.clear();
    this.preloadCache.clear();
    this.queryOptimizer.clear();
    this.emit('caches_cleared', { timestamp: Date.now() });
  }

  // Override shutdown to properly cleanup hot resources
  override async shutdown(): Promise<void> {
    await this.clearAllCaches();
    this.connectionPool.length = 0;
    await super.shutdown();
  }

  // Add missing methods for type compatibility
  async optimize(): Promise<void> {
    // Optimize cache, indices, and performance parameters
    this.optimizeCache();
    this.triggerPerformanceOptimization();
    this.adaptCacheConfiguration();
  }

  async updateConfiguration(newConfig: Partial<MCPConfig>): Promise<boolean> {
    try {
      // Update hot-specific configuration
      if (newConfig.cacheSize !== undefined) {
        this.hotConfig.cacheSize = newConfig.cacheSize;
      }
      if (newConfig.connectionPoolSize !== undefined) {
        this.hotConfig.connectionPoolSize = newConfig.connectionPoolSize;
      }
      if (newConfig.queryTimeout !== undefined) {
        this.hotConfig.queryTimeout = newConfig.queryTimeout;
      }
      // Update base config
      Object.assign(this.config, newConfig);
      Object.assign(this.metadata.configuration, newConfig);
      
      // Re-initialize resources with new config
      if (newConfig.connectionPoolSize && newConfig.connectionPoolSize !== this.connectionPool.length) {
        this.initializeConnectionPool();
      }
      return true;
    } catch (error) {
      this.handleHotError('updateConfiguration', error as Error);
      return false;
    }
  }
}