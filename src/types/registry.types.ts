/**
 * Registry Types for Enterprise Multi-MCP Smart Database System
 * 
 * Defines types for MCP registry management, lifecycle operations,
 * and coordination across multiple MCP instances.
 */

import { MCPMetadata, MCPType, MCPDomain, MCPCapabilities, MCPHealthStatus } from './mcp.types';

/**
 * Central registry for managing all MCP instances
 */
export interface MCPRegistry {
  /** Registry unique identifier */
  id: string;
  
  /** Registry name */
  name: string;
  
  /** Registry creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
  
  /** Registry configuration */
  configuration: RegistryConfiguration;
  
  /** Registered MCP instances */
  mcps: Map<string, RegisteredMCP>;
  
  /** MCP discovery mechanisms */
  discoveryMechanisms: DiscoveryMechanism[];
  
  /** Load balancing strategies */
  loadBalancingStrategies: LoadBalancingStrategy[];
  
  /** Health monitoring configuration */
  healthMonitoring: HealthMonitoringConfig;
  
  /** Performance metrics */
  metrics: RegistryMetrics;
  
  /** Event handlers */
  eventHandlers: RegistryEventHandler[];
}

/**
 * Registry configuration settings
 */
export interface RegistryConfiguration {
  /** Maximum number of MCP instances */
  maxMCPs: number;
  
  /** Default MCP configuration */
  defaultMCPConfig: Partial<MCPMetadata>;
  
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  
  /** Metrics collection interval in milliseconds */
  metricsInterval: number;
  
  /** Auto-scaling enabled */
  autoScalingEnabled: boolean;
  
  /** Auto-discovery enabled */
  autoDiscoveryEnabled: boolean;
  
  /** Load balancing algorithm */
  loadBalancingAlgorithm: LoadBalancingAlgorithm;
  
  /** Failover strategy */
  failoverStrategy: FailoverStrategy;
  
  /** Data replication factor */
  replicationFactor: number;
  
  /** Consistency requirements */
  consistencyRequirements: ConsistencyRequirements;
  
  /** Security settings */
  security: RegistrySecurity;
}

/**
 * Load balancing algorithms
 */
export type LoadBalancingAlgorithm = 
  | 'round_robin'
  | 'least_connections'
  | 'least_response_time'
  | 'hash_based'
  | 'weighted_round_robin'
  | 'least_load'
  | 'geographic'
  | 'custom';

/**
 * Failover strategies
 */
export type FailoverStrategy = 
  | 'immediate'
  | 'graceful'
  | 'rolling'
  | 'circuit_breaker'
  | 'custom';

/**
 * Consistency requirements
 */
export interface ConsistencyRequirements {
  /** Default consistency level */
  defaultLevel: ConsistencyLevel;
  
  /** Per-domain consistency requirements */
  domainRequirements: Map<MCPDomain, ConsistencyLevel>;
  
  /** Cross-MCP consistency timeout */
  consistencyTimeout: number;
  
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolutionStrategy;
}

/**
 * Consistency levels
 */
export type ConsistencyLevel = 'strong' | 'eventual' | 'weak' | 'session';

/**
 * Conflict resolution strategies
 */
export type ConflictResolutionStrategy = 
  | 'timestamp_wins'
  | 'version_wins'
  | 'priority_wins'
  | 'merge'
  | 'manual_review'
  | 'custom';

/**
 * Registry security settings
 */
export interface RegistrySecurity {
  /** Authentication required */
  authenticationRequired: boolean;
  
  /** Authorization scheme */
  authorizationScheme: AuthorizationScheme;
  
  /** Encryption in transit */
  encryptionInTransit: boolean;
  
  /** Encryption at rest */
  encryptionAtRest: boolean;
  
  /** Access control policies */
  accessControlPolicies: AccessControlPolicy[];
  
  /** Audit logging enabled */
  auditLoggingEnabled: boolean;
  
  /** Rate limiting configuration */
  rateLimiting: RateLimitingConfig;
}

/**
 * Authorization schemes
 */
export type AuthorizationScheme = 'none' | 'basic' | 'bearer' | 'oauth2' | 'custom';

/**
 * Access control policy
 */
export interface AccessControlPolicy {
  /** Policy identifier */
  id: string;
  
  /** Policy name */
  name: string;
  
  /** Subject (user, role, service) */
  subject: string;
  
  /** Resources affected */
  resources: string[];
  
  /** Actions allowed */
  actions: string[];
  
  /** Conditions for policy application */
  conditions: PolicyCondition[];
  
