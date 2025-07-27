/**
 * Enterprise Security Type Definitions
 * Comprehensive type system for enterprise-grade security features
 */

// ============================================================================
// Core Security Types
// ============================================================================

export interface SecurityConfig {
  auth: AuthenticationConfig;
  authz: AuthorizationConfig;
  encryption: EncryptionConfig;
  audit: AuditConfig;
  monitoring: MonitoringConfig;
  compliance: ComplianceConfig;
}

export interface SecurityContext {
  sessionId: string;
  userId: string;
  userInfo: UserInfo;
  permissions: Permission[];
  authLevel: AuthenticationLevel;
  authenticatedAt: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  attributes?: Record<string, any>;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  department?: string;
  organization?: string;
  clearanceLevel?: string;
  accountStatus: 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'EXPIRED';
}

export type AuthenticationLevel = 'NONE' | 'BASIC' | 'MFA' | 'CERTIFICATE' | 'BIOMETRIC';
export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecuritySeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthenticationConfig {
  providers: AuthProvider[];
  mfa: MFAConfig;
  sso: SSOConfig;
  session: SessionConfig;
  passwordPolicy: PasswordPolicy;
  lockoutPolicy: LockoutPolicy;
}

export interface AuthProvider {
  name: string;
  type: 'LOCAL' | 'LDAP' | 'OAUTH2' | 'SAML' | 'CERTIFICATE';
  config: any;
  priority: number;
  enabled: boolean;
}

export interface MFAConfig {
  enabled: boolean;
  methods: MFAMethod[];
  gracePeriod: number; // seconds
  backupCodes: boolean;
}

export interface MFAMethod {
  type: 'TOTP' | 'SMS' | 'EMAIL' | 'PUSH' | 'HARDWARE_TOKEN';
  required: boolean;
  config?: any;
}

export interface SSOConfig {
  enabled: boolean;
  providers: SSOProvider[];
  fallbackToLocal: boolean;
}

export interface SSOProvider {
  name: string;
  protocol: 'SAML' | 'OAUTH2' | 'OIDC';
  endpoint: string;
  clientId?: string;
  certificateValidation: boolean;
  attributeMapping: Record<string, string>;
}

export interface SessionConfig {
  maxDuration: number; // seconds
  idleTimeout: number; // seconds
  renewalThreshold: number; // seconds before expiry
  concurrentSessions: number;
  secureOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number; // last N passwords
  maxAge: number; // days
  complexityScore: number; // 0-100
}

export interface LockoutPolicy {
  maxAttempts: number;
  lockoutDuration: number; // seconds
  progressiveLockout: boolean;
  notifyUser: boolean;
  notifyAdmin: boolean;
}

// ============================================================================
// Authorization Types
// ============================================================================

