/**
 * Query Types for Enterprise Multi-MCP Smart Database System
 * 
 * Defines comprehensive types for natural language query processing,
 * interpretation, and execution across multiple MCP instances.
 */

import { MCPDomain } from './mcp.types';

/**
 * Raw natural language query input
 */
export interface NaturalQuery {
  /** The raw natural language query string */
  raw: string;
  
  /** Optional context to improve query interpretation */
  context?: QueryContext;
  
  /** Query metadata */
  metadata?: QueryMetadata;
  
  /** User preferences for query execution */
  preferences?: QueryPreferences;
}

/**
 * Context information to improve query interpretation
 */
export interface QueryContext {
  /** User ID for personalized interpretation */
  userId?: string;
  
  /** Session ID for maintaining conversation context */
  sessionId?: string;
  
  /** Previous queries in the session */
  previousQueries?: string[];
  
  /** Current application state */
  applicationState?: Record<string, any>;
  
  /** User's typical query patterns */
  userPatterns?: UserQueryPattern[];
  
  /** Time zone for temporal queries */
  timeZone?: string;
  
  /** Language preference */
  language?: string;
  
  /** Geographic location for location-based queries */
  location?: GeographicContext;
}

/**
 * Geographic context for location-aware queries
 */
export interface GeographicContext {
  /** Latitude coordinate */
  latitude: number;
  
  /** Longitude coordinate */
  longitude: number;
  
  /** Country code */
  country?: string;
  
  /** City name */
  city?: string;
  
  /** Time zone identifier */
  timeZone?: string;
}

/**
 * User query pattern for personalization
 */
export interface UserQueryPattern {
  /** Pattern description */
  pattern: string;
  
  /** Frequency of this pattern */
  frequency: number;
  
  /** Typical data domains accessed */
  domains: MCPDomain[];
  
  /** Typical query complexity */
  complexity: QueryComplexity;
  
  /** Last used timestamp */
  lastUsed: number;
}

/**
 * Query complexity levels for optimization
 */
export type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'enterprise';

/**
 * Query metadata for tracking and optimization
 */
export interface QueryMetadata {
  /** Unique query identifier */
  id: string;
  
  /** Query timestamp */
  timestamp: number;
  
  /** Source of the query (API, UI, etc.) */
  source: QuerySource;
  
  /** Priority level for execution */
  priority: QueryPriority;
  
  /** Maximum execution time allowed */
  maxExecutionTime?: number;
  
  /** Query version for A/B testing */
  version?: string;
  
  /** Debug mode flag */
  debug?: boolean;
}

/**
 * Query source types
 */
export type QuerySource = 'api' | 'web_ui' | 'mobile_app' | 'cli' | 'scheduled' | 'webhook';

/**
 * Query source enum for backward compatibility
 */
export enum QuerySourceEnum {
  API = 'api',
  WEB_UI = 'web_ui',
  MOBILE_APP = 'mobile_app',
  CLI = 'cli',
  SCHEDULED = 'scheduled',
  WEBHOOK = 'webhook'
}

/**
 * Query priority levels
 */
export type QueryPriority = 'low' | 'normal' | 'high' | 'critical' | 'realtime';

/**
 * User preferences for query execution
 */
export interface QueryPreferences {
  /** Preferred response format */
  responseFormat: ResponseFormat;
  
  /** Maximum number of results */
  maxResults?: number;
  
  /** Include performance metrics in response */
  includeMetrics?: boolean;
  
  /** Preferred MCP types (hot/cold) */
  preferredMCPTypes?: ('hot' | 'cold')[];
  
  /** Cache preference */
  cachePreference: CachePreference;
  
  /** Consistency level preference */
  consistencyLevel?: 'strong' | 'eventual' | 'weak';
  
  /** Explanation level for query interpretation */
  explanationLevel: ExplanationLevel;
}

/**
 * Response format options
 */
export type ResponseFormat = 'json' | 'table' | 'chart' | 'summary' | 'raw';

