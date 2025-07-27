/**
 * Type Definitions Index for Enterprise Multi-MCP Smart Database System
 * 
 * Central export point for all TypeScript type definitions used throughout
 * the multi-MCP smart database system. This ensures consistent type usage
 * and provides a single import location for all types.
 */

// Core MCP Types - using specific exports to avoid conflicts
export {
  // Export only types that actually exist in mcp.types.ts
  MCPType,
  MCPDomain,
  MCPMetadata,
  MCPConfiguration,
  MCPMetrics,
  MCPCapabilities,
  MCPHealthStatus,
  MCPPerformanceTier,
  ConsistencyLevel,
  IndexStrategy,
  MigrationStatus,
  MCPQueryResult,
  QueryError as MCPQueryError,
  MCPTypeGuards,
  DataRecord,
  MCPInstance,
  MCPTypeString,
  // Additional types that exist in mcp.types.ts
  AccessPattern,
  AccessPatternType,
  BaseMCP,
  ComplianceContext,
  ConstraintDefinition,
  DataClassification,
  DataClassificationType,
  ExtendedMCPConfiguration,
  ExtendedMCPMetadata,
  FieldDefinition,
  GeographicContext as MCPGeographicContext,
  HealthStatus,
  IndexDefinition,
  LogEntry,
  MCPConfig,
  MCPCreationOptions,
  MCPFactory,
  MCPHealth,
  MCPQuery,
  MCPRegistryConfig,
  MCPSchema,
  MCPStats,
  MCPStatus,
  MCPTier,
  MigrationPlan,
  MigrationRecord,
  MigrationStep,
  PerformanceContext,
  PerformanceMetrics,
  QueryResult as MCPQueryResultBase,
  RedundancyContext,
  RoutingDecision,
  RoutingExecutionStep,
  SecurityContext
} from './mcp.types';

export {
  // Export only types that actually exist in query.types.ts
  NaturalQuery,
  InterpretedQuery,
  QueryIntent,
  QueryEntities,
  QueryFilter,
  QueryExecutionResult,
  QueryExecutionPlan,
  QueryMetadata,
  QueryContext,
  QueryPreferences,
  QueryComplexity,
  QueryPriority,
  QuerySource,
  ResponseFormat,
  CachePreference,
  ExplanationLevel,
  IntentType,
  FilterOperator,
  LogicalConnector,
  AggregationFunction,
  JoinType,
  SortCriteria,
  PaginationCriteria,
  GroupingCriteria,
  JoinCriteria,
  TimeGranularity,
  RelativeTime,
  AccessPatternType as QueryAccessPatternType,
  OptimizationType,
  QueryError,
  QueryWarning,
  QueryPerformanceMetrics,
  QueryTypeGuards,
  RAG2Config,
  QueryResult,
  QueryExecutionMetadata,
  MCPExecutionResult,
  CacheHitInfo,
  QueryExplanation,
  CachingStrategy,
  QueryIntentDetails,
  StepType,
  ResourceRequirements,
  ResourceUsage,
  OptimizationStrategy,
  MergeStrategy,
  ConflictResolution,
  TransformationType,
  QueryOptimization,
  DataType,
  TemporalContext,
  QuerySourceEnum,
  // Additional types that exist in query.types.ts
  GeographicContext,
  UserQueryPattern,
  TemporalIntent,
  SpatialIntent,
  QueryEntity,
  ExecutionStep,
  DataAccessPattern,
  LocalityPattern,
  TemporalPattern,
  AccessFrequency,
  ParallelizationPlan,
  ParallelExecutionGroup,
  AggregationStrategy,
  AggregationType,
  ResultTransformation,
  InterpretationStep,
  ExecutionStepExplanation,
  MCPSelectionReasoning,
  OptimizationDecision,
  TimeRange,
  SpatialRelationship,
  GeographicBoundary,
  DistanceCriteria,
  JoinCondition,
  CacheLevel,
  IndexUsagePlan,
  MCPQueryCapability,
  QueryExecutionPhase,
  MCPQueryFragment,
  MCPResult
} from './query.types';

