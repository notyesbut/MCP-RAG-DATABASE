/**
 * LogsMCP - Specialized MCP for efficient log storage and querying
 * Optimized for high-volume log ingestion, searching, and retention management
 */

import { BaseMCP } from '../mcp/base_mcp';
import { MCPConfig, DataRecord, MCPType, MCPDomain, ConsistencyLevel } from '../../types/mcp.types';

interface LogData {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: {
    application: string;
    service: string;
    instance: string;
    host: string;
    version?: string;
  };
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    correlationId?: string;
  };
  details: {
    error?: {
      type: string;
      message: string;
      stack?: string;
      code?: string;
    };
    performance?: {
      duration: number;
      memory: number;
      cpu: number;
    };
    metadata?: Record<string, any>;
  };
  tags: string[];
  labels: Record<string, string>;
  structured: Record<string, any>;
  retention: {
    policy: 'debug' | 'standard' | 'long' | 'permanent';
    expiresAt?: number;
    archived?: boolean;
  };
  created: number;
}

export class LogsMCP extends BaseMCP {
  private levelIndex: Map<string, Set<string>> = new Map(); // level -> recordIds
  private sourceIndex: Map<string, Set<string>> = new Map(); // application -> recordIds
  private serviceIndex: Map<string, Set<string>> = new Map(); // service -> recordIds
  private hostIndex: Map<string, Set<string>> = new Map(); // host -> recordIds
  private timeIndex: Map<string, Set<string>> = new Map(); // timeKey -> recordIds
  private contextIndex: Map<string, Set<string>> = new Map(); // contextField -> recordIds
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> recordIds
  private errorIndex: Map<string, Set<string>> = new Map(); // errorType -> recordIds
  private retentionQueue: Map<string, Set<string>> = new Map(); // date -> recordIds to expire

  constructor(domain: MCPDomain, type: MCPType, config: Partial<MCPConfig> = {}) {
    super(domain, type, config);
    this.setupLogsSpecificIndices();
    this.startRetentionManager();
  }

  protected defineCapabilities() {
    return {
      queryTypes: ['select', 'insert', 'delete', 'search'] as ('select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search')[],
      dataTypes: ['string', 'number', 'object', 'array'],
      maxConnections: 200,
      consistencyLevels: ['eventual', 'weak'] as ConsistencyLevel[],
      transactionSupport: false,
      backupSupport: true,
      replicationSupport: false,
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
    if (!record.timestamp || typeof record.timestamp !== 'number') return false;
    if (!record.message || typeof record.message !== 'string') return false;
    
    // Level validation
    const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
    if (!record.level || !validLevels.includes(record.level)) return false;
    
    // Source validation
    if (!record.source || typeof record.source !== 'object') return false;
    if (!record.source.application || typeof record.source.application !== 'string') return false;
    if (!record.source.service || typeof record.source.service !== 'string') return false;
    if (!record.source.instance || typeof record.source.instance !== 'string') return false;
    if (!record.source.host || typeof record.source.host !== 'string') return false;
    
    // Retention policy validation
    if (record.retention && record.retention.policy) {
      const validPolicies = ['debug', 'standard', 'long', 'permanent'];
      if (!validPolicies.includes(record.retention.policy)) return false;
    }

    return true;
  }

  private setupLogsSpecificIndices(): void {
    this.on('record_stored', (record: DataRecord) => {
      this.updateLogsIndices(record, 'create');
      this.scheduleForRetention(record);
    });

    this.on('record_deleted', (record: DataRecord) => {
      this.updateLogsIndices(record, 'delete');
    });
  }

  private updateLogsIndices(record: DataRecord, operation: 'create' | 'delete'): void {
    const logData = record.data as LogData;
    
    if (operation === 'create') {
      // Level index
      if (!this.levelIndex.has(logData.level)) {
        this.levelIndex.set(logData.level, new Set());
      }
      this.levelIndex.get(logData.level)!.add(record.id);
      
      // Source indices
      if (!this.sourceIndex.has(logData.source.application)) {
        this.sourceIndex.set(logData.source.application, new Set());
      }
      this.sourceIndex.get(logData.source.application)!.add(record.id);
      
      if (!this.serviceIndex.has(logData.source.service)) {
        this.serviceIndex.set(logData.source.service, new Set());
      }
      this.serviceIndex.get(logData.source.service)!.add(record.id);
      
      if (!this.hostIndex.has(logData.source.host)) {
        this.hostIndex.set(logData.source.host, new Set());
      }
      this.hostIndex.get(logData.source.host)!.add(record.id);
      
      // Time indices
      const date = new Date(logData.timestamp);
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
      
      // Context indices
      if (logData.context.requestId) {
        const contextKey = `requestId:${logData.context.requestId}`;
        if (!this.contextIndex.has(contextKey)) {
          this.contextIndex.set(contextKey, new Set());
        }
        this.contextIndex.get(contextKey)!.add(record.id);
      }
      
      if (logData.context.traceId) {
        const contextKey = `traceId:${logData.context.traceId}`;
        if (!this.contextIndex.has(contextKey)) {
          this.contextIndex.set(contextKey, new Set());
        }
        this.contextIndex.get(contextKey)!.add(record.id);
      }
      
      // Tag indices
      for (const tag of logData.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(record.id);
      }
      
      // Error index
      if (logData.details.error) {
        if (!this.errorIndex.has(logData.details.error.type)) {
          this.errorIndex.set(logData.details.error.type, new Set());
        }
        this.errorIndex.get(logData.details.error.type)!.add(record.id);
      }
      
    } else if (operation === 'delete') {
      // Remove from all indices
      this.levelIndex.get(logData.level)?.delete(record.id);
      this.sourceIndex.get(logData.source.application)?.delete(record.id);
      this.serviceIndex.get(logData.source.service)?.delete(record.id);
      this.hostIndex.get(logData.source.host)?.delete(record.id);
      
      const date = new Date(logData.timestamp);
      const timeKeys = [
        `minute:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
        `hour:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}`,
        `day:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      ];
      
      for (const timeKey of timeKeys) {
        this.timeIndex.get(timeKey)?.delete(record.id);
      }
      
      if (logData.context.requestId) {
        this.contextIndex.get(`requestId:${logData.context.requestId}`)?.delete(record.id);
      }
      
      if (logData.context.traceId) {
        this.contextIndex.get(`traceId:${logData.context.traceId}`)?.delete(record.id);
      }
      
      for (const tag of logData.tags) {
        this.tagIndex.get(tag)?.delete(record.id);
      }
      
      if (logData.details.error) {
        this.errorIndex.get(logData.details.error.type)?.delete(record.id);
      }
    }
  }