/**
 * Cache preference options
 */
export type CachePreference = 'always' | 'never' | 'smart' | 'fresh_only';

/**
 * Explanation level for query interpretation
 */
export type ExplanationLevel = 'none' | 'basic' | 'detailed' | 'debug';

/**
 * Interpreted query after natural language processing
 */
export interface InterpretedQuery {
  /** Original natural query reference */
  originalQuery: NaturalQuery;
  
  /** Identified intents from the query */
  intents: QueryIntentDetails[];
  
  /** Extracted entities and their relationships */
  entities: QueryEntities;
  
  /** Target MCP instances to query */
  targetMCPs: string[];
  
  /** Query execution plan */
  executionPlan: QueryExecutionPlan;
  
  /** Result aggregation strategy */
  aggregationStrategy?: AggregationStrategy;
  
  /** Confidence score for interpretation (0-1) */
  confidence: number;
  
  /** Alternative interpretations */
  alternatives?: InterpretedQuery[];
  
  /** Query optimization suggestions */
  optimizations: QueryOptimization[];
  
  /** Human-readable explanation of the interpretation */
  explanation?: {
    interpretation: string;
    mcpSelection: string;
    executionPlan: string;
  };
}

/**
 * Query intent types and details
 */
export interface QueryIntentDetails {
  /** Intent type */
  type: IntentType;
  
  /** Confidence score for this intent */
  confidence: number;
  
  /** Parameters specific to this intent */
  parameters: Record<string, any>;
  
  /** Temporal aspects if applicable */
  temporal?: TemporalIntent;
  
  /** Spatial aspects if applicable */
  spatial?: SpatialIntent;
}

/**
 * Supported intent types
 */
export type IntentType = 
  | 'retrieve'          // Get data
  | 'aggregate'         // Summarize/group data
  | 'filter'            // Filter data by criteria
  | 'sort'              // Order data
  | 'compare'           // Compare data sets
  | 'trend'             // Analyze trends
  | 'count'             // Count records
  | 'search'            // Full-text search
  | 'relationship'      // Find relationships
  | 'anomaly'           // Detect anomalies

/**
 * Query intent enum for parser compatibility
 */
export enum QueryIntent {
  RETRIEVE = 'retrieve',
  AGGREGATE = 'aggregate',
  FILTER = 'filter',
  SORT = 'sort',
  COMPARE = 'compare',
  TREND = 'trend',
  COUNT = 'count',
  SEARCH = 'search',
  RELATIONSHIP = 'relationship',
  ANOMALY = 'anomaly',
  ANALYZE = 'analyze',
  UPDATE = 'update',
  DELETE = 'delete'
}

/**
 * Data type enum for parser compatibility
 */
export enum DataType {
  USERS = 'users',
  MESSAGES = 'messages',
  CHATS = 'chats',
  STATS = 'stats',
  METRICS = 'metrics',
  LOGS = 'logs',
  TOKENS = 'tokens',
  FILES = 'files'
}

/**
 * Temporal context enum for parser compatibility
 */
export enum TemporalContext {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_WEEK = 'last_week',
  LAST_MONTH = 'last_month',
  RECENT = 'recent',
  HISTORICAL = 'historical'
}

/**
 * RAG₂ Configuration for query processing
 */
export interface RAG2Config {
  /** Natural language processing settings */
  nlp: {
    confidence_threshold: number;
    entity_extraction_model: string;
    intent_recognition_model: string;
    language_models: string[];
  };
  
  /** Query execution settings */
  execution: {
    max_parallel_mcps: number;
    query_timeout: number;
    retry_attempts: number;
    fallback_enabled: boolean;
  };
  
  /** Caching configuration */
  caching: {
    enabled: boolean;
    default_ttl: number;
    max_cache_size: number;
    intelligent_invalidation: boolean;
  };
  
  /** Learning and optimization */
  learning: {
    enabled: boolean;
    pattern_learning_rate: number;
    performance_tracking: boolean;
    auto_optimization: boolean;
  };
}

