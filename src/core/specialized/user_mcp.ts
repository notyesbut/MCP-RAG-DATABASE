/**
 * User-Specialized MCP
 * Optimized for user data storage and retrieval
 */

import { BaseMCP } from '../mcp/base_mcp';
import {
  MCPCapabilities,
  DataRecord,
  MCPDomain,
  MCPType,
  MCPConfig
} from '../../types/mcp.types';

export interface UserRecord {
  userId: string;
  email?: string;
  profile?: {
    name: string;
    avatar?: string;
    preferences: Record<string, any>;
  };
  authentication?: {
    hashedPassword?: string;
    tokens: string[];
    lastLogin?: number;
    loginHistory: number[];
  };
  permissions?: string[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: number;
    tags: string[];
  };
}

export class UserMCP extends BaseMCP {
  private userIndex: Map<string, string> = new Map(); // email -> recordId
  private tokenIndex: Map<string, string> = new Map(); // token -> recordId
  private permissionIndex: Map<string, Set<string>> = new Map(); // permission -> recordIds
  
  constructor(domain: MCPDomain, type: MCPType, config: Partial<MCPConfig> = {}) {
    super(domain, type, {
      maxRecords: 50000, // Users typically don't scale as high as other data
      maxSize: 1024 * 1024 * 50, // 50MB
      compressionEnabled: false, // User data needs fast access
      backupStrategy: 'realtime', // Critical data
      replicationFactor: 2, // Important for redundancy
      shardingStrategy: 'hash',
      ...config
    });
  }

  protected defineCapabilities(): MCPCapabilities {
    return {
      supportedDataTypes: ['user'],
      supportedQueryTypes: ['id', 'email', 'token', 'permission'],
      isTemporal: false,
      isVolatile: false,
      isVersioned: true,
    };
  }

  protected optimizeForDomain(): void {
    // User-specific optimizations
    this.setupSecurityIndices();
    this.enableEncryption();
    this.setupAuditLogging();
  }

  /**
   * User-specific operations
   */
  async storeUser(userData: UserRecord): Promise<boolean> {
    // Validate user data
    if (!this.validateUserData(userData)) {
      return false;
    }

    // Encrypt sensitive data
    const encryptedUserData = await this.encryptSensitiveData(userData);
    
    const record: DataRecord = {
      id: userData.userId,
      domain: 'user',
      timestamp: Date.now(),
      data: encryptedUserData,
      metadata: {
        source: 'user_service',
        priority: 9, // High priority for user data
        accessPattern: {
          frequency: 0,
          lastAccessed: Date.now(),
          accessHistory: [],
          predictedNextAccess: Date.now() + (24 * 60 * 60 * 1000),
          accessType: 'write'
        },
        relationships: this.extractUserRelationships(userData),
        size: JSON.stringify(encryptedUserData).length,
        version: userData.metadata.version || 1
      }
    };

    const success = await this.store(record);
    
    if (success) {
      await this.updateUserIndices(userData);
      await this.logUserAudit('user_created', userData.userId);
    }
    
    return success;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const record = await this.retrieve(userId);
    if (!record) return null;
    
    const decryptedData = await this.decryptSensitiveData(record.data);
    await this.logUserAudit('user_accessed', userId);
    
    return decryptedData as UserRecord;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const recordId = this.userIndex.get(email.toLowerCase());
    if (!recordId) return null;
    
    return this.getUserById(recordId);
  }

  async getUserByToken(token: string): Promise<UserRecord | null> {
    const recordId = this.tokenIndex.get(token);
    if (!recordId) return null;
    
    return this.getUserById(recordId);
  }

  async getUsersByPermission(permission: string): Promise<UserRecord[]> {
    const recordIds = this.permissionIndex.get(permission);
    if (!recordIds) return [];
    
    const users: UserRecord[] = [];
    for (const recordId of recordIds) {
      const user = await this.getUserById(recordId);
      if (user) users.push(user);
    }
    
    return users;
  }