export {
  // Export only types that actually exist in registry.types.ts
  MCPRegistry,
  RegisteredMCP,
  RegistryConfiguration,
  RegistryMetrics,
  RegistrationStatus,
  LoadBalancingAlgorithm,
  FailoverStrategy,
  DiscoveryMechanism,
  ServiceEndpoint,
  EndpointType,
  HealthCheckResult,
  HealthMetrics,
  MCPPerformanceStats,
  StatsPeriod,
  BackupInfo,
  BackupSchedule,
  RetentionPolicy as RegistryRetentionPolicy,
  AlertSeverity,
  AlertFrequency,
  RegistryEventType,
  RegistryEvent,
  EventSeverity,
  LoadBalancingStrategy,
  LoadBalancingConfig,
  CircuitBreakerConfig,
  ConnectionPoolInfo,
  ConnectionPoolStats,
  RegistryTypeGuards,
  // Additional types that exist in registry.types.ts
  AccessControlPolicy,
  AlertChannel,
  AlertCondition,
  AlertRule,
  AlertingConfig,
  AuthorizationScheme,
  BackupEncryption,
  CacheMetrics,
  ConflictResolutionStrategy,
  ConsistencyLevel as RegistryConsistencyLevel,
  ConsistencyRequirements,
  CustomHealthCheck,
  DataTransferMetrics,
  EscalationPolicy,
  EscalationStep,
  HealthCheckEndpoint,
  HealthMonitoringConfig,
  KeyManagement,
  PolicyCondition,
  RateLimitingConfig,
  RegistryEventHandler,
  RegistrySecurity,
  ResourceUtilizationMetrics,
  ResponseValidation,
  ServiceDiscoveryInfo,
  TLSConfig,
  WeightFactor
} from './registry.types';

// Type guard exports for runtime type checking are already included above


/**
 * Common utility types used across the system
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  /** Response data */
  data: T;
  
  /** Success indicator */
  success: boolean;
  
  /** Response message */
  message?: string;
  
  /** Response metadata */
  metadata?: ResponseMetadata;
  
  /** Errors if any */
  errors?: ApiError[];
  
  /** Warnings if any */
  warnings?: ApiWarning[];
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Request timestamp */
  timestamp: number;
  
  /** Request ID for tracing */
  requestId: string;
  
  /** Response time in milliseconds */
  responseTime: number;
  
  /** API version */
  version: string;
  
  /** Pagination info for paginated responses */
  pagination?: PaginationInfo;
  
  /** Rate limiting info */
  rateLimit?: RateLimitInfo;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page */
  currentPage: number;
  
  /** Items per page */
  pageSize: number;
  
  /** Total number of items */
  totalItems: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Has next page */
  hasNext: boolean;
  
  /** Has previous page */
  hasPrevious: boolean;
  
  /** Next page URL */
  nextPageUrl?: string;
  
  /** Previous page URL */
  previousPageUrl?: string;
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;
  
  /** Total requests allowed in window */
  limit: number;
  
  /** Window reset time (Unix timestamp) */
  resetTime: number;
  
  /** Retry after (seconds) if rate limited */
  retryAfter?: number;
}

/**
 * API error structure
 */
export interface ApiError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Error details */
  details?: any;
  
  /** Field that caused the error (for validation errors) */
  field?: string;
  
  /** Stack trace (development only) */
  stack?: string;
  
  /** Error timestamp */
  timestamp: number;
}

/**
 * API warning structure
 */
export interface ApiWarning {
  /** Warning code */
  code: string;
  
  /** Warning message */
  message: string;
  
  /** Warning details */
  details?: any;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  
  /** Warning timestamp */
  timestamp: number;
}

/**
 * Configuration interface for system-wide settings
 */
export interface SystemConfiguration {
  /** Environment (development, staging, production) */
  environment: Environment;
  
  /** Logging configuration */
  logging: LoggingConfig;
  
  /** Security configuration */
  security: SecurityConfig;
  
  /** Performance configuration */
  performance: PerformanceConfig;
  
  /** Feature flags */
  features: FeatureFlags;
  
  /** External service configurations */
  externalServices: ExternalServiceConfig;
}

/**
 * Environment types
 */
export type Environment = 'development' | 'testing' | 'staging' | 'production';

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level */
  level: LogLevel;
  
  /** Log format */
  format: 'json' | 'text' | 'structured';
  
  /** Log output destinations */
  outputs: LogOutput[];
  
  /** Log rotation settings */
  rotation: LogRotationConfig;
  
  /** Sensitive field masking */
  sensitiveFields: string[];
}

/**
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log output destinations
 */
export type LogOutput = 'console' | 'file' | 'database' | 'remote';

/**
 * Log rotation configuration
 */
export interface LogRotationConfig {
  /** Maximum file size before rotation */
  maxSize: string;
  
  /** Maximum number of files to keep */
  maxFiles: number;
  