/**
 * MCP Query Capability interface
 */
export interface MCPQueryCapability {
  /** MCP identifier */
  mcpId: string;
  
  /** Supported query types */
  queryTypes: string[];
  
  /** Data domains this MCP handles */
  domains: string[];
  
  /** Performance tier */
  tier: 'hot' | 'cold';
  
  /** Average response time */
  avgResponseTime: number;
  
  /** Current load */
  currentLoad: number;
  
  /** Maximum concurrent queries */
  maxConcurrentQueries: number;
  
  /** Priority score for selection */
  priority: number;
}

/**
 * Query execution plan for RAG₂
 */
export interface QueryExecutionPlan {
  /** Unique execution identifier */
  executionId: string;
  
  /** Execution phases */
  phases: QueryExecutionPhase[];
  
  /** Total estimated time */
  estimatedTime: number;
  
  /** Resource requirements */
  resourceRequirements: ResourceRequirements;
  
  /** Optimization notes */
  optimizations: string[];
  
  /** Execution strategy */
  strategy?: {
    type: 'sequential' | 'parallel' | 'hybrid';
    estimatedTotalTime: number;
    resourceRequirements: ResourceRequirements;
  };
  
  /** Fallback plans */
  fallbacks?: any[];
}

/**
 * Query execution phase
 */
export interface QueryExecutionPhase {
  /** Phase identifier */
  phase: string;
  
  /** Can this phase be executed in parallel */
  parallelizable: boolean;
  
  /** MCP queries in this phase */
  mcpQueries: MCPQueryFragment[];
  
  /** Dependencies on other phases */
  dependencies: string[];
  
  /** Estimated phase duration */
  estimatedDuration: number;
}

/**
 * MCP query fragment
 */
export interface MCPQueryFragment {
  /** Target MCP identifier */
  mcpId: string;
  
  /** Query to execute on this MCP */
  query: any;
  
  /** Priority of this query */
  priority: number;
  
  /** Expected result size */
  expectedResultSize: number;
  
  /** Timeout for this specific query */
  timeout: number;
}

/**
 * MCP result from query execution
 */
export interface MCPResult {
  /** MCP identifier */
  mcpId: string;
  
  /** Success status */
  success: boolean;
  
  /** Result data */
  data: any[];
  
  /** Execution metadata */
  metadata: {
    recordCount: number;
    queryTime: number;
    cacheHit: boolean;
    error?: string;
  };
  
  /** Original query fragment */
  queryFragment: any;
}

/**
 * Final query result from RAG₂
 */
export interface QueryResult {
  /** Execution identifier */
  executionId: string;
  
  /** Success status */
  success: boolean;
  
  /** Total execution duration */
  duration: number;
  
  /** Result timestamp */
  timestamp: number;
  
  /** Aggregated data */
  data: {
    primary: any[];
    metadata: {
      totalRecords: number;
      sources: Array<{
        mcpId: string;
        recordCount: number;
        queryTime: number;
      }>;
      aggregationApplied: string;
    };
  };
  
  /** Query metadata */
  metadata?: {
    executionTime: number;
    mcpId: string;
    optimizationStrategy: string;
    cacheHit: boolean;
    indexesUsed: string[];
    resourceUsage: {
      cpu: number;
      memory: number;
      io: number;
    };
  };
  
  /** Query sources */
  sources?: Array<{
    mcpId: string;
    recordCount: number;
    queryTime: number;
  }>;
  
  /** Query insights and explanations */
  insights: {
    interpretation: string;
    performanceNotes: string[];
    suggestions: string[];
  };
  
  /** Errors encountered */
  errors?: Array<{
    mcpId: string;
    error: string;
    severity: 'warning' | 'error' | 'critical';
    handlingStrategy: string;
  }>;
  
  /** Caching information */
  caching: {
    cached: boolean;
    cacheKey?: string;
    cacheTTL?: number;
    cacheHitRate?: number;
  };
  
