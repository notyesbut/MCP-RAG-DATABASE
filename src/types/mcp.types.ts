/**
 * Core MCP (Model Context Protocol) Types for Enterprise Multi-MCP Smart Database System
 * 
 * Defines the foundational type system for intelligent data routing and management
 * across multiple specialized MCP instances with HOT/COLD classification.
 */

/**
 * Classification types for MCP instances based on access patterns and data temperature
 */
export type MCPTypeString = 'hot' | 'cold';

/**
 * MCP Type enum for backward compatibility
 * Merged from multiple definitions to include all types
 */
export enum MCPType {
  // Data types
  VECTOR = 'vector',
  GRAPH = 'graph',
  DOCUMENT = 'document',
  TEMPORAL = 'temporal',
  SPATIAL = 'spatial',
  HYBRID = 'hybrid',
  // Domain types
  USER = 'user',
  CHAT = 'chat',
  STATS = 'stats',
  LOGS = 'logs',
  // Temperature types
  HOT = 'hot',
  COLD = 'cold'
}

/**
 * Domain categories for specialized MCP instances
 * Extensible string union allows for dynamic domain creation
 */
export type MCPDomain = 'user' | 'chat' | 'stats' | 'logs' | 'archive' | 'security' | 'analytics' | 'cache' | 'general' | string;

/**
 * Performance tiers for MCP optimization strategies
 */
export type MCPPerformanceTier = 'realtime' | 'standard' | 'batch' | 'archive';

/**
 * MCP Tier enum for compatibility
 * Temperature-based data classification
 */
export enum MCPTier {
  HOT = 'hot',      // Frequently accessed, high performance
  WARM = 'warm',    // Moderate access, balanced performance
  COLD = 'cold',    // Archive, optimized for storage
  ARCHIVE = 'archive' // Long-term storage
}

/**
 * Data consistency levels for cross-MCP operations
 */
export type ConsistencyLevel = 'strong' | 'eventual' | 'weak';

/**
 * Index strategies for optimizing data access patterns
 */
export type IndexStrategy = 
  | 'btree'           // B-tree for range queries
  | 'hash'            // Hash for exact matches
  | 'fulltext'        // Full-text search indexing
  | 'geospatial'      // Geographic data indexing
  | 'temporal'        // Time-series optimization
  | 'graph'           // Relationship-based indexing
  | 'vector'          // Vector similarity indexing
  | 'composite';      // Multi-column indexing

/**
 * Health status indicators for MCP instances
 */
export type MCPHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';

/**
 * MCP operational status
 */
export type MCPStatus = 'active' | 'inactive' | 'initializing' | 'error' | 'maintenance' | 'migrating';

/**
 * MCP Status enum for backward compatibility
 */
export enum MCPStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  INITIALIZING = 'initializing',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  MIGRATING = 'migrating'
}

/**
 * Active query tracking interface
 */
export interface ActiveQuery {
  /** Query unique identifier */
  id?: string;
  
  /** Query unique identifier (alias) */
  queryId?: string;
  
  /** Query string */
  query?: string;
  
  /** Query start time */
  startTime: number;
  
  /** Estimated completion time */
  estimatedTime: number;
  
  /** Estimated cost */
  estimatedCost: number;
  
  /** MCP load during query execution */
  mcpLoad: number;
  
  /** Query type */
  type?: string;
  
  /** Query status */
  status?: 'pending' | 'running' | 'completed' | 'failed';
  
  /** Target MCP ID */
  mcpId?: string;
  
  /** Query criteria */
  criteria?: Record<string, any>;
  
  /** Progress percentage (0-100) */
  progress?: number;
  
  /** Execution time */
  executionTime?: number;
  
  /** MCPs used */
  mcpsUsed?: string[];
  
  /** Result size */
  resultSize?: number;
}

/**
 * Data access patterns for optimization
 */
export type AccessPatternType = 'sequential' | 'random' | 'batch' | 'stream';

/**
 * Access pattern tracking interface
 */
export interface AccessPattern {
  /** Access frequency */
  frequency: number;
  
  /** Last accessed timestamp */
  lastAccessed: number;
  
  /** Access history */
  accessHistory: number[];
  
  /** Predicted next access */
  predictedNextAccess: number;
  