  /** Policy effect (allow/deny) */
  effect: 'allow' | 'deny';
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  /** Condition type */
  type: string;
  
  /** Condition parameters */
  parameters: Record<string, any>;
  
  /** Condition operator */
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
}

/**
 * Rate limiting configuration
 */
export interface RateLimitingConfig {
  /** Requests per minute */
  requestsPerMinute: number;
  
  /** Burst capacity */
  burstCapacity: number;
  
  /** Rate limiting strategy */
  strategy: 'token_bucket' | 'sliding_window' | 'fixed_window' | 'adaptive';
  
  /** Rate limit by subject */
  perSubjectLimits: Map<string, number>;
}

/**
 * Registered MCP instance
 */
export interface RegisteredMCP {
  /** MCP metadata */
  metadata: MCPMetadata;
  
  /** Registration timestamp */
  registeredAt: number;
  
  /** Last seen timestamp */
  lastSeen: number;
  
  /** Registration status */
  status: RegistrationStatus;
  
  /** MCP capabilities */
  capabilities: MCPCapabilities;
  
  /** Service discovery information */
  discoveryInfo: ServiceDiscoveryInfo;
  
  /** Load balancing weight */
  weight: number;
  
  /** Health check results */
  healthChecks: HealthCheckResult[];
  
  /** Performance statistics */
  performanceStats: MCPPerformanceStats;
  
  /** Connection pool information */
  connectionPool: ConnectionPoolInfo;
  
  /** Backup and recovery information */
  backupInfo: BackupInfo;
  
  /** Tags for organization and filtering */
  tags: string[];
  
  /** Custom annotations */
  annotations: Record<string, string>;
}

/**
 * Registration status
 */
export type RegistrationStatus = 
  | 'registering'
  | 'active'
  | 'inactive'
  | 'draining'
  | 'failed'
  | 'deregistering';

/**
 * Service discovery information
 */
export interface ServiceDiscoveryInfo {
  /** Discovery mechanism used */
  mechanism: DiscoveryMechanism;
  
  /** Service endpoints */
  endpoints: ServiceEndpoint[];
  
  /** Service version */
  version: string;
  
  /** Service metadata */
  metadata: Record<string, any>;
  
  /** TTL for service registration */
  ttl: number;
  
  /** Auto-renewal interval */
  renewalInterval: number;
}

/**
 * Discovery mechanisms
 */
export type DiscoveryMechanism = 
  | 'static'
  | 'dns'
  | 'consul'
  | 'etcd'
  | 'kubernetes'
  | 'eureka'
  | 'zookeeper'
  | 'custom';

/**
 * Service endpoint
 */
export interface ServiceEndpoint {
  /** Endpoint URL */
  url: string;
  
  /** Endpoint type */
  type: EndpointType;
  
  /** Protocol used */
  protocol: 'http' | 'https' | 'tcp' | 'grpc' | 'websocket';
  
  /** Port number */
  port: number;
  
  /** Health check path */
  healthCheckPath?: string;
  
  /** SSL/TLS configuration */
  tlsConfig?: TLSConfig;
  
  /** Load balancing weight */
  weight: number;
  
  /** Endpoint metadata */
  metadata: Record<string, any>;
}

/**
 * Endpoint types
 */
export type EndpointType = 'query' | 'admin' | 'metrics' | 'health' | 'backup' | 'replication';

/**
 * TLS configuration
 */
export interface TLSConfig {
  /** TLS enabled */
  enabled: boolean;
  
  /** Certificate path */
  certPath?: string;
  
  /** Private key path */
  keyPath?: string;
  
  /** CA certificate path */
  caPath?: string;
  
  /** Skip certificate verification */
  skipVerify?: boolean;
  
  /** Minimum TLS version */
  minVersion?: string;
  
  /** Cipher suites */
  cipherSuites?: string[];
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check timestamp */
  timestamp: number;
  
  /** Health status */
  status: MCPHealthStatus;
  
  /** Response time in milliseconds */
  responseTime: number;
  
  /** Error message if unhealthy */
  error?: string;
  
  /** Additional health metrics */
  metrics: HealthMetrics;
  
  /** Check details */
  details: Record<string, any>;
}

/**
 * Health metrics
 */
export interface HealthMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  
  /** Memory usage percentage */
  memoryUsage: number;
  
  /** Disk usage percentage */
  diskUsage: number;
  
  /** Network latency */
  networkLatency: number;
  
  /** Active connections */
  activeConnections: number;
  
  /** Queue depth */
  queueDepth: number;
  
  /** Error rate */
  errorRate: number;
  
  /** Throughput */
  throughput: number;
}

