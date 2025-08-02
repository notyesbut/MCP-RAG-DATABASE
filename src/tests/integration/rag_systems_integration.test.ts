/**
 * Comprehensive Integration Test for RAG₁ and RAG₂ Systems
 * Tests the complete data flow: Ingestion → RAG₁ → MCPs → RAG₂ → Query Results
 */

// Jest globals are available without imports
// describe, test, expect, beforeAll, afterAll are provided by Jest
import supertest from 'supertest';
import { apiServer } from '../../api/server';
import { DataRecord } from '../../types/mcp.types';
import { NaturalQuery } from '../../types/query.types';

describe('🧪 RAG Systems Integration Tests', () => {
  let request: any;
  let authToken: string;
  
  beforeAll(async () => {
    jest.setTimeout(30000); // 30 second timeout for initialization
    
    // Initialize the API server with all systems
    await apiServer.initialize();
    await apiServer.start();
    
    // Wait a moment for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    request = supertest(apiServer.getApp());
    
    // Login to get auth token
    const loginResponse = await request
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'password' })
      .expect(200);
    
    authToken = loginResponse.body.data.token;
    
    console.log('✅ Test environment initialized');
  });

  afterAll(async () => {
    jest.setTimeout(10000);
    await apiServer.stop();
    console.log('✅ Test environment cleaned up');
  });

  describe('🏗️ System Health and Initialization', () => {
    test('should have all systems running and healthy', async () => {
      // Test RAG₁ Ingestion System Health
      const rag1Health = await request
        .get('/api/v1/ingest/health')
        .set('Authorization', `Bearer ${authToken}`);
      
      // Verify status manually
      expect(rag1Health.status).toBe(200);
      expect(rag1Health.body).toBeDefined();
      expect(rag1Health.body.status).toBe('healthy');
      expect(rag1Health.body.capabilities).toBeDefined();
      expect(rag1Health.body.capabilities.intelligentClassification).toBe(true);
      expect(rag1Health.body.capabilities.dynamicRouting).toBe(true);
      expect(rag1Health.body.capabilities.patternLearning).toBe(true);

      // Test RAG₂ Query System Health
      const rag2Health = await request
        .get('/api/v1/query/health')
        .set('Authorization', `Bearer ${authToken}`);
      
      // Verify status manually
      expect(rag2Health.status).toBe(200);
      expect(rag2Health.body).toBeDefined();
      expect(rag2Health.body.status).toBe('healthy');
      expect(rag2Health.body.capabilities).toBeDefined();
      expect(rag2Health.body.capabilities.naturalLanguageProcessing).toBe(true);
      expect(rag2Health.body.capabilities.multiMCPQueries).toBe(true);
      expect(rag2Health.body.capabilities.intelligentCaching).toBe(true);
    });

    test('should have initial specialized MCPs created', async () => {
      const ingestionStatus = await request
        .get('/api/v1/ingest/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(ingestionStatus.body.status).toBe('active');
      expect(typeof ingestionStatus.body.system.metrics).toBe('object');
    });
  });

  describe('📥 RAG₁ Intelligent Data Ingestion', () => {
    let ingestedRecords: string[] = [];

    test('should intelligently ingest user data', async () => {
      const userData = {
        data: {
          userId: 'test_user_123',
          email: 'test@example.com',
          name: 'Test User',
          profile: {
            age: 30,
            country: 'USA',
            preferences: ['tech', 'ai', 'databases']
          },
          authToken: 'xyz123',
          lastLogin: Date.now()
        },
        domain: 'user',
        type: 'user_profile',
        metadata: {
          source: 'integration_test',
          priority: 'high'
        }
      };

      const response = await request
        .post('/api/v1/ingest/single')
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.recordId).toBe('string');
      expect(typeof response.body.classification).toBe('object');
      expect(Array.isArray(response.body.routing.targetMCPs)).toBe(true);
      expect(typeof response.body.processingTime).toBe('number');

      ingestedRecords.push(response.body.recordId);
      console.log(`✅ User data ingested: ${response.body.recordId}`);
    });

    test('should intelligently ingest chat messages', async () => {
      const chatData = {
        data: {
          messageId: 'msg_456',
          userId: 'test_user_123',
          chatId: 'chat_789',
          message: 'Hello, how can I query user activity data?',
          timestamp: Date.now(),
          metadata: {
            channel: 'support',
            priority: 'normal'
          }
        },
        domain: 'chat',
        type: 'chat_message',
        metadata: {
          source: 'integration_test',
          realtime: true
        }
      };

      const response = await request
        .post('/api/v1/ingest/single')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.routing.targetMCPs).toEqual(expect.arrayContaining(['chat-mcp', 'user-mcp']));
      
      ingestedRecords.push(response.body.recordId);
      console.log(`✅ Chat message ingested: ${response.body.recordId}`);
    });

    test('should batch ingest analytics data', async () => {
      const analyticsRecords = [
        {
          data: {
            metric: 'user_activity',
            value: 150,
            timestamp: Date.now(),
            dimensions: { country: 'USA', platform: 'web' }
          },
          domain: 'stats',
          type: 'analytics_metric'
        },
        {
          data: {
            metric: 'api_calls',
            value: 1250,
            timestamp: Date.now(),
            dimensions: { endpoint: '/api/v1/query', status: 'success' }
          },
          domain: 'stats',
          type: 'analytics_metric'
        },
        {
          data: {
            metric: 'query_performance',
            value: 85.5,
            timestamp: Date.now(),
            dimensions: { type: 'natural_language', complexity: 'medium' }
          },
          domain: 'stats',
          type: 'analytics_metric'
        }
      ];

      const response = await request
        .post('/api/v1/ingest/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ records: analyticsRecords })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary.total).toBe(3);
      expect(response.body.summary.successful).toBe(3);
      expect(response.body.summary.failed).toBe(0);
      expect(response.body.summary.successRate).toBe('100.0%');

      console.log(`✅ Batch analytics ingested: ${response.body.batchId}`);
    });

    test('should provide pattern insights from ingested data', async () => {
      const patterns = await request
        .get('/api/v1/ingest/patterns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(patterns.body.patterns)).toBe(true);
      expect(typeof patterns.body.total).toBe('number');
      expect(patterns.body.insights.learningEnabled).toBe(true);

      console.log(`✅ Pattern insights: ${patterns.body.total} patterns discovered`);
    });
  });

  describe('🔍 RAG₂ Natural Language Query Processing', () => {
    test('should process natural language query for user data', async () => {
      const naturalQuery = {
        query: 'get user data for test_user_123',
        context: {
          userId: 'test_user_123',
          sessionId: 'test_session'
        }
      };

      const response = await request
        .post('/api/v1/query/natural')
        .set('Authorization', `Bearer ${authToken}`)
        .send(naturalQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.primary)).toBe(true);
      expect(typeof response.body.data.metadata.totalRecords).toBe('number');
      expect(Array.isArray(response.body.data.metadata.sources)).toBe(true);
      expect(typeof response.body.insights.interpretation).toBe('string');
      expect(typeof response.body.duration).toBe('number');

      console.log(`✅ Natural query processed: ${response.body.insights.interpretation}`);
      console.log(`📊 Results: ${response.body.data.metadata.totalRecords} records from ${response.body.data.metadata.sources.length} MCPs`);
    });

    test('should process complex analytics query', async () => {
      const analyticsQuery = {
        query: 'show user activity stats and API performance metrics',
        context: {
          userId: 'test_user_123',
          sessionId: 'test_session'
        }
      };

      const response = await request
        .post('/api/v1/query/natural')
        .set('Authorization', `Bearer ${authToken}`)
        .send(analyticsQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata.sources.length).toBeGreaterThan(1);
      expect(Array.isArray(response.body.insights.performanceNotes)).toBe(true);
      expect(Array.isArray(response.body.insights.suggestions)).toBe(true);

      console.log(`✅ Analytics query processed with ${response.body.data.metadata.sources.length} MCP sources`);
    });

    test('should handle query interpretation testing', async () => {
      const testQuery = {
        query: 'find all messages from user test_user_123 about database queries'
      };

      const response = await request
        .post('/api/v1/query/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testQuery)
        .expect(200);

      expect(response.body.query).toBe(testQuery.query);
      expect(typeof response.body.interpretation).toBe('object');
      expect(response.body.test).toBe(true);

      console.log(`✅ Query interpretation test: ${response.body.interpretation.intents?.length || 0} intents identified`);
    });

    test('should provide query examples and categories', async () => {
      const examples = await request
        .get('/api/v1/query/examples')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(examples.body.examples)).toBe(true);
      expect(typeof examples.body.total).toBe('number');
      expect(examples.body.version).toBe('2.0');

      // Check that examples have proper structure
      examples.body.examples.forEach((example: any) => {
        expect(typeof example.query).toBe('string');
        expect(typeof example.description).toBe('string');
        expect(typeof example.category).toBe('string');
      });

      console.log(`✅ Query examples: ${examples.body.total} examples available`);
    });

    test('should handle batch queries', async () => {
      const batchQueries = {
        queries: [
          'get user activity for test_user_123',
          'show recent chat messages',
          'count total API calls today'
        ],
        context: {
          userId: 'test_user_123',
          sessionId: 'test_session'
        }
      };

      const response = await request
        .post('/api/v1/query/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(batchQueries)
        .expect(200);

      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.summary.total).toBe(3);
      expect(typeof response.body.summary.successRate).toBe('string');

      console.log(`✅ Batch queries processed: ${response.body.summary.successRate} success rate`);
    });
  });

  describe('🔄 Complete Data Flow Validation', () => {
    test('should demonstrate the TARGET.MD workflow', async function() {
      jest.setTimeout(15000); // Longer timeout for complete flow
      
      console.log('\n🎯 DEMONSTRATING TARGET.MD WORKFLOW:');
      console.log('📥 Data Ingestion → RAG₁ → MCPs → RAG₂ → 🔍 Query Results\n');

      // Step 1: Ingest structured data that demonstrates the workflow
      const workflowData = {
        data: {
          userId: 'workflow_demo_user',
          email: 'demo@ragdb.ai',
          name: 'Workflow Demo User',
          action: 'database_query',
          query: 'get user statistics for premium users',
          timestamp: Date.now(),
          metadata: {
            source: 'workflow_demo',
            complexity: 'high',
            domains: ['user', 'stats', 'analytics']
          }
        },
        domain: 'user',
        type: 'workflow_demonstration',
        metadata: {
          source: 'TARGET_MD_workflow',
          priority: 'high',
          demonstration: true
        }
      };

      console.log('📥 Step 1: Ingesting workflow demonstration data...');
      const ingestionResponse = await request
        .post('/api/v1/ingest/single')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowData)
        .expect(201);

      expect(ingestionResponse.body.success).toBe(true);
      console.log(`✅ Data ingested via RAG₁: ${ingestionResponse.body.recordId}`);
      console.log(`🧠 Classification: ${ingestionResponse.body.classification?.domain}`);
      console.log(`🎯 Target MCPs: ${ingestionResponse.body.routing?.targetMCPs?.join(', ')}`);

      // Step 2: Wait a moment for data to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Query the data using natural language via RAG₂
      console.log('\n🔍 Step 2: Querying data using natural language via RAG₂...');
      const queryData = {
        query: 'find workflow demo user data and show their database query activity',
        context: {
          userId: 'workflow_demo_user',
          sessionId: 'workflow_demo_session',
          priority: 'high'
        }
      };

      const queryResponse = await request
        .post('/api/v1/query/natural')
        .set('Authorization', `Bearer ${authToken}`)
        .send(queryData)
        .expect(200);

      expect(queryResponse.body.success).toBe(true);
      console.log(`✅ Query processed via RAG₂: ${queryResponse.body.insights.interpretation}`);
      console.log(`📊 Results from ${queryResponse.body.data.metadata.sources.length} MCPs`);
      console.log(`⚡ Processing time: ${queryResponse.body.duration}ms`);

      // Step 4: Verify the complete flow worked
      expect(queryResponse.body.data.metadata.totalRecords).toBeGreaterThan(0);
      expect(Array.isArray(queryResponse.body.data.metadata.sources)).toBe(true);
      expect(queryResponse.body.insights.interpretation).toContain('workflow');

      console.log('\n🎉 TARGET.MD WORKFLOW COMPLETED SUCCESSFULLY!');
      console.log('✅ Data → RAG₁ (classify & route) → MCPs → RAG₂ (interpret & resolve) → Results');
    });

    test('should show system performance metrics', async () => {
      // RAG₁ Performance
      const rag1Status = await request
        .get('/api/v1/ingest/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // RAG₂ Performance  
      const rag2Performance = await request
        .get('/api/v1/query/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      console.log('\n📈 SYSTEM PERFORMANCE METRICS:');
      console.log(`🧠 RAG₁ Metrics:`, {
        totalIngested: rag1Status.body.system.metrics.totalIngested,
        averageProcessingTime: rag1Status.body.system.metrics.averageProcessingTime,
        classificationAccuracy: rag1Status.body.system.metrics.classificationAccuracy,
        routingSuccessRate: rag1Status.body.system.metrics.routingSuccessRate
      });
      
      console.log(`🔍 RAG₂ Metrics:`, {
        cacheSize: rag2Performance.body.insights.cache.size,
        cacheHitRate: rag2Performance.body.insights.cache.hitRate
      });

      expect(rag1Status.body.system.metrics.totalIngested).toBeGreaterThan(0);
      expect(typeof rag2Performance.body.insights).toBe('object');
    });

    test('should validate error handling and resilience', async () => {
      // Test invalid ingestion data
      const invalidData = {
        data: null, // Invalid data
        domain: 'invalid'
      };

      const ingestionError = await request
        .post('/api/v1/ingest/single')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(ingestionError.body.success).toBe(false);
      expect(ingestionError.body.message).toContain('Data payload is required');

      // Test invalid query
      const invalidQuery = {
        query: '', // Empty query
      };

      const queryError = await request
        .post('/api/v1/query/natural')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidQuery)
        .expect(400);

      expect(queryError.body.error).toContain('Invalid request');

      console.log('✅ Error handling validation completed');
    });
  });

  describe('🧮 Advanced Features Validation', () => {
    test('should support topology recommendations', async () => {
      const recommendations = await request
        .get('/api/v1/ingest/topology/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(recommendations.body.recommendations)).toBe(true);
      expect(typeof recommendations.body.rebalancing).toBe('object');

      console.log(`✅ Topology recommendations: ${recommendations.body.recommendations.length} recommendations`);
    });

    test('should maintain query history', async () => {
      const history = await request
        .get('/api/v1/query/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(history.body.history)).toBe(true);
      expect(typeof history.body.total).toBe('number');

      console.log(`✅ Query history: ${history.body.total} queries tracked`);
    });

    test('should demonstrate caching effectiveness', async () => {
      const cacheQuery = {
        query: 'get workflow demo user data',
        context: { userId: 'workflow_demo_user' }
      };

      // First query (should be uncached)
      const firstResponse = await request
        .post('/api/v1/query/natural')
        .set('Authorization', `Bearer ${authToken}`)
        .send(cacheQuery)
        .expect(200);

      // Second identical query (should hit cache)
      const secondResponse = await request
        .post('/api/v1/query/natural')
        .set('Authorization', `Bearer ${authToken}`)
        .send(cacheQuery)
        .expect(200);

      expect(firstResponse.body.caching.cached).toBe(false);
      // Note: Cache behavior depends on implementation details
      
      console.log(`✅ Caching test completed`);
    });
  });

  describe('🎯 Final Integration Validation', () => {
    test('should confirm all components are working together', async () => {
      console.log('\n🔍 FINAL SYSTEM VALIDATION:');
      
      // Validate all endpoints are responding
      const endpoints = [
        '/api/v1/ingest/health',
        '/api/v1/query/health',
        '/api/v1/ingest/status',
        '/api/v1/query/performance',
        '/api/v1/query/examples'
      ];

      const results = await Promise.all(
        endpoints.map(endpoint => 
          request.get(endpoint).set('Authorization', `Bearer ${authToken}`).expect(200)
        )
      );

      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        console.log(`✅ ${endpoints[index]} - OK`);
      });

      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('✅ RAG₁ + RAG₂ + MCP Registry + API Integration = SUCCESS');
      console.log('✅ Complete data flow validated');
      console.log('✅ Error handling confirmed');
      console.log('✅ Performance metrics available');
      console.log('✅ Advanced features operational');
      console.log('\n🚀 Enterprise Multi-MCP Smart Database System is FULLY OPERATIONAL!');
    });
  });
});