  /** Access type */
  accessType: string;
}

/**
 * MCP Performance metrics interface
 */
export interface MCPPerformance {
  avgQueryTime: number;
  avgReadLatency: number;
  avgWriteLatency: number;
  throughput: number;
  cacheHitRatio: number;
  cacheHitRate: number;  // Alias for compatibility
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsed: number;
  totalRecords?: number;
  lastUpdated: Date;
  averageResponseTime?: number;
}

/**
 * Alias for MCPHealthStatus (compatibility)
 */
export type HealthStatus = MCPHealthStatus;

/**
 * Configuration for MCP instances (alias for MCPConfiguration)
 */
export type MCPConfig = MCPConfiguration;

/**
 * Performance metrics (alias for MCPMetrics)
 */
export type PerformanceMetrics = MCPMetrics;

/**
 * Migration status for data movement between MCPs
 */
export type MigrationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Data classification types for intelligent routing
 */
export type DataClassificationType = 
  | 'user_data'
  | 'system_data'
  | 'analytics_data'
  | 'log_data'
  | 'cache_data'
  | 'archive_data'
  | 'security_data'
  | 'metadata'
  | 'temporary'
  | 'unknown';

/**
 * Data classification enum for temporal access patterns
 */
export enum DataClassification {
  REALTIME = 'realtime',
  FREQUENT = 'frequent',
  OCCASIONAL = 'occasional',
  ARCHIVE = 'archive'
}

/**
 * Security context for data classification
 */
export interface SecurityContext {
  /** Security level (0-1 scale) */
  level: number;
  
  /** Specific security requirements */
  requirements: string[];
}

/**
 * Compliance context for data classification
 */
export interface ComplianceContext {
  /** Compliance level (0-1 scale) */
  level: number;
  
  /** Specific compliance requirements */
  requirements: string[];
}

/**
 * Performance context for data classification
 */
export interface PerformanceContext {
  /** Performance level (0-1 scale) */
  level: number;
  
  /** Specific performance requirements */
  requirements: string[];
}

/**
 * Redundancy context for data classification
 */
export interface RedundancyContext {
  /** Redundancy level (0-1 scale) */
  level: number;
  
  /** Specific redundancy requirements */
  requirements: string[];
}

/**
 * Geographic context for data classification
 */
export interface GeographicContext {
  /** Geographic constraint level (0-1 scale) */
  level: number;
  
  /** Specific geographic requirements */
  requirements: string[];
}

/**
 * Data record interface for ingestion
 */
export interface DataRecord {
  /** Unique identifier for the record */
  id: string;
  
  /** The actual data payload */
  data: any;
  
  /** Domain classification */
  domain: MCPDomain;
  
  /** Record type */
  type: MCPType | string;
  
  /** Data size in bytes */
  size?: number;
  
  /** Routing information for intelligent MCP selection */
  routing?: {
    mcpId?: string;
    confidence?: number;
    reason?: string;
    distributionStrategy?: 'replicated' | 'sharded' | 'single';
    preferredMCPs?: string[];
    excludeMCPs?: string[];
    targetMCPs?: string[];
    strategy?: string;
    priority?: number;
  };
  
  /** Encryption status for security compliance */
  encrypted?: boolean;
  
  /** Access control tags for permission management */
  accessControlTags?: string[];
  
  /** Compliance flags for regulatory requirements */
  complianceFlags?: string[];
  
  /** Creation timestamp */
  timestamp: number;
  
  /** Additional metadata */
  metadata?: {
    source?: string;
    userId?: string;
    sessionId?: string;
    schema?: any;
    options?: any;
    batchId?: string;
    batchIndex?: number;
    accessPattern?: AccessPattern;
    [key: string]: any;
  };
}

/**
 * Routing decision from RAG₁
 */
export interface RoutingDecision {
  /** Target MCP instances for storage */
  targetMCPs: string[];
  
  /** Primary MCP ID */
  mcpId?: string;
  
  /** Routing strategy used */
  strategy: 'primary' | 'replicated' | 'sharded' | 'cached' | 'archived';
  
  /** Score for routing decision */
  score?: number;
  
  /** Reasoning for routing decision */
  reasons?: string[];
  
