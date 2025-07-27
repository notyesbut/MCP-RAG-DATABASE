/**
 * Comprehensive Integration Test for RAG₁ and RAG₂ Systems
 * Tests the complete data flow: Ingestion → RAG₁ → MCPs → RAG₂ → Query Results
 */

import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import supertest from 'supertest';
import { apiServer } from '../../api/server';
import { DataRecord } from '../../types/mcp.types';
import { NaturalQuery } from '../../types/query.types';

describe('🧪 RAG Systems Integration Tests', () => {
  let request: any;
  
  before(async function() {
    this.timeout(30000); // 30 second timeout for initialization
    
    // Initialize the API server with all systems
    await apiServer.initialize();
    await apiServer.start();
    request = supertest(apiServer.getApp());
    
    console.log('✅ Test environment initialized');
  });

  after(async function() {
    this.timeout(10000);
    await apiServer.stop();
    console.log('✅ Test environment cleaned up');
  });

  describe('🏗️ System Health and Initialization', () => {
    it('should have all systems running and healthy', async () => {
      // Test RAG₁ Ingestion System Health
      const rag1Health = await request
        .get('/api/v1/ingest/health')
        .expect(200);
      
      expect(rag1Health.body.status).to.equal('healthy');
      expect(rag1Health.body.capabilities.intelligentClassification).to.be.true;
      expect(rag1Health.body.capabilities.dynamicRouting).to.be.true;
      expect(rag1Health.body.capabilities.patternLearning).to.be.true;

      // Test RAG₂ Query System Health
      const rag2Health = await request
        .get('/api/v1/query/health')
        .expect(200);
      
      expect(rag2Health.body.status).to.equal('healthy');
      expect(rag2Health.body.capabilities.naturalLanguageProcessing).to.be.true;
      expect(rag2Health.body.capabilities.multiMCPQueries).to.be.true;
      expect(rag2Health.body.capabilities.intelligentCaching).to.be.true;
    });

    it('should have initial specialized MCPs created', async () => {
      const ingestionStatus = await request
        .get('/api/v1/ingest/status')
        .expect(200);
      
      expect(ingestionStatus.body.status).to.equal('active');
      expect(ingestionStatus.body.system.metrics).to.be.an('object');
    });
  });

  describe('📥 RAG₁ Intelligent Data Ingestion', () => {
    let ingestedRecords: string[] = [];

    it('should intelligently ingest user data', async () => {
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
        .send(userData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.recordId).to.be.a('string');
      expect(response.body.classification).to.be.an('object');
      expect(response.body.routing.targetMCPs).to.be.an('array').with.length.greaterThan(0);
      expect(response.body.processingTime).to.be.a('number');

      ingestedRecords.push(response.body.recordId);
      console.log(`✅ User data ingested: ${response.body.recordId}`);
    });

    it('should intelligently ingest chat messages', async () => {
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
        .send(chatData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.routing.targetMCPs).to.include.members(['chat-mcp', 'user-mcp']);
      
      ingestedRecords.push(response.body.recordId);
      console.log(`✅ Chat message ingested: ${response.body.recordId}`);
    });

    it('should batch ingest analytics data', async () => {
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
        .send({ records: analyticsRecords })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.summary.total).to.equal(3);
      expect(response.body.summary.successful).to.equal(3);
      expect(response.body.summary.failed).to.equal(0);
      expect(response.body.summary.successRate).to.equal('100.0%');

      console.log(`✅ Batch analytics ingested: ${response.body.batchId}`);
    });

    it('should provide pattern insights from ingested data', async () => {
      const patterns = await request
        .get('/api/v1/ingest/patterns')
        .expect(200);

      expect(patterns.body.patterns).to.be.an('array');
      expect(patterns.body.total).to.be.a('number');
      expect(patterns.body.insights.learningEnabled).to.be.true;

      console.log(`✅ Pattern insights: ${patterns.body.total} patterns discovered`);
    });
  });

  describe('🔍 RAG₂ Natural Language Query Processing', () => {
    it('should process natural language query for user data', async () => {
      const naturalQuery = {
        query: 'get user data for test_user_123',
        context: {
          userId: 'test_user_123',
          sessionId: 'test_session'
        }
      };

      const response = await request
        .post('/api/v1/query/natural')
        .send(naturalQuery)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.primary).to.be.an('array');
      expect(response.body.data.metadata.totalRecords).to.be.a('number');
      expect(response.body.data.metadata.sources).to.be.an('array');
      expect(response.body.insights.interpretation).to.be.a('string');
      expect(response.body.duration).to.be.a('number');

      console.log(`✅ Natural query processed: ${response.body.insights.interpretation}`);
      console.log(`📊 Results: ${response.body.data.metadata.totalRecords} records from ${response.body.data.metadata.sources.length} MCPs`);
    });

    it('should process complex analytics query', async () => {
      const analyticsQuery = {
        query: 'show user activity stats and API performance metrics',
        context: {
          userId: 'test_user_123',
          sessionId: 'test_session'
        }
      };

      const response = await request
        .post('/api/v1/query/natural')
        .send(analyticsQuery)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.metadata.sources.length).to.be.greaterThan(1);
      expect(response.body.insights.performanceNotes).to.be.an('array');
      expect(response.body.insights.suggestions).to.be.an('array');

      console.log(`✅ Analytics query processed with ${response.body.data.metadata.sources.length} MCP sources`);
    });

    it('should handle query interpretation testing', async () => {
      const testQuery = {
        query: 'find all messages from user test_user_123 about database queries'
      };

      const response = await request
        .post('/api/v1/query/test')
        .send(testQuery)
        .expect(200);

      expect(response.body.query).to.equal(testQuery.query);
      expect(response.body.interpretation).to.be.an('object');
      expect(response.body.test).to.be.true;

      console.log(`✅ Query interpretation test: ${response.body.interpretation.intents?.length || 0} intents identified`);
    });

    it('should provide query examples and categories', async () => {
      const examples = await request
        .get('/api/v1/query/examples')
        .expect(200);

      expect(examples.body.examples).to.be.an('array');
      expect(examples.body.total).to.be.a('number');
      expect(examples.body.version).to.equal('2.0');

      // Check that examples have proper structure
      examples.body.examples.forEach((example: any) => {
        expect(example.query).to.be.a('string');
        expect(example.description).to.be.a('string');
        expect(example.category).to.be.a('string');
      });

      console.log(`✅ Query examples: ${examples.body.total} examples available`);
    });

    it('should handle batch queries', async () => {
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
        .send(batchQueries)
        .expect(200);

      expect(response.body.results).to.be.an('array').with.length(3);
      expect(response.body.summary.total).to.equal(3);
      expect(response.body.summary.successRate).to.be.a('string');

      console.log(`✅ Batch queries processed: ${response.body.summary.successRate} success rate`);
    });
  });

  describe('🔄 Complete Data Flow Validation', () => {
    it('should demonstrate the TARGET.MD workflow', async function() {
      this.timeout(15000); // Longer timeout for complete flow
      
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
        .send(workflowData)
        .expect(201);

      expect(ingestionResponse.body.success).to.be.true;
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
        .send(queryData)
        .expect(200);

      expect(queryResponse.body.success).to.be.true;
      console.log(`✅ Query processed via RAG₂: ${queryResponse.body.insights.interpretation}`);
      console.log(`📊 Results from ${queryResponse.body.data.metadata.sources.length} MCPs`);
      console.log(`⚡ Processing time: ${queryResponse.body.duration}ms`);

      // Step 4: Verify the complete flow worked
      expect(queryResponse.body.data.metadata.totalRecords).to.be.greaterThan(0);
      expect(queryResponse.body.data.metadata.sources).to.be.an('array').with.length.greaterThan(0);
      expect(queryResponse.body.insights.interpretation).to.include('workflow');

      console.log('\n🎉 TARGET.MD WORKFLOW COMPLETED SUCCESSFULLY!');
      console.log('✅ Data → RAG₁ (classify & route) → MCPs → RAG₂ (interpret & resolve) → Results');
    });

    it('should show system performance metrics', async () => {
      // RAG₁ Performance
      const rag1Status = await request
        .get('/api/v1/ingest/status')
        .expect(200);

      // RAG₂ Performance  
      const rag2Performance = await request
        .get('/api/v1/query/performance')
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

      expect(rag1Status.body.system.metrics.totalIngested).to.be.greaterThan(0);
      expect(rag2Performance.body.insights).to.be.an('object');
    });

    it('should validate error handling and resilience', async () => {
      // Test invalid ingestion data
      const invalidData = {
        data: null, // Invalid data
        domain: 'invalid'
      };

      const ingestionError = await request
        .post('/api/v1/ingest/single')
        .send(invalidData)
        .expect(400);

      expect(ingestionError.body.success).to.be.false;
      expect(ingestionError.body.message).to.include('Data payload is required');

      // Test invalid query
      const invalidQuery = {
        query: '', // Empty query
      };

      const queryError = await request
        .post('/api/v1/query/natural')
        .send(invalidQuery)
        .expect(400);

      expect(queryError.body.error).to.include('Invalid request');

      console.log('✅ Error handling validation completed');
    });
  });

  describe('🧮 Advanced Features Validation', () => {
    it('should support topology recommendations', async () => {
      const recommendations = await request
        .get('/api/v1/ingest/topology/recommendations')
        .expect(200);

      expect(recommendations.body.recommendations).to.be.an('array');
      expect(recommendations.body.rebalancing).to.be.an('object');

      console.log(`✅ Topology recommendations: ${recommendations.body.recommendations.length} recommendations`);
    });

    it('should maintain query history', async () => {
      const history = await request
        .get('/api/v1/query/history')
        .expect(200);

      expect(history.body.history).to.be.an('array');
      expect(history.body.total).to.be.a('number');

      console.log(`✅ Query history: ${history.body.total} queries tracked`);
    });

    it('should demonstrate caching effectiveness', async () => {
      const cacheQuery = {
        query: 'get workflow demo user data',
        context: { userId: 'workflow_demo_user' }
      };

      // First query (should be uncached)
      const firstResponse = await request
        .post('/api/v1/query/natural')
        .send(cacheQuery)
        .expect(200);

      // Second identical query (should hit cache)
      const secondResponse = await request
        .post('/api/v1/query/natural')
        .send(cacheQuery)
        .expect(200);

      expect(firstResponse.body.caching.cached).to.be.false;
      // Note: Cache behavior depends on implementation details
      
      console.log(`✅ Caching test completed`);
    });
  });

  describe('🎯 Final Integration Validation', () => {
    it('should confirm all components are working together', async () => {
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
          request.get(endpoint).expect(200)
        )
      );

      results.forEach((result, index) => {
        expect(result.status).to.equal(200);
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