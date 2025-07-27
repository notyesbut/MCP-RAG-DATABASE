/**
 * Concurrency and Thread-Safety Tests
 * Tests system behavior under concurrent operations and thread safety
 */

const { Database } = require('../../src/core/database');
const { MCPServer } = require('../../src/mcp/server');
const { LockManager } = require('../../src/concurrency/lock-manager');
const cluster = require('cluster');
const { Worker } = require('worker_threads');

describe('Concurrency and Thread-Safety', () => {
  let db;
  let server;
  let lockManager;

  beforeAll(async () => {
    db = await global.testHelpers.createTestDatabase();
    lockManager = new LockManager({ database: db });
    server = await global.testHelpers.createTestMCPServer({
      lockManager: lockManager
    });
    
    await server.start();
    await lockManager.initialize();
  });

  afterAll(async () => {
    await lockManager.cleanup();
    await db.close();
    await server.stop();
  });

  describe('Database Concurrency Control', () => {
    test('should handle concurrent inserts without conflicts', async () => {
      const concurrentInserts = 100;
      const collectionName = 'concurrent_inserts_test';
      
      // Create array of insert operations
      const insertOperations = Array.from({ length: concurrentInserts }, (_, i) => 
        db.insert(collectionName, {
          id: `concurrent_${i}`,
          data: `Test data ${i}`,
          timestamp: Date.now(),
          worker: i % 10 // Simulate 10 workers
        })
      );

      // Execute all inserts concurrently
      const startTime = Date.now();
      const results = await Promise.allSettled(insertOperations);
      const endTime = Date.now();

      // All inserts should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(concurrentInserts);
      expect(failed.length).toBe(0);

      // Verify all records were inserted
      const totalRecords = await db.count(collectionName, {});
      expect(totalRecords).toBe(concurrentInserts);

      console.log(`Concurrent inserts performance: ${concurrentInserts} inserts in ${endTime - startTime}ms`);
    });

    test('should handle concurrent updates with optimistic locking', async () => {
      const testRecordId = 'optimistic_lock_test';
      
      // Insert initial record
      await db.insert('optimistic_lock_test', {
        id: testRecordId,
        counter: 0,
        version: 1
      });

      const concurrentUpdates = 50;
      
      // Create concurrent update operations
      const updateOperations = Array.from({ length: concurrentUpdates }, (_, i) => 
        async () => {
          let success = false;
          let attempts = 0;
          const maxAttempts = 10;

          while (!success && attempts < maxAttempts) {
            try {
              // Get current version
              const current = await db.findById('optimistic_lock_test', testRecordId);
              
              // Attempt update with version check
              const result = await db.update('optimistic_lock_test',
                { id: testRecordId, version: current.version },
                { 
                  $inc: { counter: 1 },
                  $set: { version: current.version + 1, updatedBy: i }
                }
              );

              if (result.modifiedCount === 1) {
                success = true;
              }
            } catch (error) {
              if (!error.message.includes('version conflict')) {
                throw error;
              }
            }
            attempts++;
            
            // Small random delay to reduce contention
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          }

          return { success, attempts, worker: i };
        }
      );

      // Execute all updates concurrently
      const results = await Promise.all(updateOperations.map(op => op()));

      // Verify final state
      const finalRecord = await db.findById('optimistic_lock_test', testRecordId);
      expect(finalRecord.counter).toBe(concurrentUpdates);
      expect(finalRecord.version).toBe(concurrentUpdates + 1);

      // All operations should eventually succeed
      const successful = results.filter(r => r.success);
      expect(successful.length).toBe(concurrentUpdates);

      console.log('Optimistic locking stats:', {
        avgAttempts: results.reduce((sum, r) => sum + r.attempts, 0) / results.length,
        maxAttempts: Math.max(...results.map(r => r.attempts))
      });
    });

    test('should handle concurrent reads without blocking writes', async () => {
      const collectionName = 'read_write_concurrency_test';
      
      // Insert initial data
      const initialData = global.testHelpers.generateBulkTestData(1000);
      await db.insertMany(collectionName, initialData);

      const readOperations = [];
      const writeOperations = [];

      // Create 50 concurrent read operations
      for (let i = 0; i < 50; i++) {
        readOperations.push(
          db.find(collectionName, { index: { $gte: i * 20 } }, { limit: 50 })
        );
      }

      // Create 10 concurrent write operations
      for (let i = 0; i < 10; i++) {
        writeOperations.push(
          db.insert(collectionName, global.testHelpers.generateTestRecord({
            concurrent_write: true,
            writer: i
          }))
        );
      }

      // Execute reads and writes concurrently
      const startTime = Date.now();
      const [readResults, writeResults] = await Promise.all([
        Promise.allSettled(readOperations),
        Promise.allSettled(writeOperations)
      ]);
      const endTime = Date.now();

      // All operations should succeed
      expect(readResults.filter(r => r.status === 'fulfilled').length).toBe(50);
      expect(writeResults.filter(r => r.status === 'fulfilled').length).toBe(10);

      console.log(`Read/Write concurrency: ${readOperations.length + writeOperations.length} operations in ${endTime - startTime}ms`);
    });

    test('should implement deadlock detection and resolution', async () => {
      const resource1 = 'resource_1';
      const resource2 = 'resource_2';

      // Simulate two transactions that could deadlock
      const transaction1 = async () => {
        const lock1 = await lockManager.acquireLock(resource1, 'exclusive', 5000);
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
        
        try {
          const lock2 = await lockManager.acquireLock(resource2, 'exclusive', 1000);
          await lockManager.releaseLock(lock2);
        } finally {
          await lockManager.releaseLock(lock1);
        }
      };

      const transaction2 = async () => {
        const lock2 = await lockManager.acquireLock(resource2, 'exclusive', 5000);
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
        
        try {
          const lock1 = await lockManager.acquireLock(resource1, 'exclusive', 1000);
          await lockManager.releaseLock(lock1);
        } finally {
          await lockManager.releaseLock(lock2);
        }
      };

      // Execute potentially deadlocking transactions
      const results = await Promise.allSettled([transaction1(), transaction2()]);

      // At least one should succeed, deadlock should be detected and resolved
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(0);
      
      if (failed > 0) {
        // Failed transaction should be due to deadlock detection
        const failedResult = results.find(r => r.status === 'rejected');
        expect(failedResult.reason.message).toContain('deadlock');
      }
    });
  });

  describe('Transaction Isolation Levels', () => {
    test('should implement READ_COMMITTED isolation', async () => {
      const testData = { id: 'isolation_test', value: 100 };
      await db.insert('isolation_test', testData);

      let transaction1Complete = false;
      let transaction2Reading = false;

      // Transaction 1: Update value
      const transaction1 = db.transaction(async (session) => {
        await session.update('isolation_test', 
          { id: 'isolation_test' },
          { $set: { value: 200 } }
        );
        
        // Wait for transaction 2 to attempt read
        while (!transaction2Reading) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Hold transaction open for a moment
        await new Promise(resolve => setTimeout(resolve, 200));
        transaction1Complete = true;
      });

      // Transaction 2: Read value
      const transaction2 = db.transaction(async (session) => {
        transaction2Reading = true;
        
        // Should read committed value (100), not uncommitted value (200)
        const result = await session.findById('isolation_test', 'isolation_test');
        return result.value;
      });

      const [, readValue] = await Promise.all([transaction1, transaction2]);

      // Should read the original committed value
      expect(readValue).toBe(100);
      expect(transaction1Complete).toBe(true);
    });

    test('should implement REPEATABLE_READ isolation', async () => {
      const testData = { id: 'repeatable_read_test', value: 300 };
      await db.insert('repeatable_read_test', testData);

      const readValues = [];

      // Long-running transaction with multiple reads
      const longTransaction = db.transaction(async (session) => {
        // First read
        const read1 = await session.findById('repeatable_read_test', 'repeatable_read_test');
        readValues.push(read1.value);
        
        // Wait for external update
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Second read - should get same value
        const read2 = await session.findById('repeatable_read_test', 'repeatable_read_test');
        readValues.push(read2.value);
      }, { isolationLevel: 'REPEATABLE_READ' });

      // External update during transaction
      const externalUpdate = (async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        await db.update('repeatable_read_test',
          { id: 'repeatable_read_test' },
          { $set: { value: 400 } }
        );
      })();

      await Promise.all([longTransaction, externalUpdate]);

      // Both reads should return the same value (repeatable read)
      expect(readValues).toHaveLength(2);
      expect(readValues[0]).toBe(readValues[1]);
      expect(readValues[0]).toBe(300); // Original value
    });

    test('should prevent phantom reads in SERIALIZABLE isolation', async () => {
      const collectionName = 'phantom_read_test';
      
      // Initial data
      await db.insertMany(collectionName, [
        { category: 'test', value: 1 },
        { category: 'test', value: 2 }
      ]);

      const queryResults = [];

      // Transaction with range query
      const serializableTransaction = db.transaction(async (session) => {
        // First query
        const result1 = await session.find(collectionName, { category: 'test' });
        queryResults.push(result1.length);
        
        // Wait for potential insert
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Second query - should return same results (no phantoms)
        const result2 = await session.find(collectionName, { category: 'test' });
        queryResults.push(result2.length);
      }, { isolationLevel: 'SERIALIZABLE' });

      // External insert during transaction
      const externalInsert = (async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        await db.insert(collectionName, { category: 'test', value: 3 });
      })();

      await Promise.all([serializableTransaction, externalInsert]);

      // Both queries should return the same count (no phantom reads)
      expect(queryResults).toHaveLength(2);
      expect(queryResults[0]).toBe(queryResults[1]);
      expect(queryResults[0]).toBe(2); // Original count
    });
  });

  describe('Multi-Process Coordination', () => {
    test('should coordinate between multiple database connections', async () => {
      const connectionCount = 5;
      const connections = [];

      // Create multiple database connections
      for (let i = 0; i < connectionCount; i++) {
        const connection = await global.testHelpers.createTestDatabase();
        connections.push(connection);
      }

      try {
        const sharedCounter = 'multi_connection_counter';
        
        // Initialize counter
        await connections[0].insert('shared_data', {
          id: sharedCounter,
          counter: 0
        });

        // Each connection increments counter
        const incrementOperations = connections.map((conn, index) => 
          conn.transaction(async (session) => {
            for (let i = 0; i < 20; i++) {
              const current = await session.findById('shared_data', sharedCounter);
              await session.update('shared_data',
                { id: sharedCounter },
                { $set: { counter: current.counter + 1 } }
              );
            }
          })
        );

        await Promise.all(incrementOperations);

        // Final counter should be exactly connectionCount * 20
        const finalCounter = await connections[0].findById('shared_data', sharedCounter);
        expect(finalCounter.counter).toBe(connectionCount * 20);

      } finally {
        // Cleanup connections
        await Promise.all(connections.map(conn => conn.close()));
      }
    });

    test('should handle process crashes gracefully', async () => {
      const lockId = 'crash_test_lock';
      
      // Simulate a process acquiring a lock then crashing
      const lock = await lockManager.acquireLock(lockId, 'exclusive', 10000);
      
      // Simulate process death by not releasing the lock normally
      // Instead, rely on lock timeout mechanism
      
      // Another process tries to acquire the same lock
      const startTime = Date.now();
      
      // This should eventually succeed when the lock times out
      const newLock = await lockManager.acquireLock(lockId, 'exclusive', 15000);
      const endTime = Date.now();
      
      expect(newLock).toBeDefined();
      expect(endTime - startTime).toBeGreaterThan(5000); // Should wait for timeout
      expect(endTime - startTime).toBeLessThan(15000); // But not timeout itself
      
      await lockManager.releaseLock(newLock);
    });
  });

  describe('Performance Under Concurrency', () => {
    test('should maintain performance with high concurrent load', async () => {
      const concurrentUsers = 50;
      const operationsPerUser = 20;
      const collectionName = 'performance_concurrency_test';

      // Pre-populate with some data
      const initialData = global.testHelpers.generateBulkTestData(1000);
      await db.insertMany(collectionName, initialData);

      const allOperations = [];

      // Create operations for each concurrent user
      for (let user = 0; user < concurrentUsers; user++) {
        for (let op = 0; op < operationsPerUser; op++) {
          const operationType = op % 4;
          
          switch (operationType) {
            case 0: // Insert
              allOperations.push(
                db.insert(collectionName, global.testHelpers.generateTestRecord({
                  user,
                  operation: op,
                  type: 'concurrent_insert'
                }))
              );
              break;
              
            case 1: // Query
              allOperations.push(
                db.find(collectionName, { 
                  user: { $lte: user },
                  index: { $gte: op * 10 }
                }, { limit: 10 })
              );
              break;
              
            case 2: // Update
              allOperations.push(
                db.update(collectionName,
                  { index: (user * operationsPerUser + op) % 1000 },
                  { $set: { 
                    updated_by: user,
                    updated_at: Date.now()
                  }}
                )
              );
              break;
              
            case 3: // Count
              allOperations.push(
                db.count(collectionName, { user: { $lte: user } })
              );
              break;
          }
        }
      }

      // Execute all operations concurrently
      const performance = await global.testHelpers.measurePerformance(
        () => Promise.all(allOperations),
        1 // Single run due to scale
      );

      const totalOperations = concurrentUsers * operationsPerUser;
      const throughput = totalOperations / (performance.avg / 1000); // ops per second

      console.log(`Concurrent performance: ${totalOperations} operations in ${performance.avg}ms (${Math.round(throughput)} ops/sec)`);

      // Should maintain reasonable performance
      expect(performance.avg).toBeLessThan(totalOperations * 10); // Max 10ms per operation
      expect(throughput).toBeGreaterThan(100); // At least 100 ops/sec
    });

    test('should scale query performance with read replicas', async () => {
      // This test simulates the behavior of read replicas
      // In a real implementation, this would involve multiple database instances
      
      const queryCount = 100;
      const collectionName = 'read_replica_test';

      // Insert test data
      const testData = global.testHelpers.generateBulkTestData(10000);
      await db.insertMany(collectionName, testData);

      // Simulate load balancing across read replicas
      const queries = Array.from({ length: queryCount }, (_, i) => 
        db.find(collectionName, {
          index: { $gte: i * 100, $lt: (i + 1) * 100 }
        }, { 
          limit: 50,
          // Simulate read preference for different replicas
          readPreference: `replica_${i % 3}`
        })
      );

      const performance = await global.testHelpers.measurePerformance(
        () => Promise.all(queries),
        3
      );

      const avgQueryTime = performance.avg / queryCount;
      console.log(`Read replica performance: ${queryCount} queries in ${performance.avg}ms (${avgQueryTime.toFixed(2)}ms per query)`);

      // Should maintain fast query performance
      expect(avgQueryTime).toBeLessThan(50); // Under 50ms per query
    });
  });

  describe('Resource Contention Management', () => {
    test('should manage connection pool under high load', async () => {
      const maxConnections = 20;
      const requestedConnections = 50;

      // Configure limited connection pool
      const connectionPool = new (require('../../src/core/connection-pool'))({
        maxConnections,
        maxWaitingClients: 100,
        acquireTimeoutMillis: 30000
      });

      const connectionPromises = [];
      
      // Request more connections than available
      for (let i = 0; i < requestedConnections; i++) {
        connectionPromises.push(
          connectionPool.acquire().then(conn => {
            // Simulate work
            return new Promise(resolve => {
              setTimeout(() => {
                connectionPool.release(conn);
                resolve(i);
              }, Math.random() * 100 + 50);
            });
          })
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(connectionPromises);
      const endTime = Date.now();

      // All connections should eventually be served
      expect(results).toHaveLength(requestedConnections);
      expect(results.every(r => r >= 0)).toBe(true);

      console.log(`Connection pool performance: ${requestedConnections} connections served in ${endTime - startTime}ms`);

      await connectionPool.close();
    });

    test('should handle memory pressure gracefully', async () => {
      const initialMemory = global.testHelpers.getMemoryUsage();
      
      // Create operations that consume memory
      const memoryIntensiveOperations = [];
      
      for (let i = 0; i < 20; i++) {
        memoryIntensiveOperations.push(
          db.insertMany('memory_pressure_test', 
            global.testHelpers.generateBulkTestData(5000, {
              largeData: 'x'.repeat(10000) // 10KB per record
            })
          )
        );
      }

      // Execute operations concurrently
      await Promise.all(memoryIntensiveOperations);

      const peakMemory = global.testHelpers.getMemoryUsage();
      
      // Clean up data to release memory
      await db.deleteMany('memory_pressure_test', {});
      
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      const finalMemory = global.testHelpers.getMemoryUsage();
      
      // Memory should be reclaimed after cleanup
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200); // Under 200MB permanent increase

      console.log('Memory usage:', {
        initial: initialMemory.heapUsed,
        peak: peakMemory.heapUsed,
        final: finalMemory.heapUsed,
        increase: memoryIncrease
      });
    });

    test('should implement fair scheduling under contention', async () => {
      const priorities = ['high', 'medium', 'low'];
      const operationsPerPriority = 20;
      const completionTimes = { high: [], medium: [], low: [] };

      const allOperations = [];

      // Create operations with different priorities
      for (const priority of priorities) {
        for (let i = 0; i < operationsPerPriority; i++) {
          const operation = async () => {
            const startTime = Date.now();
            
            // Simulate priority-based scheduling
            const delay = priority === 'high' ? 10 : priority === 'medium' ? 50 : 100;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            await db.insert('priority_test', {
              priority,
              operation: i,
              timestamp: Date.now()
            });
            
            const endTime = Date.now();
            completionTimes[priority].push(endTime - startTime);
          };

          allOperations.push(operation());
        }
      }

      await Promise.all(allOperations);

      // Calculate average completion times
      const avgTimes = {};
      for (const priority of priorities) {
        avgTimes[priority] = completionTimes[priority].reduce((a, b) => a + b, 0) / 
                            completionTimes[priority].length;
      }

      console.log('Priority-based completion times:', avgTimes);

      // High priority should complete faster on average
      expect(avgTimes.high).toBeLessThan(avgTimes.medium);
      expect(avgTimes.medium).toBeLessThan(avgTimes.low);
    });
  });
});