  async searchUsers(query: {
    name?: string;
    email?: string;
    permissions?: string[];
    tags?: string[];
    limit?: number;
  }): Promise<UserRecord[]> {
    const results: UserRecord[] = [];
    const limit = query.limit || 50;
    
    // Search through all user records
    for (const record of this.records.values()) {
      if (results.length >= limit) break;
      
      const userData = await this.decryptSensitiveData(record.data) as UserRecord;
      
      // Apply filters
      if (query.name && !userData.profile?.name.toLowerCase().includes(query.name.toLowerCase())) {
        continue;
      }
      
      if (query.email && !userData.email?.toLowerCase().includes(query.email.toLowerCase())) {
        continue;
      }
      
      if (query.permissions && !query.permissions.some(p => userData.permissions?.includes(p))) {
        continue;
      }
      
      if (query.tags && !query.tags.some(t => userData.metadata.tags.includes(t))) {
        continue;
      }
      
      results.push(userData);
    }
    
    return results;
  }

  async updateUser(userId: string, updates: Partial<UserRecord>): Promise<boolean> {
    const existingUser = await this.getUserById(userId);
    if (!existingUser) return false;
    
    // Merge updates
    const updatedUser: UserRecord = {
      ...existingUser,
      ...updates,
      userId, // Ensure userId doesn't change
      metadata: {
        ...existingUser.metadata,
        ...updates.metadata,
        updatedAt: Date.now(),
        version: existingUser.metadata.version + 1
      }
    };
    
    // Remove old indices
    await this.removeUserFromIndices(existingUser);
    
    // Store updated user
    const success = await this.storeUser(updatedUser);
    
    if (success) {
      await this.logUserAudit('user_updated', userId, updates);
    }
    
    return success;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    // Remove from indices
    await this.removeUserFromIndices(user);
    
    // Delete record
    const success = await this.delete(userId);
    
    if (success) {
      await this.logUserAudit('user_deleted', userId);
    }
    
    return success;
  }