  /** Estimated latency for the routing */
  estimatedLatency?: number;
  
  /** Reliability score */
  reliability?: number;
  
  /** Cost factor */
  cost?: number;
  
  /** Priority level */
  priority?: number;
  
  /** Alternative routing options */
  alternativeRoutes?: string[][];
  
  /** Execution plan for storage */
  executionPlan: RoutingExecutionStep[];
  
  /** Confidence in routing decision */
  confidence: number;
  
  /** Reasoning for the routing decision */
  reasoning?: string;
}

/**
 * Routing execution step
 */
export interface RoutingExecutionStep {
  /** Step identifier */
  stepId: string;
  
  /** Target MCP for this step */
  targetMCP: string;
  
  /** Operation type */
  operation: 'store' | 'index' | 'replicate' | 'validate';
  
  /** Step parameters */
  parameters: Record<string, any>;
  
  /** Estimated duration in milliseconds */
  estimatedDuration: number;
  
  /** Dependencies on other steps */
  dependencies: string[];
}

/**
 * Comprehensive metadata for MCP instance management and optimization
 */
export interface MCPMetadata {
  /** Unique identifier for the MCP instance */
  id: string;
  
  /** Domain specialization of this MCP */
  domain: MCPDomain;
  
  /** Hot/Cold classification for performance optimization */
  type: MCPTypeString;
  
  /** Performance tier for resource allocation */
  performanceTier: MCPPerformanceTier;
  
  /** Temperature tier (hot/warm/cold) */
  tier?: MCPTier;
  
  /** Number of times this MCP has been accessed */
  accessFrequency: number;
  
  /** Timestamp of last access (Unix timestamp) */
  lastAccessed: number;
  
  /** Current number of records stored */
  recordCount: number;
  
  /** Name for the MCP instance */
  name: string;
  
  /** Creation timestamp */
  created: number;
  
  /** Access count for tier optimization */
  accessCount: number;
  
  /** Data size in bytes */
  dataSize: number;
  
  /** Tags for categorization */
  tags: string[];
  
  /** Current status */
  status: MCPStatus;
  
  /** Average record size in bytes */
  averageRecordSize: number;
  
  /** Total storage size in bytes */
  totalSize: number;
  
  /** Active indexing strategies */
  indexStrategies: IndexStrategy[];
  
  /** Current health status */
  healthStatus: MCPHealthStatus;
  
  /** Network location or connection details */
  endpoint: string;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
  
  /** Configuration settings specific to this MCP */
  configuration: MCPConfiguration;
  
  /** Performance metrics */
  metrics: MCPMetrics & {
    avgQueryTime?: number;
    errorRate?: number;
  };
  
  /** Data schema information (dynamic) */
  schema?: MCPSchema;
  
  /** Migration history */
  migrationHistory: MigrationRecord[];
  
  /** Related MCP instances for cross-references */
  relatedMCPs: string[];
}


export interface MCPConfiguration {
  /** MCP domain */
  domain?: MCPDomain;
  
  /** MCP type */
  type?: MCPTypeString;
  
  /** Maximum number of records before triggering migration */
  maxRecords: number;
  
  /** Maximum storage size in bytes before migration */
  maxSize: number;
  
  /** Cache size in MB */
  cacheSize: number;
  
  /** Connection pool size */
  connectionPoolSize: number;
  
  /** Query timeout in milliseconds */
  queryTimeout: number;
  
  /** Backup frequency in hours */
  backupFrequency: number;
  
  /** Compression enabled */
  compressionEnabled: boolean;
  
  /** Encryption enabled */
  encryptionEnabled: boolean;
  
  /** Auto migration configuration */
  autoMigration?: {
    enabled: boolean;
    thresholds: {
      recordCount?: number;
      storageSize?: number;
      performanceMetric?: number;
    };
  };
  
  /** Index strategies configuration */
  indexStrategies?: IndexStrategy[];
  
  /** Auto-indexing enabled */
  autoIndexing: boolean;
  
  /** Replication factor */
  replicationFactor: number;
  
  /** Consistency level for operations */
  consistencyLevel: ConsistencyLevel;
  
  /** Custom configuration properties */
  customProperties: Record<string, any>;
}

/**
 * Performance metrics for MCP monitoring and optimization
 */