  private determineRetentionPolicy(level: string): 'debug' | 'standard' | 'long' | 'permanent' {
    switch (level) {
      case 'debug': return 'debug';    // 1 day
      case 'info': return 'standard';  // 30 days
      case 'warn': return 'long';      // 90 days
      case 'error':
      case 'fatal': return 'permanent'; // Never delete
      default: return 'standard';
    }
  }

  private calculateExpirationTime(policy: string, timestamp: number): number | undefined {
    const retentionDays: Record<string, number> = {
      debug: 1,
      standard: 30,
      long: 90,
      permanent: 0 // Never expires
    };
    
    const days = retentionDays[policy];
    return days > 0 ? timestamp + (days * 24 * 60 * 60 * 1000) : undefined;
  }

  private generateAutoTags(logData: LogData): string[] {
    const tags: string[] = [];
    
    // Tag based on level
    tags.push(`level:${logData.level}`);
    
    // Tag based on source
    tags.push(`app:${logData.source.application}`);
    tags.push(`service:${logData.source.service}`);
    
    // Tag based on error presence
    if (logData.details.error) {
      tags.push('has-error');
      tags.push(`error:${logData.details.error.type}`);
    }
    
    // Tag based on performance data
    if (logData.details.performance) {
      tags.push('has-performance');
      if (logData.details.performance.duration > 1000) {
        tags.push('slow-request');
      }
    }
    
    // Tag based on message content
    const message = logData.message.toLowerCase();
    if (message.includes('timeout')) tags.push('timeout');
    if (message.includes('connection')) tags.push('connection');
    if (message.includes('database')) tags.push('database');
    if (message.includes('authentication')) tags.push('auth');
    if (message.includes('authorization')) tags.push('authz');
    
    return tags;
  }

  private calculateLogPriority(level: string, details: LogData['details']): number {
    let priority = 0;
    
    // Base priority by level
    switch (level) {
      case 'debug': priority = 1; break;
      case 'info': priority = 2; break;
      case 'warn': priority = 3; break;
      case 'error': priority = 4; break;
      case 'fatal': priority = 5; break;
    }
    
    // Boost priority for errors
    if (details.error) {
      priority += 2;
    }
    
    // Boost priority for performance issues
    if (details.performance && details.performance.duration > 5000) {
      priority += 1;
    }
    
    return priority;
  }

  private scheduleForRetention(record: DataRecord): void {
    const logData = record.data as LogData;
    if (logData.retention.expiresAt) {
      const expirationDate = new Date(logData.retention.expiresAt).toISOString().split('T')[0];
      if (!this.retentionQueue.has(expirationDate)) {
        this.retentionQueue.set(expirationDate, new Set());
      }
      this.retentionQueue.get(expirationDate)!.add(record.id);
    }
  }

  private startRetentionManager(): void {
    // Run retention cleanup daily
    setInterval(() => {
      this.performRetentionCleanup();
    }, 86400000); // 24 hours
  }

  private async performRetentionCleanup(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    for (const [expirationDate, recordIds] of this.retentionQueue) {
      if (expirationDate <= today) {
        for (const recordId of recordIds) {
          try {
            await this.delete(recordId);
          } catch (error) {
            console.error(`Failed to delete expired log record ${recordId}:`, error);
          }
        }
        this.retentionQueue.delete(expirationDate);
      }
    }
  }