/**
 * MCP performance statistics
 */
export interface MCPPerformanceStats {
  /** Statistics collection period */
  period: StatsPeriod;
  
  /** Request count */
  requestCount: number;
  
  /** Average response time */
  averageResponseTime: number;
  
  /** 95th percentile response time */
  p95ResponseTime: number;
  
  /** 99th percentile response time */
  p99ResponseTime: number;
  
  /** Error count */
  errorCount: number;
  
  /** Success rate */
  successRate: number;
  
  /** Throughput (requests per second) */
  throughput: number;
  
  /** Data transfer metrics */
  dataTransfer: DataTransferMetrics;
  
  /** Resource utilization */
  resourceUtilization: ResourceUtilizationMetrics;
  
  /** Cache metrics */
  cacheMetrics: CacheMetrics;
}

/**
 * Statistics periods
 */
export type StatsPeriod = '1m' | '5m' | '15m' | '1h' | '6h' | '1d' | '1w';

/**
 * Data transfer metrics
 */
export interface DataTransferMetrics {
  /** Bytes sent */
  bytesSent: number;
  
  /** Bytes received */
  bytesReceived: number;
  
  /** Records processed */
  recordsProcessed: number;
  
  /** Average record size */
  averageRecordSize: number;
  
  /** Compression ratio */
  compressionRatio: number;
}

/**
 * Resource utilization metrics
 */
export interface ResourceUtilizationMetrics {
  /** Average CPU usage */
  avgCpuUsage: number;
  
  /** Peak CPU usage */
  peakCpuUsage: number;
  
  /** Average memory usage */
  avgMemoryUsage: number;
  
  /** Peak memory usage */
  peakMemoryUsage: number;
  
  /** Disk I/O operations */
  diskIOOperations: number;
  
  /** Network I/O operations */
  networkIOOperations: number;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  /** Cache hit ratio */
  hitRatio: number;
  
  /** Cache size */
  cacheSize: number;
  
  /** Cache utilization */
  utilization: number;
  
  /** Eviction count */
  evictionCount: number;
  
  /** Average access time */
  averageAccessTime: number;
}

/**
 * Connection pool information
 */
export interface ConnectionPoolInfo {
  /** Pool size */
  poolSize: number;
  
  /** Active connections */
  activeConnections: number;
  
  /** Idle connections */
  idleConnections: number;
  
  /** Connection timeout */
  connectionTimeout: number;
  
  /** Idle timeout */
  idleTimeout: number;
  
  /** Maximum lifetime */
  maxLifetime: number;
  
  /** Pool statistics */
  statistics: ConnectionPoolStats;
}

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  /** Total connections created */
  totalCreated: number;
  
  /** Total connections closed */
  totalClosed: number;
  
  /** Connection acquisition time */
  avgAcquisitionTime: number;
  
  /** Connection failures */
  connectionFailures: number;
  
  /** Pool exhaustion events */
  poolExhaustionEvents: number;
}

/**
 * Backup information
 */
export interface BackupInfo {
  /** Backup enabled */
  enabled: boolean;
  
  /** Backup schedule */
  schedule: BackupSchedule;
  
  /** Last backup timestamp */
  lastBackup?: number;
  
  /** Backup size */
  backupSize?: number;
  
  /** Backup location */
  backupLocation: string;
  
  /** Retention policy */
  retentionPolicy: RetentionPolicy;
  
  /** Backup encryption */
  encryption: BackupEncryption;
  
  /** Recovery point objective (RPO) */
  rpo: number;
  
  /** Recovery time objective (RTO) */
  rto: number;
}

/**
 * Backup schedule
 */
export interface BackupSchedule {
  /** Schedule type */
  type: 'continuous' | 'interval' | 'cron';
  
  /** Interval in minutes (for interval type) */
  intervalMinutes?: number;
  
  /** Cron expression (for cron type) */
  cronExpression?: string;
  
  /** Full backup frequency */
  fullBackupFrequency: string;
  
  /** Incremental backup enabled */
  incrementalBackupEnabled: boolean;
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  /** Daily backups to keep */
  dailyRetention: number;
  
  /** Weekly backups to keep */
  weeklyRetention: number;
  
  /** Monthly backups to keep */
  monthlyRetention: number;
  
  /** Yearly backups to keep */
  yearlyRetention: number;
  
  /** Archive old backups */
  archiveOldBackups: boolean;
  
  /** Archive location */
  archiveLocation?: string;
}

/**
 * Backup encryption
 */
export interface BackupEncryption {
  /** Encryption enabled */
  enabled: boolean;
  
