/**
 * End-to-End Workflow Tests
 * Tests complete system workflows from user perspective
 */

const { spawn } = require('child_process');
const { MCPClient } = require('../../src/mcp/client');
const path = require('path');

describe('End-to-End Complete Workflows', () => {
  let serverProcess;
  let client;
  const serverPort = global.__TEST_CONFIG__.mcpTestPort + 100;

  beforeAll(async () => {
    // Start the actual MCP server process
    serverProcess = spawn('node', [
      path.join(__dirname, '../../src/server.js'),
      '--port', serverPort,
      '--env', 'test'
    ], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
      
      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('Server listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
    });

    // Connect client
    client = new MCPClient({
      serverUrl: `http://localhost:${serverPort}`
    });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => {
        serverProcess.on('close', resolve);
      });
    }
  });

  describe('Complete Database Lifecycle Workflow', () => {
    test('should handle complete CRUD workflow with validation', async () => {
      const workflowId = 'crud_workflow_test';
      
      // Step 1: Initialize collection with schema
      const initResponse = await client.request('tools/call', {
        name: 'database_init_collection',
        arguments: {
          collection: 'users',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              email: { type: 'string', format: 'email' },
              age: { type: 'number', minimum: 0, maximum: 150 },
              role: { type: 'string', enum: ['admin', 'user', 'guest'] }
            },
            required: ['name', 'email']
          }
        }
      });
      expect(initResponse.content.success).toBe(true);

      // Step 2: Insert valid user
      const insertResponse = await client.request('tools/call', {
        name: 'database_insert',
        arguments: {
          collection: 'users',
          document: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            age: 30,
            role: 'user'
          }
        }
      });
      expect(insertResponse.content.success).toBe(true);
      const userId = insertResponse.content.insertedId;

      // Step 3: Query user
      const queryResponse = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'users',
          query: { email: 'john.doe@example.com' }
        }
      });
      expect(queryResponse.content.results).toHaveLength(1);
      expect(queryResponse.content.results[0].name).toBe('John Doe');

      // Step 4: Update user
      const updateResponse = await client.request('tools/call', {
        name: 'database_update',
        arguments: {
          collection: 'users',
          query: { id: userId },
          update: { $set: { age: 31, role: 'admin' } }
        }
      });
      expect(updateResponse.content.modifiedCount).toBe(1);

      // Step 5: Verify update
      const verifyResponse = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'users',
          query: { id: userId }
        }
      });
      expect(verifyResponse.content.results[0].age).toBe(31);
      expect(verifyResponse.content.results[0].role).toBe('admin');

      // Step 6: Attempt invalid update (should fail validation)
      await expect(client.request('tools/call', {
        name: 'database_update',
        arguments: {
          collection: 'users',
          query: { id: userId },
          update: { $set: { age: 200 } } // Invalid age
        }
      })).rejects.toThrow();

      // Step 7: Delete user
      const deleteResponse = await client.request('tools/call', {
        name: 'database_delete',
        arguments: {
          collection: 'users',
          query: { id: userId }
        }
      });
      expect(deleteResponse.content.deletedCount).toBe(1);

      // Step 8: Verify deletion
      const finalQueryResponse = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'users',
          query: { id: userId }
        }
      });
      expect(finalQueryResponse.content.results).toHaveLength(0);
    });
  });

  describe('Natural Language Query Complete Workflow', () => {
    beforeAll(async () => {
      // Setup test data for NLQ testing
      const testUsers = [
        { name: 'Alice Johnson', department: 'Engineering', salary: 95000, city: 'San Francisco' },
        { name: 'Bob Smith', department: 'Marketing', salary: 75000, city: 'New York' },
        { name: 'Carol Williams', department: 'Engineering', salary: 110000, city: 'Seattle' },
        { name: 'David Brown', department: 'Sales', salary: 85000, city: 'Chicago' },
        { name: 'Eve Davis', department: 'Engineering', salary: 120000, city: 'San Francisco' }
      ];

      for (const user of testUsers) {
        await client.request('tools/call', {
          name: 'database_insert',
          arguments: {
            collection: 'employees',
            document: user
          }
        });
      }
    });

    test('should handle complete natural language query workflow', async () => {
      const nlQueries = [
        {
          query: 'Find all engineers in San Francisco',
          expectedResults: 2,
          expectedFields: ['name', 'department', 'city']
        },
        {
          query: 'What is the average salary of engineers?',
          expectedType: 'aggregation',
          expectedValue: 108333.33
        },
        {
          query: 'Show me employees with salary greater than 100000',
          expectedResults: 2,
          expectedCondition: 'salary'
        },
        {
          query: 'Count employees by department',
          expectedType: 'group',
          expectedGroups: ['Engineering', 'Marketing', 'Sales']
        }
      ];

      for (const testQuery of nlQueries) {
        const response = await client.request('tools/call', {
          name: 'natural_language_query',
          arguments: {
            query: testQuery.query
          }
        });

        expect(response.content.interpretation).toBeDefined();
        expect(response.content.interpretation.confidence).toBeGreaterThan(0.5);

        if (testQuery.expectedResults) {
          expect(response.content.results).toHaveLength(testQuery.expectedResults);
        }

        if (testQuery.expectedType === 'aggregation') {
          expect(response.content.aggregationResult).toBeCloseTo(testQuery.expectedValue, 2);
        }

        if (testQuery.expectedType === 'group') {
          expect(Object.keys(response.content.groups)).toEqual(
            expect.arrayContaining(testQuery.expectedGroups)
          );
        }

        // Verify query interpretation
        expect(response.content.interpretation.mongoQuery).toBeDefined();
        expect(response.content.executionTime).toBeLessThan(5000); // Under 5 seconds
      }
    });

    test('should handle complex multi-step NLQ workflow', async () => {
      // Step 1: Initial broad query
      const broadQuery = await client.request('tools/call', {
        name: 'natural_language_query',
        arguments: {
          query: 'Show me all employees'
        }
      });
      expect(broadQuery.content.results).toHaveLength(5);

      // Step 2: Refined query based on initial results
      const refinedQuery = await client.request('tools/call', {
        name: 'natural_language_query',
        arguments: {
          query: 'From those employees, show me only engineers'
        }
      });
      expect(refinedQuery.content.results).toHaveLength(3);

      // Step 3: Further refinement with aggregation
      const aggregationQuery = await client.request('tools/call', {
        name: 'natural_language_query',
        arguments: {
          query: 'What is the highest salary among engineers?'
        }
      });
      expect(aggregationQuery.content.aggregationResult).toBe(120000);

      // Step 4: Location-based filtering
      const locationQuery = await client.request('tools/call', {
        name: 'natural_language_query',
        arguments: {
          query: 'Which engineers work in San Francisco?'
        }
      });
      expect(locationQuery.content.results).toHaveLength(2);

      // All queries should maintain context and be consistent
      const sfEngineers = locationQuery.content.results;
      expect(sfEngineers.every(emp => emp.department === 'Engineering')).toBe(true);
      expect(sfEngineers.every(emp => emp.city === 'San Francisco')).toBe(true);
    });
  });

  describe('Multi-User Collaboration Workflow', () => {
    test('should handle concurrent multi-user operations', async () => {
      // Simulate multiple users working on shared data
      const users = ['user1', 'user2', 'user3'];
      const sharedProject = 'collaborative_project';

      // Initialize shared project
      await client.request('tools/call', {
        name: 'database_insert',
        arguments: {
          collection: 'projects',
          document: {
            id: sharedProject,
            name: 'Collaborative Project',
            status: 'active',
            contributors: [],
            tasks: []
          }
        }
      });

      // Each user adds tasks concurrently
      const userTasks = users.map((user, index) => 
        client.request('tools/call', {
          name: 'database_update',
          arguments: {
            collection: 'projects',
            query: { id: sharedProject },
            update: {
              $push: {
                tasks: {
                  id: `task_${user}_${index}`,
                  title: `Task by ${user}`,
                  assignee: user,
                  status: 'pending'
                }
              }
            }
          }
        })
      );

      const taskResults = await Promise.all(userTasks);
      taskResults.forEach(result => {
        expect(result.content.modifiedCount).toBe(1);
      });

      // Verify all tasks were added
      const finalProject = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'projects',
          query: { id: sharedProject }
        }
      });

      expect(finalProject.content.results[0].tasks).toHaveLength(3);

      // Users complete tasks
      const completionTasks = users.map(user => 
        client.request('tools/call', {
          name: 'database_update',
          arguments: {
            collection: 'projects',
            query: { 
              id: sharedProject,
              'tasks.assignee': user
            },
            update: {
              $set: {
                'tasks.$.status': 'completed',
                'tasks.$.completed_at': new Date().toISOString()
              }
            }
          }
        })
      );

      await Promise.all(completionTasks);

      // Verify project completion
      const completedProject = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'projects',
          query: { id: sharedProject }
        }
      });

      const allTasksCompleted = completedProject.content.results[0].tasks.every(
        task => task.status === 'completed'
      );
      expect(allTasksCompleted).toBe(true);
    });
  });

  describe('Data Import/Export Workflow', () => {
    test('should handle complete data migration workflow', async () => {
      // Step 1: Export data
      const exportResponse = await client.request('tools/call', {
        name: 'database_export',
        arguments: {
          collection: 'employees',
          format: 'json',
          options: { includeMetadata: true }
        }
      });

      expect(exportResponse.content.success).toBe(true);
      expect(exportResponse.content.data).toBeDefined();
      expect(exportResponse.content.recordCount).toBeGreaterThan(0);

      // Step 2: Clear collection
      const clearResponse = await client.request('tools/call', {
        name: 'database_delete_many',
        arguments: {
          collection: 'employees',
          query: {}
        }
      });

      expect(clearResponse.content.deletedCount).toBeGreaterThan(0);

      // Step 3: Verify collection is empty
      const emptyCheck = await client.request('tools/call', {
        name: 'database_count',
        arguments: {
          collection: 'employees',
          query: {}
        }
      });

      expect(emptyCheck.content.count).toBe(0);

      // Step 4: Import data back
      const importResponse = await client.request('tools/call', {
        name: 'database_import',
        arguments: {
          collection: 'employees',
          data: exportResponse.content.data,
          format: 'json',
          options: { 
            upsert: true,
            validateSchema: true
          }
        }
      });

      expect(importResponse.content.success).toBe(true);
      expect(importResponse.content.importedCount).toBe(exportResponse.content.recordCount);

      // Step 5: Verify data integrity
      const restoredData = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'employees',
          query: {}
        }
      });

      expect(restoredData.content.results).toHaveLength(exportResponse.content.recordCount);

      // Verify specific records
      const aliceRecord = restoredData.content.results.find(emp => emp.name === 'Alice Johnson');
      expect(aliceRecord).toBeDefined();
      expect(aliceRecord.department).toBe('Engineering');
      expect(aliceRecord.salary).toBe(95000);
    });
  });

  describe('Real-Time Data Streaming Workflow', () => {
    test('should handle real-time data updates and notifications', async () => {
      const streamingData = [];
      const notificationReceived = [];

      // Set up real-time subscription
      const subscription = await client.subscribe('data_changes', {
        collection: 'real_time_test',
        operations: ['insert', 'update', 'delete']
      }, (notification) => {
        notificationReceived.push(notification);
      });

      expect(subscription.subscriptionId).toBeDefined();

      // Generate real-time data
      const dataGenerationTasks = [];
      for (let i = 0; i < 10; i++) {
        dataGenerationTasks.push(
          (async () => {
            await new Promise(resolve => setTimeout(resolve, i * 100)); // Stagger timing
            
            const response = await client.request('tools/call', {
              name: 'database_insert',
              arguments: {
                collection: 'real_time_test',
                document: {
                  id: `real_time_${i}`,
                  value: Math.random() * 100,
                  timestamp: new Date().toISOString()
                }
              }
            });
            
            streamingData.push(response.content.insertedId);
          })()
        );
      }

      await Promise.all(dataGenerationTasks);

      // Wait for notifications to be received
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notifications were received
      expect(notificationReceived.length).toBe(10);
      notificationReceived.forEach(notification => {
        expect(notification.operation).toBe('insert');
        expect(notification.collection).toBe('real_time_test');
        expect(notification.document).toBeDefined();
      });

      // Update some records and verify update notifications
      const updateTasks = streamingData.slice(0, 5).map(id => 
        client.request('tools/call', {
          name: 'database_update',
          arguments: {
            collection: 'real_time_test',
            query: { id },
            update: { $set: { updated: true } }
          }
        })
      );

      await Promise.all(updateTasks);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have received update notifications
      const updateNotifications = notificationReceived.filter(n => n.operation === 'update');
      expect(updateNotifications.length).toBe(5);

      // Clean up subscription
      await client.unsubscribe(subscription.subscriptionId);
    });
  });

  describe('Performance and Monitoring Workflow', () => {
    test('should handle complete performance monitoring workflow', async () => {
      // Step 1: Start performance monitoring
      const monitoringResponse = await client.request('tools/call', {
        name: 'performance_start_monitoring',
        arguments: {
          metrics: ['query_time', 'memory_usage', 'cpu_usage', 'throughput'],
          interval: 1000 // 1 second intervals
        }
      });

      expect(monitoringResponse.content.success).toBe(true);
      const monitoringId = monitoringResponse.content.monitoringId;

      // Step 2: Generate load for monitoring
      const loadGenerationTasks = [];
      for (let i = 0; i < 50; i++) {
        loadGenerationTasks.push(
          client.request('tools/call', {
            name: 'database_query',
            arguments: {
              collection: 'employees',
              query: { department: 'Engineering' }
            }
          })
        );
      }

      // Execute load while monitoring
      await Promise.all(loadGenerationTasks);

      // Step 3: Get performance metrics
      const metricsResponse = await client.request('tools/call', {
        name: 'performance_get_metrics',
        arguments: {
          monitoringId,
          timeRange: '5m' // Last 5 minutes
        }
      });

      expect(metricsResponse.content.metrics).toBeDefined();
      expect(metricsResponse.content.metrics.query_time).toBeDefined();
      expect(metricsResponse.content.metrics.throughput).toBeDefined();

      // Step 4: Generate performance report
      const reportResponse = await client.request('tools/call', {
        name: 'performance_generate_report',
        arguments: {
          monitoringId,
          format: 'detailed',
          includeRecommendations: true
        }
      });

      expect(reportResponse.content.report).toBeDefined();
      expect(reportResponse.content.report.summary).toBeDefined();
      expect(reportResponse.content.report.recommendations).toBeDefined();

      // Step 5: Stop monitoring
      const stopResponse = await client.request('tools/call', {
        name: 'performance_stop_monitoring',
        arguments: {
          monitoringId
        }
      });

      expect(stopResponse.content.success).toBe(true);
    });
  });

  describe('Error Recovery and Resilience Workflow', () => {
    test('should handle complete error recovery workflow', async () => {
      // Step 1: Simulate system error
      const errorResponse = await client.request('tools/call', {
        name: 'system_simulate_error',
        arguments: {
          errorType: 'connection_failure',
          duration: 5000 // 5 seconds
        }
      });

      expect(errorResponse.content.errorSimulated).toBe(true);

      // Step 2: Attempt operations during error (should fail gracefully)
      const failingOperations = [];
      for (let i = 0; i < 5; i++) {
        failingOperations.push(
          client.request('tools/call', {
            name: 'database_query',
            arguments: {
              collection: 'employees',
              query: {}
            }
          }).catch(error => ({ error: error.message }))
        );
      }

      const failedResults = await Promise.all(failingOperations);
      const errorCount = failedResults.filter(r => r.error).length;
      expect(errorCount).toBeGreaterThan(0);

      // Step 3: Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Step 4: Verify system recovery
      const recoveryResponse = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'employees',
          query: {}
        }
      });

      expect(recoveryResponse.content.results).toBeDefined();
      expect(recoveryResponse.content.results.length).toBeGreaterThan(0);

      // Step 5: Check system health
      const healthResponse = await client.request('tools/call', {
        name: 'system_health_check',
        arguments: {}
      });

      expect(healthResponse.content.status).toBe('healthy');
      expect(healthResponse.content.components.database).toBe('operational');
      expect(healthResponse.content.components.mcp_server).toBe('operational');
    });
  });
});