export interface MCPMetrics {
  /** Average query response time in milliseconds */
  averageResponseTime: number;
  
  /** Average read latency in milliseconds */
  avgReadLatency: number;
  
  /** Average write latency in milliseconds */
  avgWriteLatency: number;
  
  /** Average throughput operations per second */
  avgThroughput: number;
  
  /** Operations throughput per second */
  throughput: number;
  
  /** Queries per second */
  queryThroughput: number;
  
  /** Current CPU utilization percentage */
  cpuUtilization: number;
  
  /** Current memory utilization percentage */
  memoryUtilization: number;
  
  /** Current disk utilization percentage */
  diskUtilization: number;
  
  /** Network I/O metrics */
  networkIO: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  
  /** Cache hit ratio */
  cacheHitRatio: number;
  
  /** Cache hit rate (alias for compatibility) */
  cacheHitRate: number;
  
  /** Error rate percentage */
  errorRate: number;
  
  /** Active connections count */
  activeConnections: number;
  
  /** Total successful operations */
  successfulOperations: number;
  
  /** Total failed operations */
  failedOperations: number;
  
  /** Total operations (successful + failed) */
  totalOperations: number;
  
  /** Last metrics update timestamp */
  lastUpdated: number;
}

/**
 * Dynamic schema information for MCP data structures
 */
export interface MCPSchema {
  /** Schema version for evolution tracking */
  version: string;
  
  /** Field definitions */
  fields: Record<string, FieldDefinition>;
  
  /** Index definitions */
  indexes: IndexDefinition[];
  
  /** Constraints and validation rules */
  constraints: ConstraintDefinition[];
  
  /** Schema metadata */
  metadata: {
    createdAt: number;
    updatedAt: number;
    migrationPaths: string[];
  };
}

/**
 * Field definition for dynamic schema management
 */
export interface FieldDefinition {
  /** Field data type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'binary';
  
  /** Is field required */
  required: boolean;
  
  /** Is field indexed */
  indexed: boolean;
  
  /** Default value */
  defaultValue?: any;
  
  /** Validation constraints */
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minimum?: number;
    maximum?: number;
    enum?: any[];
  };
  
  /** Field description */
  description?: string;
}

/**
 * Index definition for performance optimization
 */
export interface IndexDefinition {
  /** Index name */
  name: string;
  
  /** Index type/strategy */
  type: IndexStrategy;
  
  /** Fields included in the index */
  fields: string[];
  
  /** Is index unique */
  unique: boolean;
  
  /** Index options */
  options: Record<string, any>;
  
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Constraint definition for data integrity
 */
export interface ConstraintDefinition {
  /** Constraint name */
  name: string;
  
  /** Constraint type */
  type: 'unique' | 'foreign_key' | 'check' | 'not_null';
  
  /** Fields affected by constraint */
  fields: string[];
  
  /** Constraint parameters */
  parameters: Record<string, any>;
  
  /** Error message for constraint violations */
  errorMessage: string;
}

/**
 * Migration record for tracking data movement history
 */
export interface MigrationRecord {
  /** Migration unique identifier */
  id: string;
  
  /** Source MCP identifier */
  sourceMCP: string;
  
  /** Destination MCP identifier */
  destinationMCP: string;
  
  /** Number of records migrated */
  recordCount: number;
  
  /** Size of data migrated in bytes */
  dataSize: number;
  
  /** Migration status */
  status: MigrationStatus;
  
  /** Migration start timestamp */
  startedAt: number;
  
  /** Migration completion timestamp */
  completedAt?: number;
  
  /** Migration reason */
  reason: string;
  
  /** Migration strategy used */
  strategy: 'copy' | 'move' | 'replicate';
  
  /** Error details if migration failed */
  error?: {
    code: string;
    message: string;
    details: any;
  };
  
  /** Performance metrics for the migration */
  metrics: {
    throughput: number;
    duration: number;
    resourceUsage: Record<string, number>;
  };
}

/**
 * MCP operational capabilities
 */
export interface MCPCapabilities {
  /** Supported query types */
  queryTypes: ('select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search')[];
  
  /** Supported query types (alternate name for compatibility) */
  supportedQueryTypes?: string[];
  
  /** Supported data types */
  dataTypes: string[];
  
