/**
 * Test Setup for Enterprise Multi-MCP Smart Database System
 * 
 * Global test configuration and utilities for the test suite.
 * Sets up the testing environment with necessary mocks and helpers.
 */

import { jest } from '@jest/globals';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidMCPMetadata(): R;
      toBeValidNaturalQuery(): R;
      toBeValidInterpretedQuery(): R;
      toHaveValidTypeStructure(): R;
    }
  }
}

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/smart_mcp_test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!!';
process.env.LOG_LEVEL = 'error';

// Global setup before all tests
beforeAll(async () => {
  // Initialize test database connections
  // Set up test data
  // Configure test environment
  console.log('🧪 Test environment initialized');
});

// Global cleanup after all tests
afterAll(async () => {
  // Close database connections
  // Clean up test data
  // Reset environment
  console.log('🧹 Test environment cleaned up');
});

// Reset state before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Don't reset modules as it breaks singleton instances like apiServer
  // jest.resetModules();
});

// Custom matchers
expect.extend({
  /**
   * Check if value is valid MCP metadata
   */
  toBeValidMCPMetadata(received: any) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.id === 'string' &&
      typeof received.domain === 'string' &&
      ['hot', 'cold'].includes(received.type) &&
      typeof received.accessFrequency === 'number' &&
      typeof received.lastAccessed === 'number' &&
      typeof received.recordCount === 'number' &&
      Array.isArray(received.indexStrategies);

    return {
      message: () => 
        pass 
          ? `Expected ${JSON.stringify(received)} not to be valid MCP metadata`
          : `Expected ${JSON.stringify(received)} to be valid MCP metadata`,
      pass
    };
  },

  /**
   * Check if value is valid natural query
   */
  toBeValidNaturalQuery(received: any) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.raw === 'string' &&
      received.raw.length > 0;

    return {
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be valid natural query`
          : `Expected ${JSON.stringify(received)} to be valid natural query`,
      pass
    };
  },

  /**
   * Check if value is valid interpreted query
   */
  toBeValidInterpretedQuery(received: any) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.originalQuery === 'object' &&
      Array.isArray(received.intents) &&
      typeof received.entities === 'object' &&
      Array.isArray(received.targetMCPs) &&
      typeof received.confidence === 'number' &&
      received.confidence >= 0 &&
      received.confidence <= 1;

    return {
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be valid interpreted query`
          : `Expected ${JSON.stringify(received)} to be valid interpreted query`,
      pass
    };
  },

  /**
   * Check if object has valid type structure
   */
  toHaveValidTypeStructure(received: any) {
    const pass = typeof received === 'object' && received !== null;

    return {
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to have valid type structure`
          : `Expected ${JSON.stringify(received)} to have valid type structure`,
      pass
    };
  }
});

// Test utilities
export const TestUtils = {
  /**
   * Create mock MCP metadata
   */
  createMockMCPMetadata: (overrides: Partial<any> = {}) => ({
    id: 'test-mcp-001',
    domain: 'test',
    type: 'hot' as const,
    performanceTier: 'standard' as const,
    accessFrequency: 100,
    lastAccessed: Date.now(),
    recordCount: 1000,
    averageRecordSize: 1024,
    totalSize: 1024000,
    indexStrategies: ['btree', 'hash'],
    healthStatus: 'healthy' as const,
    endpoint: 'http://localhost:3001',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    configuration: {
      maxRecords: 100000,
      maxSize: 1073741824,
      cacheSize: 64,
      connectionPoolSize: 10,
      queryTimeout: 30000,
      backupFrequency: 24,
      compressionEnabled: true,
      encryptionEnabled: true,
      autoIndexing: true,
      replicationFactor: 1,
      consistencyLevel: 'strong' as const,
      customProperties: {}
    },
    metrics: {
      averageResponseTime: 50,
      queryThroughput: 100,
      cpuUtilization: 25,
      memoryUtilization: 40,
      diskUtilization: 30,
      networkIO: {
        bytesIn: 1024000,
        bytesOut: 2048000,
        packetsIn: 1000,
        packetsOut: 2000
      },
      cacheHitRatio: 0.85,
      errorRate: 0.01,
      activeConnections: 5,
      successfulOperations: 9900,
      failedOperations: 100,
      lastUpdated: Date.now()
    },
    migrationHistory: [],
    relatedMCPs: [],
    tags: ['test'],
    ...overrides
  }),

  /**
   * Create mock natural query
   */
  createMockNaturalQuery: (overrides: Partial<any> = {}) => ({
    raw: 'get user messages from last week',
    context: {
      userId: 'user-123',
      sessionId: 'session-456',
      timeZone: 'UTC'
    },
    metadata: {
      id: 'query-123',
      timestamp: Date.now(),
      source: 'api' as const,
      priority: 'normal' as const
    },
    preferences: {
      responseFormat: 'json' as const,
      maxResults: 100,
      cachePreference: 'smart' as const,
      explanationLevel: 'basic' as const
    },
    ...overrides
  }),

  /**
   * Create mock interpreted query
   */
  createMockInterpretedQuery: (overrides: Partial<any> = {}) => ({
    originalQuery: TestUtils.createMockNaturalQuery(),
    intents: [
      {
        type: 'retrieve' as const,
        confidence: 0.9,
        parameters: { dataType: 'messages' }
      }
    ],
    entities: {
      dataType: 'messages',
      filters: [
        {
          field: 'userId',
          operator: 'equals' as const,
          value: 'user-123'
        },
        {
          field: 'createdAt',
          operator: 'greater_than' as const,
          value: Date.now() - (7 * 24 * 60 * 60 * 1000)
        }
      ]
    },
    targetMCPs: ['chat-mcp-001'],
    executionPlan: {
      steps: [
        {
          id: 'step-1',
          type: 'query' as const,
          targetMCP: 'chat-mcp-001',
          parameters: {},
          dependencies: [],
          estimatedTime: 100,
          resources: {
            cpu: 1,
            memory: 64,
            diskIO: 10,
            networkBandwidth: 5,
            dataSize: 1024
          }
        }
      ],
      estimatedTime: 100,
      resourceRequirements: {
        cpu: 1,
        memory: 64,
        diskIO: 10,
        networkBandwidth: 5,
        dataSize: 1024
      },
      optimizationStrategy: {
        name: 'standard',
        indexUsage: [],
        caching: {
          level: 'query' as const,
          keyStrategy: 'hash',
          ttl: 3600,
          invalidationTriggers: []
        },
        queryRewriting: [],
        dataAccessPattern: {
          type: 'sequential' as const,
          locality: 'high' as const,
          temporal: 'recent' as const,
          frequency: 'medium' as const
        }
      },
      parallelization: {
        parallel: false,
        maxParallelism: 1,
        groups: [],
        synchronizationPoints: []
      }
    },
    confidence: 0.9,
    optimizations: [],
    ...overrides
  }),

  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random test data
   */
  randomString: (length: number = 10): string => 
    Math.random().toString(36).substring(2, 2 + length),

  randomNumber: (min: number = 0, max: number = 100): number =>
    Math.floor(Math.random() * (max - min + 1)) + min,

  randomBoolean: (): boolean => Math.random() < 0.5,

  randomArrayElement: <T>(array: T[]): T =>
    array[Math.floor(Math.random() * array.length)],

  /**
   * Create test database cleanup function
   */
  createCleanupFunction: (tables: string[]) => async (): Promise<void> => {
    // Implementation would clean up specified tables
    console.log(`Cleaning up tables: ${tables.join(', ')}`);
  },

  /**
   * Mock console methods for testing
   */
  mockConsole: () => {
    const originalConsole = { ...console };
    
    const mockMethods = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };

    Object.assign(console, mockMethods);

    return {
      restore: () => Object.assign(console, originalConsole),
      mocks: mockMethods
    };
  }
};

// Export for use in tests
export default TestUtils;