/**
 * Predictive Caching Module for RAG System
 * Anticipates and pre-caches frequently accessed data
 */

import { InterpretedQuery, QueryResult } from '../../types/query.types';
import { PatternLearner } from './pattern_learner';

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  key: string;
  data: any;
  metadata: CacheMetadata;
  accessPattern: AccessPattern;
  predictions: CachePredictions;
}

/**
 * Cache metadata
 */
interface CacheMetadata {
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl: number;
  tags: string[];
  source: string;
  queryHash: string;
}

/**
 * Access pattern tracking
 */
interface AccessPattern {
  timestamps: number[];
  frequency: number;
  periodicity: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  peakTimes: number[];
  userSegments: string[];
}

/**
 * Cache predictions
 */
interface CachePredictions {
  nextAccessTime: number | null;
  probability: number;
  optimalTTL: number;
  preloadPriority: number;
  evictionScore: number;
}

/**
 * Cache warming task
 */
interface CacheWarmingTask {
  id: string;
  query: InterpretedQuery;
  priority: number;
  scheduledTime: number;
  reason: string;
  expectedBenefit: number;
}

/**
 * Cache statistics
 */
interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  warmingSuccessRate: number;
  avgLatencySaved: number;
  costSavings: number;
}

/**
 * Predictive cache system with ML-based optimization
 */
