/**
 * 🎯 Complete Enterprise Multi-MCP Smart Database System Demo
 * Integrates: MCPs + RAG₁ + RAG₂ + Intelligence Coordination + API Server
 * Demonstrates: Full TARGET.MD workflow with advanced AI capabilities
 */

import { UserMCP, ChatMCP, StatsMCP, LogsMCP } from './index';
import { MCPRegistry } from './mcp/registry/MCPRegistry';
import { MCPConfiguration } from './types/mcp.types';
import { apiServer } from './api/server';
import { RAG1Controller } from './rag/ingest/rag1';
import { RAG2Controller } from './rag/query/rag2';
import { IntelligenceCoordinator } from './intelligence/intelligence_coordinator';
import { logger } from './utils/logger';

async function demonstrateSpecializedMCPs() {
  console.log('🎯 Enterprise Multi-MCP Smart Database System - Complete Demo');
  console.log('🧠 AI-Powered | 🗂️ Multi-MCP | 🔍 RAG Intelligence | 🌐 Production-Ready\n');

  // Initialize the comprehensive system
  console.log('📋 Step 1: Initializing Complete Enterprise System...');
  
  // Initialize MCP Registry with advanced configuration
  const registry = new MCPRegistry();

  // Initialize Intelligence Coordinator
  const intelligenceCoordinator = new IntelligenceCoordinator(registry);

  console.log('✅ Advanced MCP Registry initialized');
  console.log('✅ Intelligence Coordinator initialized');
  console.log('✅ Pattern learning, caching, and neural optimization: ACTIVE\n');

  try {
    // Initialize RAG Controllers with Intelligence Coordination
    console.log('🧠 Step 2: Initializing RAG Intelligence Systems...');
    
    const rag1Controller = new RAG1Controller(registry);
    await rag1Controller.initialize();
    
    const rag2Controller = new RAG2Controller(registry);

    console.log('✅ RAG₁ Intelligent Ingestion Controller: INITIALIZED');
    console.log('✅ RAG₂ Natural Language Query Controller: INITIALIZED');
    console.log('✅ Intelligence coordination: ACTIVE\n');

    // 1. Specialized MCP Creation with Intelligence
    console.log('🗂️ Step 3: Creating Intelligent Specialized MCPs...');
    const userConfig: MCPConfiguration = {
      domain: 'user',
      type: 'hot',
      maxRecords: 25000,
      maxSize: 1024 * 1024 * 1024,
      cacheSize: 128,
      connectionPoolSize: 10,
      queryTimeout: 5000,
      backupFrequency: 3600000,
      compressionEnabled: true,
      encryptionEnabled: false,
      autoIndexing: true,
      replicationFactor: 3,
      consistencyLevel: 'eventual',
      customProperties: {
        indexingStrategy: 'smart',
        cachingStrategy: 'hybrid'
      }
    };

    await registry.registerMCP({ ...userConfig, id: 'user-mcp-intelligent' });
    const userMCP = await registry.getMCP('user-mcp-intelligent') as UserMCP;

    // Create sample users
    const userId1 = await userMCP.storeUser({
      userId: 'user-001',
      email: 'john.doe@example.com',
      profile: {
        name: 'John Doe',
        preferences: {}
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        tags: ['premium']
      }
    });

    const userId2 = await userMCP.storeUser({
      userId: 'user-002',
      email: 'jane.smith@example.com',
      profile: {
        name: 'Jane Smith',
        preferences: {}
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        tags: ['free']
      }
    });

    console.log(`✅ Created intelligent users: ${userId1}, ${userId2}`);

    // Demonstrate specialized queries with intelligence coordination
    const premiumUsers = await userMCP.getUsersByPermission('premium');
    console.log(`💎 Premium users found: ${premiumUsers.length}`);

    const userByEmail = await userMCP.getUserByEmail('john.doe@example.com');
    console.log(`📧 User retrieved by email: ${userByEmail?.profile?.name}`);

    const userStats = await userMCP.getUserAnalytics();
    console.log(`📊 Intelligent user analytics:`, userStats);

    // Demonstrate RAG₁ intelligent data ingestion
    console.log('\n🧠 RAG₁ Intelligent Data Processing...');
    await intelligenceCoordinator.analyzeQueryPatterns();

    // 2. ChatMCP Demo
    console.log('\n💬 === ChatMCP Demonstration ===');
    const chatConfig: MCPConfiguration = {
      domain: 'chat',
      type: 'hot',
      maxRecords: 100000,
      maxSize: 2 * 1024 * 1024 * 1024,
      cacheSize: 256,
      connectionPoolSize: 15,
      queryTimeout: 3000,
      backupFrequency: 1800000,
      compressionEnabled: true,
      encryptionEnabled: false,
      autoIndexing: true,
      replicationFactor: 3,
      consistencyLevel: 'eventual',
      customProperties: {
        indexingStrategy: 'smart',
        cachingStrategy: 'hybrid'
      }
    };

    await registry.registerMCP({ ...chatConfig, id: 'chat-mcp-demo' });
    const chatMCP = await registry.getMCP('chat-mcp-demo') as ChatMCP;

    // Create sample messages
    const msgId1 = await chatMCP.store({
      id: 'msg-001',
      domain: 'chat',
      type: 'message',
      timestamp: Date.now(),
      data: {
        conversationId: 'conv-123',
        senderId: 'user-001',
        receiverId: 'user-002',
        content: {
          type: 'text',
          text: 'Hello Jane! How are you doing? #greeting @janesmith'
        }
      }
    });

    const msgId2 = await chatMCP.store({
      id: 'msg-002',
      domain: 'chat',
      type: 'message',
      timestamp: Date.now(),
      data: {
        conversationId: 'conv-123',
        senderId: 'user-002',
        receiverId: 'user-001',
        content: {
          type: 'text',
          text: 'Hi John! I\'m great, thanks for asking! #reply'
        }
      }
    });

    console.log(`✅ Created messages: ${msgId1}, ${msgId2}`);

    // Demonstrate chat-specific queries
    const conversationMessages = await chatMCP.getConversationMessages('conv-123');
    console.log(`💬 Conversation messages: ${conversationMessages.length}`);

    const mentions = await chatMCP.getMentions('janesmith');
    console.log(`🏷️ Mentions for janesmith: ${mentions.length}`);

    const hashtagMessages = await chatMCP.getMessagesByHashtag('greeting');
    console.log(`#️⃣ Messages with #greeting: ${hashtagMessages.length}`);

    // 3. StatsMCP Demo
    console.log('\n📊 === StatsMCP Demonstration ===');
    const statsConfig: MCPConfiguration = {
      domain: 'stats',
      type: 'hot',
      maxRecords: 1000000,
      maxSize: 5 * 1024 * 1024 * 1024,
      cacheSize: 512,
      connectionPoolSize: 20,
      queryTimeout: 10000,
      backupFrequency: 7200000,
      compressionEnabled: true,
      encryptionEnabled: false,
      autoIndexing: true,
      replicationFactor: 2,
      consistencyLevel: 'eventual',
      customProperties: {
        indexingStrategy: 'eager',
        cachingStrategy: 'hybrid'
      }
    };

    await registry.registerMCP({ ...statsConfig, id: 'stats-mcp-demo' });
    const statsMCP = await registry.getMCP('stats-mcp-demo') as StatsMCP;

    // Create sample metrics
    const statId1 = await statsMCP.store({
      id: 'stat-001',
      domain: 'stats',
      type: 'metric',
      timestamp: Date.now(),
      data: {
        metricName: 'user_login',
        category: 'authentication',
        value: 1,
        dimensions: {
          userId: 'user-001',
          device: 'web',
          location: 'US'
        },
        tags: ['login', 'success'],
        source: 'auth-service',
        aggregationLevel: 'raw',
        metadata: {
          unit: 'count',
          dataType: 'counter',
          precision: 0,
          retention: 30
        },
        context: {
          userId: 'user-001',
          environment: 'production'
        }
      }
    });

    const statId2 = await statsMCP.store({
      id: 'stat-002',
      domain: 'stats',
      type: 'metric',
      timestamp: Date.now(),
      data: {
        metricName: 'message_sent',
        category: 'messaging',
        value: 1,
        dimensions: {
          userId: 'user-001',
          conversationId: 'conv-123'
        },
        tags: ['message', 'sent'],
        source: 'chat-service',
        aggregationLevel: 'raw',
        metadata: {
          unit: 'count',
          dataType: 'counter',
          precision: 0,
          retention: 90
        },
        context: {
          userId: 'user-001',
          environment: 'production'
        }
      }
    });

    console.log(`✅ Created metrics: ${statId1}, ${statId2}`);

    // Demonstrate analytics queries
    const loginMetrics = await statsMCP.getMetricData('user_login');
    console.log(`🔑 Login metrics: ${loginMetrics.length}`);

    const aggregation = await statsMCP.aggregateMetric('message_sent', 'sum', {
      groupBy: 'userId'
    });
    console.log(`📈 Message aggregation:`, aggregation);

    const topMetrics = await statsMCP.getTopMetrics('messaging', 5);
    console.log(`🏆 Top messaging metrics:`, topMetrics);

    // 4. LogsMCP Demo
    console.log('\n📋 === LogsMCP Demonstration ===');
    const logsConfig: MCPConfiguration = {
      domain: 'logs',
      type: 'cold',
      maxRecords: 10000000,
      maxSize: 10 * 1024 * 1024 * 1024,
      cacheSize: 64,
      connectionPoolSize: 5,
      queryTimeout: 15000,
      backupFrequency: 21600000,
      compressionEnabled: true,
      encryptionEnabled: false,
      autoIndexing: true,
      replicationFactor: 1,
      consistencyLevel: 'eventual',
      customProperties: {
        indexingStrategy: 'smart',
        cachingStrategy: 'disk'
      }
    };

    await registry.registerMCP({ ...logsConfig, id: 'logs-mcp-demo' });
    const logsMCP = await registry.getMCP('logs-mcp-demo') as LogsMCP;

    // Create sample logs
    const logId1 = await logsMCP.store({
      id: 'log-001',
      domain: 'logs',
      type: 'log',
      timestamp: Date.now(),
      data: {
        level: 'info',
        message: 'User authentication successful',
        source: {
          application: 'auth-service',
          service: 'authentication',
          instance: 'auth-001',
          host: 'app-server-01',
          version: '1.2.3'
        },
        context: {
          userId: 'user-001',
          requestId: 'req-12345',
          traceId: 'trace-abc123'
        },
        details: {
          metadata: {
            method: 'POST',
            endpoint: '/auth/login',
            responseTime: 150
          }
        },
        tags: ['auth', 'success']
      }
    });

    const logId2 = await logsMCP.store({
      id: 'log-002',
      domain: 'logs',
      type: 'log',
      timestamp: Date.now(),
      data: {
        level: 'error',
        message: 'Database connection timeout',
        source: {
          application: 'chat-service',
          service: 'database',
          instance: 'db-001',
          host: 'db-server-01',
          version: '1.0.5'
        },
        context: {
          requestId: 'req-67890',
          traceId: 'trace-def456'
        },
        details: {
          error: {
            type: 'TimeoutError',
            message: 'Connection timeout after 30s',
            code: 'DB_TIMEOUT'
          }
        },
        tags: ['database', 'error', 'timeout']
      }
    });

    console.log(`✅ Created logs: ${logId1}, ${logId2}`);

    // Demonstrate log queries
    const errorLogs = await logsMCP.getErrorLogs();
    console.log(`❌ Error logs: ${errorLogs.length}`);

    const traceLogs = await logsMCP.getLogsByTrace('trace-abc123');
    console.log(`🔍 Trace logs: ${traceLogs.length}`);

    const appLogs = await logsMCP.searchLogs('authentication', {
      level: 'info',
      application: 'auth-service'
    });
    console.log(`🔎 Authentication logs: ${appLogs.length}`);

    const logStats = await logsMCP.getLogStats();
    console.log(`📊 Log statistics:`, logStats);

    // 5. Registry Demo
    console.log('\n🏛️ === Registry Demonstration ===');
    const registryStats = registry.getSystemMetrics();
    console.log(`📈 Registry stats:`, registryStats);

    const allMCPs = await registry.getAllMCPs();
    console.log(`🗂️ Total MCPs: ${allMCPs.size}`);

    const hotMCPs = await registry.getMCPsByType('hot' as any);
    console.log(`🔥 HOT MCPs: ${hotMCPs.size}`);

    const coldMCPs = await registry.getMCPsByType('cold' as any);
    console.log(`❄️ COLD MCPs: ${coldMCPs.size}`);

    console.log('\n✨ Demo completed successfully!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('  • Domain-specific MCPs with specialized indexing');
    console.log('  • Intelligent hot/cold classification');
    console.log('  • Load balancing and health monitoring');
    console.log('  • Advanced querying capabilities');
    console.log('  • Real-time analytics and aggregations');
    console.log('  • Structured log management with retention policies');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup
    await registry.shutdown();
    console.log('\n🔚 Registry shutdown complete');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateSpecializedMCPs().catch(console.error);
}

export { demonstrateSpecializedMCPs };