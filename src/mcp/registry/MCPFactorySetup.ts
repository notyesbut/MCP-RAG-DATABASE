/**
 * MCP Factory Setup - Registration of all specialized MCP factories
 * Centralizes the creation logic for all MCP types
 */

import { MCPRegistry } from './MCPRegistry';
import { BaseMCP } from '../../core/mcp/base_mcp';
import { UserMCP } from '../../core/specialized/user_mcp';
import { ChatMCP } from '../../core/specialized/chat_mcp';
import { StatsMCP } from '../../core/specialized/stats_mcp';
import { LogsMCP } from '../../core/specialized/logs_mcp';
import { MCPType, MCPDomain, MCPConfig } from '../../types/mcp.types';

/**
 * Register all MCP factories with the registry
 */
export function setupMCPFactories(registry: MCPRegistry): void {
  // User MCP Factory
  registry.registerMCPFactory(MCPType.USER, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    return new UserMCP(domain, type, config);
  });

  // Chat MCP Factory
  registry.registerMCPFactory(MCPType.CHAT, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    return new ChatMCP(domain, type, config);
  });

  // Stats MCP Factory
  registry.registerMCPFactory(MCPType.STATS, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    return new StatsMCP(domain, type, config);
  });

  // Logs MCP Factory
  registry.registerMCPFactory(MCPType.LOGS, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    return new LogsMCP(domain, type, config);
  });

  // Generic HOT MCP Factory
  registry.registerMCPFactory(MCPType.HOT, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    // Create appropriate specialized MCP based on domain
    switch (domain) {
      case 'user':
        return new UserMCP(domain, type, { ...config, compressionEnabled: false });
      case 'chat':
        return new ChatMCP(domain, type, { ...config, compressionEnabled: false });
      case 'stats':
        return new StatsMCP(domain, type, { ...config, compressionEnabled: false });
      case 'logs':
        return new LogsMCP(domain, type, { ...config, compressionEnabled: false });
      default:
        // Create a generic hot MCP for unknown domains
        return new GenericHotMCP(domain, type, config);
    }
  });

  // Generic COLD MCP Factory
  registry.registerMCPFactory(MCPType.COLD, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    // Create appropriate specialized MCP based on domain with cold optimizations
    switch (domain) {
      case 'user':
        return new UserMCP(domain, type, { ...config, compressionEnabled: true, cacheSize: 10 });
      case 'chat':
        return new ChatMCP(domain, type, { ...config, compressionEnabled: true, cacheSize: 10 });
      case 'stats':
        return new StatsMCP(domain, type, { ...config, compressionEnabled: true, cacheSize: 10 });
      case 'logs':
        return new LogsMCP(domain, type, { ...config, compressionEnabled: true, cacheSize: 10 });
      default:
        // Create a generic cold MCP for unknown domains
        return new GenericColdMCP(domain, type, config);
    }
  });

  // Hybrid MCP Factory - for mixed workloads
  registry.registerMCPFactory(MCPType.HYBRID, (domain: MCPDomain, type: MCPType, config: Partial<MCPConfig>) => {
    // Choose the best specialized MCP for the domain
    switch (domain) {
      case 'user':
        return new UserMCP(domain, type, config);
      case 'chat':
        return new ChatMCP(domain, type, config);
      case 'stats':
        return new StatsMCP(domain, type, config);
      case 'logs':
        return new LogsMCP(domain, type, config);
      default:
        return new GenericHybridMCP(domain, type, config);
    }
  });
}

/**
 * Generic Hot MCP for unknown domains
 */
class GenericHotMCP extends BaseMCP {
  protected defineCapabilities() {
    return {
      queryTypes: ['select', 'insert', 'update', 'delete', 'search'] as ('select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search')[],
      dataTypes: ['string', 'number', 'object', 'array'],
      maxConnections: 200,
      consistencyLevels: ['strong'] as any[],
      transactionSupport: true,
      backupSupport: true,
      replicationSupport: true,
      encryptionSupport: false,
      compressionSupport: false, // Hot tier prioritizes speed
      fullTextSearch: true,
      geospatialSupport: false,
      vectorSearch: false,
      streamingSupport: true
    };
  }

  protected optimizeForDomain(): void {
    // Hot tier optimizations
    this.config.cacheSize = 100;
    this.config.maxRecords = 50000;
    this.config.compressionEnabled = false;
  }
}

/**
 * Generic Cold MCP for unknown domains
 */
class GenericColdMCP extends BaseMCP {
  protected defineCapabilities() {
    return {
      queryTypes: ['select', 'insert', 'delete'] as ('select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search')[],
      dataTypes: ['string', 'number', 'object', 'array'],
      maxConnections: 10,
      consistencyLevels: ['eventual'] as any[],
      transactionSupport: false,
      backupSupport: true,
      replicationSupport: false,
      encryptionSupport: false,
      compressionSupport: true, // Cold tier prioritizes storage efficiency
      fullTextSearch: false,
      geospatialSupport: false,
      vectorSearch: false,
      streamingSupport: false
    };
  }

  protected optimizeForDomain(): void {
    // Cold tier optimizations
    this.config.cacheSize = 5;
    this.config.maxRecords = 1000000;
    this.config.compressionEnabled = true;
  }
}

/**
 * Generic Hybrid MCP for unknown domains
 */
class GenericHybridMCP extends BaseMCP {
  protected defineCapabilities() {
    return {
      queryTypes: ['select', 'insert', 'update', 'delete', 'search'] as ('select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'search')[],
      dataTypes: ['string', 'number', 'object', 'array'],
      maxConnections: 50,
      consistencyLevels: ['eventual', 'weak'] as any[],
      transactionSupport: false,
      backupSupport: true,
      replicationSupport: true,
      encryptionSupport: false,
      compressionSupport: true,
      fullTextSearch: true,
      geospatialSupport: false,
      vectorSearch: false,
      streamingSupport: false
    };
  }

  protected optimizeForDomain(): void {
    // Balanced optimizations
    this.config.cacheSize = 25;
    this.config.maxRecords = 100000;
    this.config.compressionEnabled = true;
  }
}

/**
 * Create a default MCP registry with all factories registered
 */
export function createDefaultMCPRegistry(): MCPRegistry {
  const registry = new MCPRegistry();
  setupMCPFactories(registry);
  return registry;
}

/**
 * Validate MCP creation request
 */
export function validateMCPCreationRequest(request: any): string[] {
  const errors: string[] = [];

  if (!request.name || typeof request.name !== 'string') {
    errors.push('MCP name is required and must be a string');
  }

  if (!request.type || !Object.values(MCPType).includes(request.type)) {
    errors.push('Valid MCP type is required');
  }

  if (!request.domain || typeof request.domain !== 'string') {
    errors.push('MCP domain is required and must be a string');
  }

  if (request.config && typeof request.config !== 'object') {
    errors.push('MCP config must be an object if provided');
  }

  if (request.tags && !Array.isArray(request.tags)) {
    errors.push('MCP tags must be an array if provided');
  }

  if (request.initialData && !Array.isArray(request.initialData)) {
    errors.push('Initial data must be an array if provided');
  }

  return errors;
}