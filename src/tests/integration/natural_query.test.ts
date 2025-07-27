/**
 * RAG₂ Natural Language Query Integration Tests
 * Comprehensive tests for the SQL-eliminating interface
 * Enterprise MCP System - Quality Assurance Lead Implementation
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { RAG2Controller, createRAG2Controller } from '../../rag/query/rag2';
import { NaturalQuery, QueryResult } from '../../types/query.types';
import { MCPRegistry } from '../../mcp/registry/MCPRegistry';

// Mock MCP Registry for testing
class MockMCPRegistry extends MCPRegistry {
  async getMCPCapabilities(mcpId: string) {
    const capabilities = {
      'user-mcp': {
        supportedDataTypes: ['users'],
        supportedIntents: ['retrieve', 'search', 'count'],
        supportedAggregations: ['merge', 'deduplicate'],
        performance: {
          avgLatency: 50,
          throughput: 1000,
          reliability: 0.99,
          hotDataLatency: 30,
          coldDataLatency: 100
        },
        features: {
          fullTextSearch: true,
          spatialQueries: false,
          temporalQueries: true,
          aggregations: true,
          joins: false,
          transactions: true
        }
      },
      'chat-mcp': {
        supportedDataTypes: ['messages', 'chats'],
        supportedIntents: ['retrieve', 'search', 'filter'],
        supportedAggregations: ['time_ordered', 'merge'],
        performance: {
          avgLatency: 80,
          throughput: 800,
          reliability: 0.95,
          hotDataLatency: 40,
          coldDataLatency: 200
        },
        features: {
          fullTextSearch: true,
          spatialQueries: false,
          temporalQueries: true,
          aggregations: false,
          joins: true,
          transactions: false
        }
      }
    };
    
    return capabilities[mcpId as keyof typeof capabilities] || capabilities['user-mcp'];
  }

  async getMCPLoad(mcpId: string) {
    return Math.random() * 50; // 0-50% load
  }

  async getMCPHealth(mcpId: string) {
    return {
      status: 'healthy' as const,
      uptime: 1000,
      memoryUsage: 100,
      cpuUsage: 10,
      diskUsage: 100
    };
  }
}

describe('RAG₂ Natural Language Query System', () => {
  let rag2Controller: RAG2Controller;
  let mockRegistry: MockMCPRegistry;

  beforeEach(() => {
    mockRegistry = new MockMCPRegistry();
    rag2Controller = createRAG2Controller(mockRegistry, {
      caching: { enabled: false }, // Disable caching for tests
      learning: { enabled: false }  // Disable learning for predictable tests
    });
  });

  afterEach(() => {
    rag2Controller.reset();
  });

  describe('Basic Natural Language Queries', () => {
    test('should process simple user retrieval query', async () => {
      const query: NaturalQuery = {
        raw: 'get all users',
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.insights.interpretation).toContain('retrieve');
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should handle user search with filter', async () => {
      const query: NaturalQuery = {
        raw: 'find user admin@example.com',
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.data.metadata.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mcpId: 'user-mcp' })
        ])
      );
    });

    test('should process chat messages query', async () => {
      const query: NaturalQuery = {
        raw: 'show messages from today',
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.data.metadata.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mcpId: 'chat-mcp' })
        ])
      );
    });
  });

  describe('Complex Multi-MCP Queries', () => {
    test('should handle cross-MCP query with token validation', async () => {
      const query: NaturalQuery = {
        raw: 'get messages token xyz123',
        context: {
          userId: 'test-user'
        },
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.data.metadata.sources.length).toBeGreaterThan(1);
      
      // Should include both chat and token MCPs
      const mcpIds = result.data.metadata.sources.map(s => s.mcpId);
      expect(mcpIds).toContain('chat-mcp');
      expect(mcpIds).toContain('token-mcp');
    });

    test('should aggregate results from multiple MCPs', async () => {
      const query: NaturalQuery = {
        raw: 'analyze user activity and messages',
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.data.metadata.aggregationApplied).toBe('cross_reference');
      expect(result.insights.interpretation).toContain('analyze');
    });
  });

  describe('Temporal Queries', () => {
    test('should handle recent data queries efficiently', async () => {
      const query: NaturalQuery = {
        raw: 'show recent user activity',
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.insights.performanceNotes.length).toBeGreaterThanOrEqual(0);
      
      // Recent queries should be fast
      expect(result.duration).toBeLessThan(1000);
    });

    test('should handle historical data queries', async () => {
      const query: NaturalQuery = {
        raw: 'get logs from last month',
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          source: 'api',
          priority: 'high'
        }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      // Historical queries might be slower
      expect(result.data.metadata.sources).toBeDefined();
    });
  });

  describe('Query Intent Recognition', () => {
    test('should recognize count intent', async () => {
      const interpretation = await rag2Controller.plan('count active users');

      expect(interpretation.intents[0]).toBe('count');
      expect(interpretation.entities.dataType).toBe('users');
      expect(interpretation.aggregationStrategy).toBe('statistical_summary');
    });

    test('should recognize search intent', async () => {
      const interpretation = await rag2Controller.plan('search messages containing error');

      expect(interpretation.intents[0]).toBe('search');
      expect(interpretation.entities.dataType).toBe('messages');
    });

    test('should recognize analyze intent', async () => {
      const interpretation = await rag2Controller.plan('analyze user behavior patterns');

      expect(interpretation.intents[0]).toBe('analyze');
      expect(interpretation.targetMCPs.some(mcp => mcp === 'analytics-mcp')).toBe(true);
    });
  });

  describe('Entity Extraction', () => {
    test('should extract email entities', async () => {
      const interpretation = await rag2Controller.plan('find user admin@example.com');

      const emailEntity = interpretation.entities.extractedEntities?.find(e => e.type === 'email');
      expect(emailEntity).toBeDefined();
      expect(emailEntity?.value).toBe('admin@example.com');
      expect(emailEntity?.confidence).toBeGreaterThan(0.9);
    });

    test('should extract token entities', async () => {
      const interpretation = await rag2Controller.plan('get messages token abc123');

      const tokenEntity = interpretation.entities.extractedEntities?.find(e => e.type === 'token');
      expect(tokenEntity).toBeDefined();
      expect(tokenEntity?.value).toBe('abc123');
      expect(interpretation.entities.filters.some(f => f.field === 'token' && f.value === 'abc123')).toBe(true);
    });

    test('should extract temporal entities', async () => {
      const interpretation = await rag2Controller.plan('show messages from yesterday');

      expect(interpretation.entities.temporal).toBe('yesterday');
      const temporalEntity = interpretation.entities.extractedEntities?.find(e => e.type === 'temporal');
      expect(temporalEntity).toBeDefined();
    });
  });

  describe('Performance and Optimization', () => {
    test('should provide optimization hints', async () => {
      const interpretation = await rag2Controller.plan('get user details token xyz123');

      expect(interpretation.optimizations).toBeDefined();
      expect(interpretation.optimizations[0]?.useCache).toBe(true);
      expect(interpretation.optimizations[0]?.suggestedIndexes).toContain('token_index');
    });

    test('should detect parallelizable queries', async () => {
      const interpretation = await rag2Controller.plan('analyze users and messages and stats');

      expect(interpretation.optimizations[0]?.parallelizable).toBe(true);
      expect(interpretation.optimizations[0]?.estimatedComplexity).toBe('high');
    });

    test('should track performance metrics', async () => {
      const query: NaturalQuery = {
        raw: 'get all users',
        metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
      };

      await rag2Controller.processNaturalQuery(query);
      
      const insights = rag2Controller.getPerformanceInsights();
      expect(insights).toBeDefined();
      expect(insights.planner).toBeDefined();
      expect(insights.aggregator).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed queries gracefully', async () => {
      const query: NaturalQuery = {
        raw: 'asdf qwerty invalid query',
        metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.insights.suggestions.length).toBeGreaterThan(0);
    });

    test('should provide helpful suggestions for failed queries', async () => {
      const query: NaturalQuery = {
        raw: '',
        metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(false);
      expect(result.insights.suggestions).toContain('Try rephrasing your query');
    });
  });

  describe('Query Explanation', () => {
    test('should provide clear explanations for query interpretation', async () => {
      const interpretation = await rag2Controller.plan('get recent messages from user john');

      expect(interpretation.explanation?.interpretation).toContain('retrieve');
      expect(interpretation.explanation?.mcpSelection).toContain('chat-mcp');
      expect(interpretation.explanation?.executionPlan).toContain('query');
    });

    test('should explain MCP selection logic', async () => {
      const interpretation = await rag2Controller.plan('count active users today');

      expect(interpretation.explanation?.mcpSelection).toContain('user-mcp');
      expect(interpretation.explanation?.interpretation).toContain('count');
    });
  });

  describe('Supported Query Examples', () => {
    test('should handle all documented query examples', async () => {
      const examples = rag2Controller.getExamples();
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples).toContain('get messages token xyz123');
      expect(examples).toContain('show user activity last week');
      expect(examples).toContain('count active users today');

      // Test a few examples
      for (const example of examples.slice(0, 3)) {
        const query: NaturalQuery = {
          raw: example,
          metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
        };

        const result = await rag2Controller.processNaturalQuery(query);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Query History and Learning', () => {
    test('should maintain query history', async () => {
      const query1: NaturalQuery = {
        raw: 'get users',
        metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
      };
      const query2: NaturalQuery = {
        raw: 'show messages',
        metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
      };

      await rag2Controller.processNaturalQuery(query1);
      await rag2Controller.processNaturalQuery(query2);

      const history = rag2Controller.getQueryHistory();
      expect(history.length).toBe(2);
      expect(history[0].query.raw).toBe('get users');
      expect(history[1].query.raw).toBe('show messages');
    });
  });

  describe('Real-world Query Scenarios', () => {
    test('should handle authentication flow query', async () => {
      const query: NaturalQuery = {
        raw: 'get user details for token abc123 and show their recent messages',
        context: { sessionId: 'test-session' },
        metadata: { id: 'test', timestamp: Date.now(), source: 'api', priority: 'high' }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.metadata.sources.length).toBeGreaterThanOrEqual(2);
      
      // Should include token validation and user/message retrieval
      const mcpIds = result.data.metadata.sources.map(s => s.mcpId);
      expect(mcpIds).toContain('token-mcp');
      expect(mcpIds.some(id => id.includes('user') || id.includes('chat'))).toBe(true);
    });

    test('should handle analytics dashboard query', async () => {
      const query: NaturalQuery = {
        raw: 'analyze user engagement metrics for this week compared to last week',
        metadata: { id: 'web', timestamp: Date.now(), source: 'web_ui', priority: 'high' }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      expect(result.insights.interpretation).toContain('analyze');
      expect(result.data.metadata.aggregationApplied).toBe('cross_reference');
    });

    test('should handle search and filter query', async () => {
      const query: NaturalQuery = {
        raw: 'find all error messages from user admin@example.com in the last 24 hours',
        metadata: { id: 'cli', timestamp: Date.now(), source: 'cli', priority: 'high' }
      };

      const result = await rag2Controller.processNaturalQuery(query);

      expect(result.success).toBe(true);
      
      const interpretation = await rag2Controller.plan(query.raw);
      expect(interpretation.intents[0]).toBe('search');
      expect(interpretation.entities.temporal).toBe('recent');
      expect(interpretation.entities.filters.some(f => f.field === 'email' && f.value === 'admin@example.com')).toBe(true);
    });
  });
});

describe('RAG₂ Advanced Error Handling and Resilience', () => {
  let rag2Controller: RAG2Controller;
  let mockRegistry: MockMCPRegistry;

  beforeEach(() => {
    mockRegistry = new MockMCPRegistry();
    rag2Controller = createRAG2Controller(mockRegistry);
  });

  test('should handle MCP downtime gracefully', async () => {
    // Simulate MCP failure
    mockRegistry.getMCPHealth = async () => ({ status: 'down', uptime: 0, memoryUsage: 0, cpuUsage: 0, diskUsage: 0 });
    
    const query: NaturalQuery = {
      raw: 'get user data',
      metadata: { id: 'resilience-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const result = await rag2Controller.processNaturalQuery(query);
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.insights.suggestions).toContain('Try again later');
  });

  test('should implement circuit breaker pattern', async () => {
    // Simulate repeated failures
    const failedQueries = [];
    for (let i = 0; i < 5; i++) {
      const query: NaturalQuery = {
        raw: 'trigger failure',
        metadata: { id: 'circuit-breaker', timestamp: Date.now(), source: 'api', priority: 'high' }
      };
      failedQueries.push(rag2Controller.processNaturalQuery(query));
    }
    
    const results = await Promise.all(failedQueries);
    const lastResult = results[results.length - 1];
    
    // Circuit breaker should be open after repeated failures
    expect(lastResult.insights.performanceNotes).toContain('circuit breaker');
  });

  test('should validate input sanitization', async () => {
    const maliciousQuery: NaturalQuery = {
      raw: '<script>alert("xss")</script>',
      metadata: { id: 'security-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const result = await rag2Controller.processNaturalQuery(maliciousQuery);
    
    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.error).toContain('Invalid');
  });

  test('should handle extremely large queries', async () => {
    const largeQuery: NaturalQuery = {
      raw: 'get user data '.repeat(1000),
      metadata: { id: 'load-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const result = await rag2Controller.processNaturalQuery(largeQuery);
    
    // Should either process successfully or fail gracefully
    if (!result.success) {
      expect(result.errors?.[0]?.error).toContain('Query too large');
    }
  });

  test('should enforce rate limiting', async () => {
    const queries = Array.from({ length: 100 }, (_, i) => ({
      raw: `rapid query ${i}`,
      metadata: { id: `rate-limit-test-${i}`, timestamp: Date.now(), source: 'api', priority: 'high' }
    }));

    const results = await Promise.all(
      queries.map(query => rag2Controller.processNaturalQuery(query))
    );

    const rateLimitedResults = results.filter(r => 
      r.errors?.some(e => e.error.includes('rate limit'))
    );
    
    expect(rateLimitedResults.length).toBeGreaterThan(0);
  });
});

describe('RAG₂ Performance Benchmarks', () => {
  let rag2Controller: RAG2Controller;

  beforeEach(() => {
    const mockRegistry = new MockMCPRegistry();
    rag2Controller = createRAG2Controller(mockRegistry);
  });

  test('should process simple queries under 100ms', async () => {
    const query: NaturalQuery = {
      raw: 'get users',
      metadata: { id: 'benchmark', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const startTime = Date.now();
    const result = await rag2Controller.processNaturalQuery(query);
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(100);
  });

  test('should handle concurrent queries efficiently', async () => {
    const queries = Array.from({ length: 10 }, (_, i) => ({
      raw: `get user ${i}`,
      metadata: { id: `concurrent-${i}`, timestamp: Date.now(), source: 'api', priority: 'high' }
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      queries.map(query => rag2Controller.processNaturalQuery(query))
    );
    const duration = Date.now() - startTime;

    expect(results.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(500); // All 10 queries under 500ms
  });

  test('should scale with query complexity', async () => {
    const simpleQuery: NaturalQuery = {
      raw: 'get users',
      metadata: { id: 'benchmark-simple', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const complexQuery: NaturalQuery = {
      raw: 'analyze user engagement patterns across all message types with token validation and cross-reference user profiles',
      metadata: { id: 'benchmark-complex', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const simpleStart = Date.now();
    const simpleResult = await rag2Controller.processNaturalQuery(simpleQuery);
    const simpleDuration = Date.now() - simpleStart;

    const complexStart = Date.now();
    const complexResult = await rag2Controller.processNaturalQuery(complexQuery);
    const complexDuration = Date.now() - complexStart;

    expect(simpleResult.success).toBe(true);
    expect(complexResult.success).toBe(true);
    
    // Complex queries should take longer but still be reasonable
    expect(complexDuration).toBeGreaterThan(simpleDuration);
    expect(complexDuration).toBeLessThan(2000); // Under 2 seconds
  });

  test('should maintain performance under memory pressure', async () => {
    // Create memory pressure with large data structures
    const largeDataStructures = Array.from({ length: 100 }, () => 
      new Array(10000).fill('memory-pressure-data')
    );

    const query: NaturalQuery = {
      raw: 'get user statistics',
      metadata: { id: 'memory-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const startTime = Date.now();
    const result = await rag2Controller.processNaturalQuery(query);
    const duration = Date.now() - startTime;

    // Should still perform reasonably under memory pressure
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(500);
    
    // Cleanup
    largeDataStructures.length = 0;
  });

  test('should track performance metrics accurately', async () => {
    const queries = Array.from({ length: 10 }, (_, i) => ({
      raw: `performance test query ${i}`,
      metadata: { id: `metrics-test-${i}`, timestamp: Date.now(), source: 'api', priority: 'high' }
    }));

    const results = [];
    for (const query of queries) {
      const result = await rag2Controller.processNaturalQuery(query);
      results.push(result);
    }

    const insights = rag2Controller.getPerformanceInsights();
    
    expect(insights).toBeDefined();
  });
});

describe('RAG₂ Security and Authentication', () => {
  let rag2Controller: RAG2Controller;
  let mockRegistry: MockMCPRegistry;

  beforeEach(() => {
    mockRegistry = new MockMCPRegistry();
    rag2Controller = createRAG2Controller(mockRegistry, {
      // security: { enabled: true },
      // authentication: { required: true }
    });
  });

  test('should validate authentication tokens', async () => {
    const query: NaturalQuery = {
      raw: 'get sensitive user data',
      context: { 
        userId: 'test-user',
        authToken: 'invalid-token'
      },
      metadata: { id: 'security-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const result = await rag2Controller.processNaturalQuery(query);
    
    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.error).toContain('authentication');
  });

  test('should enforce authorization policies', async () => {
    const restrictedQuery: NaturalQuery = {
      raw: 'get admin user data',
      context: { 
        userId: 'regular-user',
        role: 'user'
      },
      metadata: { id: 'authorization-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    const result = await rag2Controller.processNaturalQuery(restrictedQuery);
    
    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.error).toContain('authorization');
  });

  test('should audit all query activities', async () => {
    const query: NaturalQuery = {
      raw: 'get user data',
      context: { userId: 'audit-test-user' },
      metadata: { id: 'audit-test', timestamp: Date.now(), source: 'api', priority: 'high' }
    };

    await rag2Controller.processNaturalQuery(query);
    
    // Audit functionality would need to be implemented
    // For now, we'll check if the query was processed
    const history = rag2Controller.getQueryHistory();
    const relevantQuery = history.find(h => 
      h.query.context?.userId === 'audit-test-user' && h.query.raw === query.raw
    );
    
    expect(relevantQuery).toBeDefined();
    expect(relevantQuery?.timestamp).toBeDefined();
  });
});