export class PredictiveCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessLog: Map<string, number[]> = new Map();
  private warmingQueue: CacheWarmingTask[] = [];
  private patternLearner: PatternLearner;
  private maxCacheSize: number = 1024 * 1024 * 1024; // 1GB
  private currentSize: number = 0;
  private statistics: CacheStatistics;
  private warmingInterval: NodeJS.Timeout | null = null;

  constructor(patternLearner: PatternLearner, maxSize?: number) {
    this.patternLearner = patternLearner;
    if (maxSize) this.maxCacheSize = maxSize;
    
    this.statistics = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      warmingSuccessRate: 0,
      avgLatencySaved: 0,
      costSavings: 0
    };
    
    this.startPredictiveWarming();
    this.startCacheMaintenance();
  }

  /**
   * Start predictive cache warming
   */
  private startPredictiveWarming(): void {
    this.warmingInterval = setInterval(() => {
      this.executeCacheWarming();
    }, 60000); // Every minute
  }

  /**
   * Start cache maintenance tasks
   */
  private startCacheMaintenance(): void {
    // TTL expiration check
    setInterval(() => {
      this.expireStaleCacheEntries();
    }, 30000); // Every 30 seconds

    // Adaptive TTL adjustment
    setInterval(() => {
      this.adjustTTLs();
    }, 300000); // Every 5 minutes

    // Cache optimization
    setInterval(() => {
      this.optimizeCacheLayout();
    }, 3600000); // Every hour
  }

  /**
   * Get cached result with predictive loading
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.statistics.missRate++;
      this.recordMiss(key);
      return null;
    }
    
    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.statistics.missRate++;
      this.recordMiss(key);
      return null;
    }
    
    // Update access pattern
    this.updateAccessPattern(entry);
    this.statistics.hitRate++;
    
    // Trigger predictive loading for related queries
    this.triggerPredictiveLoading(entry);
    
    return entry.data;
  }

  /**
   * Store result with intelligent TTL
   */
  async set(
    key: string,
    data: any,
    query: InterpretedQuery,
    result: QueryResult
  ): Promise<void> {
    const size = this.calculateDataSize(data);
    
    // Check if we need to evict entries
    if (this.currentSize + size > this.maxCacheSize) {
      await this.evictEntries(size);
    }
    
    // Calculate optimal TTL
    const ttl = await this.calculateOptimalTTL(query, result);
    
    // Create cache entry
    const entry: CacheEntry = {
      key,
      data,
      metadata: {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size,
        ttl,
        tags: this.extractTags(query),
        source: query.targetMCPs.join(','),
        queryHash: this.hashQuery(query)
      },
      accessPattern: {
        timestamps: [Date.now()],
        frequency: 1,
        periodicity: null,
        trend: 'stable',
        peakTimes: [],
        userSegments: []
      },
      predictions: {
        nextAccessTime: null,
        probability: 0.5,
        optimalTTL: ttl,
        preloadPriority: 0.5,
        evictionScore: 0.5
      }
    };
    
    this.cache.set(key, entry);
    this.currentSize += size;
    this.statistics.totalEntries++;
    this.statistics.totalSize = this.currentSize;
    
    // Learn from this caching event
    await this.learnFromCaching(query, result, ttl);
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.metadata.createdAt > entry.metadata.ttl;
  }

  /**
   * Update access pattern for entry
   */
  private updateAccessPattern(entry: CacheEntry): void {
    const now = Date.now();
    entry.metadata.lastAccessed = now;
    entry.metadata.accessCount++;
    entry.accessPattern.timestamps.push(now);
    
    // Keep only recent timestamps
    if (entry.accessPattern.timestamps.length > 100) {
      entry.accessPattern.timestamps.shift();
    }
    
    // Update frequency
    const timeSpan = now - entry.metadata.createdAt;
    entry.accessPattern.frequency = entry.metadata.accessCount / (timeSpan / 3600000); // Per hour
    
    // Detect periodicity
    entry.accessPattern.periodicity = this.detectPeriodicity(entry.accessPattern.timestamps);
    
    // Detect trend
    entry.accessPattern.trend = this.detectAccessTrend(entry.accessPattern.timestamps);
    
    // Update predictions
    this.updatePredictions(entry);
  }

  /**
   * Detect periodicity in access pattern
   */
  private detectPeriodicity(timestamps: number[]): number | null {
    if (timestamps.length < 10) return null;
    
    // Calculate intervals
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    // Find most common interval (with some tolerance)
    const tolerance = 60000; // 1 minute
    const intervalCounts = new Map<number, number>();
    
    intervals.forEach(interval => {
      // Round to nearest minute
      const rounded = Math.round(interval / tolerance) * tolerance;
      intervalCounts.set(rounded, (intervalCounts.get(rounded) || 0) + 1);
    });
    
    // Find most frequent interval
    let maxCount = 0;
    let mostCommonInterval = null;
    
    intervalCounts.forEach((count, interval) => {
      if (count > maxCount && count > intervals.length * 0.3) {
        maxCount = count;
        mostCommonInterval = interval;
      }
    });
    
    return mostCommonInterval;
  }

  /**
   * Detect access trend
   */
  private detectAccessTrend(timestamps: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (timestamps.length < 5) return 'stable';
    
    // Calculate access rate in windows
    const windowSize = Math.floor(timestamps.length / 3);
    const earlyWindow = timestamps.slice(0, windowSize);
    const lateWindow = timestamps.slice(-windowSize);
    
    const earlyRate = windowSize / (earlyWindow[earlyWindow.length - 1] - earlyWindow[0]);
    const lateRate = windowSize / (lateWindow[lateWindow.length - 1] - lateWindow[0]);
    
    const changeRate = (lateRate - earlyRate) / earlyRate;
    
    if (changeRate > 0.2) return 'increasing';
    if (changeRate < -0.2) return 'decreasing';
    return 'stable';
  }

  /**
   * Update predictions for cache entry
   */
  private updatePredictions(entry: CacheEntry): void {
    // Predict next access time
    if (entry.accessPattern.periodicity) {
      entry.predictions.nextAccessTime = 
        entry.metadata.lastAccessed + entry.accessPattern.periodicity;
    } else {
      // Use average interval
      const avgInterval = this.calculateAverageInterval(entry.accessPattern.timestamps);
      entry.predictions.nextAccessTime = 
        entry.metadata.lastAccessed + avgInterval;
    }
    
    // Calculate access probability
    const timeSinceLastAccess = Date.now() - entry.metadata.lastAccessed;
    const expectedInterval = entry.accessPattern.periodicity || 
      this.calculateAverageInterval(entry.accessPattern.timestamps);
    
    if (expectedInterval > 0) {
      entry.predictions.probability = Math.exp(-timeSinceLastAccess / expectedInterval);
    }
    
    // Calculate optimal TTL
    entry.predictions.optimalTTL = this.calculateOptimalTTLFromPattern(entry.accessPattern);
    
    // Calculate preload priority
    entry.predictions.preloadPriority = this.calculatePreloadPriority(entry);
    
    // Calculate eviction score
    entry.predictions.evictionScore = this.calculateEvictionScore(entry);
  }

  /**
   * Calculate average interval between accesses
   */
  private calculateAverageInterval(timestamps: number[]): number {
    if (timestamps.length < 2) return 3600000; // Default 1 hour
    
    let totalInterval = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalInterval += timestamps[i] - timestamps[i - 1];
    }
    
    return totalInterval / (timestamps.length - 1);
  }

  /**
   * Calculate optimal TTL from access pattern
   */
  private calculateOptimalTTLFromPattern(pattern: AccessPattern): number {
    // Base TTL on access frequency and trend
    let baseTTL = 3600000; // 1 hour default
    
    if (pattern.frequency > 10) {
      baseTTL = 7200000; // 2 hours for very frequent
    } else if (pattern.frequency > 5) {
      baseTTL = 3600000; // 1 hour for frequent
    } else if (pattern.frequency > 1) {
      baseTTL = 1800000; // 30 minutes for moderate
    } else {
      baseTTL = 900000; // 15 minutes for rare
    }
    
    // Adjust for trend
    if (pattern.trend === 'increasing') {
      baseTTL *= 1.5;
    } else if (pattern.trend === 'decreasing') {
      baseTTL *= 0.7;
    }
    
    // Adjust for periodicity
    if (pattern.periodicity) {
      baseTTL = Math.max(baseTTL, pattern.periodicity * 2);
    }
    
    return baseTTL;
  }

  /**
   * Calculate preload priority
   */
  private calculatePreloadPriority(entry: CacheEntry): number {
    let priority = 0.5;
    
    // Factor 1: Access frequency
    priority += Math.min(entry.accessPattern.frequency / 20, 0.2);
    
    // Factor 2: Prediction confidence
    priority += entry.predictions.probability * 0.2;
    
    // Factor 3: Data size (smaller = higher priority)
    const sizeFactor = 1 - (entry.metadata.size / (10 * 1024 * 1024)); // 10MB baseline
    priority += Math.max(0, sizeFactor * 0.1);
    
    // Factor 4: Trend
    if (entry.accessPattern.trend === 'increasing') {
      priority += 0.1;
    } else if (entry.accessPattern.trend === 'decreasing') {
      priority -= 0.1;
    }
    
    return Math.max(0, Math.min(1, priority));
  }

  /**
   * Calculate eviction score
   */
  private calculateEvictionScore(entry: CacheEntry): number {
    let score = 0.5;
    
    // Factor 1: Time since last access
    const timeSinceAccess = Date.now() - entry.metadata.lastAccessed;
    const ageFactor = Math.min(timeSinceAccess / (24 * 3600000), 1); // Max 1 day
    score += ageFactor * 0.3;
    
    // Factor 2: Access frequency (inverse)
    const freqFactor = 1 / (1 + entry.accessPattern.frequency);
    score += freqFactor * 0.3;
    
    // Factor 3: Size (larger = higher eviction score)
    const sizeFactor = entry.metadata.size / (10 * 1024 * 1024); // 10MB baseline
    score += Math.min(sizeFactor, 1) * 0.2;
    
    // Factor 4: Trend
    if (entry.accessPattern.trend === 'decreasing') {
      score += 0.1;
    } else if (entry.accessPattern.trend === 'increasing') {
      score -= 0.1;
    }
    
    // Factor 5: Prediction probability (inverse)
    score += (1 - entry.predictions.probability) * 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Trigger predictive loading for related queries
   */
  private async triggerPredictiveLoading(entry: CacheEntry): Promise<void> {
    // Get predictions from pattern learner
    const predictions = await this.patternLearner.getPredictions(
      entry.metadata.queryHash,
      undefined // Could pass userId if available
    );
    
    // Schedule warming tasks for likely next queries
    predictions.nextLikelyQueries.forEach((query, index) => {
      const task: CacheWarmingTask = {
        id: `warm_${Date.now()}_${index}`,
        query: this.parseQueryString(query), // Would need implementation
        priority: 0.8 - index * 0.1,
        scheduledTime: Date.now() + (index + 1) * 5000, // Stagger by 5 seconds
        reason: 'Predictive loading based on access pattern',
        expectedBenefit: predictions.estimatedExecutionTime * (0.8 - index * 0.1)
      };
      
      this.scheduleWarmingTask(task);
    });
  }

  /**
   * Schedule a cache warming task
   */
  private scheduleWarmingTask(task: CacheWarmingTask): void {
    // Insert in priority order
    const insertIndex = this.warmingQueue.findIndex(t => t.priority < task.priority);
    
    if (insertIndex === -1) {
      this.warmingQueue.push(task);
    } else {
      this.warmingQueue.splice(insertIndex, 0, task);
    }
    
    // Keep queue size reasonable
    if (this.warmingQueue.length > 100) {
      this.warmingQueue = this.warmingQueue.slice(0, 100);
    }
  }

  /**
   * Execute cache warming tasks
   */
  private async executeCacheWarming(): Promise<void> {
    const now = Date.now();
    const tasksToExecute = this.warmingQueue.filter(t => t.scheduledTime <= now);
    
    // Remove from queue
    this.warmingQueue = this.warmingQueue.filter(t => t.scheduledTime > now);
    
    // Execute tasks in parallel (with limit)
    const batchSize = 5;
    for (let i = 0; i < tasksToExecute.length; i += batchSize) {
      const batch = tasksToExecute.slice(i, i + batchSize);
      await Promise.all(batch.map(task => this.executeWarmingTask(task)));
    }
  }

  /**
   * Execute a single warming task
   */
  private async executeWarmingTask(task: CacheWarmingTask): Promise<void> {
    try {
      // This would actually execute the query
      // For now, we'll just simulate
      console.log(`Warming cache for query: ${task.query}`);
      
      // Update statistics
      this.statistics.warmingSuccessRate++;
    } catch (error) {
      console.error(`Failed to warm cache: ${error}`);
    }
  }

  /**
   * Calculate optimal TTL for a query
   */
  private async calculateOptimalTTL(
    query: InterpretedQuery,
    result: QueryResult
  ): Promise<number> {
    // Get predictions from pattern learner
    const predictions = await this.patternLearner.getPredictions(
      this.extractQueryPattern(query),
      undefined
    );
    
    let ttl = 3600000; // Default 1 hour
    
    // Adjust based on query characteristics
    if (query.entities.temporal === 'recent' || query.entities.temporal === 'today') {
      ttl = 300000; // 5 minutes for recent data
    } else if (query.entities.temporal === 'historical') {
      ttl = 86400000; // 24 hours for historical data
    }
    
    // Adjust based on data size
    const dataSize = this.calculateDataSize(result.data);
    if (dataSize > 10 * 1024 * 1024) { // 10MB
      ttl *= 0.5; // Shorter TTL for large data
    }
    
    // Adjust based on execution time
    if (result.duration > 5000) {
      ttl *= 1.5; // Longer TTL for expensive queries
    }
    
    // Adjust based on predictions
    if (predictions.estimatedExecutionTime > 2000) {
      ttl *= 1.3;
    }
    
    return Math.min(ttl, 86400000); // Max 24 hours
  }

  /**
   * Evict entries to make space
   */
  private async evictEntries(requiredSpace: number): Promise<void> {
    // Sort entries by eviction score
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry, score: entry.predictions.evictionScore }))
      .sort((a, b) => b.score - a.score);
    
    let freedSpace = 0;
    const toEvict: string[] = [];
    
    for (const { key, entry } of entries) {
      if (freedSpace >= requiredSpace) break;
      
      toEvict.push(key);
      freedSpace += entry.metadata.size;
    }
    
    // Evict entries
    toEvict.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.currentSize -= entry.metadata.size;
        this.cache.delete(key);
        this.statistics.evictionRate++;
      }
    });
  }

  /**
   * Expire stale cache entries
   */
  private expireStaleCacheEntries(): void {
    const now = Date.now();
    const toExpire: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.metadata.createdAt > entry.metadata.ttl) {
        toExpire.push(key);
      }
    });
    
    toExpire.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.currentSize -= entry.metadata.size;
        this.cache.delete(key);
      }
    });
  }

  /**
   * Adjust TTLs based on access patterns
   */
  private adjustTTLs(): void {
    this.cache.forEach(entry => {
      const newTTL = entry.predictions.optimalTTL;
      if (Math.abs(newTTL - entry.metadata.ttl) > 60000) { // 1 minute difference
        entry.metadata.ttl = newTTL;
      }
    });
  }

  /**
   * Optimize cache layout for better performance
   */
  private optimizeCacheLayout(): void {
    // This could reorganize cache based on access patterns
    // For now, we'll just update statistics
    this.updateStatistics();
  }

  /**
   * Update cache statistics
   */
  private updateStatistics(): void {
    const total = this.statistics.hitRate + this.statistics.missRate;
    if (total > 0) {
      const hitRate = this.statistics.hitRate / total;
      this.statistics.hitRate = hitRate;
      this.statistics.missRate = 1 - hitRate;
    }
    
    // Calculate average latency saved
    let totalLatencySaved = 0;
    let count = 0;
    
    this.cache.forEach(entry => {
      if (entry.metadata.accessCount > 1) {
        // Estimate latency saved per access
        totalLatencySaved += 1000 * (entry.metadata.accessCount - 1); // Assume 1s saved
        count += entry.metadata.accessCount - 1;
      }
    });
    
    if (count > 0) {
      this.statistics.avgLatencySaved = totalLatencySaved / count;
    }
    
    // Calculate cost savings (simplified)
    this.statistics.costSavings = this.statistics.avgLatencySaved * count * 0.001; // $0.001 per ms
  }

  /**
   * Record cache miss
   */
  private recordMiss(key: string): void {
    if (!this.accessLog.has(key)) {
      this.accessLog.set(key, []);
    }
    this.accessLog.get(key)!.push(Date.now());
    
    // Check if this key should be pre-cached
    const missCount = this.accessLog.get(key)!.length;
    if (missCount >= 3) {
      // Schedule for warming
      // This would need the actual query information
      console.log(`Key ${key} has ${missCount} misses - consider pre-caching`);
    }
  }

  /**
   * Learn from caching event
   */
  private async learnFromCaching(
    query: InterpretedQuery,
    result: QueryResult,
    ttl: number
  ): Promise<void> {
    // This would integrate with pattern learner
    // For now, just log
    console.log(`Learned from caching: TTL=${ttl}, Duration=${result.duration}`);
  }

  /**
   * Extract tags from query
   */
  private extractTags(query: InterpretedQuery): string[] {
    const tags: string[] = [];
    
    // Add intents as tags
    tags.push(...query.intents.map(intent => intent.type));
    
    // Add data type
    tags.push(query.entities.dataType);
    
    // Add temporal context
    if (query.entities.temporal) {
      tags.push(`temporal:${query.entities.temporal}`);
    }
    
    // Add MCP tags
    query.targetMCPs.forEach(mcp => tags.push(`mcp:${mcp}`));
    
    return tags;
  }

  /**
   * Calculate data size
   */
  private calculateDataSize(data: any): number {
    // Simplified size calculation
    return JSON.stringify(data).length;
  }

  /**
   * Hash query for key generation
   */
  private hashQuery(query: InterpretedQuery): string {
    const queryString = JSON.stringify({
      intents: query.intents,
      entities: query.entities,
      mcps: query.targetMCPs
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < queryString.length; i++) {
      const char = queryString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `query_${Math.abs(hash)}`;
  }

  /**
   * Extract query pattern
   */
  private extractQueryPattern(query: InterpretedQuery): string {
    return `${query.intents.join('_')}_${query.entities.dataType}`;
  }

  /**
   * Parse query string (placeholder)
   */
  private parseQueryString(query: string): InterpretedQuery {
    // This would need proper implementation
    return {} as InterpretedQuery;
  }

  /**
   * Get cache insights
   */
  getCacheInsights(): {
    statistics: CacheStatistics;
    topEntries: Array<{ key: string; accessCount: number; size: number }>;
    warmingQueue: CacheWarmingTask[];
    recommendations: string[];
  } {
    // Get top accessed entries
    const topEntries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.metadata.accessCount,
        size: entry.metadata.size
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (this.statistics.hitRate < 0.5) {
      recommendations.push('Low hit rate - consider increasing cache size or improving predictions');
    }
    
    if (this.statistics.evictionRate > 0.2) {
      recommendations.push('High eviction rate - cache may be too small');
    }
    
    if (this.warmingQueue.length > 50) {
      recommendations.push('Large warming queue - may need to optimize warming strategy');
    }
    
    return {
      statistics: this.statistics,
      topEntries,
      warmingQueue: this.warmingQueue.slice(0, 10),
      recommendations
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.warmingQueue = [];
    this.accessLog.clear();
  }

  /**
   * Stop background tasks
   */
  stop(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }
  }
}