  /** Rotation frequency */
  frequency: 'daily' | 'weekly' | 'monthly';
  
  /** Compress rotated files */
  compress: boolean;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Authentication settings */
  authentication: AuthenticationConfig;
  
  /** Authorization settings */
  authorization: AuthorizationConfig;
  
  /** Encryption settings */
  encryption: EncryptionConfig;
  
  /** CORS settings */
  cors: CorsConfig;
  
  /** Rate limiting */
  rateLimiting: GlobalRateLimitConfig;
  
  /** Security headers */
  securityHeaders: SecurityHeadersConfig;
}

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  /** Authentication method */
  method: AuthMethod;
  
  /** JWT settings */
  jwt?: JwtConfig;
  
  /** OAuth settings */
  oauth?: OAuthConfig;
  
  /** Session settings */
  session?: SessionConfig;
}

/**
 * Authentication methods
 */
export type AuthMethod = 'jwt' | 'oauth' | 'session' | 'api_key' | 'none';

/**
 * JWT configuration
 */
export interface JwtConfig {
  /** Secret key */
  secret: string;
  
  /** Token expiration */
  expiresIn: string;
  
  /** Refresh token expiration */
  refreshExpiresIn: string;
  
  /** Issuer */
  issuer: string;
  
  /** Algorithm */
  algorithm: string;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  /** OAuth providers */
  providers: OAuthProvider[];
  
  /** Default provider */
  defaultProvider: string;
  
  /** Callback URL */
  callbackUrl: string;
}

/**
 * OAuth provider
 */
export interface OAuthProvider {
  /** Provider name */
  name: string;
  
  /** Client ID */
  clientId: string;
  
  /** Client secret */
  clientSecret: string;
  
  /** Authorization URL */
  authUrl: string;
  
  /** Token URL */
  tokenUrl: string;
  
  /** User info URL */
  userInfoUrl: string;
  
  /** Scopes */
  scopes: string[];
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session secret */
  secret: string;
  
  /** Session timeout */
  timeout: number;
  
  /** Cookie settings */
  cookie: CookieConfig;
  
  /** Store type */
  store: 'memory' | 'redis' | 'database';
}

/**
 * Cookie configuration
 */
export interface CookieConfig {
  /** Cookie name */
  name: string;
  
  /** Max age */
  maxAge: number;
  
  /** HTTP only */
  httpOnly: boolean;
  
  /** Secure flag */
  secure: boolean;
  
  /** Same site policy */
  sameSite: 'strict' | 'lax' | 'none';
}

/**
 * Authorization configuration
 */
export interface AuthorizationConfig {
  /** RBAC enabled */
  rbacEnabled: boolean;
  
  /** Default roles */
  defaultRoles: string[];
  
  /** Resource-based permissions */
  resourcePermissions: ResourcePermission[];
}

/**
 * Resource permission
 */
export interface ResourcePermission {
  /** Resource pattern */
  resource: string;
  
  /** Actions allowed */
  actions: string[];
  
  /** Roles with access */
  roles: string[];
  
  /** Conditions */
  conditions?: PermissionCondition[];
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  /** Condition type */
  type: string;
  
  /** Condition value */
  value: any;
  
  /** Condition operator */
  operator: string;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption at rest */
  atRest: AtRestEncryptionConfig;
  
  /** Encryption in transit */
  inTransit: InTransitEncryptionConfig;
  
  /** Key management */
  keyManagement: KeyManagementConfig;
}

/**
 * At-rest encryption configuration
 */
export interface AtRestEncryptionConfig {
  /** Enabled */
  enabled: boolean;
  
  /** Algorithm */
  algorithm: string;
  
  /** Key rotation frequency */
  keyRotationDays: number;
}

/**
 * In-transit encryption configuration
 */
export interface InTransitEncryptionConfig {
  /** TLS version */
  tlsVersion: string;
  
  /** Cipher suites */
  cipherSuites: string[];
  
  /** Certificate configuration */
  certificates: CertificateConfig;
}

/**
 * Certificate configuration
 */
export interface CertificateConfig {
  /** Certificate path */
  certPath: string;
  
  /** Private key path */
  keyPath: string;
  
  /** CA certificate path */
  caPath?: string;
  
  /** Auto-renewal */
  autoRenewal: boolean;
}

/**
 * Key management configuration
 */
export interface KeyManagementConfig {
  /** Provider */
  provider: KeyProvider;
  
  /** Provider configuration */
  configuration: Record<string, any>;
}

/**
 * Key providers
 */