  /** Results from query (alternative to data) */
  results?: any[];
  
  /** Learned patterns */
  learnedPatterns?: string[];
}

/**
 * Temporal intent for time-based queries
 */
export interface TemporalIntent {
  /** Time range specification */
  range: TimeRange;
  
  /** Granularity for time-based aggregation */
  granularity?: TimeGranularity;
  
  /** Relative time expressions */
  relative?: RelativeTime;
}

/**
 * Time range specification
 */
export interface TimeRange {
  /** Start time (Unix timestamp or ISO string) */
  start?: number | string;
  
  /** End time (Unix timestamp or ISO string) */
  end?: number | string;
  
  /** Duration in milliseconds */
  duration?: number;
  
  /** Time zone for interpretation */
  timeZone?: string;
}

/**
 * Time granularity options
 */
export type TimeGranularity = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Relative time expressions
 */
export type RelativeTime = 
  | 'now'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'last_hour'
  | 'last_24_hours'
  | 'last_7_days'
  | 'last_30_days';

/**
 * Spatial intent for location-based queries
 */
export interface SpatialIntent {
  /** Geographic boundary */
  boundary?: GeographicBoundary;
  
  /** Distance-based criteria */
  distance?: DistanceCriteria;
  
  /** Spatial relationship */
  relationship?: SpatialRelationship;
}

/**
 * Geographic boundary specification
 */
export interface GeographicBoundary {
  /** Boundary type */
  type: 'circle' | 'rectangle' | 'polygon' | 'country' | 'city' | 'state';
  
  /** Coordinates defining the boundary */
  coordinates: number[][];
  
  /** Radius for circle boundaries (in meters) */
  radius?: number;
}

/**
 * Distance-based criteria
 */
export interface DistanceCriteria {
  /** Reference point */
  center: [number, number]; // [longitude, latitude]
  
  /** Maximum distance in meters */
  maxDistance: number;
  
  /** Minimum distance in meters */
  minDistance?: number;
  
  /** Distance unit for display */
  unit: 'meters' | 'kilometers' | 'miles' | 'feet';
}

/**
 * Spatial relationship types
 */
export type SpatialRelationship = 'within' | 'contains' | 'intersects' | 'near' | 'far';

/**
 * Individual entity extracted from query
 */
export interface QueryEntity {
  /** Entity type (e.g., 'email', 'userId', 'temporal') */
  type: string;
  
  /** Entity value */
  value: any;
  
  /** Confidence score for this entity (0-1) */
  confidence: number;
  
  /** Position in original query text */
  position: {
    start: number;
    end: number;
  };
  
  /** Whether entity was derived from context */
  contextual?: boolean;
  
  /** Additional metadata for the entity */
  metadata?: Record<string, any>;
}

/**
 * Extracted entities from the query
 */
export interface QueryEntities {
  /** Primary data type being queried */
  dataType: string;
  
  /** Filters to apply to the data */
  filters: QueryFilter[];
  
  /** Fields to include in results */
  fields?: string[];
  
  /** Sorting criteria */
  sorting?: SortCriteria[];
  
  /** Pagination parameters */
  pagination?: PaginationCriteria;
  
  /** Grouping criteria for aggregations */
  grouping?: GroupingCriteria[];
  
  /** Join operations with other entities */
  joins?: JoinCriteria[];
  
  /** All extracted entities from the query */
  extractedEntities: QueryEntity[];
  
  /** Temporal context if time-based query */
  temporal?: TemporalContext;
}

/**
 * Query filter specification
 */
export interface QueryFilter {
  /** Field name to filter on */
  field: string;
  
  /** Filter operator */
  operator: FilterOperator;
  
  /** Filter value(s) */
  value: any;
  
  /** Logical connector to next filter */
  connector?: LogicalConnector;
  
  /** Nested filters for complex conditions */
  nested?: QueryFilter[];
  