  /** Maximum concurrent connections */
  maxConnections: number;
  
  /** Supported consistency levels */
  consistencyLevels: ConsistencyLevel[];
  
  /** Transaction support */
  transactionSupport: boolean;
  
  /** Backup capabilities */
  backupSupport: boolean;
  
  /** Replication capabilities */
  replicationSupport: boolean;
  
  /** Encryption capabilities */
  encryptionSupport: boolean;
  
  /** Compression capabilities */
  compressionSupport: boolean;
  
  /** Full-text search capabilities */
  fullTextSearch: boolean;
  
  /** Geospatial query capabilities */
  geospatialSupport: boolean;
  
  /** Vector similarity search */
  vectorSearch: boolean;
  
  /** Real-time streaming capabilities */
  streamingSupport: boolean;
}

/**
 * MCP instance creation options
 */
export interface MCPCreationOptions {
  /** Domain for the new MCP */
  domain: MCPDomain;
  
  /** Initial type classification */
  type: MCPTypeString;
  
  /** Performance tier */
  performanceTier: MCPPerformanceTier;
  
  /** Initial configuration */
  configuration: Partial<MCPConfiguration>;
  
  /** Initial schema (optional) */
  schema?: MCPSchema;
  
  /** Tags for organization */
  tags?: string[];
  
  /** Custom metadata */
  customMetadata?: Record<string, any>;
}

/**
 * MCP query result interface
 */
export interface MCPQueryResult<T = any> {
  /** Query results */
  data: T[];
  
  /** Total count (may differ from data.length for paginated results) */
  totalCount: number;
  
  /** Query execution metadata */
  metadata: {
    /** Execution time in milliseconds */
    executionTime: number;
    
    /** MCP instance that handled the query */
    mcpId: string;
    
    /** Query optimization strategy used */
    optimizationStrategy: string;
    
    /** Cache hit status */
    cacheHit: boolean;
    
    /** Index usage information */
    indexesUsed: string[];
    
    /** Resource usage during query */
    resourceUsage: {
      cpu: number;
      memory: number;
      io: number;
    };
  };
  
  /** Pagination information */
  pagination?: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  
  /** Error information if query partially failed */
  errors?: QueryError[];
}

/**
 * Query error details
 */
export interface QueryError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** MCP instance where error occurred */
  mcpId: string;
  
  /** Additional error details */
  details?: any;
  
  /** Error timestamp */
  timestamp: number;
}

/**
 * Type guards for runtime type checking
 */
export const MCPTypeGuards = {
  isMCPType: (value: any): value is MCPType => {
    return typeof value === 'string' && ['hot', 'cold'].includes(value);
  },
  
  isMCPDomain: (value: any): value is MCPDomain => {
    return typeof value === 'string' && value.length > 0;
  },
  
  isPerformanceTier: (value: any): value is MCPPerformanceTier => {
    return typeof value === 'string' && 
           ['realtime', 'standard', 'batch', 'archive'].includes(value);
  },
  
  isHealthStatus: (value: any): value is MCPHealthStatus => {
    return typeof value === 'string' && 
           ['healthy', 'degraded', 'unhealthy', 'unreachable'].includes(value);
  },
  
  isMCPMetadata: (value: any): value is MCPMetadata => {
    return typeof value === 'object' && 
           value !== null &&
           typeof value.id === 'string' &&
           MCPTypeGuards.isMCPDomain(value.domain) &&
           MCPTypeGuards.isMCPType(value.type);
  },
  
  isDataRecord: (value: any): value is DataRecord => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.id === 'string' &&
           value.data !== undefined &&
           MCPTypeGuards.isMCPDomain(value.domain) &&
           typeof value.type === 'string' &&
           typeof value.timestamp === 'number';
  }
};

/**
 * MCP Query interface
 */
export interface MCPQuery {
  /** Query identifier */
  id?: string;
  
  /** Target MCP IDs or domains */
  targets?: string[] | MCPDomain[];
  
  /** Query type */
  type: 'select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search';
  
  /** Query criteria */
  criteria?: Record<string, any>;
  
  /** Query filters */
  filters?: Record<string, any>;
  
  /** Target domain */
  domain?: MCPDomain;
  