export interface AuthorizationConfig {
  model: 'RBAC' | 'ABAC' | 'HYBRID';
  defaultDeny: boolean;
  hierarchicalRoles: boolean;
  contextualAccess: boolean;
  policies: PolicyConfig[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: AccessCondition[];
  grantedAt: Date;
  expiresAt?: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
  level: number;
  isSystemRole: boolean;
}

export interface AccessCondition {
  type: 'TIME' | 'LOCATION' | 'ATTRIBUTE' | 'RESOURCE_STATE';
  operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'GREATER' | 'LESS';
  value: any;
  field?: string;
}

export interface PolicyConfig {
  id: string;
  name: string;
  description: string;
  effect: 'ALLOW' | 'DENY';
  subjects: string[];
  resources: string[];
  actions: string[];
  conditions?: AccessCondition[];
  priority: number;
}

// ============================================================================
// Encryption Types
// ============================================================================

export interface EncryptionConfig {
  algorithms: EncryptionAlgorithm[];
  keyManagement: KeyManagementConfig;
  dataClassification: ClassificationConfig;
  tokenization: TokenizationConfig;
  masking: MaskingConfig;
}

export interface EncryptionAlgorithm {
  name: string;
  type: 'SYMMETRIC' | 'ASYMMETRIC' | 'HASH';
  algorithm: string; // AES-256-GCM, RSA-4096, etc.
  keySize: number;
  useCases: string[];
  default: boolean;
}

export interface KeyManagementConfig {
  provider: 'LOCAL' | 'HSM' | 'KMS' | 'VAULT';
  rotationInterval: number; // days
  derivationRounds: number;
  backupStrategy: 'SPLIT' | 'ESCROW' | 'DISTRIBUTED';
  masterKeyProtection: 'PASSWORD' | 'HARDWARE' | 'BIOMETRIC';
}

export interface ClassificationConfig {
  levels: DataClassification[];
  autoClassification: boolean;
  retentionPolicies: Record<string, number>; // days
}

export interface DataClassification {
  level: string;
  description: string;
  encryptionRequired: boolean;
  algorithm?: string;
  keyRotationDays: number;
  accessLogRequired: boolean;
}

export interface TokenizationConfig {
  enabled: boolean;
  algorithm: 'FPE' | 'RANDOM' | 'DETERMINISTIC';
  preserveFormat: boolean;
  reversible: boolean;
  ttl: number; // seconds
}

export interface MaskingConfig {
  patterns: MaskingPattern[];
  defaultMask: string;
  contextualMasking: boolean;
}

export interface MaskingPattern {
  name: string;
  regex: string;
  maskChar: string;
  preserveLength: boolean;
  keepPrefix?: number;
  keepSuffix?: number;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditConfig {
  enabled: boolean;
  storage: AuditStorageConfig;
  retention: AuditRetentionConfig;
  integrity: AuditIntegrityConfig;
  fields: AuditFieldConfig;
  filters: AuditFilter[];
}

export interface AuditStorageConfig {
  type: 'DATABASE' | 'FILE' | 'SIEM' | 'BLOCKCHAIN';
  encryption: boolean;
  compression: boolean;
  replication: boolean;
  immutable: boolean;
}

export interface AuditRetentionConfig {
  defaultDays: number;
  byEventType: Record<string, number>;
  archiveAfterDays: number;
  purgeAfterDays: number;
  complianceHold: boolean;
}

export interface AuditIntegrityConfig {
  digitalSignatures: boolean;
  blockchainAnchoring: boolean;
  tamperEvidence: boolean;
  periodicVerification: boolean;
  hashChaining: boolean;
}

export interface AuditFieldConfig {
  includeStackTrace: boolean;
  includeRequestBody: boolean;
  includeResponseBody: boolean;
  maskSensitiveData: boolean;
  customFields: string[];
}

export interface AuditFilter {
  eventType: string;
  severity: SecuritySeverity;
  include: boolean;
  conditions?: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: SecuritySeverity;
  userId?: string;
  sessionId?: string;
  resource?: string;
  action?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'ERROR';
  message: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  stackTrace?: string;
  digitalSignature?: string;
  blockchainHash?: string;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MonitoringConfig {
  realTimeAnalysis: boolean;
  threatDetection: ThreatDetectionConfig;
  anomalyDetection: AnomalyDetectionConfig;
  alerting: AlertingConfig;
  metrics: MetricsConfig;
}

export interface ThreatDetectionConfig {
  enabled: boolean;
  models: ThreatModel[];
  sensitivity: number; // 0-100
  correlationWindow: number; // seconds
  autoResponse: boolean;
}

export interface ThreatModel {
  name: string;
  type: 'BRUTE_FORCE' | 'PRIVILEGE_ESCALATION' | 'DATA_EXFILTRATION' | 'INJECTION' | 'ANOMALY';
  parameters: Record<string, any>;
  threshold: number;
  enabled: boolean;
}

export interface AnomalyDetectionConfig {
  enabled: boolean;
  algorithm: 'STATISTICAL' | 'ML' | 'RULE_BASED';
  baselinePeriod: number; // days
  sensitivity: number; // 0-100
  adaptiveLearning: boolean;
}

export interface AlertingConfig {
  channels: AlertChannel[];
  escalation: EscalationRule[];
  rateLimiting: boolean;
  aggregation: boolean;
}

export interface AlertChannel {
  type: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'SIEM' | 'SLACK';
  config: any;
  severityFilter: SecuritySeverity[];
  enabled: boolean;
}

export interface EscalationRule {
  condition: string;
  delay: number; // seconds
  actions: string[];
}

export interface MetricsConfig {
  collection: boolean;
  interval: number; // seconds
  retention: number; // days
  aggregation: string[];
}

// ============================================================================
// Compliance Types
// ============================================================================

export interface ComplianceConfig {
  frameworks: ComplianceFramework[];
  reporting: ComplianceReportingConfig;
  automation: ComplianceAutomationConfig;
  dataGovernance: DataGovernanceConfig;
}

export interface ComplianceFramework {
  name: string;
  type: 'GDPR' | 'HIPAA' | 'SOX' | 'PCI_DSS' | 'ISO27001' | 'CUSTOM';
  requirements: ComplianceRequirement[];
  enabled: boolean;
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  controls: ComplianceControl[];
  evidence: string[];
  autoCheck: boolean;
}

export interface ComplianceControl {
  id: string;
  description: string;
  implementation: string;
  testProcedure: string;
  frequency: string;
  responsible: string;
}

export interface ComplianceReportingConfig {
  automated: boolean;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  recipients: string[];
  format: 'PDF' | 'HTML' | 'JSON' | 'CSV';
  includeEvidence: boolean;
}

export interface ComplianceAutomationConfig {
  policyEnforcement: boolean;
  dataClassification: boolean;
  retentionManagement: boolean;
  breachNotification: boolean;
  rightToErasure: boolean;
}

export interface DataGovernanceConfig {
  dataMapping: boolean;
  privacyByDesign: boolean;
  consentManagement: boolean;
  dataMinimization: boolean;
  purposeLimitation: boolean;
}

// ============================================================================
// Security Events
// ============================================================================

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  source: string;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  threatLevel?: ThreatLevel;
  confidence?: number; // 0-100
  remediation?: string[];
  tags?: string[];
  error?: Error;
}

export type SecurityEventType =
  | 'AUTHENTICATION_SUCCESS'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHENTICATION_LOCKOUT'
  | 'AUTHORIZATION_SUCCESS'
  | 'AUTHORIZATION_FAILURE'
  | 'SESSION_CREATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'DATA_EXPORT'
  | 'ENCRYPTION_OPERATION'
  | 'KEY_ROTATION'
  | 'POLICY_VIOLATION'
  | 'THREAT_DETECTED'
  | 'ANOMALY_DETECTED'
  | 'SYSTEM_INITIALIZATION'
  | 'SYSTEM_SHUTDOWN'
  | 'CONFIGURATION_CHANGE'
  | 'COMPLIANCE_VIOLATION'
  | 'SECURITY_INCIDENT'
  | 'BREACH_DETECTED'
  | 'VULNERABILITY_FOUND';

// ============================================================================
// API and Integration Types
// ============================================================================

export interface SecurityMiddleware {
  authenticate: (req: any, res: any, next: any) => Promise<void>;
  authorize: (resource: string, action: string) => (req: any, res: any, next: any) => Promise<void>;
  auditLog: (req: any, res: any, next: any) => Promise<void>;
  rateLimit: (req: any, res: any, next: any) => Promise<void>;
  sanitizeInput: (req: any, res: any, next: any) => Promise<void>;
}

export interface SecurityMetrics {
  timestamp: Date;
  authentication: {
    successfulLogins: number;
    failedLogins: number;
    lockedAccounts: number;
    activeSessions: number;
  };
  authorization: {
    authorizedRequests: number;
    deniedRequests: number;
    policyViolations: number;
  };
  threats: {
    detectedThreats: number;
    blockedRequests: number;
    currentThreatLevel: ThreatLevel;
  };
  data: {
    encryptionOperations: number;
    decryptionOperations: number;
    tokenizationOperations: number;
    dataAccessEvents: number;
  };
  compliance: {
    violations: number;
    auditEvents: number;
    reports: number;
  };
}

export interface SecurityDashboard {
  overview: SecurityMetrics;
  realtimeEvents: SecurityEvent[];
  threatIntelligence: ThreatIntelligence;
  complianceStatus: ComplianceStatus;
  alerts: SecurityAlert[];
}

export interface ThreatIntelligence {
  sources: string[];
  indicators: ThreatIndicator[];
  lastUpdate: Date;
}

export interface ThreatIndicator {
  type: 'IP' | 'HASH' | 'DOMAIN' | 'URL' | 'EMAIL';
  value: string;
  confidence: number;
  severity: ThreatLevel;
  source: string;
  description: string;
  firstSeen: Date;
  lastSeen: Date;
}

export interface ComplianceStatus {
  frameworks: Record<string, FrameworkStatus>;
  overallScore: number;
  lastAssessment: Date;
  nextAssessment: Date;
}

export interface FrameworkStatus {
  name: string;
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  lastCheck: Date;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: SecuritySeverity;
  title: string;
  description: string;
  timestamp: Date;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';
  assignee?: string;
  remediation: string[];
  affectedResources: string[];
  indicators: ThreatIndicator[];
}