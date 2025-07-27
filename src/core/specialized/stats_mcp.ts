/**
 * StatsMCP - Specialized MCP for analytics and metrics with specialized indexing
 * Optimized for time-series data, aggregations, and analytical queries
 */

import { BaseMCP } from '../mcp/base_mcp';
import { MCPConfig, DataRecord, MCPType, MCPDomain, ConsistencyLevel } from '../../types/mcp.types';

interface StatsData {
  id: string;
  metricName: string;
  category: string;
  value: number;
  dimensions: Record<string, string>;
  tags: string[];
  timestamp: number;
  source: string;
  aggregationLevel: 'raw' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  metadata: {
    unit: string;
    dataType: 'counter' | 'gauge' | 'histogram' | 'timer';
    precision: number;
    retention: number; // days
    rollupRules?: {
      interval: string;
      aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
    }[];
  };
  context: {
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    location?: string;
    environment: 'development' | 'staging' | 'production';
  };
  created: number;
}

export class StatsMCP extends BaseMCP {
  private metricIndex: Map<string, Set<string>> = new Map(); // metricName -> recordIds
  private categoryIndex: Map<string, Set<string>> = new Map(); // category -> recordIds
  private timeIndex: Map<string, Set<string>> = new Map(); // timeKey -> recordIds
  private dimensionIndex: Map<string, Map<string, Set<string>>> = new Map(); // dimension -> value -> recordIds
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> recordIds
  private sourceIndex: Map<string, Set<string>> = new Map(); // source -> recordIds
  private aggregationCache: Map<string, any> = new Map(); // aggregation results cache

  constructor(domain: MCPDomain, type: MCPType, config: Partial<MCPConfig> = {}) {
    super(domain, type, config);
    this.setupStatsSpecificIndices();
    this.startAggregationScheduler();
  }

  protected defineCapabilities() {
    return {
      queryTypes: ['select', 'insert', 'update', 'delete', 'aggregate', 'search'] as ('select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search')[],
      dataTypes: ['number', 'string', 'object', 'array'],
      maxConnections: 100,
      consistencyLevels: ['eventual'] as ConsistencyLevel[],
      transactionSupport: false,
      backupSupport: true,
      replicationSupport: true,
      encryptionSupport: false,
      compressionSupport: true,
      fullTextSearch: true,
      geospatialSupport: false,
      vectorSearch: false,
      streamingSupport: true
    };
  }

  protected optimizeForDomain() {}

  validateRecord(record: any): boolean {
    if (!record || typeof record !== 'object') return false;
    
    // Required fields validation
    if (!record.id || typeof record.id !== 'string') return false;
    if (!record.metricName || typeof record.metricName !== 'string') return false;
    if (!record.category || typeof record.category !== 'string') return false;
    if (typeof record.value !== 'number' || isNaN(record.value)) return false;
    if (!record.timestamp || typeof record.timestamp !== 'number') return false;
    if (!record.source || typeof record.source !== 'string') return false;
    
    // Aggregation level validation
    const validAggregationLevels = ['raw', 'minute', 'hour', 'day', 'week', 'month'];
    if (!record.aggregationLevel || !validAggregationLevels.includes(record.aggregationLevel)) {
      return false;
    }
    
    // Metadata validation
    if (!record.metadata || typeof record.metadata !== 'object') return false;
    if (!record.metadata.unit || typeof record.metadata.unit !== 'string') return false;
    
    const validDataTypes = ['counter', 'gauge', 'histogram', 'timer'];
    if (!record.metadata.dataType || !validDataTypes.includes(record.metadata.dataType)) {
      return false;
    }
    
    // Context validation
    if (!record.context || typeof record.context !== 'object') return false;
    const validEnvironments = ['development', 'staging', 'production'];
    if (!record.context.environment || !validEnvironments.includes(record.context.environment)) {
      return false;
    }

    return true;
  }

  private setupStatsSpecificIndices(): void {
    this.on('record_stored', (record: DataRecord) => {
      this.updateStatsIndices(record, 'create');
      this.invalidateAggregationCache(record.data as StatsData);
    });

    this.on('record_deleted', (record: DataRecord) => {
      this.updateStatsIndices(record, 'delete');
      this.invalidateAggregationCache(record.data as StatsData);
    });
  }

