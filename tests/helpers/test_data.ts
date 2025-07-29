/**
 * Test Data Generators
 * 
 * Provides mock data generators for all MCP types and system components.
 */

// Import types from source files
// Note: Using any for test mocks since actual types may not be fully implemented yet
type MCPMetadata = any;
type NaturalQuery = any;
type InterpretedQuery = any;
type QueryExecutionPlan = any;
type MCPConfiguration = any;
type MCPMetrics = any;

export class TestDataGenerator {
  /**
   * Generate mock MCP metadata
   */
  static createMCPMetadata(overrides: Partial<MCPMetadata> = {}): MCPMetadata {
    return {
      id: `test-mcp-${Date.now()}`,
      domain: 'test',
      type: 'hot',
      performanceTier: 'standard',
      accessFrequency: 100,
      lastAccessed: Date.now(),
      recordCount: 1000,
      averageRecordSize: 1024,
      totalSize: 1024000,
      indexStrategies: ['btree', 'hash'],
      healthStatus: 'healthy',
      endpoint: 'http://localhost:3001',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
      configuration: TestDataGenerator.createMCPConfiguration(),
      metrics: TestDataGenerator.createMCPMetrics(),
      migrationHistory: [],
      relatedMCPs: [],
      tags: ['test'],
      ...overrides
    };
  }

  /**
   * Generate mock MCP configuration
   */
  static createMCPConfiguration(overrides: Partial<MCPConfiguration> = {}): MCPConfiguration {
    return {
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
      consistencyLevel: 'strong',
      customProperties: {},
      ...overrides
    };
  }

  /**
   * Generate mock MCP metrics
   */
  static createMCPMetrics(overrides: Partial<MCPMetrics> = {}): MCPMetrics {
    return {
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
      lastUpdated: Date.now(),
      ...overrides
    };
  }

  /**
   * Generate mock natural query
   */
  static createNaturalQuery(overrides: Partial<NaturalQuery> = {}): NaturalQuery {
    return {
      raw: 'get user messages from last week',
      context: {
        userId: 'user-123',
        sessionId: 'session-456',
        timeZone: 'UTC'
      },
      metadata: {
        id: `query-${Date.now()}`,
        timestamp: Date.now(),
        source: 'api',
        priority: 'normal'
      },
      preferences: {
        responseFormat: 'json',
        maxResults: 100,
        cachePreference: 'smart',
        explanationLevel: 'basic'
      },
      ...overrides
    };
  }

  /**
   * Generate mock interpreted query
   */
  static createInterpretedQuery(overrides: Partial<InterpretedQuery> = {}): InterpretedQuery {
    return {
      originalQuery: TestDataGenerator.createNaturalQuery(),
      intents: [
        {
          type: 'retrieve',
          confidence: 0.9,
          parameters: { dataType: 'messages' }
        }
      ],
      entities: {
        dataType: 'messages',
        filters: [
          {
            field: 'userId',
            operator: 'equals',
            value: 'user-123'
          },
          {
            field: 'createdAt',
            operator: 'greater_than',
            value: Date.now() - (7 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      targetMCPs: ['chat-mcp-001'],
      executionPlan: TestDataGenerator.createExecutionPlan(),
      confidence: 0.9,
      optimizations: [],
      ...overrides
    };
  }

  /**
   * Generate mock execution plan
   */
  static createExecutionPlan(): QueryExecutionPlan {
    return {
      steps: [
        {
          id: 'step-1',
          type: 'query',
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
          level: 'query',
          keyStrategy: 'hash',
          ttl: 3600,
          invalidationTriggers: []
        },
        queryRewriting: [],
        dataAccessPattern: {
          type: 'sequential',
          locality: 'high',
          temporal: 'recent',
          frequency: 'medium'
        }
      },
      parallelization: {
        parallel: false,
        maxParallelism: 1,
        groups: [],
        synchronizationPoints: []
      }
    };
  }

  /**
   * Generate test user data
   */
  static createTestUser(overrides: any = {}) {
    return {
      id: `user-${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: true
      },
      ...overrides
    };
  }

  /**
   * Generate test chat message data
   */
  static createTestMessage(overrides: any = {}) {
    return {
      id: `msg-${Date.now()}`,
      userId: 'user-123',
      content: 'Test message content',
      type: 'text',
      channelId: 'channel-456',
      timestamp: new Date(),
      metadata: {
        ip: '127.0.0.1',
        userAgent: 'Test Agent',
        clientVersion: '1.0.0'
      },
      reactions: [],
      mentions: [],
      attachments: [],
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
      ...overrides
    };
  }

  /**
   * Generate test statistics data
   */
  static createTestStats(overrides: any = {}) {
    return {
      id: `stats-${Date.now()}`,
      type: 'query_performance',
      timestamp: new Date(),
      value: Math.random() * 1000,
      metadata: {
        queryId: 'query-123',
        mcpId: 'mcp-456',
        userId: 'user-789'
      },
      tags: ['performance', 'query'],
      aggregatedBy: 'minute',
      ...overrides
    };
  }

  /**
   * Generate test log entry
   */
  static createTestLogEntry(overrides: any = {}) {
    return {
      id: `log-${Date.now()}`,
      level: 'info',
      message: 'Test log message',
      timestamp: new Date(),
      source: 'test-component',
      userId: 'user-123',
      sessionId: 'session-456',
      requestId: 'req-789',
      metadata: {
        component: 'test',
        operation: 'test-operation',
        duration: 100
      },
      context: {
        environment: 'test',
        version: '1.0.0'
      },
      ...overrides
    };
  }

  /**
   * Generate multiple test items
   */
  static generateMultiple<T>(generator: () => T, count: number): T[] {
    return Array.from({ length: count }, () => generator());
  }

  /**
   * Generate random string
   */
  static randomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Generate random number in range
   */
  static randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   */
  static randomBoolean(): boolean {
    return Math.random() < 0.5;
  }

  /**
   * Pick random element from array
   */
  static randomArrayElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate random date within range
   */
  static randomDate(start: Date = new Date(2023, 0, 1), end: Date = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}

export default TestDataGenerator;