  /** Case sensitivity for string comparisons */
  caseSensitive?: boolean;
}

/**
 * Filter operators
 */
export type FilterOperator = 
  | 'eq'
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'is_null'
  | 'is_not_null'
  | 'between'
  | 'exists';

/**
 * Logical connectors for combining filters
 */
export type LogicalConnector = 'and' | 'or' | 'not';

/**
 * Sorting criteria
 */
export interface SortCriteria {
  /** Field to sort by */
  field: string;
  
  /** Sort direction */
  direction: 'asc' | 'desc';
  
  /** Priority for multi-field sorting */
  priority: number;
  
  /** Null value handling */
  nullsFirst?: boolean;
}

/**
 * Pagination criteria
 */
export interface PaginationCriteria {
  /** Page number (1-based) */
  page: number;
  
  /** Number of results per page */
  pageSize: number;
  
  /** Offset for cursor-based pagination */
  offset?: number;
  
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Grouping criteria for aggregations
 */
export interface GroupingCriteria {
  /** Field to group by */
  field: string;
  
  /** Aggregation function to apply */
  aggregation: AggregationFunction;
  
  /** Alias for the aggregated result */
  alias?: string;
  
  /** Having clause for group filtering */
  having?: QueryFilter;
}

/**
 * Aggregation functions
 */
export type AggregationFunction = 
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'distinct_count'
  | 'median'
  | 'percentile'
  | 'stddev'
  | 'variance';

/**
 * Join criteria for multi-entity queries
 */
export interface JoinCriteria {
  /** Entity to join with */
  entity: string;
  
  /** Type of join */
  type: JoinType;
  
  /** Join conditions */
  conditions: JoinCondition[];
  
  /** Alias for the joined entity */
  alias?: string;
}

/**
 * Join types
 */
export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross';

/**
 * Join condition
 */
export interface JoinCondition {
  /** Left side field */
  leftField: string;
  
  /** Join operator */
  operator: FilterOperator;
  
  /** Right side field */
  rightField: string;
}

/**
 * Query execution plan
 */
export interface QueryExecutionPlan {
  /** Execution steps in order */
  steps: ExecutionStep[];
  
  /** Estimated execution time */
  estimatedTime: number;
  
  /** Resource requirements */
  resourceRequirements: ResourceRequirements;
  
  /** Optimization strategy */
  optimizationStrategy: OptimizationStrategy | 'standard';
  
  /** Parallelization opportunities */
  parallelization: ParallelizationPlan;
}

/**
 * Individual execution step
 */
export interface ExecutionStep {
  /** Step identifier */
  id: string;
  
  /** Step type */
  type: StepType;
  
  /** Target MCP for this step */
  targetMCP: string;
  
  /** Step-specific parameters */
  parameters: Record<string, any>;
  
  /** Dependencies on other steps */
  dependencies: string[];
  
  /** Estimated execution time for this step */
  estimatedTime: number;
  
  /** Resource requirements for this step */
  resources: ResourceRequirements;
}

/**
 * Execution step types
 */
export type StepType = 
  | 'query'
  | 'filter'
  | 'aggregate'
  | 'join'
  | 'sort'
  | 'transform'
  | 'validate'
  | 'cache';

/**
 * Resource requirements
 */
export interface ResourceRequirements {
  /** CPU cores required */
  cpu: number;
  
  /** Memory in MB */
  memory: number;
  
  /** Disk I/O in MB/s */
  diskIO: number;
  
  /** Network bandwidth in MB/s */
  networkBandwidth: number;
  
  /** Estimated data size to process */
  dataSize: number;
}

/**
 * Optimization strategy details
 */
export interface OptimizationStrategyDetails {
  /** Strategy name */
  name: string;
  
  /** Index usage plan */
  indexUsage: IndexUsagePlan[];
  
  /** Caching strategy */
  caching: CachingStrategy;
  
  /** Query rewriting optimizations */
  queryRewriting: string[];
  
