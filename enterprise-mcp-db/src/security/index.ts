/**
 * Enterprise Security Module - Main Entry Point
 * Provides comprehensive security services for the MCP database system
 * 
 * Features:
 * - Multi-factor authentication & SSO
 * - Role-based & attribute-based access control
 * - End-to-end encryption (AES-256, TLS 1.3)
 * - Blockchain-based audit trails
 * - PII tokenization & data masking
 * - Real-time threat detection
 * - Compliance management (GDPR, SOX, HIPAA)
 */

import { AuthenticationService } from './auth/AuthenticationService';
import { AuthorizationService } from './access/AuthorizationService';
import { EncryptionService } from './encryption/EncryptionService';
import { AuditService } from './audit/AuditService';
import { SecurityMonitor } from './monitoring/SecurityMonitor';
import { ComplianceManager } from './compliance/ComplianceManager';
import { SecurityConfig, SecurityContext, SecurityEvent, ThreatLevel } from '../types/security.types';

/**
 * Enterprise Security Manager
 * Orchestrates all security services and provides unified interface
 */
export class EnterpriseSecurityManager {
  private readonly authentication: AuthenticationService;
  private readonly authorization: AuthorizationService;
  private readonly encryption: EncryptionService;
  private readonly audit: AuditService;
  private readonly monitor: SecurityMonitor;
  private readonly compliance: ComplianceManager;
  private readonly config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
    
