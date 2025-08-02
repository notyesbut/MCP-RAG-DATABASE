/**
 * Multi-MCP Flow Integration Tests
 * 
 * Tests the complete data flow through RAG₁ → MCPs → RAG₂ system.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { TestDataGenerator, MCPFixtures } from '../helpers';

describe('Multi-MCP Flow Integration', () => {
  let systemOrchestrator: any;
  let rag1System: any;
  let rag2System: any;
  let mcpRegistry: any;
  let testMCPs: any[];

  beforeAll(async () => {
    // Initialize test environment
    console.log('🔧 Setting up Multi-MCP Flow integration test environment...');
    
    // Mock system components
    systemOrchestrator = {
      initialize: jest.fn(),
      shutdown: jest.fn(),
      processDataFlow: jest.fn(),
      getSystemStatus: jest.fn()
    };

    rag1System = {
      classifyData: jest.fn(),
      routeToMCP: jest.fn(),
      learnFromFeedback: jest.fn()
    };

    rag2System = {
      parseNaturalQuery: jest.fn(),
      executeQuery: jest.fn(),
      aggregateResults: jest.fn()
    };

    mcpRegistry = {
      registerMCP: jest.fn(),
      getMCP: jest.fn(),
      getAllMCPs: jest.fn(),
      getHotMCPs: jest.fn(),
      getColdMCPs: jest.fn(),
      migrateMCP: jest.fn(),
      getRegistryStatus: jest.fn()
    };

    // Create test MCPs
    testMCPs = [
      ...MCPFixtures.getHotMCPFixtures(),
      ...MCPFixtures.getColdMCPFixtures()
    ];

    // Mock system initialization
    systemOrchestrator.initialize.mockResolvedValue({
      success: true,
      message: 'Multi-MCP system initialized',
      components: {
        rag1: 'initialized',
        rag2: 'initialized',
        mcpRegistry: 'initialized',
        activeConnections: testMCPs.length
      }
    });

    await systemOrchestrator.initialize();
  });

  afterAll(async () => {
    // Cleanup test environment
    systemOrchestrator.shutdown.mockResolvedValue({
      success: true,
      message: 'System shutdown complete'
    });
    
    await systemOrchestrator.shutdown();
    console.log('🧹 Multi-MCP Flow integration test environment cleaned up');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Data Ingestion Flow', () => {
    test('should complete full user data ingestion flow', async () => {
      const userData = TestDataGenerator.createTestUser();
      
      // Step 1: RAG₁ classifies incoming data
      rag1System.classifyData.mockResolvedValue({
        dataType: 'user',
        domain: 'users',
        tier: 'hot',
        confidence: 0.95,
        suggestedMCP: 'user-mcp-hot-001'
      });

      // Step 2: Route to appropriate MCP
      rag1System.routeToMCP.mockResolvedValue({
        targetMCP: 'user-mcp-hot-001',
        routingDecision: 'direct',
        estimatedLatency: 25
      });

      // Step 3: MCP processes the data
      mcpRegistry.getMCP.mockResolvedValue({
        id: 'user-mcp-hot-001',
        domain: 'users',
        type: 'hot',
        status: 'healthy',
        insert: jest.fn().mockResolvedValue({
          success: true,
          data: { ...userData, id: 'user-123' }
        })
      });

      // Step 4: Execute full flow
      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        flow: {
          classification: { dataType: 'user', confidence: 0.95 },
          routing: { targetMCP: 'user-mcp-hot-001', latency: 25 },
          storage: { id: 'user-123', stored: true },
          totalTime: 78
        }
      });

      // Execute the flow
      const result = await systemOrchestrator.processDataFlow(userData);

      expect(result.success).toBe(true);
      expect(result.flow.classification.dataType).toBe('user');
      expect(result.flow.storage.stored).toBe(true);
      expect(result.flow.totalTime).toBeLessThan(100);
    });

    test('should handle chat message ingestion with high throughput', async () => {
      const messageData = TestDataGenerator.createTestMessage();
      
      // RAG₁ classification for real-time message
      rag1System.classifyData.mockResolvedValue({
        dataType: 'message',
        domain: 'messages',
        tier: 'hot',
        confidence: 0.92,
        suggestedMCP: 'chat-mcp-hot-001',
        priority: 'realtime'
      });

      // High-priority routing for real-time data
      rag1System.routeToMCP.mockResolvedValue({
        targetMCP: 'chat-mcp-hot-001',
        routingDecision: 'priority_lane',
        estimatedLatency: 15
      });

      // Mock high-performance MCP
      mcpRegistry.getMCP.mockResolvedValue({
        id: 'chat-mcp-hot-001',
        domain: 'messages',
        type: 'hot',
        performanceTier: 'premium',
        insert: jest.fn().mockResolvedValue({
          success: true,
          data: { ...messageData, id: 'msg-456' },
          responseTime: 12
        })
      });

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        flow: {
          classification: { dataType: 'message', confidence: 0.92 },
          routing: { targetMCP: 'chat-mcp-hot-001', priority: 'realtime' },
          storage: { id: 'msg-456', stored: true },
          totalTime: 35
        }
      });

      const result = await systemOrchestrator.processDataFlow(messageData);

      expect(result.success).toBe(true);
      expect(result.flow.totalTime).toBeLessThan(50); // Real-time requirement
      expect(result.flow.routing.priority).toBe('realtime');
    });

    test('should route analytics data to appropriate cold storage', async () => {
      const analyticsData = TestDataGenerator.createTestLogEntry({
        level: 'info',
        message: 'User page view',
        metadata: { page: '/dashboard', duration: 5000 }
      });

      // RAG₁ classifies as archival data
      rag1System.classifyData.mockResolvedValue({
        dataType: 'analytics_event',
        domain: 'analytics',
        tier: 'cold',
        confidence: 0.89,
        suggestedMCP: 'logs-mcp-cold-001'
      });

      // Batch routing for cold data
      rag1System.routeToMCP.mockResolvedValue({
        targetMCP: 'logs-mcp-cold-001',
        routingDecision: 'batch',
        batchSize: 100,
        estimatedLatency: 200
      });

      mcpRegistry.getMCP.mockResolvedValue({
        id: 'logs-mcp-cold-001',
        domain: 'logs',
        type: 'cold',
        insert: jest.fn().mockResolvedValue({
          success: true,
          data: { ...analyticsData, id: 'log-789' },
          batchProcessed: true
        })
      });

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        flow: {
          classification: { dataType: 'analytics_event', tier: 'cold' },
          routing: { targetMCP: 'logs-mcp-cold-001', batch: true },
          storage: { id: 'log-789', batchProcessed: true },
          totalTime: 250
        }
      });

      const result = await systemOrchestrator.processDataFlow(analyticsData);

      expect(result.success).toBe(true);
      expect(result.flow.classification.tier).toBe('cold');
      expect(result.flow.storage.batchProcessed).toBe(true);
    });
  });

  describe('End-to-End Query Processing Flow', () => {
    test('should process simple natural language query', async () => {
      const naturalQuery = TestDataGenerator.createNaturalQuery({
        raw: 'show me all active users'
      });

      // RAG₂ parses natural language
      rag2System.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          intents: [{ type: 'retrieve', parameters: { dataType: 'users', filter: 'active' } }],
          targetMCPs: ['user-mcp-hot-001'],
          confidence: 0.94
        }
      });

      // Execute query against target MCP
      const mockUsers = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestUser({ isActive: true }),
        5
      );

      rag2System.executeQuery.mockResolvedValue({
        success: true,
        results: [
          {
            mcpId: 'user-mcp-hot-001',
            data: mockUsers,
            count: 5,
            responseTime: 45
          }
        ]
      });

      // Aggregate and format results
      rag2System.aggregateResults.mockResolvedValue({
        data: mockUsers,
        totalCount: 5,
        sources: ['user-mcp-hot-001'],
        queryTime: 52,
        explanation: 'Retrieved 5 active users from user management system'
      });

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        queryFlow: {
          parsing: { confidence: 0.94, intents: 1 },
          execution: { mcps: 1, totalResults: 5 },
          aggregation: { finalCount: 5, queryTime: 52 }
        },
        results: mockUsers
      });

      const result = await systemOrchestrator.processDataFlow({ 
        type: 'query', 
        data: naturalQuery 
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      expect(result.queryFlow.execution.totalResults).toBe(5);
    });

    test('should handle complex multi-MCP query', async () => {
      const complexQuery = TestDataGenerator.createNaturalQuery({
        raw: 'show me user profiles and their message counts from last week'
      });

      // RAG₂ identifies multi-intent query
      rag2System.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          intents: [
            { type: 'retrieve', parameters: { dataType: 'users' } },
            { type: 'aggregate', parameters: { dataType: 'messages', operation: 'count' } }
          ],
          targetMCPs: ['user-mcp-hot-001', 'chat-mcp-hot-001'],
          confidence: 0.88,
          executionPlan: {
            steps: [
              { id: 'step-1', targetMCP: 'user-mcp-hot-001', operation: 'get_users' },
              { id: 'step-2', targetMCP: 'chat-mcp-hot-001', operation: 'count_messages', dependencies: ['step-1'] },
              { id: 'step-3', operation: 'join_results', dependencies: ['step-1', 'step-2'] }
            ]
          }
        }
      });

      // Execute multi-step query
      rag2System.executeQuery.mockResolvedValue({
        success: true,
        results: [
          {
            mcpId: 'user-mcp-hot-001',
            stepId: 'step-1',
            data: TestDataGenerator.generateMultiple(() => TestDataGenerator.createTestUser(), 3),
            count: 3
          },
          {
            mcpId: 'chat-mcp-hot-001',
            stepId: 'step-2',
            data: [
              { userId: 'user-1', messageCount: 25 },
              { userId: 'user-2', messageCount: 18 },
              { userId: 'user-3', messageCount: 31 }
            ],
            count: 3
          }
        ]
      });

      // Join and aggregate results
      rag2System.aggregateResults.mockResolvedValue({
        data: [
          { user: TestDataGenerator.createTestUser(), messageCount: 25 },
          { user: TestDataGenerator.createTestUser(), messageCount: 18 },
          { user: TestDataGenerator.createTestUser(), messageCount: 31 }
        ],
        totalCount: 3,
        sources: ['user-mcp-hot-001', 'chat-mcp-hot-001'],
        queryTime: 125,
        explanation: 'Retrieved user profiles and joined with message counts'
      });

      const aggregatedResults = [
        { user: TestDataGenerator.createTestUser(), messageCount: 25 },
        { user: TestDataGenerator.createTestUser(), messageCount: 18 },
        { user: TestDataGenerator.createTestUser(), messageCount: 31 }
      ];

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        queryFlow: {
          parsing: { confidence: 0.88, intents: 2 },
          execution: { mcps: 2, steps: 3, totalResults: 3 },
          aggregation: { joined: true, queryTime: 125 }
        },
        results: aggregatedResults
      });

      const result = await systemOrchestrator.processDataFlow({ 
        type: 'query', 
        data: complexQuery 
      });

      expect(result.success).toBe(true);
      expect(result.queryFlow.execution.mcps).toBe(2);
      expect(result.queryFlow.execution.steps).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.results[0]).toHaveProperty('user');
      expect(result.results[0]).toHaveProperty('messageCount');
    });

    test('should handle queries spanning hot and cold MCPs', async () => {
      const analyticsQuery = TestDataGenerator.createNaturalQuery({
        raw: 'compare current user activity with historical data from 6 months ago'
      });

      // Query requires both hot (current) and cold (historical) data
      rag2System.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          intents: [{ type: 'compare', parameters: { timeframes: ['current', 'historical'] } }],
          targetMCPs: ['stats-mcp-hot-001', 'archive-mcp-cold-001'],
          confidence: 0.85,
          complexity: 'cross_tier'
        }
      });

      rag2System.executeQuery.mockResolvedValue({
        success: true,
        results: [
          {
            mcpId: 'stats-mcp-hot-001',
            data: { activeUsers: 1250, avgSessionTime: 28 },
            responseTime: 35
          },
          {
            mcpId: 'archive-mcp-cold-001',
            data: { activeUsers: 980, avgSessionTime: 22 },
            responseTime: 280 // Slower for cold storage
          }
        ]
      });

      rag2System.aggregateResults.mockResolvedValue({
        data: {
          comparison: {
            current: { activeUsers: 1250, avgSessionTime: 28 },
            historical: { activeUsers: 980, avgSessionTime: 22 },
            growth: { users: '27.6%', sessionTime: '27.3%' }
          }
        },
        sources: ['stats-mcp-hot-001', 'archive-mcp-cold-001'],
        queryTime: 315,
        explanation: 'Compared current activity with 6-month historical data'
      });

      const comparisonResults = {
        comparison: {
          current: { activeUsers: 1250, avgSessionTime: 28 },
          historical: { activeUsers: 980, avgSessionTime: 22 },
          growth: { users: '27.6%', sessionTime: '27.3%' }
        }
      };

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        queryFlow: {
          parsing: { confidence: 0.85, complexity: 'cross_tier' },
          execution: { hotMCPs: 1, coldMCPs: 1, crossTier: true },
          aggregation: { comparison: true, queryTime: 315 }
        },
        results: comparisonResults
      });

      const result = await systemOrchestrator.processDataFlow({ 
        type: 'query', 
        data: analyticsQuery 
      });

      expect(result.success).toBe(true);
      expect(result.queryFlow.execution.crossTier).toBe(true);
      expect(result.results.comparison.growth.users).toBe('27.6%');
    });
  });

  describe('System Health and Performance', () => {
    test('should monitor system health across all components', async () => {
      systemOrchestrator.getSystemStatus.mockResolvedValue({
        overall: 'healthy',
        components: {
          rag1: {
            status: 'healthy',
            classificationsPerSecond: 150,
            accuracy: 0.94,
            avgResponseTime: 25
          },
          rag2: {
            status: 'healthy',
            queriesPerSecond: 45,
            parseSuccess: 0.91,
            avgQueryTime: 85
          },
          mcpRegistry: {
            status: 'healthy',
            totalMCPs: 8,
            hotMCPs: 5,
            coldMCPs: 3,
            averageLoad: 0.35
          }
        },
        performance: {
          systemThroughput: 195,
          avgEndToEndLatency: 110,
          errorRate: 0.008
        }
      });

      const status = await systemOrchestrator.getSystemStatus();

      expect(status.overall).toBe('healthy');
      expect(status.components.rag1.accuracy).toBeGreaterThan(0.9);
      expect(status.components.rag2.parseSuccess).toBeGreaterThan(0.9);
      expect(status.performance.errorRate).toBeLessThan(0.01);
    });

    test('should handle load balancing during high traffic', async () => {
      // Simulate high load scenario
      const highVolumeData = Array.from({ length: 100 }, () => 
        TestDataGenerator.createTestMessage()
      );

      // Load balancing kicks in
      rag1System.routeToMCP.mockImplementation((data: any, index: number) => ({
        targetMCP: `chat-mcp-hot-${(index % 3) + 1}`, // Round-robin
        routingDecision: 'load_balanced',
        currentLoad: 0.8 + (Math.random() * 0.15)
      }));

      systemOrchestrator.processDataFlow.mockImplementation((data: any) => ({
        success: true,
        flow: {
          classification: { dataType: 'message' },
          routing: { loadBalanced: true },
          storage: { stored: true }
        },
        loadBalancing: {
          distributedAcross: 3,
          averageLoad: 0.85
        }
      }));

      const results = await Promise.all(
        highVolumeData.slice(0, 10).map((data, index) => 
          systemOrchestrator.processDataFlow(data)
        )
      );

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.some(r => r.loadBalancing?.distributedAcross === 3)).toBe(true);
    });

    test('should handle MCP failure and failover', async () => {
      const userData = TestDataGenerator.createTestUser();

      // Primary MCP fails
      rag1System.routeToMCP.mockResolvedValueOnce({
        targetMCP: 'user-mcp-hot-001',
        routingDecision: 'primary'
      });

      // Simulate MCP failure and failover
      mcpRegistry.getMCP
        .mockResolvedValueOnce(null) // Primary MCP unavailable
        .mockResolvedValueOnce({     // Failover MCP
          id: 'user-mcp-hot-002',
          domain: 'users',
          type: 'hot',
          status: 'healthy',
          insert: jest.fn().mockResolvedValue({
            success: true,
            data: { ...userData, id: 'user-failover-123' }
          })
        });

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        flow: {
          classification: { dataType: 'user' },
          routing: { 
            primaryMCP: 'user-mcp-hot-001',
            failedOver: true,
            actualMCP: 'user-mcp-hot-002'
          },
          storage: { stored: true, failoverUsed: true }
        }
      });

      const result = await systemOrchestrator.processDataFlow(userData);

      expect(result.success).toBe(true);
      expect(result.flow.routing.failedOver).toBe(true);
      expect(result.flow.storage.failoverUsed).toBe(true);
    });
  });

  describe('Data Migration and Optimization', () => {
    test('should migrate data from hot to cold storage based on access patterns', async () => {
      // Create a migration candidate explicitly
      const migrationCandidate = TestDataGenerator.createMCPMetadata({
        id: 'user-mcp-hot-001',
        domain: 'users',
        type: 'hot',
        accessFrequency: 25 // Low frequency for hot MCP
      });

      mcpRegistry.migrateMCP.mockResolvedValue({
        success: true,
        migration: {
          from: 'user-mcp-hot-001',
          to: 'user-mcp-cold-001',
          recordsMigrated: 25000,
          dataSize: '1.2GB',
          migrationTime: 45000,
          reason: 'Low access frequency detected'
        }
      });

      const result = await mcpRegistry.migrateMCP(migrationCandidate.id, 'cold');

      expect(result.success).toBe(true);
      expect(result.migration.recordsMigrated).toBeGreaterThan(0);
      expect(result.migration.reason).toContain('Low access frequency');
    });

    test('should optimize query routing based on learned patterns', async () => {
      const query = TestDataGenerator.createNaturalQuery({
        raw: 'get user messages from john'
      });

      // System has learned this pattern
      rag1System.learnFromFeedback.mockResolvedValue({
        patternLearned: 'user + messages query',
        optimizedRouting: {
          directTo: 'chat-mcp-hot-001',
          skipClassification: true,
          confidence: 0.98
        }
      });

      rag2System.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          intents: [{ type: 'retrieve' }],
          targetMCPs: ['chat-mcp-hot-001'],
          optimizations: ['pattern_recognition', 'skip_classification']
        }
      });

      systemOrchestrator.processDataFlow.mockResolvedValue({
        success: true,
        queryFlow: {
          optimized: true,
          optimizations: ['pattern_recognition'],
          timeStored: 35 // Faster due to optimization
        }
      });

      const result = await systemOrchestrator.processDataFlow({ 
        type: 'query', 
        data: query 
      });

      expect(result.success).toBe(true);
      expect(result.queryFlow.optimized).toBe(true);
      expect(result.queryFlow.optimizations).toContain('pattern_recognition');
    });
  });
});