  /** Data access pattern optimization */
  dataAccessPattern: DataAccessPattern;
}

/**
 * Index usage plan
 */
export interface IndexUsagePlan {
  /** Index name */
  indexName: string;
  
  /** MCP containing the index */
  mcpId: string;
  
  /** Expected selectivity */
  selectivity: number;
  
  /** Index coverage for the query */
  coverage: number;
}

/**
 * Caching strategy
 */
export interface CachingStrategy {
  /** Cache level (query, data, result) */
  level: CacheLevel;
  
  /** Cache key generation strategy */
  keyStrategy: string;
  
  /** Cache TTL in seconds */
  ttl: number;
  
  /** Cache invalidation triggers */
  invalidationTriggers: string[];
}

/**
 * Cache levels
 */
export type CacheLevel = 'query' | 'data' | 'result' | 'aggregation';

/**
 * Data access pattern
 */
export interface DataAccessPattern {
  /** Pattern type */
  type: AccessPatternType;
  
  /** Locality characteristics */
  locality: LocalityPattern;
  
  /** Temporal characteristics */
  temporal: TemporalPattern;
  
  /** Predicted access frequency */
  frequency: AccessFrequency;
}

/**
 * Access pattern types
 */
export type AccessPatternType = 'sequential' | 'random' | 'clustered' | 'temporal' | 'spatial';

/**
 * Locality patterns
 */
export type LocalityPattern = 'high' | 'medium' | 'low' | 'none';

/**
 * Temporal patterns
 */
export type TemporalPattern = 'recent' | 'historical' | 'mixed' | 'periodic';

/**
 * Access frequency predictions
 */
export type AccessFrequency = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

/**
 * Parallelization plan
 */
export interface ParallelizationPlan {
  /** Can steps be executed in parallel */
  parallel: boolean;
  
  /** Maximum parallelism degree */
  maxParallelism: number;
  
  /** Parallel execution groups */
  groups: ParallelExecutionGroup[];
  
  /** Synchronization points */
  synchronizationPoints: string[];
}

/**
 * Parallel execution group
 */
export interface ParallelExecutionGroup {
  /** Group identifier */
  id: string;
  
  /** Steps that can execute in parallel */
  steps: string[];
  
  /** Resource allocation for the group */
  resources: ResourceRequirements;
}

/**
 * Result aggregation strategy
 */
export interface AggregationStrategy {
  /** Aggregation type */
  type: AggregationType;
  
  /** Merge strategy for results from multiple MCPs */
  mergeStrategy: MergeStrategy;
  
  /** Conflict resolution for duplicate data */
  conflictResolution: ConflictResolution;
  
  /** Result transformation rules */
  transformations: ResultTransformation[];
}

/**
 * Aggregation types
 */
export type AggregationType = 'merge' | 'union' | 'intersection' | 'difference' | 'custom';

/**
 * Merge strategies
 */
export type MergeStrategy = 'append' | 'merge_by_key' | 'replace' | 'upsert' | 'custom';

/**
 * Conflict resolution strategies
 */
export type ConflictResolution = 'first_wins' | 'last_wins' | 'highest_priority' | 'merge_values' | 'error';

/**
 * Result transformation
 */
export interface ResultTransformation {
  /** Transformation type */
  type: TransformationType;
  
  /** Transformation parameters */
  parameters: Record<string, any>;
  
  /** Target fields */
  targetFields: string[];
  
  /** Conditional application */
  condition?: QueryFilter;
}

/**
 * Transformation types
 */
export type TransformationType = 
  | 'format'
  | 'calculate'
  | 'normalize'
  | 'anonymize'
  | 'enrich'
  | 'validate'
  | 'convert';

/**
 * Query optimization suggestions
 */
export interface QueryOptimization {
  /** Optimization type */
  type: OptimizationType;
  
  /** Description of the optimization */
  description: string;
  
  /** Expected performance improvement */
  expectedImprovement: number;
  
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high';
  