    // Initialize core security services
    this.encryption = new EncryptionService(config.encryption);
    this.audit = new AuditService(config.audit, this.encryption);
    this.authentication = new AuthenticationService(config.auth, this.audit);
    this.authorization = new AuthorizationService(config.authz, this.audit);
    this.monitor = new SecurityMonitor(config.monitoring, this.audit);
    this.compliance = new ComplianceManager(config.compliance, this.audit);
  }

  /**
   * Initialize all security services
   */
  async initialize(): Promise<void> {
    try {
      await this.encryption.initialize();
      await this.audit.initialize();
      await this.authentication.initialize();
      await this.authorization.initialize();
      await this.monitor.initialize();
      await this.compliance.initialize();

      await this.audit.logSecurityEvent({
        type: 'SYSTEM_INITIALIZATION',
        severity: 'INFO',
        message: 'Enterprise security system initialized successfully',
        timestamp: new Date(),
        source: 'SecurityManager'
      });
    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'INITIALIZATION_FAILURE',
        severity: 'CRITICAL',
        message: `Security system initialization failed: ${error.message}`,
        timestamp: new Date(),
        source: 'SecurityManager',
        error: error
      });
      throw error;
    }
  }

  /**
   * Authenticate user with multi-factor authentication
   */
  async authenticate(credentials: any): Promise<SecurityContext> {
    const startTime = Date.now();
    
    try {
      const authResult = await this.authentication.authenticate(credentials);
      
      if (authResult.success) {
        const context: SecurityContext = {
          sessionId: authResult.sessionId,
          userId: authResult.userId,
          userInfo: authResult.userInfo,
          permissions: await this.authorization.getUserPermissions(authResult.userId),
          authLevel: authResult.authLevel,
          authenticatedAt: new Date(),
          expiresAt: authResult.expiresAt,
          ipAddress: credentials.ipAddress,
          userAgent: credentials.userAgent
        };

        // Monitor for suspicious authentication patterns
        await this.monitor.analyzeAuthenticationAttempt({
          userId: authResult.userId,
          success: true,
          ipAddress: credentials.ipAddress,
          userAgent: credentials.userAgent,
          timestamp: new Date(),
          duration: Date.now() - startTime
        });

        return context;
      } else {
        await this.monitor.analyzeAuthenticationAttempt({
          username: credentials.username,
          success: false,
          ipAddress: credentials.ipAddress,
          userAgent: credentials.userAgent,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          failureReason: authResult.error
        });

        throw new Error(authResult.error || 'Authentication failed');
      }
    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'AUTHENTICATION_FAILURE',
        severity: 'WARNING',
        message: `Authentication failed for user: ${credentials.username}`,
        timestamp: new Date(),
        source: 'SecurityManager',
        metadata: {
          ipAddress: credentials.ipAddress,
          userAgent: credentials.userAgent,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Check if user has permission for specific operation
   */
  async authorize(context: SecurityContext, resource: string, action: string): Promise<boolean> {
    try {
      const authorized = await this.authorization.checkPermission(
        context.userId,
        resource,
        action,
        context
      );

      await this.audit.logAccessAttempt({
        userId: context.userId,
        sessionId: context.sessionId,
        resource,
        action,
        authorized,
        timestamp: new Date(),
        ipAddress: context.ipAddress
      });

      if (!authorized) {
        await this.monitor.analyzeUnauthorizedAccess({
          userId: context.userId,
          resource,
          action,
          timestamp: new Date(),
          context
        });
      }

      return authorized;
    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'AUTHORIZATION_ERROR',
        severity: 'ERROR',
        message: `Authorization check failed: ${error.message}`,
        timestamp: new Date(),
        source: 'SecurityManager',
        metadata: { userId: context.userId, resource, action }
      });
      return false;
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(data: any, classification: string = 'CONFIDENTIAL'): Promise<string> {
    return await this.encryption.encrypt(data, classification);
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: string, context: SecurityContext): Promise<any> {
    // Log data access for audit trail
    await this.audit.logDataAccess({
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'DECRYPT',
      timestamp: new Date()
    });

    return await this.encryption.decrypt(encryptedData);
  }

  /**
   * Tokenize PII data for privacy protection
   */
  async tokenizePII(data: any, userId: string): Promise<any> {
    return await this.encryption.tokenizePII(data, userId);
  }

  /**
   * Mask sensitive data for display
   */
  async maskData(data: any, context: SecurityContext, level: string = 'PARTIAL'): Promise<any> {
    return await this.encryption.maskData(data, context.permissions, level);
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(options: any): Promise<any> {
    const [auditReport, monitoringReport, complianceReport] = await Promise.all([
      this.audit.generateReport(options),
      this.monitor.generateReport(options),
      this.compliance.generateReport(options)
    ]);

    return {
      timestamp: new Date(),
      timeframe: options.timeframe,
      audit: auditReport,
      monitoring: monitoringReport,
      compliance: complianceReport,
      summary: {
        totalEvents: auditReport.totalEvents,
        securityIncidents: monitoringReport.incidents?.length || 0,
        complianceViolations: complianceReport.violations?.length || 0,
        threatLevel: await this.monitor.getCurrentThreatLevel()
      }
    };
  }

  /**
   * Handle security incident
   */
  async handleSecurityIncident(incident: SecurityEvent): Promise<void> {
    await this.monitor.processSecurityIncident(incident);
    
    // Notify compliance if needed
    if (incident.severity === 'CRITICAL') {
      await this.compliance.notifyIncident(incident);
    }
  }

  /**
   * Validate session and refresh if needed
   */
  async validateSession(sessionId: string): Promise<SecurityContext | null> {
    return await this.authentication.validateSession(sessionId);
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string, reason: string = 'USER_LOGOUT'): Promise<void> {
    await this.authentication.revokeSession(sessionId, reason);
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<any> {
    return await this.monitor.getMetrics();
  }

  /**
   * Shutdown security services
   */
  async shutdown(): Promise<void> {
    await this.monitor.shutdown();
    await this.audit.shutdown();
    await this.encryption.shutdown();
    await this.authentication.shutdown();
    await this.authorization.shutdown();
    await this.compliance.shutdown();
  }
}

// Export all security services for individual use
export {
  AuthenticationService,
  AuthorizationService,
  EncryptionService,
  AuditService,
  SecurityMonitor,
  ComplianceManager
};

// Export types
export * from '../types/security.types';