  /** Encryption algorithm */
  algorithm?: string;
  
  /** Key management */
  keyManagement?: KeyManagement;
  
  /** Encryption at rest */
  atRest: boolean;
  
  /** Encryption in transit */
  inTransit: boolean;
}

/**
 * Key management
 */
export interface KeyManagement {
  /** Key management service */
  service: 'local' | 'aws_kms' | 'azure_key_vault' | 'hashicorp_vault' | 'custom';
  
  /** Key identifier */
  keyId: string;
  
  /** Key rotation enabled */
  rotationEnabled: boolean;
  
  /** Rotation frequency in days */
  rotationFrequencyDays?: number;
}

/**
 * Health monitoring configuration
 */
export interface HealthMonitoringConfig {
  /** Health check enabled */
  enabled: boolean;
  
  /** Check interval in milliseconds */
  checkInterval: number;
  
  /** Check timeout in milliseconds */
  checkTimeout: number;
  
  /** Failure threshold */
  failureThreshold: number;
  
  /** Success threshold */
  successThreshold: number;
  
  /** Health check endpoints */
  endpoints: HealthCheckEndpoint[];
  
  /** Custom health checks */
  customChecks: CustomHealthCheck[];
  
  /** Alerting configuration */
  alerting: AlertingConfig;
}

/**
 * Health check endpoint
 */
export interface HealthCheckEndpoint {
  /** Endpoint URL */
  url: string;
  
  /** HTTP method */
  method: 'GET' | 'POST' | 'HEAD';
  
  /** Expected status codes */
  expectedStatusCodes: number[];
  
  /** Request headers */
  headers?: Record<string, string>;
  
  /** Request body */
  body?: string;
  
  /** Response validation */
  responseValidation?: ResponseValidation;
}

/**
 * Response validation
 */
export interface ResponseValidation {
  /** Expected response body pattern */
  bodyPattern?: string;
  
  /** Expected response headers */
  expectedHeaders?: Record<string, string>;
  
  /** Maximum response time */
  maxResponseTime?: number;
  
  /** Custom validation function */
  customValidator?: string;
}

/**
 * Custom health check
 */
export interface CustomHealthCheck {
  /** Check name */
  name: string;
  
  /** Check function */
  checkFunction: string;
  
  /** Check parameters */
  parameters: Record<string, any>;
  
  /** Check interval */
  interval: number;
  
  /** Check timeout */
  timeout: number;
}

/**
 * Alerting configuration
 */
export interface AlertingConfig {
  /** Alerting enabled */
  enabled: boolean;
  
  /** Alert channels */
  channels: AlertChannel[];
  
  /** Alert rules */
  rules: AlertRule[];
  
  /** Escalation policies */
  escalationPolicies: EscalationPolicy[];
}

/**
 * Alert channel
 */
export interface AlertChannel {
  /** Channel identifier */
  id: string;
  
  /** Channel type */
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty' | 'custom';
  
  /** Channel configuration */
  configuration: Record<string, any>;
  
  /** Channel enabled */
  enabled: boolean;
}

/**
 * Alert rule
 */
export interface AlertRule {
  /** Rule identifier */
  id: string;
  
  /** Rule name */
  name: string;
  
  /** Condition */
  condition: AlertCondition;
  
  /** Severity level */
  severity: AlertSeverity;
  
  /** Alert channels to use */
  channels: string[];
  
  /** Alert frequency */
  frequency: AlertFrequency;
  
  /** Rule enabled */
  enabled: boolean;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  /** Metric to monitor */
  metric: string;
  
  /** Comparison operator */
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'contains';
  
  /** Threshold value */
  threshold: number | string;
  
  /** Time window */
  timeWindow: number;
  
  /** Evaluation frequency */
  evaluationFrequency: number;
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Alert frequency
 */
export type AlertFrequency = 'once' | 'every_occurrence' | 'hourly' | 'daily' | 'weekly';

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  /** Policy identifier */
  id: string;
  
  /** Policy name */
  name: string;
  
  /** Escalation steps */
  steps: EscalationStep[];
  
  /** Repeat policy */
  repeat: boolean;
  
  /** Policy enabled */
  enabled: boolean;
}

/**
 * Escalation step
 */
export interface EscalationStep {
  /** Step number */
  step: number;
  
  /** Delay before escalation (minutes) */
  delayMinutes: number;
  
  /** Alert channels for this step */
  channels: string[];
  
  /** Acknowledgment required */
  acknowledgmentRequired: boolean;
  
  /** Timeout for acknowledgment */
  acknowledgmentTimeout: number;
}