  // Log-specific query methods
  async getLogsByLevel(level: string, options?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
    application?: string;
  }): Promise<DataRecord[]> {
    const levelIds = this.levelIndex.get(level) || new Set();
    const records: DataRecord[] = [];
    
    for (const recordId of levelIds) {
      const record = await this.retrieve(recordId);
      if (!record) continue;
      
      const logData = record.data as LogData;
      
      // Apply filters
      if (options?.startTime && logData.timestamp < options.startTime) continue;
      if (options?.endTime && logData.timestamp > options.endTime) continue;
      if (options?.application && logData.source.application !== options.application) continue;
      
      records.push(record);
    }
    
    records.sort((a, b) => (b.data as LogData).timestamp - (a.data as LogData).timestamp);
    return options?.limit ? records.slice(0, options.limit) : records;
  }

  async getLogsByTrace(traceId: string): Promise<DataRecord[]> {
    const contextKey = `traceId:${traceId}`;
    const recordIds = this.contextIndex.get(contextKey) || new Set();
    const records: DataRecord[] = [];
    
    for (const recordId of recordIds) {
      const record = await this.retrieve(recordId);
      if (record) records.push(record);
    }
    
    records.sort((a, b) => (a.data as LogData).timestamp - (b.data as LogData).timestamp);
    return records;
  }

  async getLogsByRequest(requestId: string): Promise<DataRecord[]> {
    const contextKey = `requestId:${requestId}`;
    const recordIds = this.contextIndex.get(contextKey) || new Set();
    const records: DataRecord[] = [];
    
    for (const recordId of recordIds) {
      const record = await this.retrieve(recordId);
      if (record) records.push(record);
    }
    
    records.sort((a, b) => (a.data as LogData).timestamp - (b.data as LogData).timestamp);
    return records;
  }

  async getErrorLogs(errorType?: string, options?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<DataRecord[]> {
    let recordIds: Set<string>;
    
    if (errorType) {
      recordIds = this.errorIndex.get(errorType) || new Set();
    } else {
      // Get all error and fatal logs
      const errorIds = this.levelIndex.get('error') || new Set();
      const fatalIds = this.levelIndex.get('fatal') || new Set();
      recordIds = new Set([...errorIds, ...fatalIds]);
    }
    
    const records: DataRecord[] = [];
    
    for (const recordId of recordIds) {
      const record = await this.retrieve(recordId);
      if (!record) continue;
      
      const logData = record.data as LogData;
      
      // Apply filters
      if (options?.startTime && logData.timestamp < options.startTime) continue;
      if (options?.endTime && logData.timestamp > options.endTime) continue;
      
      records.push(record);
    }
    
    records.sort((a, b) => (b.data as LogData).timestamp - (a.data as LogData).timestamp);
    return options?.limit ? records.slice(0, options.limit) : records;
  }

  async searchLogs(query: string, options?: {
    level?: string;
    application?: string;
    service?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<DataRecord[]> {
    const records: DataRecord[] = [];
    const queryLower = query.toLowerCase();
    
    for (const [, record] of this.records) {
      const logData = record.data as LogData;
      
      // Apply filters
      if (options?.level && logData.level !== options.level) continue;
      if (options?.application && logData.source.application !== options.application) continue;
      if (options?.service && logData.source.service !== options.service) continue;
      if (options?.startTime && logData.timestamp < options.startTime) continue;
      if (options?.endTime && logData.timestamp > options.endTime) continue;
      
      // Text search in message and structured data
      if (logData.message.toLowerCase().includes(queryLower) ||
          JSON.stringify(logData.structured).toLowerCase().includes(queryLower)) {
        records.push(record);
      }
    }
    
    records.sort((a, b) => (b.data as LogData).timestamp - (a.data as LogData).timestamp);
    return options?.limit ? records.slice(0, options.limit) : records;
  }

  // Analytics methods
  async getLogStats(timeRange?: { start: number; end: number }): Promise<any> {
    let totalLogs = 0;
    const byLevel: Record<string, number> = {};
    const byApplication: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};
    
    for (const [, record] of this.records) {
      const logData = record.data as LogData;
      
      if (timeRange) {
        if (logData.timestamp < timeRange.start || logData.timestamp > timeRange.end) {
          continue;
        }
      }
      
      totalLogs++;
      
      byLevel[logData.level] = (byLevel[logData.level] || 0) + 1;
      byApplication[logData.source.application] = (byApplication[logData.source.application] || 0) + 1;
      byService[logData.source.service] = (byService[logData.source.service] || 0) + 1;
      
      if (logData.details.error) {
        errorCounts[logData.details.error.type] = (errorCounts[logData.details.error.type] || 0) + 1;
      }
    }
    
    const errorLogs = (byLevel.error || 0) + (byLevel.fatal || 0);
    const errorRate = totalLogs > 0 ? errorLogs / totalLogs : 0;
    
    const topErrors = Object.entries(errorCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalLogs,
      byLevel,
      byApplication,
      byService,
      errorRate,
      topErrors
    };
  }

  async insert(data: any[], options?: any): Promise<any> {
    for (const item of data) {
      await this.store(item);
    }
    return { success: true };
  }

  async query(query: any): Promise<any> {
    if (query.level) {
      return this.getLogsByLevel(query.level, query.options);
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