  private updateStatsIndices(record: DataRecord, operation: 'create' | 'delete'): void {
    const statsData = record.data as StatsData;
    
    if (operation === 'create') {
      // Metric index
      if (!this.metricIndex.has(statsData.metricName)) {
        this.metricIndex.set(statsData.metricName, new Set());
      }
      this.metricIndex.get(statsData.metricName)!.add(record.id);
      
      // Category index
      if (!this.categoryIndex.has(statsData.category)) {
        this.categoryIndex.set(statsData.category, new Set());
      }
      this.categoryIndex.get(statsData.category)!.add(record.id);
      
      // Source index
      if (!this.sourceIndex.has(statsData.source)) {
        this.sourceIndex.set(statsData.source, new Set());
      }
      this.sourceIndex.get(statsData.source)!.add(record.id);
      
      // Time indices
      const date = new Date(statsData.timestamp);
      const timeKeys = [
        `minute:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
        `hour:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}`,
        `day:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      ];
      
      for (const timeKey of timeKeys) {
        if (!this.timeIndex.has(timeKey)) {
          this.timeIndex.set(timeKey, new Set());
        }
        this.timeIndex.get(timeKey)!.add(record.id);
      }
      
      // Dimension indices
      for (const [dimensionName, dimensionValue] of Object.entries(statsData.dimensions)) {
        if (!this.dimensionIndex.has(dimensionName)) {
          this.dimensionIndex.set(dimensionName, new Map());
        }
        const dimensionMap = this.dimensionIndex.get(dimensionName)!;
        if (!dimensionMap.has(dimensionValue)) {
          dimensionMap.set(dimensionValue, new Set());
        }
        dimensionMap.get(dimensionValue)!.add(record.id);
      }
      
      // Tag indices
      for (const tag of statsData.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(record.id);
      }
      
    } else if (operation === 'delete') {
      // Remove from all indices
      this.metricIndex.get(statsData.metricName)?.delete(record.id);
      this.categoryIndex.get(statsData.category)?.delete(record.id);
      this.sourceIndex.get(statsData.source)?.delete(record.id);
      
      // Remove from time indices
      const date = new Date(statsData.timestamp);
      const timeKeys = [
        `minute:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
        `hour:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}`,
        `day:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      ];
      
      for (const timeKey of timeKeys) {
        this.timeIndex.get(timeKey)?.delete(record.id);
      }
      
      // Remove from dimension indices
      for (const [dimensionName, dimensionValue] of Object.entries(statsData.dimensions)) {
        this.dimensionIndex.get(dimensionName)?.get(dimensionValue)?.delete(record.id);
      }
      