export type KeyProvider = 'local' | 'aws_kms' | 'azure_vault' | 'hashicorp_vault' | 'custom';

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins */
  origins: string[];
  
  /** Allowed methods */
  methods: string[];
  
  /** Allowed headers */
  headers: string[];
  
  /** Credentials allowed */
  credentials: boolean;
  
  /** Max age */
  maxAge: number;
}

/**
 * Global rate limiting configuration
 */
export interface GlobalRateLimitConfig {
  /** Enabled */
  enabled: boolean;
  
  /** Default limits */
  defaultLimits: RateLimitRule[];
  
  /** Per-user limits */
  userLimits: UserRateLimitRule[];
  
  /** Per-endpoint limits */
  endpointLimits: EndpointRateLimitRule[];
}

/**
 * Rate limit rule
 */
export interface RateLimitRule {
  /** Requests per window */
  requests: number;
  
  /** Window duration in seconds */
  windowSeconds: number;
  
  /** Burst allowance */
  burst?: number;
}

/**
 * User-specific rate limit rule
 */
export interface UserRateLimitRule extends RateLimitRule {
  /** User identifier pattern */
  userPattern: string;
  
  /** User roles */
  roles?: string[];
}

/**
 * Endpoint-specific rate limit rule
 */
export interface EndpointRateLimitRule extends RateLimitRule {
  /** Endpoint pattern */
  endpoint: string;
  
  /** HTTP methods */
  methods?: string[];
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy */
  contentSecurityPolicy: string;
  
  /** X-Frame-Options */
  frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  
  /** X-Content-Type-Options */
  contentTypeOptions: boolean;
  
  /** X-XSS-Protection */
  xssProtection: boolean;
  
  /** Strict-Transport-Security */
  strictTransportSecurity: string;
  
  /** Referrer-Policy */
  referrerPolicy: string;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Connection pooling */
  connectionPooling: ConnectionPoolingConfig;
  
  /** Caching */
  caching: CachingConfig;
  
  /** Query optimization */
  queryOptimization: QueryOptimizationConfig;
  
  /** Resource limits */
  resourceLimits: ResourceLimitsConfig;
}

/**
 * Connection pooling configuration
 */
export interface ConnectionPoolingConfig {
  /** Default pool size */
  defaultPoolSize: number;
  
  /** Maximum pool size */
  maxPoolSize: number;
  
  /** Connection timeout */
  connectionTimeout: number;
  
  /** Idle timeout */
  idleTimeout: number;
  
  /** Max lifetime */
  maxLifetime: number;
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  /** Default TTL */
  defaultTtl: number;
  
  /** Cache providers */
  providers: CacheProvider[];
  
  /** Cache strategies */
  strategies: CacheStrategy[];
}

/**
 * Cache provider
 */
export interface CacheProvider {
  /** Provider name */
  name: string;
  
  /** Provider type */
  type: 'memory' | 'redis' | 'memcached' | 'database';
  
  /** Configuration */
  configuration: Record<string, any>;
  
  /** Priority */
  priority: number;
}

/**
 * Cache strategy
 */
export interface CacheStrategy {
  /** Pattern */
  pattern: string;
  
  /** TTL */
  ttl: number;
  
  /** Provider */
  provider: string;
  
  /** Invalidation rules */
  invalidation: string[];
}

/**
 * Query optimization configuration
 */
export interface QueryOptimizationConfig {
  /** Auto-indexing enabled */
  autoIndexing: boolean;
  
  /** Query analysis enabled */
  queryAnalysis: boolean;
  
  /** Optimization suggestions */
  suggestions: boolean;
  
  /** Performance monitoring */
  monitoring: boolean;
}

/**
 * Resource limits configuration
 */
export interface ResourceLimitsConfig {
  /** Memory limits */
  memory: ResourceLimit;
  
  /** CPU limits */
  cpu: ResourceLimit;
  
  /** Disk limits */
  disk: ResourceLimit;
  
  /** Network limits */
  network: ResourceLimit;
}

/**
 * Resource limit
 */
export interface ResourceLimit {
  /** Soft limit */
  soft: number;
  
  /** Hard limit */
  hard: number;
  
  /** Unit */
  unit: string;
  
  /** Alert threshold */
  alertThreshold: number;
}

/**
 * Feature flags
 */
export interface FeatureFlags {
  /** RAG₁ intelligent routing */
  rag1IntelligentRouting: boolean;
  
  /** RAG₂ natural language queries */
  rag2NaturalLanguage: boolean;
  
