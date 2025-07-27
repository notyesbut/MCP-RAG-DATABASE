/**
 * Performance and Load Testing Suite
 * Tests system performance under various load conditions
 */

const { Database } = require('../../src/core/database');
const { MCPServer } = require('../../src/mcp/server');
const { PerformanceMonitor } = require('../../src/performance/monitor');

describe('Performance and Load Testing', () => {
  let db;
  let server;
  let monitor;

  beforeAll(async () => {
    db = await global.testHelpers.createTestDatabase();
    server = await global.testHelpers.createTestMCPServer();
    monitor = new PerformanceMonitor();
    
    await server.start();
    await monitor.initialize();
  });

  afterAll(async () => {
    await monitor.generateReport();
    await db.close();
    await server.stop();
  });

  describe('Database Performance Tests', () => {
    test('should handle high-volume inserts efficiently', async () => {
      const volumes = [1000, 5000, 10000, 25000];
      const results = {};

      for (const volume of volumes) {
        const testData = global.testHelpers.generateBulkTestData(volume);
        
        const performance = await global.testHelpers.measurePerformance(
          () => db.insertMany('performance_insert_test', testData),
          3
        );
        
        results[volume] = {
          avgTime: performance.avg,
          throughput: volume / (performance.avg / 1000), // records per second
          memoryUsage: global.testHelpers.getMemoryUsage()
        };
        
        // Performance should scale linearly or better
        if (volume > 1000) {
          const prevVolume = volumes[volumes.indexOf(volume) - 1];
          const scaleFactor = volume / prevVolume;
          const timeFactor = performance.avg / results[prevVolume].avgTime;
          
          // Time increase should be less than volume increase (sub-linear)
          expect(timeFactor).toBeLessThan(scaleFactor * 1.5);
        }
        
        // Clean up for next test
        await db.deleteMany('performance_insert_test', {});
      }

      console.log('Insert Performance Results:', results);
    });

    test('should maintain query performance with large datasets', async () => {
      // Create progressively larger datasets
      const dataSizes = [10000, 50000, 100000];
      const queryResults = {};

      for (const size of dataSizes) {
        // Insert test data
        const testData = global.testHelpers.generateBulkTestData(size, {
          category: `perf_test_${size}`,
          searchField: Math.random().toString(36).substr(2, 10)
        });
        
        await db.insertMany('query_performance_test', testData);
        
        // Create index for fair comparison
        await db.createIndex('query_performance_test', { category: 1 });
        await db.createIndex('query_performance_test', { searchField: 1 });
        
        // Test different query types
        const simpleQuery = await global.testHelpers.measurePerformance(
          () => db.find('query_performance_test', { 
            category: `perf_test_${size}` 
          }, { limit: 100 }),
          5
        );
        
        const complexQuery = await global.testHelpers.measurePerformance(
          () => db.find('query_performance_test', {
            $and: [
              { category: `perf_test_${size}` },
              { index: { $gte: size / 2 } },
              { 'data.test': true }
            ]
          }, { limit: 100 }),
          5
        );
        
        const aggregationQuery = await global.testHelpers.measurePerformance(
          () => db.aggregate('query_performance_test', [
            { $match: { category: `perf_test_${size}` } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ]),
          5
        );
        
        queryResults[size] = {
          simple: simpleQuery.avg,
          complex: complexQuery.avg,
          aggregation: aggregationQuery.avg,
          memoryUsage: global.testHelpers.getMemoryUsage()
        };
        
        // Query performance should not degrade significantly
        expect(simpleQuery.avg).toBeLessThan(1000); // Under 1 second
        expect(complexQuery.avg).toBeLessThan(2000); // Under 2 seconds
        expect(aggregationQuery.avg).toBeLessThan(3000); // Under 3 seconds
      }

      console.log('Query Performance Results:', queryResults);
    });

    test('should handle concurrent read/write operations', async () => {
      const concurrentUsers = [10, 25, 50, 100];
      const results = {};

      for (const userCount of concurrentUsers) {
        const operations = [];
        
        // Create mixed workload for each user
        for (let user = 0; user < userCount; user++) {
          // Read operations (70%)
          for (let i = 0; i < 7; i++) {
            operations.push(
              db.find('concurrent_test', { 
                user_id: user,
                index: { $gte: i * 10 } 
              }, { limit: 10 })
            );
          }
          
          // Write operations (20%)
          for (let i = 0; i < 2; i++) {
            const doc = global.testHelpers.generateTestRecord({
              user_id: user,
              operation_type: 'concurrent_write'
            });
            operations.push(db.insert('concurrent_test', doc));
          }
          
          // Update operations (10%)
          operations.push(
            db.update('concurrent_test',
              { user_id: user },
              { $set: { last_updated: Date.now() } }
            )
          );
        }

        const performance = await global.testHelpers.measurePerformance(
          () => Promise.all(operations),
          3
        );

        results[userCount] = {
          totalOperations: operations.length,
          avgTime: performance.avg,
          throughput: operations.length / (performance.avg / 1000),
          memoryUsage: global.testHelpers.getMemoryUsage()
        };

        // Throughput should scale reasonably with user count
        expect(performance.avg).toBeLessThan(10000); // Under 10 seconds
      }

      console.log('Concurrent Operation Results:', results);
    });

    test('should handle transaction performance under load', async () => {
      const transactionSizes = [10, 50, 100, 200];
      const results = {};

      for (const txSize of transactionSizes) {
        const performance = await global.testHelpers.measurePerformance(
          () => db.transaction(async (session) => {
            const operations = [];
            
            for (let i = 0; i < txSize; i++) {
              const doc = global.testHelpers.generateTestRecord({
                transaction_size: txSize,
                operation_index: i
              });
              operations.push(session.insert('transaction_perf_test', doc));
            }
            
            await Promise.all(operations);
            return { operationsCompleted: txSize };
          }),
          5
        );

        results[txSize] = {
          avgTime: performance.avg,
          opsPerSecond: txSize / (performance.avg / 1000),
          memoryUsage: global.testHelpers.getMemoryUsage()
        };

        // Transaction time should scale reasonably
        expect(performance.avg).toBeLessThan(txSize * 50); // Max 50ms per operation
      }

      console.log('Transaction Performance Results:', results);
    });
  });

  describe('MCP Server Performance Tests', () => {
    test('should handle high request throughput', async () => {
      const client = new (require('../../src/mcp/client'))({
        serverUrl: `http://localhost:${server.port}`
      });
      
      await client.connect();

      const requestCounts = [100, 500, 1000];
      const results = {};

      for (const requestCount of requestCounts) {
        const requests = Array.from({ length: requestCount }, (_, i) => 
          client.request('tools/call', {
            name: 'database_query',
            arguments: {
              collection: 'mcp_perf_test',
              query: { index: i % 100 },
              options: { limit: 10 }
            }
          })
        );

        const performance = await global.testHelpers.measurePerformance(
          () => Promise.all(requests),
          3
        );

        results[requestCount] = {
          avgTime: performance.avg,
          requestsPerSecond: requestCount / (performance.avg / 1000),
          memoryUsage: global.testHelpers.getMemoryUsage()
        };

        // Should maintain reasonable response times
        expect(performance.avg).toBeLessThan(requestCount * 10); // Max 10ms per request
      }

      await client.disconnect();
      console.log('MCP Server Performance Results:', results);
    });

    test('should handle concurrent client connections', async () => {
      const clientCounts = [5, 10, 20];
      const results = {};

      for (const clientCount of clientCounts) {
        const clients = [];
        
        // Create multiple clients
        for (let i = 0; i < clientCount; i++) {
          const client = new (require('../../src/mcp/client'))({
            serverUrl: `http://localhost:${server.port}`
          });
          await client.connect();
          clients.push(client);
        }

        // Each client makes multiple requests
        const allRequests = [];
        for (let i = 0; i < clientCount; i++) {
          const clientRequests = Array.from({ length: 10 }, (_, j) => 
            clients[i].request('tools/call', {
              name: 'database_query',
              arguments: {
                collection: 'concurrent_client_test',
                query: { client_id: i, request_id: j }
              }
            })
          );
          allRequests.push(...clientRequests);
        }

        const performance = await global.testHelpers.measurePerformance(
          () => Promise.all(allRequests),
          3
        );

        results[clientCount] = {
          totalRequests: allRequests.length,
          avgTime: performance.avg,
          requestsPerSecond: allRequests.length / (performance.avg / 1000),
          memoryUsage: global.testHelpers.getMemoryUsage()
        };

        // Clean up clients
        await Promise.all(clients.map(client => client.disconnect()));

        // Should handle concurrent clients efficiently
        expect(performance.avg).toBeLessThan(10000); // Under 10 seconds
      }

      console.log('Concurrent Client Results:', results);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory during sustained operations', async () => {
      const initialMemory = global.testHelpers.getMemoryUsage();
      const memorySnapshots = [initialMemory];

      // Perform sustained operations
      for (let iteration = 0; iteration < 10; iteration++) {
        // Insert data
        const data = global.testHelpers.generateBulkTestData(1000);
        await db.insertMany('memory_leak_test', data);

        // Query data
        await db.find('memory_leak_test', {}, { limit: 500 });

        // Update data
        await db.updateMany('memory_leak_test', 
          { iteration: { $exists: false } },
          { $set: { iteration } }
        );

        // Delete data
        await db.deleteMany('memory_leak_test', { iteration: { $lt: iteration - 2 } });

        // Take memory snapshot
        memorySnapshots.push(global.testHelpers.getMemoryUsage());

        // Force garbage collection if available
        if (global.gc) global.gc();
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal (under 100MB)
      expect(memoryIncrease).toBeLessThan(100);

      console.log('Memory Usage Over Time:', memorySnapshots);
    });

    test('should efficiently handle large object operations', async () => {
      const objectSizes = [1, 10, 100, 1000]; // KB
      const results = {};

      for (const sizeKB of objectSizes) {
        // Generate large object
        const largeData = {
          id: 'large_object_test',
          size_kb: sizeKB,
          data: 'x'.repeat(sizeKB * 1024) // sizeKB * 1024 bytes
        };

        const insertPerf = await global.testHelpers.measurePerformance(
          () => db.insert('large_object_test', largeData),
          5
        );

        const queryPerf = await global.testHelpers.measurePerformance(
          () => db.findById('large_object_test', 'large_object_test'),
          5
        );

        const updatePerf = await global.testHelpers.measurePerformance(
          () => db.update('large_object_test',
            { id: 'large_object_test' },
            { $set: { updated_at: new Date() } }
          ),
          5
        );

        results[sizeKB] = {
          insert: insertPerf.avg,
          query: queryPerf.avg,
          update: updatePerf.avg,
          memoryUsage: global.testHelpers.getMemoryUsage()
        };

        // Clean up
        await db.delete('large_object_test', { id: 'large_object_test' });

        // Performance should degrade gracefully with size
        expect(insertPerf.avg).toBeLessThan(sizeKB * 100); // Max 100ms per KB
      }

      console.log('Large Object Performance:', results);
    });
  });

  describe('Stress Testing', () => {
    test('should handle extreme load conditions', async () => {
      const extremeLoad = {
        collections: 50,
        documentsPerCollection: 1000,
        concurrentOperations: 100
      };

      // Create multiple collections with data
      const setupOperations = [];
      for (let i = 0; i < extremeLoad.collections; i++) {
        const collectionName = `stress_test_${i}`;
        const data = global.testHelpers.generateBulkTestData(
          extremeLoad.documentsPerCollection,
          { collection_index: i }
        );
        setupOperations.push(db.insertMany(collectionName, data));
      }

      await Promise.all(setupOperations);

      // Perform concurrent operations across all collections
      const stressOperations = [];
      for (let i = 0; i < extremeLoad.concurrentOperations; i++) {
        const collectionIndex = i % extremeLoad.collections;
        const collectionName = `stress_test_${collectionIndex}`;

        const operationType = i % 4;
        switch (operationType) {
          case 0: // Query
            stressOperations.push(
              db.find(collectionName, { collection_index: collectionIndex }, { limit: 50 })
            );
            break;
          case 1: // Insert
            stressOperations.push(
              db.insert(collectionName, global.testHelpers.generateTestRecord({
                stress_test: true,
                timestamp: Date.now()
              }))
            );
            break;
          case 2: // Update
            stressOperations.push(
              db.update(collectionName,
                { collection_index: collectionIndex },
                { $set: { stress_updated: Date.now() } }
              )
            );
            break;
          case 3: // Count
            stressOperations.push(
              db.count(collectionName, { collection_index: collectionIndex })
            );
            break;
        }
      }

      const stressPerformance = await global.testHelpers.measurePerformance(
        () => Promise.all(stressOperations),
        1 // Single run due to intensity
      );

      // System should survive extreme load
      expect(stressPerformance.avg).toBeLessThan(30000); // Under 30 seconds
      
      // Memory should remain reasonable
      const memoryUsage = global.testHelpers.getMemoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(1000); // Under 1GB

      console.log('Stress Test Results:', {
        duration: stressPerformance.avg,
        memoryUsage,
        operationsPerSecond: extremeLoad.concurrentOperations / (stressPerformance.avg / 1000)
      });
    });

    test('should recover from resource exhaustion', async () => {
      // Simulate memory pressure
      const largeArrays = [];
      try {
        // Allocate memory until we get close to limits
        for (let i = 0; i < 100; i++) {
          largeArrays.push(new Array(100000).fill(`memory_pressure_${i}`));
        }

        // Try to perform database operations under memory pressure
        const operationResult = await db.find('stress_test_0', {}, { limit: 10 });
        expect(operationResult).toBeDefined();

      } catch (error) {
        // Expected to potentially fail under extreme pressure
        expect(error.message).toContain('memory');
      } finally {
        // Release memory
        largeArrays.length = 0;
        if (global.gc) global.gc();
      }

      // System should recover after pressure is relieved
      const recoveryResult = await db.find('stress_test_0', {}, { limit: 10 });
      expect(recoveryResult).toBeDefined();
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain baseline performance standards', async () => {
      const baselines = {
        singleInsert: 50, // ms
        batchInsert1000: 2000, // ms
        simpleQuery: 100, // ms
        complexQuery: 500, // ms
        indexedQuery: 50, // ms
        aggregation: 1000 // ms
      };

      // Single insert
      const singleDoc = global.testHelpers.generateTestRecord();
      const singleInsertPerf = await global.testHelpers.measurePerformance(
        () => db.insert('baseline_test', singleDoc),
        10
      );
      expect(singleInsertPerf.avg).toBeLessThan(baselines.singleInsert);

      // Batch insert
      const batchData = global.testHelpers.generateBulkTestData(1000);
      const batchInsertPerf = await global.testHelpers.measurePerformance(
        () => db.insertMany('baseline_test', batchData),
        5
      );
      expect(batchInsertPerf.avg).toBeLessThan(baselines.batchInsert1000);

      // Create index for query tests
      await db.createIndex('baseline_test', { name: 1 });
      await db.createIndex('baseline_test', { 'data.test': 1 });

      // Simple query
      const simpleQueryPerf = await global.testHelpers.measurePerformance(
        () => db.find('baseline_test', { 'data.test': true }, { limit: 100 }),
        10
      );
      expect(simpleQueryPerf.avg).toBeLessThan(baselines.simpleQuery);

      // Complex query
      const complexQueryPerf = await global.testHelpers.measurePerformance(
        () => db.find('baseline_test', {
          $and: [
            { 'data.test': true },
            { index: { $gte: 500 } },
            { name: { $regex: /Test Record/ } }
          ]
        }, { limit: 50 }),
        10
      );
      expect(complexQueryPerf.avg).toBeLessThan(baselines.complexQuery);

      // Indexed query
      const indexedQueryPerf = await global.testHelpers.measurePerformance(
        () => db.find('baseline_test', { name: 'Test Record 100' }),
        10
      );
      expect(indexedQueryPerf.avg).toBeLessThan(baselines.indexedQuery);

      // Aggregation
      const aggregationPerf = await global.testHelpers.measurePerformance(
        () => db.aggregate('baseline_test', [
          { $match: { 'data.test': true } },
          { $group: { _id: '$name', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 100 }
        ]),
        5
      );
      expect(aggregationPerf.avg).toBeLessThan(baselines.aggregation);

      console.log('Baseline Performance Results:', {
        singleInsert: singleInsertPerf.avg,
        batchInsert: batchInsertPerf.avg,
        simpleQuery: simpleQueryPerf.avg,
        complexQuery: complexQueryPerf.avg,
        indexedQuery: indexedQueryPerf.avg,
        aggregation: aggregationPerf.avg
      });
    });
  });
});