  /** Auto-applicable flag */
  autoApplicable: boolean;
  
  /** Optimization parameters */
  parameters: Record<string, any>;
  
  /** Whether to use caching for this query */
  useCache?: boolean;
  
  /** Suggested database indexes to improve performance */
  suggestedIndexes?: string[];
  
  /** Whether this query can be parallelized */
  parallelizable?: boolean;
  
  /** Estimated query complexity */
  estimatedComplexity?: 'low' | 'medium' | 'high';
}

/**
 * Optimization types
 */
export type OptimizationType = 
  | 'index_creation'
  | 'query_rewrite'
  | 'mcp_selection'
  | 'caching'
  | 'parallelization'
  | 'data_placement'
  | 'resource_allocation';

/**
 * Optimization strategy type
 */
export type OptimizationStrategy = 'standard' | 'aggressive' | 'balanced' | 'minimal';

/**
 * Query execution result
 */
export interface QueryExecutionResult<T = any> {
  /** Original natural query */
  originalQuery: NaturalQuery;
  
  /** Interpreted query */
  interpretedQuery: InterpretedQuery;
  
  /** Query results */
  data: T[];
  
  /** Total count across all MCPs */
  totalCount: number;
  
  /** Execution metadata */
  metadata: QueryExecutionMetadata;
  
  /** Results from individual MCPs */
  mcpResults: MCPExecutionResult[];
  
  /** Query explanation */
  explanation?: QueryExplanation;
  
  /** Performance metrics */
  performance: QueryPerformanceMetrics;
  
  /** Warnings or notices */
  warnings: QueryWarning[];
  
  /** Errors (if any) */
  errors: QueryError[];
}

/**
 * Query execution metadata
 */
export interface QueryExecutionMetadata {
  /** Execution identifier */
  executionId: string;
  
  /** Start timestamp */
  startTime: number;
  
  /** End timestamp */
  endTime: number;
  
  /** Total execution time */
  duration: number;
  
  /** Number of MCPs queried */
  mcpsQueried: number;
  
  /** Cache hit information */
  cacheHits: CacheHitInfo[];
  
  /** Resource usage */
  resourceUsage: ResourceUsage;
  
  /** Query version used */
  queryVersion?: string;
  
  /** A/B test variant */
  variant?: string;
}

/**
 * MCP execution result
 */
export interface MCPExecutionResult<T = any> {
  /** MCP identifier */
  mcpId: string;
  
  /** MCP domain */
  domain: MCPDomain;
  
  /** Results from this MCP */
  data: T[];
  
  /** Count from this MCP */
  count: number;
  
  /** Execution time for this MCP */
  executionTime: number;
  
  /** Cache hit status */
  cacheHit: boolean;
  
  /** Errors specific to this MCP */
  errors: QueryError[];
  
  /** MCP-specific metadata */
  metadata: Record<string, any>;
}

/**
 * Cache hit information
 */
export interface CacheHitInfo {
  /** Cache level */
  level: CacheLevel;
  
  /** Cache key */
  key: string;
  
  /** Hit or miss */
  hit: boolean;
  
  /** Cache age in seconds */
  age?: number;
  
  /** Time saved by cache hit */
  timeSaved?: number;
}

/**
 * Resource usage during execution
 */
export interface ResourceUsage {
  /** CPU time in milliseconds */
  cpuTime: number;
  
  /** Memory peak usage in MB */
  memoryPeak: number;
  
  /** Disk I/O in MB */
  diskIO: number;
  
  /** Network I/O in MB */
  networkIO: number;
  
  /** Number of database connections used */
  connections: number;
}

/**
 * Query explanation for transparency
 */
export interface QueryExplanation {
  /** Natural language explanation */
  summary: string;
  
  /** Detailed interpretation steps */
  interpretationSteps: InterpretationStep[];
  
  /** Execution plan explanation */
  executionSteps: ExecutionStepExplanation[];
  
  /** MCP selection reasoning */
  mcpSelection: MCPSelectionReasoning[];
  