/**
 * Registry metrics
 */
export interface RegistryMetrics {
  /** Total registered MCPs */
  totalMCPs: number;
  
  /** Active MCPs */
  activeMCPs: number;
  
  /** Failed MCPs */
  failedMCPs: number;
  
  /** Average registration time */
  avgRegistrationTime: number;
  
  /** Registry uptime */
  uptime: number;
  
  /** Total requests processed */
  totalRequests: number;
  
  /** Average request processing time */
  avgRequestTime: number;
  
  /** Error rate */
  errorRate: number;
  
  /** Load balancing efficiency */
  loadBalancingEfficiency: number;
  
  /** Resource utilization */
  resourceUtilization: ResourceUtilizationMetrics;
}

/**
 * Load balancing strategy
 */
export interface LoadBalancingStrategy {
  /** Strategy identifier */
  id: string;
  
  /** Strategy name */
  name: string;
  
  /** Algorithm used */
  algorithm: LoadBalancingAlgorithm;
  
  /** Strategy configuration */
  configuration: LoadBalancingConfig;
  
  /** Applicable domains */
  domains: MCPDomain[];
  
  /** Strategy weight */
  weight: number;
  
  /** Strategy enabled */
  enabled: boolean;
}

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  /** Weight factors */
  weightFactors: WeightFactor[];
  
  /** Health check influence */
  healthCheckInfluence: number;
  
  /** Response time influence */
  responseTimeInfluence: number;
  
  /** Load influence */
  loadInfluence: number;
  
  /** Geographic affinity */
  geographicAffinity: boolean;
  
  /** Session affinity */
  sessionAffinity: boolean;
  
  /** Sticky sessions */
  stickySessions: boolean;
  
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;
}

/**
 * Weight factor for load balancing
 */
export interface WeightFactor {
  /** Factor name */
  name: string;
  
  /** Factor weight */
  weight: number;
  
  /** Factor calculation method */
  calculationMethod: string;
  
  /** Factor parameters */
  parameters: Record<string, any>;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Circuit breaker enabled */
  enabled: boolean;
  
  /** Failure threshold */
  failureThreshold: number;
  
  /** Reset timeout */
  resetTimeout: number;
  
  /** Half-open max calls */
  halfOpenMaxCalls: number;
  
  /** Max concurrent requests */
  maxConcurrentRequests: number;
}

/**
 * Registry event handler
 */
export interface RegistryEventHandler {
  /** Handler identifier */
  id: string;
  
  /** Event types to handle */
  eventTypes: RegistryEventType[];
  
  /** Handler function */
  handler: string;
  
  /** Handler configuration */
  configuration: Record<string, any>;
  
  /** Handler priority */
  priority: number;
  
  /** Handler enabled */
  enabled: boolean;
}

/**
 * Registry event types
 */
export type RegistryEventType = 
  | 'mcp_registered'
  | 'mcp_deregistered'
  | 'mcp_health_changed'
  | 'mcp_load_changed'
  | 'registry_started'
  | 'registry_stopped'
  | 'load_balancing_changed'
  | 'failover_triggered'
  | 'backup_completed'
  | 'backup_failed'
  | 'alert_triggered'
  | 'custom';

/**
 * Registry event
 */
export interface RegistryEvent {
  /** Event identifier */
  id: string;
  
  /** Event type */
  type: RegistryEventType;
  
  /** Event timestamp */
  timestamp: number;
  
  /** Event source */
  source: string;
  
  /** Event data */
  data: Record<string, any>;
  
  /** Event severity */
  severity: EventSeverity;
  
  /** Event tags */
  tags: string[];
}

/**
 * Event severity levels
 */
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Type guards for registry types
 */
export const RegistryTypeGuards = {
  isMCPRegistry: (value: any): value is MCPRegistry => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.id === 'string' &&
           typeof value.name === 'string' &&
           value.mcps instanceof Map;
  },
  
  isRegisteredMCP: (value: any): value is RegisteredMCP => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.metadata === 'object' &&
           typeof value.registeredAt === 'number' &&
           typeof value.status === 'string';
  },
  
  isHealthCheckResult: (value: any): value is HealthCheckResult => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.timestamp === 'number' &&
           typeof value.status === 'string' &&
           typeof value.responseTime === 'number';
  },
  
  isRegistryEvent: (value: any): value is RegistryEvent => {
    return typeof value === 'object' &&
           value !== null &&
           typeof value.id === 'string' &&
           typeof value.type === 'string' &&
           typeof value.timestamp === 'number';
  }
};