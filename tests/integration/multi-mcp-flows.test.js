/**
 * Integration Tests for Multi-MCP Flows
 * Tests distributed operations, coordination between multiple MCP servers
 */

const { MCPServer } = require('../../src/mcp/server');
const { MCPClient } = require('../../src/mcp/client');
const { MCPCoordinator } = require('../../src/mcp/coordinator');

describe('Multi-MCP Integration Flows', () => {
  let primaryServer, secondaryServer, backupServer;
  let coordinator;
  let clients = [];

  beforeAll(async () => {
    // Start multiple MCP servers
    primaryServer = await global.testHelpers.createTestMCPServer({
      role: 'primary',
      port: global.__TEST_CONFIG__.mcpTestPort
    });
    
    secondaryServer = await global.testHelpers.createTestMCPServer({
      role: 'secondary',
      port: global.__TEST_CONFIG__.mcpTestPort + 1
    });
    
    backupServer = await global.testHelpers.createTestMCPServer({
      role: 'backup',
      port: global.__TEST_CONFIG__.mcpTestPort + 2
    });

    await Promise.all([
      primaryServer.start(),
      secondaryServer.start(),
      backupServer.start()
    ]);

    // Initialize coordinator
    coordinator = new MCPCoordinator({
      servers: [
        { url: `http://localhost:${primaryServer.port}`, role: 'primary' },
        { url: `http://localhost:${secondaryServer.port}`, role: 'secondary' },
        { url: `http://localhost:${backupServer.port}`, role: 'backup' }
      ]
    });
    
    await coordinator.initialize();

    // Create test clients
    for (const server of [primaryServer, secondaryServer, backupServer]) {
      const client = new MCPClient({
        serverUrl: `http://localhost:${server.port}`
      });
      await client.connect();
      clients.push(client);
    }
  });

  afterAll(async () => {
    // Cleanup
    await Promise.all(clients.map(client => client.disconnect()));
    await coordinator.shutdown();
    await Promise.all([
      primaryServer.stop(),
      secondaryServer.stop(),
      backupServer.stop()
    ]);
  });

  describe('Distributed Data Operations', () => {
    test('should distribute writes across multiple servers', async () => {
      const testData = global.testHelpers.generateBulkTestData(30);
      
      // Distribute data across servers
      const writeResults = await coordinator.distributeWrite({
        collection: 'distributed_test',
        documents: testData,
        strategy: 'round_robin'
      });
      
      expect(writeResults.success).toBe(true);
      expect(writeResults.distribution.primary).toBeGreaterThan(0);
      expect(writeResults.distribution.secondary).toBeGreaterThan(0);
      expect(writeResults.distribution.backup).toBeGreaterThan(0);
      
      // Verify total documents across all servers
      const totalCount = await coordinator.getDistributedCount('distributed_test');
      expect(totalCount).toBe(30);
    });

    test('should perform distributed queries', async () => {
      // Insert test data
      await coordinator.distributeWrite({
        collection: 'query_test',
        documents: global.testHelpers.generateBulkTestData(100, {
          category: 'integration_test'
        })
      });
      
      // Query across all servers
      const results = await coordinator.distributedQuery({
        collection: 'query_test',
        query: { category: 'integration_test' },
        aggregateResults: true
      });
      
      expect(results.totalResults).toBe(100);
      expect(results.serverResults).toHaveProperty('primary');
      expect(results.serverResults).toHaveProperty('secondary');
      expect(results.serverResults).toHaveProperty('backup');
    });

    test('should handle distributed transactions', async () => {
      const transactionResult = await coordinator.distributedTransaction(async (servers) => {
        // Perform operations across multiple servers
        const primaryOp = await servers.primary.insert('transaction_test', {
          part: 'primary',
          timestamp: Date.now()
        });
        
        const secondaryOp = await servers.secondary.insert('transaction_test', {
          part: 'secondary',
          timestamp: Date.now()
        });
        
        return {
          primaryId: primaryOp.insertedId,
          secondaryId: secondaryOp.insertedId
        };
      });
      
      expect(transactionResult.success).toBe(true);
      expect(transactionResult.result.primaryId).toBeDefined();
      expect(transactionResult.result.secondaryId).toBeDefined();
    });

    test('should rollback distributed transactions on failure', async () => {
      await expect(coordinator.distributedTransaction(async (servers) => {
        await servers.primary.insert('rollback_test', { step: 1 });
        await servers.secondary.insert('rollback_test', { step: 2 });
        
        // Simulate failure
        throw new Error('Distributed transaction failure');
      })).rejects.toThrow('Distributed transaction failure');
      
      // Verify rollback - no documents should exist
      const primaryCount = await clients[0].request('tools/call', {
        name: 'database_count',
        arguments: { collection: 'rollback_test' }
      });
      
      const secondaryCount = await clients[1].request('tools/call', {
        name: 'database_count',
        arguments: { collection: 'rollback_test' }
      });
      
      expect(primaryCount.content.count).toBe(0);
      expect(secondaryCount.content.count).toBe(0);
    });
  });

  describe('Load Balancing and Failover', () => {
    test('should balance read operations across servers', async () => {
      // Insert test data
      await coordinator.distributeWrite({
        collection: 'load_balance_test',
        documents: global.testHelpers.generateBulkTestData(50)
      });
      
      // Perform multiple read operations
      const readRequests = Array.from({ length: 30 }, () => 
        coordinator.balancedQuery({
          collection: 'load_balance_test',
          query: {},
          limit: 5
        })
      );
      
      const results = await Promise.all(readRequests);
      
      // Check that requests were distributed
      const serverStats = await coordinator.getLoadBalancingStats();
      expect(serverStats.primary.requests).toBeGreaterThan(0);
      expect(serverStats.secondary.requests).toBeGreaterThan(0);
      expect(serverStats.backup.requests).toBeGreaterThan(0);
      
      // Verify all requests succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('should failover to backup servers', async () => {
      // Simulate primary server failure
      await primaryServer.stop();
      
      // Perform operations - should automatically failover
      const result = await coordinator.resilientQuery({
        collection: 'failover_test',
        query: {},
        retryOnFailure: true
      });
      
      expect(result.success).toBe(true);
      expect(result.serverUsed).not.toBe('primary');
      
      // Restart primary server
      await primaryServer.start();
      await coordinator.reconnectServer('primary');
    });

    test('should handle partial server failures gracefully', async () => {
      // Stop secondary server
      await secondaryServer.stop();
      
      // Insert data - should still work with remaining servers
      const writeResult = await coordinator.distributeWrite({
        collection: 'partial_failure_test',
        documents: global.testHelpers.generateBulkTestData(20),
        tolerateFailures: true
      });
      
      expect(writeResult.success).toBe(true);
      expect(writeResult.failedServers).toContain('secondary');
      expect(writeResult.successfulServers).toContain('primary');
      expect(writeResult.successfulServers).toContain('backup');
      
      // Restart secondary server
      await secondaryServer.start();
      await coordinator.reconnectServer('secondary');
    });
  });

  describe('Data Consistency and Synchronization', () => {
    test('should maintain data consistency across servers', async () => {
      const testDoc = global.testHelpers.generateTestRecord({
        consistencyTest: true,
        timestamp: Date.now()
      });
      
      // Write to all servers
      await coordinator.replicatedWrite({
        collection: 'consistency_test',
        document: testDoc,
        replicationStrategy: 'all_servers',
        waitForConfirmation: true
      });
      
      // Verify data exists on all servers
      const primaryResult = await clients[0].request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'consistency_test',
          query: { id: testDoc.id }
        }
      });
      
      const secondaryResult = await clients[1].request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'consistency_test',
          query: { id: testDoc.id }
        }
      });
      
      const backupResult = await clients[2].request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'consistency_test',
          query: { id: testDoc.id }
        }
      });
      
      expect(primaryResult.content.results).toHaveLength(1);
      expect(secondaryResult.content.results).toHaveLength(1);
      expect(backupResult.content.results).toHaveLength(1);
      
      // Verify data content is identical
      const primaryDoc = primaryResult.content.results[0];
      const secondaryDoc = secondaryResult.content.results[0];
      const backupDoc = backupResult.content.results[0];
      
      expect(primaryDoc).toEqual(secondaryDoc);
      expect(secondaryDoc).toEqual(backupDoc);
    });

    test('should synchronize data after network partition', async () => {
      // Insert data while all servers are connected
      await coordinator.replicatedWrite({
        collection: 'sync_test',
        document: { phase: 'before_partition', data: 'initial' }
      });
      
      // Simulate network partition - disconnect secondary
      await coordinator.disconnectServer('secondary');
      
      // Insert data while secondary is disconnected
      await coordinator.replicatedWrite({
        collection: 'sync_test',
        document: { phase: 'during_partition', data: 'primary_only' },
        availableServersOnly: true
      });
      
      // Reconnect secondary and trigger synchronization
      await coordinator.reconnectServer('secondary');
      await coordinator.synchronizeServer('secondary');
      
      // Verify secondary now has all data
      const secondaryResult = await clients[1].request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'sync_test',
          query: {}
        }
      });
      
      expect(secondaryResult.content.results).toHaveLength(2);
      const phases = secondaryResult.content.results.map(doc => doc.phase);
      expect(phases).toContain('before_partition');
      expect(phases).toContain('during_partition');
    });
  });

  describe('Performance under Load', () => {
    test('should handle high concurrent load across servers', async () => {
      const concurrentOperations = 100;
      const testData = global.testHelpers.generateBulkTestData(concurrentOperations);
      
      // Measure performance of concurrent operations
      const performance = await global.testHelpers.measurePerformance(async () => {
        const operations = testData.map((doc, index) => {
          if (index % 3 === 0) {
            // Insert operation
            return coordinator.balancedWrite({
              collection: 'load_test',
              document: doc
            });
          } else if (index % 3 === 1) {
            // Query operation
            return coordinator.balancedQuery({
              collection: 'load_test',
              query: { index: { $lt: index } }
            });
          } else {
            // Update operation
            return coordinator.balancedUpdate({
              collection: 'load_test',
              query: { index: index - 1 },
              update: { $set: { updated: true } }
            });
          }
        });
        
        await Promise.all(operations);
      });
      
      expect(performance).toHavePerformanceUnder(10000); // 10 seconds max
      
      // Verify all servers handled operations
      const stats = await coordinator.getPerformanceStats();
      expect(stats.totalOperations).toBe(concurrentOperations);
      expect(stats.averageResponseTime).toBeLessThan(1000); // 1 second avg
    });

    test('should scale query performance with multiple servers', async () => {
      // Insert large dataset
      const largeDataset = global.testHelpers.generateBulkTestData(5000);
      await coordinator.distributeWrite({
        collection: 'scale_test',
        documents: largeDataset
      });
      
      // Measure single server query performance
      const singleServerPerf = await global.testHelpers.measurePerformance(
        () => clients[0].request('tools/call', {
          name: 'database_query',
          arguments: {
            collection: 'scale_test',
            query: { 'data.test': true }
          }
        }),
        5
      );
      
      // Measure distributed query performance
      const distributedPerf = await global.testHelpers.measurePerformance(
        () => coordinator.distributedQuery({
          collection: 'scale_test',
          query: { 'data.test': true },
          parallel: true
        }),
        5
      );
      
      // Distributed should be faster for large datasets
      expect(distributedPerf.avg).toBeLessThan(singleServerPerf.avg * 0.8);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from temporary network issues', async () => {
      // Simulate network issues with retry logic
      let attemptCount = 0;
      const mockNetworkIssue = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        return { success: true };
      });
      
      // Test resilient operation
      const result = await coordinator.resilientOperation(
        () => mockNetworkIssue(),
        { maxRetries: 5, backoffDelay: 100 }
      );
      
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    test('should maintain service during rolling updates', async () => {
      // Simulate rolling update by restarting servers one by one
      const testOperations = [];
      
      // Start continuous operations
      const operationPromise = (async () => {
        for (let i = 0; i < 20; i++) {
          try {
            await coordinator.balancedWrite({
              collection: 'rolling_update_test',
              document: { index: i, timestamp: Date.now() }
            });
            testOperations.push({ index: i, success: true });
          } catch (error) {
            testOperations.push({ index: i, success: false, error: error.message });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })();
      
      // Restart servers during operations
      setTimeout(async () => {
        await backupServer.stop();
        await backupServer.start();
        await coordinator.reconnectServer('backup');
      }, 500);
      
      setTimeout(async () => {
        await secondaryServer.stop();
        await secondaryServer.start();
        await coordinator.reconnectServer('secondary');
      }, 1000);
      
      await operationPromise;
      
      // Most operations should succeed despite server restarts
      const successfulOps = testOperations.filter(op => op.success);
      expect(successfulOps.length / testOperations.length).toBeGreaterThan(0.8);
    });
  });
});