  /** Optimization decisions */
  optimizations: OptimizationDecision[];
}

/**
 * Interpretation step explanation
 */
export interface InterpretationStep {
  /** Step description */
  description: string;
  
  /** Input to this step */
  input: any;
  
  /** Output from this step */
  output: any;
  
  /** Confidence level */
  confidence: number;
  
  /** Alternative interpretations considered */
  alternatives: string[];
}

/**
 * Execution step explanation
 */
export interface ExecutionStepExplanation {
  /** Step identifier */
  stepId: string;
  
  /** What this step does */
  purpose: string;
  
  /** Why this step is necessary */
  reasoning: string;
  
  /** Expected cost/benefit */
  costBenefit: string;
  
  /** Alternative approaches considered */
  alternatives: string[];
}

/**
 * MCP selection reasoning
 */
export interface MCPSelectionReasoning {
  /** MCP identifier */
  mcpId: string;
  
  /** Why this MCP was selected */
  reason: string;
  
  /** Selection criteria used */
  criteria: string[];
  
  /** Score for this MCP */
  score: number;
  
  /** Alternative MCPs considered */
  alternatives: string[];
}

/**
 * Optimization decision
 */
export interface OptimizationDecision {
  /** Optimization type */
  type: OptimizationType;
  
  /** Decision made */
  decision: string;
  
  /** Reasoning for the decision */
  reasoning: string;
  
  /** Expected impact */
  expectedImpact: string;
  
  /** Actual impact (if measured) */
  actualImpact?: string;
}

/**
 * Query performance metrics
 */
export interface QueryPerformanceMetrics {
  /** Parse time for natural language */
  parseTime: number;
  
  /** Interpretation time */
  interpretationTime: number;
  
  /** Planning time */
  planningTime: number;
  
  /** Execution time */
  executionTime: number;
  
  /** Aggregation time */
  aggregationTime: number;
  
  /** Total end-to-end time */
  totalTime: number;
  
  /** Throughput (results per second) */
  throughput: number;
  
  /** Memory efficiency */
  memoryEfficiency: number;
  
  /** Cache effectiveness */
  cacheEffectiveness: number;
  
  /** Index effectiveness */
  indexEffectiveness: number;
  
  /** Parallelization benefit */
  parallelizationBenefit: number;
}

/**
 * Query warning
 */
export interface QueryWarning {
  /** Warning code */
  code: string;
  
  /** Warning message */
  message: string;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  
  /** Suggestion for improvement */
  suggestion?: string;
  
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Query error
 */
export interface QueryError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** MCP where error occurred */
  mcpId?: string;
  
  /** Error details */
  details?: any;
  
  /** Error timestamp */
  timestamp: number;
  
  /** Is error recoverable */
  recoverable: boolean;
  
  /** Suggested recovery actions */
  recoveryActions?: string[];
}

/**
 * Type guards for query types
 */
export const QueryTypeGuards = {
  isNaturalQuery: (value: any): value is NaturalQuery => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.raw === 'string';
  },
  
  isInterpretedQuery: (value: any): value is InterpretedQuery => {
    return typeof value === 'object' &&
           value !== null &&
           QueryTypeGuards.isNaturalQuery(value.originalQuery) &&
           Array.isArray(value.intents) &&
           typeof value.entities === 'object' &&
           Array.isArray(value.targetMCPs);
  },
  
  isQueryIntent: (value: any): value is QueryIntent => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.type === 'string' &&
           typeof value.confidence === 'number' &&
           value.confidence >= 0 &&
           value.confidence <= 1;
  },
  
  isQueryExecutionResult: (value: any): value is QueryExecutionResult => {
    return typeof value === 'object' &&
           value !== null &&
           QueryTypeGuards.isNaturalQuery(value.originalQuery) &&
           QueryTypeGuards.isInterpretedQuery(value.interpretedQuery) &&
           Array.isArray(value.data);
  }
};