  /**
   * Authentication and security methods
   */
  async authenticateUser(email: string, hashedPassword: string): Promise<UserRecord | null> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.authentication?.hashedPassword) {
      await this.logUserAudit('auth_failed', email, { reason: 'user_not_found' });
      return null;
    }
    
    if (user.authentication.hashedPassword !== hashedPassword) {
      await this.logUserAudit('auth_failed', user.userId, { reason: 'invalid_password' });
      return null;
    }
    
    // Update last login
    user.authentication.lastLogin = Date.now();
    user.authentication.loginHistory.push(Date.now());
    
    // Keep only recent login history (last 100 logins)
    if (user.authentication.loginHistory.length > 100) {
      user.authentication.loginHistory = user.authentication.loginHistory.slice(-100);
    }
    
    await this.updateUser(user.userId, user);
    await this.logUserAudit('auth_success', user.userId);
    
    return user;
  }

  async authorizeUser(userId: string, requiredPermission: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    const hasPermission = user.permissions?.includes(requiredPermission) || false;
    
    await this.logUserAudit('authorization_check', userId, {
      permission: requiredPermission,
      granted: hasPermission
    });
    
    return hasPermission;
  }

  async addUserPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    if (!user.permissions) user.permissions = [];
    if (user.permissions.includes(permission)) return true;
    
    user.permissions.push(permission);
    const success = await this.updateUser(userId, user);
    
    if (success) {
      await this.logUserAudit('permission_added', userId, { permission });
    }
    
    return success;
  }

  async removeUserPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    if (!user.permissions) return true;
    
    user.permissions = user.permissions.filter(p => p !== permission);
    const success = await this.updateUser(userId, user);
    
    if (success) {
      await this.logUserAudit('permission_removed', userId, { permission });
    }
    
    return success;
  }

  /**
   * Private helper methods
   */
  private validateUserData(userData: UserRecord): boolean {
    // Basic validation
    if (!userData.userId) return false;
    if (userData.email && !this.isValidEmail(userData.email)) return false;
    
    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async encryptSensitiveData(userData: UserRecord): Promise<any> {
    // In a real implementation, this would encrypt sensitive fields
    // For now, we'll just return the data as-is
    const encrypted = { ...userData };
    
    // Mark sensitive fields as encrypted (simulation)
    if (encrypted.authentication?.hashedPassword) {
      encrypted.authentication.hashedPassword = `encrypted:${encrypted.authentication.hashedPassword}`;
    }
    
    return encrypted;
  }

  private async decryptSensitiveData(encryptedData: any): Promise<any> {
    // In a real implementation, this would decrypt sensitive fields
    const decrypted = { ...encryptedData };
    
    // Decrypt marked fields (simulation)
    if (decrypted.authentication?.hashedPassword?.startsWith('encrypted:')) {
      decrypted.authentication.hashedPassword = 
        decrypted.authentication.hashedPassword.replace('encrypted:', '');
    }
    
    return decrypted;
  }

  private extractUserRelationships(userData: UserRecord): string[] {
    const relationships: string[] = [];
    
    // Extract relationships from user data
    if (userData.authentication?.tokens) {
      relationships.push(...userData.authentication.tokens.map(t => `token:${t}`));
    }
    
    if (userData.permissions) {
      relationships.push(...userData.permissions.map(p => `permission:${p}`));
    }
    
    return relationships;
  }

  private async updateUserIndices(userData: UserRecord): Promise<void> {
    // Email index
    if (userData.email) {
      this.userIndex.set(userData.email.toLowerCase(), userData.userId);
    }
    
    // Token indices
    if (userData.authentication?.tokens) {
      for (const token of userData.authentication.tokens) {
        this.tokenIndex.set(token, userData.userId);
      }
    }
    
    // Permission indices
    if (userData.permissions) {
      for (const permission of userData.permissions) {
        if (!this.permissionIndex.has(permission)) {
          this.permissionIndex.set(permission, new Set());
        }
        this.permissionIndex.get(permission)!.add(userData.userId);
      }
    }
  }

  private async removeUserFromIndices(userData: UserRecord): Promise<void> {
    // Remove from email index
    if (userData.email) {
      this.userIndex.delete(userData.email.toLowerCase());
    }
    
    // Remove from token indices
    if (userData.authentication?.tokens) {
      for (const token of userData.authentication.tokens) {
        this.tokenIndex.delete(token);
      }
    }
    
    // Remove from permission indices
    if (userData.permissions) {
      for (const permission of userData.permissions) {
        const permissionSet = this.permissionIndex.get(permission);
        if (permissionSet) {
          permissionSet.delete(userData.userId);
          if (permissionSet.size === 0) {
            this.permissionIndex.delete(permission);
          }
        }
      }
    }
  }

  private setupSecurityIndices(): void {
    // Initialize security-specific indices
    this.indices.set('email', new Map());
    this.indices.set('tokens', new Map());
    this.indices.set('permissions', new Map());
  }

  private enableEncryption(): void {
    // Enable encryption for this MCP
    this.config.compressionEnabled = false; // Encryption first
  }

  private setupAuditLogging(): void {
    // Setup audit logging for security events
    // In a real implementation, this would integrate with an audit system
  }

  private async logUserAudit(
    action: string, 
    userId: string, 
    details?: Record<string, any>
  ): Promise<void> {
    // Log audit event
    this.emit('audit_log', {
      timestamp: Date.now(),
      action,
      userId,
      mcpId: this.metadata.id,
      details: details || {}
    });
  }

  /**
   * User-specific performance optimizations
   */
  async optimizeUserAccess(): Promise<void> {
    // Analyze user access patterns and optimize indices
    const frequentlyAccessedUsers = Array.from(this.records.values())
      .filter(record => record.metadata?.accessPattern?.frequency > 10)
      .sort((a, b) => (b.metadata?.accessPattern?.frequency || 0) - (a.metadata?.accessPattern?.frequency || 0))
      .slice(0, 100); // Top 100 frequently accessed users
    
    // Pre-load frequently accessed users into memory cache
    // In a real implementation, this would use a proper caching mechanism
    
    this.emit('user_optimization_completed', {
      optimizedUsers: frequentlyAccessedUsers.length,
      timestamp: Date.now()
    });
  }

  /**
   * User analytics and insights
   */
  async getAnalytics(): Promise<any> {
    return this.getUserAnalytics();
  }

  async insert(data: any[], options?: any): Promise<any> {
    for (const item of data) {
      await this.storeUser(item);
    }
    return { success: true };
  }

  async query(query: any): Promise<any> {
    if (query.id) {
      return this.getUserById(query.id);
    }
    if (query.email) {
      return this.getUserByEmail(query.email);
    }
    return null;
  }

  async update(id: string, data: any, options?: any): Promise<any> {
    return this.updateUser(id, data);
  }

  async delete(id: string, options?: any): Promise<any> {
    return this.deleteUser(id);
  }

  async createIndex(definition: any): Promise<any> {
    return { success: true };
  }

  protected async performOptimization(): Promise<any> {
    await this.optimizeUserAccess();
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