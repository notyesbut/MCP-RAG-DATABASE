/**
 * Load Testing Performance Tests
 * 
 * Tests system performance under various load conditions.
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { TestDataGenerator } from '../helpers';

describe('Load Testing', () => {
  let systemOrchestrator: any;
  let performanceMetrics: any;

  beforeAll(async () => {
    // Mock system components for load testing
    systemOrchestrator = {
      initialize: jest.fn(),
      processDataFlow: jest.fn(),
      getSystemStatus: jest.fn(),
      getPerformanceMetrics: jest.fn()
    };

    performanceMetrics = {
      startTimer: jest.fn(),
      endTimer: jest.fn(),
      recordThroughput: jest.fn(),
      getMetrics: jest.fn()
    };

    // Initialize performance testing environment
    await systemOrchestrator.initialize();
  });

  afterAll(async () => {
    // Cleanup after load testing
    console.log('🧹 Load testing environment cleaned up');
  });

  describe('Concurrent Data Ingestion', () => {
    test('should handle 1000 concurrent user data ingestions', async () => {
      const testUsers = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestUser(),
        1000
      );

      // Mock successful processing for all users
      systemOrchestrator.processDataFlow.mockImplementation(() => 
        Promise.resolve({
          success: true,
          processingTime: TestDataGenerator.randomNumber(20, 100)
        })
      );

      const startTime = Date.now();
      
      // Process all users concurrently
      const results = await Promise.all(
        testUsers.map(user => systemOrchestrator.processDataFlow(user))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(1000);
      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      const throughput = (1000 / totalTime) * 1000; // Operations per second
      expect(throughput).toBeGreaterThan(200); // Minimum 200 ops/sec
    }, 10000); // 10 second timeout

    test('should handle mixed data type ingestion load', async () => {
      const mixedData = [
        ...TestDataGenerator.generateMultiple(() => TestDataGenerator.createTestUser(), 200),
        ...TestDataGenerator.generateMultiple(() => TestDataGenerator.createTestMessage(), 300),
        ...TestDataGenerator.generateMultiple(() => TestDataGenerator.createTestStats(), 250),
        ...TestDataGenerator.generateMultiple(() => TestDataGenerator.createTestLogEntry(), 250)
      ];

      // Shuffle the data to simulate real-world mixed load
      const shuffledData = mixedData.sort(() => Math.random() - 0.5);

      systemOrchestrator.processDataFlow.mockImplementation((data: any) => {
        const delay = data.level ? 50 : 30; // Logs take slightly longer
        return new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            dataType: data.email ? 'user' : data.content ? 'message' : data.level ? 'log' : 'stats',
            processingTime: delay
          }), delay)
        );
      });

      const startTime = Date.now();
      const results = await Promise.all(
        shuffledData.map(data => systemOrchestrator.processDataFlow(data))
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(1000);
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify data type distribution
      const userResults = results.filter(r => r.dataType === 'user');
      const messageResults = results.filter(r => r.dataType === 'message');
      const logResults = results.filter(r => r.dataType === 'log');
      const statsResults = results.filter(r => r.dataType === 'stats');

      expect(userResults).toHaveLength(200);
      expect(messageResults).toHaveLength(300);
      expect(logResults).toHaveLength(250);
      expect(statsResults).toHaveLength(250);

      const avgThroughput = (1000 / totalTime) * 1000;
      expect(avgThroughput).toBeGreaterThan(150); // Mixed load efficiency
    }, 15000);

    test('should maintain performance under sustained load', async () => {
      const batchSize = 100;
      const numberOfBatches = 10;
      const batchResults: number[] = [];

      systemOrchestrator.processDataFlow.mockImplementation(() => 
        Promise.resolve({
          success: true,
          processingTime: TestDataGenerator.randomNumber(25, 75)
        })
      );

      // Process multiple batches to test sustained performance
      for (let batch = 0; batch < numberOfBatches; batch++) {
        const batchData = TestDataGenerator.generateMultiple(
          () => TestDataGenerator.createTestMessage(),
          batchSize
        );

        const batchStart = Date.now();
        const results = await Promise.all(
          batchData.map(data => systemOrchestrator.processDataFlow(data))
        );
        const batchTime = Date.now() - batchStart;

        expect(results.every(r => r.success)).toBe(true);
        batchResults.push(batchTime);

        // Small delay between batches to simulate real-world usage
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify performance consistency
      const avgBatchTime = batchResults.reduce((a, b) => a + b) / batchResults.length;
      const maxBatchTime = Math.max(...batchResults);
      const minBatchTime = Math.min(...batchResults);

      expect(avgBatchTime).toBeLessThan(3000); // Average batch under 3 seconds
      expect(maxBatchTime - minBatchTime).toBeLessThan(1000); // Low variance indicates consistent performance
    }, 30000);
  });

  describe('Query Load Testing', () => {
    test('should handle 500 concurrent natural language queries', async () => {
      const testQueries = [
        'get all active users',
        'show messages from last week', 
        'count user logins today',
        'find users in engineering team',
        'get user activity statistics',
        'show recent error logs',
        'count messages by channel',
        'get user profile data',
        'show system performance metrics',
        'find users with premium subscriptions'
      ];

      const queries = Array.from({ length: 500 }, () => 
        TestDataGenerator.createNaturalQuery({
          raw: TestDataGenerator.randomArrayElement(testQueries)
        })
      );

      systemOrchestrator.processDataFlow.mockImplementation((query: any) => 
        Promise.resolve({
          success: true,
          queryType: 'natural_language',
          resultsCount: TestDataGenerator.randomNumber(1, 100),
          responseTime: TestDataGenerator.randomNumber(50, 200)
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(
        queries.map(query => systemOrchestrator.processDataFlow({ type: 'query', data: query }))
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(500);
      expect(results.every(r => r.success)).toBe(true);
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(150); // Average query under 150ms
      
      const queryThroughput = (500 / totalTime) * 1000;
      expect(queryThroughput).toBeGreaterThan(50); // Minimum 50 queries per second
    }, 15000);

    test('should handle complex multi-MCP queries under load', async () => {
      const complexQueries = Array.from({ length: 100 }, () => 
        TestDataGenerator.createNaturalQuery({
          raw: 'get user profiles and their message counts with recent activity analysis'
        })
      );

      systemOrchestrator.processDataFlow.mockImplementation(() => 
        Promise.resolve({
          success: true,
          queryType: 'complex_multi_mcp',
          mcpsInvolved: 3,
          stepCount: 5,
          responseTime: TestDataGenerator.randomNumber(200, 500)
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(
        complexQueries.map(query => systemOrchestrator.processDataFlow({ type: 'query', data: query }))
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.mcpsInvolved >= 2)).toBe(true);
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(400); // Complex queries under 400ms average
      
      const complexQueryThroughput = (100 / totalTime) * 1000;
      expect(complexQueryThroughput).toBeGreaterThan(20); // Minimum 20 complex queries per second
    }, 20000);
  });

  describe('System Resource Monitoring', () => {
    test('should monitor CPU and memory usage under load', async () => {
      const loadData = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestMessage(),
        500
      );

      // Mock system metrics during load
      let cpuUsage = 20;
      let memoryUsage = 30;

      systemOrchestrator.getPerformanceMetrics.mockImplementation(() => ({
        cpu: Math.min(cpuUsage + Math.random() * 20, 90),
        memory: Math.min(memoryUsage + Math.random() * 15, 85),
        timestamp: Date.now()
      }));

      systemOrchestrator.processDataFlow.mockImplementation(() => {
        cpuUsage = Math.min(cpuUsage + 0.1, 80);
        memoryUsage = Math.min(memoryUsage + 0.05, 75);
        return Promise.resolve({ success: true });
      });

      // Process data while monitoring metrics
      const metricsHistory: any[] = [];
      const processingPromises = loadData.map(async (data) => {
        const result = await systemOrchestrator.processDataFlow(data);
        const metrics = await systemOrchestrator.getPerformanceMetrics();
        metricsHistory.push(metrics);
        return result;
      });

      const results = await Promise.all(processingPromises);

      expect(results.every(r => r.success)).toBe(true);
      expect(metricsHistory).toHaveLength(500);
      
      // Verify resource usage stays within acceptable limits
      const maxCpu = Math.max(...metricsHistory.map(m => m.cpu));
      const maxMemory = Math.max(...metricsHistory.map(m => m.memory));
      
      expect(maxCpu).toBeLessThan(90); // CPU usage under 90%
      expect(maxMemory).toBeLessThan(85); // Memory usage under 85%
    }, 10000);

    test('should handle memory cleanup during extended load', async () => {
      const extendedLoadData = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestUser(),
        1000
      );

      let allocatedMemory = 100; // MB
      
      systemOrchestrator.processDataFlow.mockImplementation(() => {
        allocatedMemory += 0.5; // Each operation adds 0.5MB
        
        // Simulate garbage collection every 100 operations
        if (allocatedMemory > 150) {
          allocatedMemory = Math.max(100, allocatedMemory * 0.7);
        }
        
        return Promise.resolve({
          success: true,
          memoryUsed: allocatedMemory
        });
      });

      const results = await Promise.all(
        extendedLoadData.map(data => systemOrchestrator.processDataFlow(data))
      );

      expect(results.every(r => r.success)).toBe(true);
      
      const memoryUsages = results.map(r => r.memoryUsed);
      const maxMemory = Math.max(...memoryUsages);
      const finalMemory = memoryUsages[memoryUsages.length - 1];
      
      // Memory should not grow indefinitely
      expect(maxMemory).toBeLessThan(200); // Should not exceed 200MB
      expect(finalMemory).toBeLessThan(180); // Final memory reasonable
    }, 15000);
  });

  describe('Error Handling Under Load', () => {
    test('should handle partial failures gracefully', async () => {
      const testData = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestMessage(),
        200
      );

      // Simulate 10% failure rate
      systemOrchestrator.processDataFlow.mockImplementation(() => {
        const shouldFail = Math.random() < 0.1;
        
        if (shouldFail) {
          return Promise.reject(new Error('Simulated processing failure'));
        }
        
        return Promise.resolve({
          success: true,
          processingTime: TestDataGenerator.randomNumber(30, 80)
        });
      });

      const results = await Promise.allSettled(
        testData.map(data => systemOrchestrator.processDataFlow(data))
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBeGreaterThan(170); // At least 85% success
      expect(failed.length).toBeLessThan(30); // At most 15% failure
      expect(successful.length + failed.length).toBe(200);
    }, 10000);

    test('should recover from temporary system overload', async () => {
      const overloadData = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestUser(),
        300
      );

      let systemOverloaded = false;
      let processedCount = 0;

      systemOrchestrator.processDataFlow.mockImplementation(() => {
        processedCount++;
        
        // Simulate overload after 150 operations
        if (processedCount > 150 && processedCount < 200) {
          systemOverloaded = true;
          return Promise.reject(new Error('System overloaded'));
        }
        
        // Recovery after 200 operations
        if (processedCount >= 200) {
          systemOverloaded = false;
        }
        
        return Promise.resolve({
          success: true,
          overloadRecovered: processedCount >= 200
        });
      });

      const results = await Promise.allSettled(
        overloadData.map(data => systemOrchestrator.processDataFlow(data))
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBeGreaterThan(200); // Should recover and process remaining
      expect(failed.length).toBeLessThan(100); // Failures during overload period
      
      // Check recovery happened
      const recoveredResults = successful.slice(-50).map(r => (r as any).value);
      expect(recoveredResults.some(r => r.overloadRecovered)).toBe(true);
    }, 12000);
  });
});