  /** Sort options */
  sort?: Record<string, 1 | -1>;
  
  /** Limit results */
  limit?: number;
  
  /** Skip results */
  skip?: number;
  
  /** Projection fields */
  projection?: string[];
  
  /** Query timeout */
  timeout?: number;
}

/**
 * Query Result (alias for MCPQueryResult)
 */
export type QueryResult<T = any> = MCPQueryResult<T>;

/**
 * Migration plan interface
 */
export interface MigrationPlan {
  /** Plan identifier */
  id: string;
  
  /** Source MCP */
  source: string;
  
  /** Target MCP */
  target: string;
  
  /** Records to migrate */
  recordCount: number;
  
  /** Estimated duration */
  estimatedDuration: number;
  
  /** Migration strategy */
  strategy: 'copy' | 'move' | 'replicate';
  
  /** Execution steps */
  steps: MigrationStep[];
  
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Scheduled execution time */
  scheduledTime?: number;
  
  /** Status */
  status?: 'pending' | 'running' | 'completed' | 'failed';
  
  /** Progress percentage */
  progress?: number;
  
  /** Start time */
  startTime?: number;
  
  /** Metadata */
  metadata?: any;
}

/**
 * Migration step interface
 */
export interface MigrationStep {
  /** Step ID */
  id: string;
  
  /** Step description */
  description: string;
  
  /** Operation type */
  operation: 'extract' | 'transform' | 'load' | 'validate';
  
  /** Estimated duration */
  estimatedDuration: number;
  
  /** Dependencies */
  dependencies: string[];
}

/**
 * MCP Registry configuration
 */
export interface MCPRegistryConfig {
  /** Instance ID */
  id: string;
  
  /** Domain */
  domain: MCPDomain;
  
  /** Type */
  type: MCPTypeString;
  
  /** Maximum MCP instances */
  maxInstances?: number;
  
  /** Default MCP configuration */
  defaultConfig?: Partial<MCPConfiguration>;
  
  /** Auto-scaling enabled */
  autoScaling?: boolean;
  
  /** Health check interval */
  healthCheckInterval?: number;
  
  /** Maximum records */
  maxRecords: number;
  
  /** Maximum size */
  maxSize?: number;
  
  /** Cache size */
  cacheSize?: number;
  
  /** Connection pool size */
  connectionPoolSize?: number;
  
  /** Query timeout */
  queryTimeout?: number;
  
  /** Backup frequency */
  backupFrequency?: number;
  
  /** Compression enabled */
  compressionEnabled?: boolean;
  
  /** Encryption enabled */
  encryptionEnabled?: boolean;
  
  /** Auto indexing */
  autoIndexing?: boolean;
  
  /** Replication factor */
  replicationFactor?: number;
  
  /** Custom properties */
  customProperties?: Record<string, any>;
  
  /** Maintenance window */
  maintenanceWindow?: {
    start: string;
    end: string;
    timezone: string;
  };
}

/**
 * MCP Factory interface
 */
export interface MCPFactory {
  /** Factory name */
  name: string;
  
  /** Create MCP instance */
  create(config: MCPConfiguration): BaseMCP;
  
  /** Validate configuration */
  validateConfig(config: MCPConfiguration): boolean;
  
  /** Get supported domains */
  getSupportedDomains(): MCPDomain[];
}

/**
 * MCP Instance interface
 */
export interface MCPInstance extends BaseMCP {
  /** Instance ID */
  id: string;
  
  /** Instance metadata */
  metadata: MCPMetadata;
  
  /** Health status */
  health: MCPHealth;
  
  /** Performance stats */
  stats: MCPStats;
  
  /** The actual MCP implementation */
  mcp?: BaseMCP;
  
  /** Event emitter functionality */
  emit?: (event: string, ...args: any[]) => boolean;
  
  /** Average query time in ms */
  averageQueryTime?: number;
  
  /** Error count */
  errorCount?: number;
  
  /** Access count */
  accessCount?: number;
  
  /** Last accessed timestamp */
  lastAccessed?: number;
}

/**
 * MCP Health interface
 */
export interface MCPHealth {
  /** Overall status */
  status: MCPHealthStatus;
  
  /** Last check timestamp */
  lastChecked: number;
  
