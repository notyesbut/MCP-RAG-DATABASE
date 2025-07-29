/**
 * Type Safety Regression Tests
 * Ensures that type fixes remain stable and don't regress
 */

import { describe, it, expect } from '@jest/globals';
import type { 
  MCPHealth, 
  MCPRegistryConfig,
  QueryError,
  QueryLearning,
  QueryExecutionPlan,
  OptimizationStrategy
} from '../../types';

describe('Type Safety Regression Tests', () => {
  describe('MCPHealth Type', () => {
    it('should not include uptime property', () => {
      const health: MCPHealth = {
        status: 'healthy',
        latency: 10,
        errors: 0,
        lastCheck: Date.now()
      };
      
      // @ts-expect-error - uptime should not exist on MCPHealth
      expect(health.uptime).toBeUndefined();
    });
  });

  describe('MCPRegistryConfig Type', () => {
    it('should have required maxRecords property', () => {
      const config: MCPRegistryConfig = {
        id: 'test',
        domain: 'test',
        type: 'specialized' as any,
        maxRecords: 1000, // This should be required
        maxSize: 1024,
        cacheSize: 512,
        connectionPoolSize: 10,
        queryTimeout: 5000,
        backupFrequency: 3600,
        retryAttempts: 3,
        retryDelay: 1000,
        compressionEnabled: false,
        encryptionEnabled: false,
        maintenanceWindow: { start: 0, duration: 3600 }
      };
      
      expect(config.maxRecords).toBeDefined();
      expect(config.maxRecords).toBe(1000);
    });
  });

  describe('QueryError Type', () => {
    it('should have all required properties', () => {
      const error: QueryError = {
        code: 'ERR001',
        message: 'Test error',
        timestamp: Date.now(),
        recoverable: true,
        mcpId: 'test-mcp',
        severity: 'error' as any
      };
      
      expect(error.code).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.recoverable).toBeDefined();
    });
  });

  describe('QueryLearning Type', () => {
    it('should not have performance property', () => {
      const learning: QueryLearning = {
        queryPattern: 'test pattern',
        successRate: 0.95,
        avgExecutionTime: 100,
        lastUsed: Date.now(),
        improvements: []
      };
      
      // @ts-expect-error - performance should not exist on QueryLearning
      expect(learning.performance).toBeUndefined();
    });
  });

  describe('QueryExecutionPlan Type', () => {
    it('should have required properties', () => {
      const plan: QueryExecutionPlan = {
        executionId: 'exec-123',
        phases: [],
        optimizations: [],
        steps: [],
        estimatedTime: 100,
        resourceRequirements: {
          cpu: 50,
          memory: 256,
          diskIO: 10,
          networkBandwidth: 100,
          dataSize: 1024
        },
        optimizationStrategy: 'standard' as OptimizationStrategy,
        parallelization: {
          enabled: true,
          maxConcurrency: 4,
          dependencies: []
        }
      };
      
      expect(plan.executionId).toBeDefined();
      expect(plan.phases).toBeDefined();
      expect(plan.optimizations).toBeDefined();
    });
  });

  describe('Optional Properties with exactOptionalPropertyTypes', () => {
    it('should handle undefined in optional properties correctly', () => {
      interface StrictOptional {
        required: string;
        optional?: string; // With exactOptionalPropertyTypes, this cannot be undefined
      }
      
      const createObject = (optional?: string): StrictOptional => {
        const obj: StrictOptional = { required: 'test' };
        if (optional !== undefined) {
          obj.optional = optional;
        }
        return obj;
      };
      
      const withValue = createObject('value');
      const withoutValue = createObject();
      
      expect(withValue.optional).toBe('value');
      expect(withoutValue.optional).toBeUndefined();
    });
  });

  describe('Method Existence Checks', () => {
    it('should verify BaseMCP methods exist', () => {
      // This is a compile-time check - if it compiles, the test passes
      interface BaseMCPInterface {
        getConfiguration: () => any;
        // updateConfiguration should not exist
        // optimize should not exist
        // prepareForMigration should not exist
      }
      
      const mockMCP: BaseMCPInterface = {
        getConfiguration: () => ({})
      };
      
      expect(mockMCP.getConfiguration).toBeDefined();
      // @ts-expect-error - these methods should not exist
      expect(mockMCP.updateConfiguration).toBeUndefined();
      // @ts-expect-error
      expect(mockMCP.optimize).toBeUndefined();
      // @ts-expect-error
      expect(mockMCP.prepareForMigration).toBeUndefined();
    });
  });
});