      // Remove from tag indices
      for (const tag of statsData.tags) {
        this.tagIndex.get(tag)?.delete(record.id);
      }
    }
  }

  private invalidateAggregationCache(statsData: StatsData): void {
    // Invalidate cached aggregations that might be affected by this data
    const keysToDelete: string[] = [];
    for (const [key] of this.aggregationCache) {
      if (key.includes(statsData.metricName) || key.includes(statsData.category)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.aggregationCache.delete(key));
  }

  // Stats-specific query methods
  async getMetricData(metricName: string, options?: {
    startTime?: number;
    endTime?: number;
    dimensions?: Record<string, string>;
    aggregationLevel?: string;
    limit?: number;
  }): Promise<DataRecord[]> {
    const metricIds = this.metricIndex.get(metricName) || new Set();
    const records: DataRecord[] = [];
    
    for (const recordId of metricIds) {
      const record = await this.retrieve(recordId);
      if (!record) continue;
      
      const statsData = record.data as StatsData;
      
      // Apply filters
      if (options?.startTime && statsData.timestamp < options.startTime) continue;
      if (options?.endTime && statsData.timestamp > options.endTime) continue;
      if (options?.aggregationLevel && statsData.aggregationLevel !== options.aggregationLevel) continue;
      
      // Check dimensions
      if (options?.dimensions) {
        let dimensionMatch = true;
        for (const [dimName, dimValue] of Object.entries(options.dimensions)) {
          if (statsData.dimensions[dimName] !== dimValue) {
            dimensionMatch = false;
            break;
          }
        }
        if (!dimensionMatch) continue;
      }
      
      records.push(record);
    }
    
    records.sort((a, b) => (a.data as StatsData).timestamp - (b.data as StatsData).timestamp);
    return options?.limit ? records.slice(0, options.limit) : records;
  }

  async aggregateMetric(metricName: string, aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count', options?: {
    startTime?: number;
    endTime?: number;
    groupBy?: string; // time interval or dimension
    dimensions?: Record<string, string>;
  }): Promise<{ key: string; value: number; timestamp?: number }[]> {
    const cacheKey = `${metricName}:${aggregationType}:${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.aggregationCache.has(cacheKey)) {
      return this.aggregationCache.get(cacheKey);
    }
    
    const records = await this.getMetricData(metricName, options);
    const results: { key: string; value: number; timestamp?: number }[] = [];
    
    if (!options?.groupBy) {
      // Single aggregation
      const values = records.map(r => (r.data as StatsData).value);
      let aggregatedValue: number;
      
      switch (aggregationType) {
        case 'sum':
          aggregatedValue = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'avg':
          aggregatedValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
          break;
        case 'min':
          aggregatedValue = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          aggregatedValue = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
      }
      
      results.push({ key: 'total', value: aggregatedValue });
      
    } else {
      // Group by aggregation
      const groups: Map<string, number[]> = new Map();
      
      for (const record of records) {
        const statsData = record.data as StatsData;
        let groupKey: string;
        
        if (options.groupBy.startsWith('time:')) {
          const interval = options.groupBy.split(':')[1];
          const date = new Date(statsData.timestamp);
          
          switch (interval) {
            case 'minute':
              groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              break;
            case 'hour':
              groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}`;
              break;
            case 'day':
              groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              break;
            default:
              groupKey = statsData.timestamp.toString();
          }
        } else {
          // Group by dimension
          groupKey = statsData.dimensions[options.groupBy] || 'unknown';
        }
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(statsData.value);
      }
      
      for (const [groupKey, values] of groups) {
        let aggregatedValue: number;
        
        switch (aggregationType) {
          case 'sum':
            aggregatedValue = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'avg':
            aggregatedValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
            break;
          case 'min':
            aggregatedValue = values.length > 0 ? Math.min(...values) : 0;
            break;
          case 'max':
            aggregatedValue = values.length > 0 ? Math.max(...values) : 0;
            break;
          case 'count':
            aggregatedValue = values.length;
            break;
        }
        
        results.push({ 
          key: groupKey, 
          value: aggregatedValue,
          timestamp: options.groupBy.startsWith('time:') ? new Date(groupKey).getTime() : undefined
        });
      }
    }
    
    // Cache the result
    this.aggregationCache.set(cacheKey, results);
    
    return results;
  }

  async getTopMetrics(category: string, limit: number = 10, timeRange?: { start: number; end: number }): Promise<{
    metric: string;
    totalValue: number;
    avgValue: number;
    count: number;
  }[]> {
    const categoryIds = this.categoryIndex.get(category) || new Set();
    const metricStats: Map<string, { values: number[]; total: number }> = new Map();
    
    for (const recordId of categoryIds) {
      const record = await this.retrieve(recordId);
      if (!record) continue;
      
      const statsData = record.data as StatsData;
      
      if (timeRange) {
        if (statsData.timestamp < timeRange.start || statsData.timestamp > timeRange.end) {
          continue;
        }
      }
      
      if (!metricStats.has(statsData.metricName)) {
        metricStats.set(statsData.metricName, { values: [], total: 0 });
      }
      
      const stats = metricStats.get(statsData.metricName)!;
      stats.values.push(statsData.value);
      stats.total += statsData.value;
    }
    
    const results = Array.from(metricStats.entries()).map(([metric, stats]) => ({
      metric,
      totalValue: stats.total,
      avgValue: stats.values.length > 0 ? stats.total / stats.values.length : 0,
      count: stats.values.length
    }));
    
    results.sort((a, b) => b.totalValue - a.totalValue);
    return results.slice(0, limit);
  }

  private startAggregationScheduler(): void {
    // Run aggregation rollups every hour
    setInterval(() => {
      this.performScheduledAggregations();
    }, 3600000); // 1 hour
  }

  private async performScheduledAggregations(): Promise<void> {
    // Implement automatic rollup aggregations for better query performance
    // This would aggregate raw data into minute/hour/day summaries
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    try {
      // Get unique metrics that have raw data in the last hour
      const metricsToAggregate = new Set<string>();
      
      for (const [, record] of this.records) {
        const statsData = record.data as StatsData;
        if (statsData.aggregationLevel === 'raw' && 
            statsData.timestamp >= oneHourAgo && 
            statsData.timestamp < now) {
          metricsToAggregate.add(statsData.metricName);
        }
      }
      
      // Perform hourly aggregations for each metric
      for (const metricName of metricsToAggregate) {
        await this.createHourlyAggregation(metricName, oneHourAgo, now);
      }
      
    } catch (error) {
      console.error('Error during scheduled aggregations:', error);
    }
  }

  private async createHourlyAggregation(metricName: string, startTime: number, endTime: number): Promise<void> {
    const rawData = await this.getMetricData(metricName, {
      startTime,
      endTime,
      aggregationLevel: 'raw'
    });
    
    if (rawData.length === 0) return;
    
    // Group by hour and create aggregated records
    const hourlyGroups: Map<string, StatsData[]> = new Map();
    
    for (const record of rawData) {
      const statsData = record.data as StatsData;
      const date = new Date(statsData.timestamp);
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}`;
      
      if (!hourlyGroups.has(hourKey)) {
        hourlyGroups.set(hourKey, []);
      }
      hourlyGroups.get(hourKey)!.push(statsData);
    }
    
    // Create aggregated records
    for (const [hourKey, records] of hourlyGroups) {
      const firstRecord = records[0];
      const values = records.map(r => r.value);
      
      const aggregatedRecord: DataRecord = {
        id: `${metricName}_${hourKey}_hourly`,
        domain: 'stats',
        timestamp: new Date(hourKey).getTime(),
        data: {
          metricName,
          category: firstRecord.category,
          value: values.reduce((sum, val) => sum + val, 0) / values.length, // Average
          dimensions: firstRecord.dimensions,
          tags: firstRecord.tags,
          timestamp: new Date(hourKey).getTime(),
          source: 'aggregation',
          aggregationLevel: 'hour',
          metadata: {
            ...firstRecord.metadata,
            dataType: 'gauge' // Aggregated data is typically gauge
          },
          context: firstRecord.context,
          created: Date.now()
        }
      };
      
      await this.store(aggregatedRecord);
    }
  }

  async insert(data: any[], options?: any): Promise<any> {
    for (const item of data) {
      await this.store(item);
    }
    return { success: true };
  }

  async query(query: any): Promise<any> {
    if (query.metricName) {
      return this.getMetricData(query.metricName, query.options);
    }
    return null;
  }

  async update(id: string, data: any, options?: any): Promise<any> {
    const record = await this.retrieve(id);
    if (!record) return { success: false };
    const updatedRecord = { ...record, ...data };
    return this.store(updatedRecord);
  }

  async delete(id: string, options?: any): Promise<any> {
    return super.delete(id);
  }

  async createIndex(definition: any): Promise<any> {
    return { success: true };
  }

  protected async performOptimization(): Promise<any> {
    return { success: true };
  }

  protected async performBackup(destination: string): Promise<any> {
    return { success: true };
  }

  protected async performRestore(source: string): Promise<any> {
    return { success: true };
  }

  protected async createSnapshot(): Promise<any> {
    return { success: true };
  }

  protected async restoreFromSnapshot(snapshot: any): Promise<any> {
    return { success: true };
  }
}