  /** Response time in ms */
  responseTime: number;
  
  /** Error count */
  errorCount: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Uptime in seconds */
  uptime: number;
  
  /** Health details */
  details: {
    database: boolean;
    network: boolean;
    memory: boolean;
    cpu: boolean;
  };
  
  /** CPU usage percentage */
  cpuUsage?: number;
}

/**
 * MCP Stats interface
 */
export interface MCPStats {
  /** Total operations */
  totalOperations: number;
  
  /** Total records */
  totalRecords: number;
  
  /** Successful operations */
  successfulOperations: number;
  
  /** Failed operations */
  failedOperations: number;
  
  /** Average response time */
  averageResponseTime: number;
  
  /** Throughput per second */
  throughput: number;
  
  /** Current connections */
  activeConnections: number;
  
  /** Memory usage in bytes */
  memoryUsage: number;
  
  /** CPU usage percentage */
  cpuUsage: number;
  
  /** Disk usage in bytes */
  diskUsage: number;
  
  /** Network I/O */
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}

/**
 * Log Entry interface
 */
export interface LogEntry {
  /** Log ID */
  id: string;
  
  /** Timestamp */
  timestamp: number;
  
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  
  /** Source MCP */
  source: string;
  
  /** Log message */
  message: string;
  
  /** Additional data */
  data?: any;
  
  /** Stack trace for errors */
  stack?: string;
  
  /** User ID if applicable */
  userId?: string;
  
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Extended MCPConfiguration with additional properties
 */
export interface ExtendedMCPConfiguration extends MCPConfiguration {
  /** MCP instance ID */
  id?: string;
  
  /** MCP domain */
  domain?: MCPDomain;
  
  /** MCP type */
  type?: MCPTypeString;
  
  /** Backup strategy */
  backupStrategy?: 'incremental' | 'full' | 'snapshot';
}

/**
 * Extended MCPMetadata with additional properties
 */
export interface ExtendedMCPMetadata extends MCPMetadata {
  /** Performance metrics (alias) */
  performanceMetrics?: MCPMetrics;
}

// Commented out duplicate MCPQuery interface - using the one at line 801
// export interface MCPQuery {
//   id: string;
//   type: string;
//   query: any;
//   filters?: Record<string, any>;
//   options?: MCPQueryOptions;
//   timestamp: Date;
// }

/**
 * MCP Query Options
 */
export interface MCPQueryOptions {
  limit?: number;
  offset?: number;
  similarity?: number;
  includeMetadata?: boolean;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * MCP Query Result
 */
export interface MCPResult {
  success: boolean;
  data?: any[];
  metadata?: any;
  error?: string;
  executionTime: number;
  fromCache?: boolean;
  mcpId?: string;
  count?: number;
  source?: string;
}

/**
 * Import BaseMCP interface for MCP Instance
 */
export interface BaseMCP {
  id: string;
  domain: MCPDomain;
  type: MCPTypeString;
  
  // Core methods
  store(record: DataRecord): Promise<boolean>;
  retrieve(id: string): Promise<DataRecord | null>;
  query(filters: Record<string, any>): Promise<DataRecord[]>;
  update(record: DataRecord): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  create(record: DataRecord): Promise<boolean>;
  
  // Additional methods
  getId?(): string;
  getStatus?(): MCPStatus;
  setStatus?(status: MCPStatus): void;
  
  // Index management
  createIndex?(indexName: string, fields: string[], options?: any): Promise<boolean>;
  clearCache?(): Promise<void>;
  updateMetadata?(metadata: Partial<MCPMetadata>): Promise<boolean>;
  
  // Health and monitoring
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  }>;
  getMetrics(): Promise<{
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
  }>;
  getLogs(options: { limit?: number; level?: string; }): Promise<any[]>;
  getConfiguration(): MCPConfiguration;
  getMetadata(): MCPMetadata;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Capabilities
  getCapabilities(): MCPCapabilities;
  
  // Migration support
  prepareForMigration?(): Promise<DataRecord[]>;
  acceptMigration?(records: DataRecord[]): Promise<boolean>;
  
  // Optimization
  optimize?(): Promise<void>;
  
  // Configuration updates
  updateConfiguration?(config: Partial<MCPConfiguration>): Promise<boolean>;
}