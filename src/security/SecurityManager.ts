// Enterprise Security Manager for Multi-MCP Smart Database
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    algorithm: jwt.Algorithm;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  audit: {
    enabled: boolean;
    logLevel: 'info' | 'warn' | 'error';
    sensitiveFields: string[];
  };
  validation: {
    maxInputLength: number;
    allowedFileTypes: string[];
    maxFileSize: number;
  };
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  ip: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: 'intrusion_attempt' | 'suspicious_activity' | 'rate_limit_exceeded' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_ip: string;
  user_id?: string;
  description: string;
  action_taken: string;
  metadata: Record<string, any>;
}

export class SecurityManager {
  private config: SecurityConfig;
  private auditLogs: AuditLog[] = [];
  private securityAlerts: SecurityAlert[] = [];
  private blockedIPs: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map();
  private encryptionKey: Buffer;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      jwt: {
        secret: config.jwt?.secret || process.env.JWT_SECRET || 'default-secret-change-in-production',
        expiresIn: config.jwt?.expiresIn || '15m',
        refreshExpiresIn: config.jwt?.refreshExpiresIn || '7d',
        algorithm: config.jwt?.algorithm || 'HS256'
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        ...config.encryption
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        skipSuccessfulRequests: false,
        ...config.rateLimit
      },
      audit: {
        enabled: true,
        logLevel: 'info',
        sensitiveFields: ['password', 'token', 'secret', 'key'],
        ...config.audit
      },
      validation: {
        maxInputLength: 10000,
        allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf', '.txt', '.csv', '.json'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        ...config.validation
      }
    };

    // Initialize encryption key
    this.encryptionKey = crypto.scryptSync(this.config.jwt.secret, 'salt', this.config.encryption.keyLength);
  }

  /**
   * Hash password securely
   */
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  public generateToken(payload: Record<string, any>): string {
    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.expiresIn,
      algorithm: this.config.jwt.algorithm
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  public generateRefreshToken(payload: Record<string, any>): string {
    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.refreshExpiresIn,
      algorithm: this.config.jwt.algorithm
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  public verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.config.jwt.secret, {
        algorithms: [this.config.jwt.algorithm]
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Encrypt sensitive data
   */
  public encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.config.encryption.ivLength);
    const cipher = crypto.createCipheriv(this.config.encryption.algorithm as crypto.CipherGCMTypes, this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  public decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipheriv(this.config.encryption.algorithm as crypto.CipherGCMTypes, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Advanced rate limiting middleware
   */
  public createRateLimit(options?: Partial<typeof this.config.rateLimit>) {
    const rateLimitConfig = { ...this.config.rateLimit, ...options };
    
    return rateLimit({
      windowMs: rateLimitConfig.windowMs,
      max: rateLimitConfig.max,
      skipSuccessfulRequests: rateLimitConfig.skipSuccessfulRequests,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        const ip = this.getClientIP(req);
        this.logSecurityAlert({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          source_ip: ip,
          description: `Rate limit exceeded for IP ${ip}`,
          action_taken: 'Request blocked',
          metadata: {
            endpoint: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent')
          }
        });
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000)
        });
      }
    });
  }

  /**
   * Input validation and sanitization
   */
  public validateInput(input: any, rules: ValidationRules): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = input[field];
      
      // Required field validation
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is not required and not provided
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }
      
      // Type validation
      if (rule.type && typeof value !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
        continue;
      }
      
      // String length validation
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > this.config.validation.maxInputLength) {
          errors.push(`${field} must be no more than ${this.config.validation.maxInputLength} characters`);
        }
        
        // Sanitize string
        sanitized[field] = this.sanitizeString(value);
      } else {
        sanitized[field] = value;
      }
      
      // Email validation
      if (rule.format === 'email' && typeof value === 'string') {
        const emailRegex = /^[\S]+@[\S]+\.[\S]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field} must be a valid email address`);
        }
      }
      
      // Custom validation
      if (rule.customValidator) {
        const customResult = rule.customValidator(value);
        if (customResult !== true) {
          errors.push(customResult);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }

  /**
   * Sanitize string input to prevent XSS
   */
  private sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * SQL injection prevention
   */
  public sanitizeSQL(input: string): string {
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment start
      .replace(/\*\//g, ''); // Remove block comment end
  }

  /**
   * Authentication middleware
   */
  public authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      this.logAudit({
        action: 'authentication_failed',
        resource: req.originalUrl,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || '',
        success: false,
        details: { reason: 'No token provided' },
        risk_level: 'medium'
      });
      
      res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid access token'
      });
      return;
    }

    try {
      const decoded = this.verifyToken(token);
      (req as any).user = decoded;
      
      this.logAudit({
        action: 'authentication_success',
        resource: req.originalUrl,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || '',
        success: true,
        userId: decoded.userId,
        risk_level: 'low'
      });
      
      next();
    } catch (error) {
      this.logAudit({
        action: 'authentication_failed',
        resource: req.originalUrl,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || '',
        success: false,
        details: { reason: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error' },
        risk_level: 'high'
      });
      
      res.status(403).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }
  };

  /**
   * Authorization middleware (role-based)
   */
  public authorize = (requiredRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Please authenticate first'
        });
        return;
      }
      
      const userRoles = user.roles || [];
      const hasPermission = requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasPermission) {
        this.logAudit({
          action: 'authorization_failed',
          resource: req.originalUrl,
          ip: this.getClientIP(req),
          userAgent: req.get('User-Agent') || '',
          success: false,
          userId: user.userId,
          details: { requiredRoles, userRoles },
          risk_level: 'high'
        });
        
        res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      next();
    };
  };

  /**
   * IP blocking middleware
   */
  public ipBlocking = (req: Request, res: Response, next: NextFunction): void => {
    const ip = this.getClientIP(req);
    
    if (this.blockedIPs.has(ip)) {
      this.logSecurityAlert({
        type: 'intrusion_attempt',
        severity: 'high',
        source_ip: ip,
        description: `Blocked IP ${ip} attempted access`,
        action_taken: 'Request blocked',
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
          userAgent: req.get('User-Agent')
        }
      });
      
      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address has been blocked'
      });
      return;
    }
    
    next();
  };

  /**
   * Suspicious activity detection
   */
  public detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction): void => {
    const ip = this.getClientIP(req);
    const suspiciousCount = this.suspiciousIPs.get(ip) || 0;
    
    // Check for suspicious patterns
    const isSuspicious = this.checkSuspiciousPatterns(req);
    
    if (isSuspicious) {
      this.suspiciousIPs.set(ip, suspiciousCount + 1);
      
      if (suspiciousCount >= 5) {
        this.blockedIPs.add(ip);
        this.logSecurityAlert({
          type: 'suspicious_activity',
          severity: 'critical',
          source_ip: ip,
          description: `IP ${ip} blocked due to repeated suspicious activity`,
          action_taken: 'IP blocked permanently',
          metadata: {
            suspiciousCount: suspiciousCount + 1,
            endpoint: req.originalUrl,
            method: req.method
          }
        });
      } else {
        this.logSecurityAlert({
          type: 'suspicious_activity',
          severity: 'medium',
          source_ip: ip,
          description: `Suspicious activity detected from IP ${ip}`,
          action_taken: 'Activity logged and monitored',
          metadata: {
            suspiciousCount: suspiciousCount + 1,
            endpoint: req.originalUrl,
            method: req.method
          }
        });
      }
    }
    
    next();
  };

  /**
   * Check for suspicious request patterns
   */
  private checkSuspiciousPatterns(req: Request): boolean {
    const url = req.originalUrl.toLowerCase();
    const userAgent = req.get('User-Agent')?.toLowerCase() || '';
    
    // SQL injection patterns
    const sqlPatterns = [
      'union select', 'drop table', 'insert into', 'delete from',
      'update set', 'create table', 'alter table', 'exec('
    ];
    
    // XSS patterns
    const xssPatterns = [
      '<script', 'javascript:', 'onerror=', 'onload=', 'onclick='
    ];
    
    // Path traversal patterns
    const pathTraversalPatterns = [
      '../', '..\\', '%2e%2e%2f', '%2e%2e%5c'
    ];
    
    // Check URL for suspicious patterns
    const allPatterns = [...sqlPatterns, ...xssPatterns, ...pathTraversalPatterns];
    const hasSuspiciousPattern = allPatterns.some(pattern => url.includes(pattern));
    
    // Check for suspicious user agents
    const suspiciousUserAgents = ['sqlmap', 'nikto', 'nmap', 'masscan', 'burpsuite'];
    const hasSuspiciousUserAgent = suspiciousUserAgents.some(agent => userAgent.includes(agent));
    
    return hasSuspiciousPattern || hasSuspiciousUserAgent;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
           req.headers['x-real-ip'] as string ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Log audit events
   */
  private logAudit(auditData: Omit<AuditLog, 'id' | 'timestamp'>): void {
    if (!this.config.audit.enabled) return;
    
    const auditLog: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...auditData
    };
    
    // Remove sensitive data
    if (auditLog.details) {
      auditLog.details = this.sanitizeAuditData(auditLog.details);
    }
    
    this.auditLogs.push(auditLog);
    
    // Log to system logger
    const logLevel = auditLog.success ? 'info' : 'warn';
    logger[logLevel]('Audit Event', {
      id: auditLog.id,
      action: auditLog.action,
      resource: auditLog.resource,
      success: auditLog.success,
      userId: auditLog.userId,
      ip: auditLog.ip,
      risk_level: auditLog.risk_level
    });
  }

  /**
   * Log security alerts
   */
  private logSecurityAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp'>): void {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...alertData
    };
    
    this.securityAlerts.push(alert);
    
    // Log to system logger
    logger.warn('Security Alert', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      source_ip: alert.source_ip,
      description: alert.description
    });
  }

  /**
   * Sanitize audit data to remove sensitive information
   */
  private sanitizeAuditData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    
    for (const field of this.config.audit.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Get audit logs
   */
  public getAuditLogs(limit?: number, userId?: string): AuditLog[] {
    let logs = [...this.auditLogs];
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Get security alerts
   */
  public getSecurityAlerts(limit?: number, severity?: string): SecurityAlert[] {
    let alerts = [...this.securityAlerts];
    
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? alerts.slice(0, limit) : alerts;
  }

  /**
   * Block IP address
   */
  public blockIP(ip: string, reason?: string): void {
    this.blockedIPs.add(ip);
    this.logSecurityAlert({
      type: 'intrusion_attempt',
      severity: 'high',
      source_ip: ip,
      description: `IP ${ip} manually blocked${reason ? ': ' + reason : ''}`,
      action_taken: 'IP blocked',
      metadata: { manual_block: true, reason }
    });
  }

  /**
   * Unblock IP address
   */
  public unblockIP(ip: string): boolean {
    const wasBlocked = this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    
    if (wasBlocked) {
      logger.info(`IP ${ip} unblocked`);
    }
    
    return wasBlocked;
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): {
    audit: { total: number; failed_attempts: number; last_24h: number };
    alerts: { total: number; critical: number; last_24h: number };
    blocked_ips: number;
    suspicious_ips: number;
  } {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      audit: {
        total: this.auditLogs.length,
        failed_attempts: this.auditLogs.filter(log => !log.success).length,
        last_24h: this.auditLogs.filter(log => log.timestamp > last24h).length
      },
      alerts: {
        total: this.securityAlerts.length,
        critical: this.securityAlerts.filter(alert => alert.severity === 'critical').length,
        last_24h: this.securityAlerts.filter(alert => alert.timestamp > last24h).length
      },
      blocked_ips: this.blockedIPs.size,
      suspicious_ips: this.suspiciousIPs.size
    };
  }
}

// Types for validation
export interface ValidationRules {
  [field: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
    minLength?: number;
    maxLength?: number;
    format?: 'email' | 'url' | 'uuid';
    customValidator?: (value: any) => true | string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: any;
}

// Export singleton instance
export const securityManager = new SecurityManager();