  /** Auto-scaling */
  autoScaling: boolean;
  
  /** Predictive caching */
  predictiveCaching: boolean;
  
  /** Advanced analytics */
  advancedAnalytics: boolean;
  
  /** Machine learning optimization */
  mlOptimization: boolean;
  
  /** Real-time monitoring */
  realTimeMonitoring: boolean;
  
  /** Custom feature flags */
  custom: Record<string, boolean>;
}

/**
 * External service configuration
 */
export interface ExternalServiceConfig {
  /** Monitoring services */
  monitoring: MonitoringServiceConfig[];
  
  /** Logging services */
  logging: LoggingServiceConfig[];
  
  /** Alerting services */
  alerting: AlertingServiceConfig[];
  
  /** Backup services */
  backup: BackupServiceConfig[];
}

/**
 * Monitoring service configuration
 */
export interface MonitoringServiceConfig {
  /** Service name */
  name: string;
  
  /** Service type */
  type: 'prometheus' | 'grafana' | 'datadog' | 'newrelic' | 'custom';
  
  /** Configuration */
  configuration: Record<string, any>;
  
  /** Enabled */
  enabled: boolean;
}

/**
 * Logging service configuration
 */
export interface LoggingServiceConfig {
  /** Service name */
  name: string;
  
  /** Service type */
  type: 'elasticsearch' | 'splunk' | 'logstash' | 'fluentd' | 'custom';
  
  /** Configuration */
  configuration: Record<string, any>;
  
  /** Enabled */
  enabled: boolean;
}

/**
 * Alerting service configuration
 */
export interface AlertingServiceConfig {
  /** Service name */
  name: string;
  
  /** Service type */
  type: 'pagerduty' | 'slack' | 'email' | 'webhook' | 'custom';
  
  /** Configuration */
  configuration: Record<string, any>;
  
  /** Enabled */
  enabled: boolean;
}

/**
 * Backup service configuration
 */
export interface BackupServiceConfig {
  /** Service name */
  name: string;
  
  /** Service type */
  type: 's3' | 'gcs' | 'azure_blob' | 'local' | 'custom';
  
  /** Configuration */
  configuration: Record<string, any>;
  
  /** Enabled */
  enabled: boolean;
}

/**
 * Type utilities for enhanced type safety
 */

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Extract keys of type T that are of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Create a type with only properties of type U
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Omit properties of type U
 */
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

/**
 * Create a union type from array values
 */
export type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer E)[] ? E : never;

/**
 * Create a type that represents all possible paths through an object
 */
export type Paths<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${Paths<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

/**
 * Get the type at a specific path in an object
 */
export type PathValue<T, P extends Paths<T>> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Paths<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : never;

/**
 * Create a branded type for enhanced type safety
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Common branded types for the system
 */
export type UserId = Brand<string, 'UserId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type MCPId = Brand<string, 'MCPId'>;
export type QueryId = Brand<string, 'QueryId'>;
export type TransactionId = Brand<string, 'TransactionId'>;

/**
 * Utility functions for type guards and validation
 */
export const TypeUtils = {
  /**
   * Check if value is defined (not null or undefined)
   */
  isDefined: <T>(value: T | null | undefined): value is T => {
    return value !== null && value !== undefined;
  },
  
  /**
   * Check if value is a string
   */
  isString: (value: unknown): value is string => {
    return typeof value === 'string';
  },
  
  /**
   * Check if value is a number
   */
  isNumber: (value: unknown): value is number => {
    return typeof value === 'number' && !isNaN(value);
  },
  
  /**
   * Check if value is a boolean
   */
  isBoolean: (value: unknown): value is boolean => {
    return typeof value === 'boolean';
  },
  
  /**
   * Check if value is an object
   */
  isObject: (value: unknown): value is object => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  },
  
  /**
   * Check if value is an array
   */
  isArray: <T>(value: unknown): value is T[] => {
    return Array.isArray(value);
  },
  
  /**
   * Check if value is a valid date
   */
  isDate: (value: unknown): value is Date => {
    return value instanceof Date && !isNaN(value.getTime());
  },
  
  /**
   * Check if object has all required properties
   */
  hasRequiredProperties: <T extends Record<string, any>>(
    obj: unknown,
    properties: (keyof T)[]
  ): obj is T => {
    if (!TypeUtils.isObject(obj)) return false;
    return properties.every(prop => prop in obj && TypeUtils.isDefined((obj as any)[prop]));
  }
};