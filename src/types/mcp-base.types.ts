/**
 * Base MCP type definitions for the Enterprise Multi-MCP Smart Database System
 * 
 * This file contains the foundational types for the Multi-Context Processor (MCP)
 * base class and related abstractions used throughout the system.
 */

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
  MCPQuery,
  QueryResult,
  MCPHealth,
  MCPStats,
  IndexStrategy,
  ConsistencyLevel
} from './mcp.types';

/**
 * Base MCP abstract class interface
 * Defines the contract for all MCP implementations
 */
export interface BaseMCPInterface extends EventEmitter {
  /** MCP metadata */
  metadata: MCPMetadata;
  
  /** Core MCP operations */
  store(record: DataRecord): Promise<string>;
  retrieve(id: string): Promise<DataRecord | null>;
  update(id: string, updates: Partial<DataRecord>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  query(query: MCPQuery): Promise<QueryResult>;
  
  /** Index management */
  createIndex(field: string, strategy: IndexStrategy): Promise<void>;
  dropIndex(field: string): Promise<void>;
  getIndices(): string[];
  
  /** Health and monitoring */
  getHealth(): Promise<MCPHealth>;
  getStats(): MCPStats;
  getCapabilities(): MCPCapabilities;
  
  /** Data management */
  clear(): Promise<void>;
  export(): Promise<any>;
  import(data: any): Promise<void>;
  
  /** Lifecycle management */
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Base MCP constructor options
 */
export interface BaseMCPOptions {
  /** MCP domain */
  domain: MCPDomain;
  
  /** MCP type */
  type: MCPType;
  
  /** Configuration overrides */
  config?: Partial<MCPConfig>;
  
  /** Initial capacity */
  initialCapacity?: number;
  
  /** Enable event logging */
  enableEventLogging?: boolean;
  
  /** Custom event handlers */
  eventHandlers?: MCPEventHandlers;
}

/**
 * MCP event handlers
 */
export interface MCPEventHandlers {
  /** Called when a record is stored */
  onStore?: (record: DataRecord) => void | Promise<void>;
  
  /** Called when a record is retrieved */
  onRetrieve?: (id: string, record: DataRecord | null) => void | Promise<void>;
  
  /** Called when a record is updated */
  onUpdate?: (id: string, updates: Partial<DataRecord>) => void | Promise<void>;
  
  /** Called when a record is deleted */
  onDelete?: (id: string) => void | Promise<void>;
  
  /** Called when a query is executed */
  onQuery?: (query: MCPQuery, result: QueryResult) => void | Promise<void>;
  
  /** Called when health status changes */
  onHealthChange?: (oldStatus: HealthStatus, newStatus: HealthStatus) => void | Promise<void>;
  
  /** Called on performance threshold breach */
  onPerformanceAlert?: (metrics: PerformanceMetrics) => void | Promise<void>;
}

/**
 * MCP lifecycle events
 */
export enum MCPLifecycleEvent {
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  READY = 'ready',
  BUSY = 'busy',
  IDLE = 'idle',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
  ERROR = 'error',
  RECOVERING = 'recovering',
  MAINTENANCE = 'maintenance'
}

/**
 * MCP operation events
 */
export enum MCPOperationEvent {
  STORE_START = 'store:start',
  STORE_SUCCESS = 'store:success',
  STORE_ERROR = 'store:error',
  RETRIEVE_START = 'retrieve:start',
  RETRIEVE_SUCCESS = 'retrieve:success',
  RETRIEVE_ERROR = 'retrieve:error',
  UPDATE_START = 'update:start',
  UPDATE_SUCCESS = 'update:success',
  UPDATE_ERROR = 'update:error',
  DELETE_START = 'delete:start',
  DELETE_SUCCESS = 'delete:success',
  DELETE_ERROR = 'delete:error',
  QUERY_START = 'query:start',
  QUERY_SUCCESS = 'query:success',
  QUERY_ERROR = 'query:error',
  INDEX_CREATED = 'index:created',
  INDEX_DROPPED = 'index:dropped',
  CAPACITY_WARNING = 'capacity:warning',
  CAPACITY_CRITICAL = 'capacity:critical'
}

/**
 * MCP internal state
 */
export interface MCPInternalState {
  /** Record storage */
  records: Map<string, DataRecord>;
  
  /** Index structures */
  indices: Map<string, Map<any, Set<string>>>;
  
  /** Performance tracking */
  performanceMetrics: PerformanceMetrics;
  
  /** Operation counters */
  operationCounts: {
    stores: number;
    retrieves: number;
    updates: number;
    deletes: number;
    queries: number;
  };
  
  /** Error tracking */
  errorCounts: {
    storeErrors: number;
    retrieveErrors: number;
    updateErrors: number;
    deleteErrors: number;
    queryErrors: number;
  };
  
  /** Cache structures */
  cache?: {
    queryCache: Map<string, { result: QueryResult; timestamp: number }>;
    recordCache: Map<string, { record: DataRecord; timestamp: number }>;
  };
  
  /** Lifecycle state */
  lifecycleState: MCPLifecycleState;
}

/**
 * MCP lifecycle state
 */
export interface MCPLifecycleState {
  /** Current state */
  current: MCPLifecycleEvent;
  
  /** Previous state */
  previous?: MCPLifecycleEvent;
  
  /** State transition timestamp */
  transitionTime: number;
  
  /** Initialization timestamp */
  initTime?: number;
  
  /** Ready timestamp */
  readyTime?: number;
  
  /** Total uptime in milliseconds */
  uptime: number;
  
  /** Error count since last ready state */
  errorsSinceReady: number;
}

/**
 * MCP migration interface
 */
export interface MCPMigration {
  /** Source MCP */
  source: BaseMCPInterface;
  
  /** Target MCP */
  target: BaseMCPInterface;
  
  /** Migration options */
  options: MCPMigrationOptions;
  
  /** Execute migration */
  execute(): Promise<MCPMigrationResult>;
  
  /** Validate migration */
  validate(): Promise<MCPMigrationValidation>;
  
  /** Rollback migration */
  rollback(): Promise<void>;
}

/**
 * MCP migration options
 */
export interface MCPMigrationOptions {
  /** Batch size for migration */
  batchSize: number;
  
  /** Include indices in migration */
  includeIndices: boolean;
  
  /** Verify data after migration */
  verifyData: boolean;
  
  /** Delete source data after successful migration */
  deleteSource: boolean;
  
  /** Consistency level required */
  consistencyLevel: ConsistencyLevel;
  
  /** Progress callback */
  onProgress?: (progress: MCPMigrationProgress) => void;
}

/**
 * MCP migration progress
 */
export interface MCPMigrationProgress {
  /** Total records to migrate */
  totalRecords: number;
  
  /** Records migrated */
  migratedRecords: number;
  
  /** Progress percentage */
  progressPercent: number;
  
  /** Current batch */
  currentBatch: number;
  
  /** Total batches */
  totalBatches: number;
  
  /** Elapsed time in milliseconds */
  elapsedTime: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining: number;
  
  /** Current phase */
  phase: 'preparing' | 'migrating' | 'verifying' | 'completing';
}

/**
 * MCP migration result
 */
export interface MCPMigrationResult {
  /** Migration success */
  success: boolean;
  
  /** Records migrated */
  recordsMigrated: number;
  
  /** Records failed */
  recordsFailed: number;
  
  /** Indices migrated */
  indicesMigrated: string[];
  
  /** Total duration in milliseconds */
  duration: number;
  
  /** Verification result */
  verificationResult?: MCPMigrationValidation;
  
  /** Error details if failed */
  error?: {
    message: string;
    failedRecords: string[];
    lastProcessedId?: string;
  };
}

/**
 * MCP migration validation
 */
export interface MCPMigrationValidation {
  /** Validation passed */
  valid: boolean;
  
  /** Record count matches */
  recordCountMatch: boolean;
  
  /** Source record count */
  sourceCount: number;
  
  /** Target record count */
  targetCount: number;
  
  /** Data integrity checks */
  integrityChecks: {
    /** Checksum validation */
    checksumMatch: boolean;
    
    /** Sample record validation */
    sampleValidation: boolean;
    
    /** Index validation */
    indexValidation: boolean;
  };
  
  /** Validation errors */
  errors: string[];
}

/**
 * Type guards for MCP base types
 */
export const MCPBaseTypeGuards = {
  /**
   * Check if object implements BaseMCPInterface
   */
  isBaseMCP: (obj: any): obj is BaseMCPInterface => {
    return obj &&
      typeof obj.store === 'function' &&
      typeof obj.retrieve === 'function' &&
      typeof obj.update === 'function' &&
      typeof obj.delete === 'function' &&
      typeof obj.query === 'function' &&
      typeof obj.getHealth === 'function' &&
      typeof obj.getStats === 'function';
  },

  /**
   * Check if object is a valid MCPMigrationResult
   */
  isMCPMigrationResult: (obj: any): obj is MCPMigrationResult => {
    return obj &&
      typeof obj.success === 'boolean' &&
      typeof obj.recordsMigrated === 'number' &&
      typeof obj.recordsFailed === 'number' &&
      typeof obj.duration === 'number';
  },

  /**
   * Check if lifecycle event is valid
   */
  isValidLifecycleEvent: (event: any): event is MCPLifecycleEvent => {
    return Object.values(MCPLifecycleEvent).includes(event);
  },

  /**
   * Check if operation event is valid
   */
  isValidOperationEvent: (event: any): event is MCPOperationEvent => {
    return Object.values(MCPOperationEvent).includes(event);
  }
};

/**
 * Export BaseMCP type for backward compatibility
 * Note: The actual implementation should extend EventEmitter and implement BaseMCPInterface
 */
export type BaseMCP = BaseMCPInterface;