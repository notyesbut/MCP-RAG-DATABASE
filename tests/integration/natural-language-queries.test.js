/**
 * Integration Tests for Natural Language Query Processing
 * Tests NLQ parsing, interpretation, and execution
 */

const { NaturalLanguageProcessor } = require('../../src/nlq/processor');
const { Database } = require('../../src/core/database');
const { MCPServer } = require('../../src/mcp/server');

describe('Natural Language Query Integration', () => {
  let db;
  let nlProcessor;
  let server;

  beforeAll(async () => {
    db = await global.testHelpers.createTestDatabase();
    nlProcessor = new NaturalLanguageProcessor({ database: db });
    server = await global.testHelpers.createTestMCPServer();
    await server.start();
    
    // Insert comprehensive test dataset
    await setupTestData();
  });

  afterAll(async () => {
    await db.close();
    await server.stop();
  });

  async function setupTestData() {
    // Users collection
    const users = [
      { name: 'John Doe', age: 30, city: 'New York', department: 'Engineering', salary: 75000 },
      { name: 'Jane Smith', age: 25, city: 'San Francisco', department: 'Marketing', salary: 65000 },
      { name: 'Bob Johnson', age: 35, city: 'Chicago', department: 'Engineering', salary: 85000 },
      { name: 'Alice Brown', age: 28, city: 'New York', department: 'Sales', salary: 70000 },
      { name: 'Charlie Wilson', age: 42, city: 'Los Angeles', department: 'Engineering', salary: 95000 }
    ];
    await db.insertMany('users', users);

    // Orders collection
    const orders = [
      { customer_id: 'user1', product: 'Laptop', amount: 1200, date: '2024-01-15', status: 'completed' },
      { customer_id: 'user2', product: 'Phone', amount: 800, date: '2024-01-20', status: 'pending' },
      { customer_id: 'user1', product: 'Tablet', amount: 500, date: '2024-02-01', status: 'completed' },
      { customer_id: 'user3', product: 'Laptop', amount: 1200, date: '2024-02-10', status: 'cancelled' }
    ];
    await db.insertMany('orders', orders);

    // Products collection
    const products = [
      { name: 'Laptop', category: 'Electronics', price: 1200, stock: 50, brand: 'TechCorp' },
      { name: 'Phone', category: 'Electronics', price: 800, stock: 100, brand: 'PhoneMaker' },
      { name: 'Tablet', category: 'Electronics', price: 500, stock: 75, brand: 'TechCorp' },
      { name: 'Desk Chair', category: 'Furniture', price: 300, stock: 25, brand: 'OfficePlus' }
    ];
    await db.insertMany('products', products);
  }

  describe('Basic Query Interpretation', () => {
    test('should parse simple find queries', async () => {
      const queries = [
        'Find all users',
        'Show me all users',
        'Get all users',
        'List users',
        'Retrieve all users'
      ];

      for (const queryText of queries) {
        const result = await nlProcessor.process(queryText);
        
        expect(result.interpretation.operation).toBe('find');
        expect(result.interpretation.collection).toBe('users');
        expect(result.results).toBeDefined();
        expect(result.results.length).toBeGreaterThan(0);
      }
    });

    test('should parse filtered queries', async () => {
      const testCases = [
        {
          query: 'Find users in New York',
          expectedFilter: { city: 'New York' },
          expectedCount: 2
        },
        {
          query: 'Show me engineers',
          expectedFilter: { department: 'Engineering' },
          expectedCount: 3
        },
        {
          query: 'Get users older than 30',
          expectedFilter: { age: { $gt: 30 } },
          expectedCount: 2
        },
        {
          query: 'Find users with salary greater than 70000',
          expectedFilter: { salary: { $gt: 70000 } },
          expectedCount: 3
        }
      ];

      for (const testCase of testCases) {
        const result = await nlProcessor.process(testCase.query);
        
        expect(result.interpretation.operation).toBe('find');
        expect(result.interpretation.collection).toBe('users');
        expect(result.results.length).toBe(testCase.expectedCount);
      }
    });

    test('should handle complex conditional queries', async () => {
      const complexQueries = [
        {
          query: 'Find engineers in New York with salary above 70000',
          expectedConditions: ['department', 'city', 'salary']
        },
        {
          query: 'Show me users aged between 25 and 35 in Engineering',
          expectedConditions: ['age', 'department']
        },
        {
          query: 'Get users from New York or San Francisco in Sales or Marketing',
          expectedConditions: ['city', 'department']
        }
      ];

      for (const testCase of complexQueries) {
        const result = await nlProcessor.process(testCase.query);
        
        expect(result.interpretation.operation).toBe('find');
        expect(result.interpretation.conditions).toBeDefined();
        expect(result.results).toBeDefined();
        
        // Verify that expected fields are in the query
        const queryStr = JSON.stringify(result.interpretation.mongoQuery);
        testCase.expectedConditions.forEach(condition => {
          expect(queryStr).toContain(condition);
        });
      }
    });
  });

  describe('Aggregation and Analytics Queries', () => {
    test('should handle count queries', async () => {
      const countQueries = [
        {
          query: 'How many users are there?',
          expectedCount: 5
        },
        {
          query: 'Count engineers',
          expectedCount: 3
        },
        {
          query: 'How many users in New York?',
          expectedCount: 2
        }
      ];

      for (const testCase of countQueries) {
        const result = await nlProcessor.process(testCase.query);
        
        expect(result.interpretation.operation).toBe('count');
        expect(result.count).toBe(testCase.expectedCount);
      }
    });

    test('should handle aggregation queries', async () => {
      const aggregationQueries = [
        {
          query: 'What is the average salary of engineers?',
          expectedOperation: 'aggregate',
          expectedField: 'salary',
          expectedAggregation: 'avg'
        },
        {
          query: 'Total salary for all users',
          expectedOperation: 'aggregate',
          expectedField: 'salary',
          expectedAggregation: 'sum'
        },
        {
          query: 'Maximum age of users in Engineering',
          expectedOperation: 'aggregate',
          expectedField: 'age',
          expectedAggregation: 'max'
        }
      ];

      for (const testCase of aggregationQueries) {
        const result = await nlProcessor.process(testCase.query);
        
        expect(result.interpretation.operation).toBe(testCase.expectedOperation);
        expect(result.interpretation.aggregation.field).toBe(testCase.expectedField);
        expect(result.interpretation.aggregation.function).toBe(testCase.expectedAggregation);
        expect(result.aggregationResult).toBeDefined();
      }
    });

    test('should handle grouping queries', async () => {
      const groupQueries = [
        'Group users by department',
        'Show users grouped by city',
        'Group by department and show average salary'
      ];

      for (const query of groupQueries) {
        const result = await nlProcessor.process(query);
        
        expect(result.interpretation.operation).toBe('group');
        expect(result.interpretation.groupBy).toBeDefined();
        expect(result.groups).toBeDefined();
        expect(Object.keys(result.groups).length).toBeGreaterThan(1);
      }
    });
  });

  describe('Multi-Collection Queries', () => {
    test('should handle join-like queries', async () => {
      const joinQueries = [
        'Show orders with customer details',
        'Find completed orders with user information',
        'Get orders for users in New York'
      ];

      for (const query of joinQueries) {
        const result = await nlProcessor.process(query);
        
        expect(result.interpretation.operation).toBe('join');
        expect(result.interpretation.collections).toContain('orders');
        expect(result.interpretation.collections).toContain('users');
        expect(result.results).toBeDefined();
      }
    });

    test('should handle relationship queries', async () => {
      const relationshipQuery = 'Find users who have placed orders';
      const result = await nlProcessor.process(relationshipQuery);
      
      expect(result.interpretation.operation).toBe('find');
      expect(result.interpretation.hasRelationship).toBe(true);
      expect(result.results).toBeDefined();
    });
  });

  describe('Temporal Queries', () => {
    test('should handle date-based queries', async () => {
      const dateQueries = [
        {
          query: 'Find orders from January 2024',
          expectedDateFilter: true
        },
        {
          query: 'Show orders placed after January 15, 2024',
          expectedDateFilter: true
        },
        {
          query: 'Get orders from last month',
          expectedDateFilter: true
        }
      ];

      for (const testCase of dateQueries) {
        const result = await nlProcessor.process(testCase.query);
        
        expect(result.interpretation.operation).toBe('find');
        expect(result.interpretation.collection).toBe('orders');
        expect(result.interpretation.hasDateFilter).toBe(testCase.expectedDateFilter);
      }
    });

    test('should handle relative time queries', async () => {
      const relativeQueries = [
        'Orders from today',
        'Users created this week',
        'Orders from the past 30 days'
      ];

      for (const query of relativeQueries) {
        const result = await nlProcessor.process(query);
        
        expect(result.interpretation.hasRelativeDate).toBe(true);
        expect(result.interpretation.dateRange).toBeDefined();
      }
    });
  });

  describe('Query Optimization and Performance', () => {
    test('should optimize query execution', async () => {
      const query = 'Find all users in Engineering with salary above 80000';
      
      // Process query
      const result = await nlProcessor.process(query);
      
      // Check that query uses indexes if available
      expect(result.queryPlan).toBeDefined();
      expect(result.queryPlan.useIndex).toBeDefined();
      expect(result.executionTime).toBeLessThan(1000); // Under 1 second
    });

    test('should handle large result sets efficiently', async () => {
      // Insert large dataset
      const largeDataset = global.testHelpers.generateBulkTestData(10000, {
        category: 'bulk_test'
      });
      await db.insertMany('bulk_collection', largeDataset);
      
      const query = 'Find first 100 items from bulk_collection';
      
      const performance = await global.testHelpers.measurePerformance(
        () => nlProcessor.process(query)
      );
      
      expect(performance.avg).toBeLessThan(2000); // Under 2 seconds
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle ambiguous queries gracefully', async () => {
      const ambiguousQueries = [
        'Find stuff',
        'Get things',
        'Show data'
      ];

      for (const query of ambiguousQueries) {
        const result = await nlProcessor.process(query);
        
        expect(result.interpretation.confidence).toBeLessThan(0.5);
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions.length).toBeGreaterThan(0);
      }
    });

    test('should handle non-existent collections', async () => {
      const invalidQuery = 'Find all dinosaurs';
      const result = await nlProcessor.process(invalidQuery);
      
      expect(result.interpretation.collection).toBe('dinosaurs');
      expect(result.error).toBeDefined();
      expect(result.error.type).toBe('COLLECTION_NOT_FOUND');
      expect(result.suggestions).toContain('users');
    });

    test('should handle invalid field references', async () => {
      const invalidFieldQuery = 'Find users with invalid_field greater than 100';
      const result = await nlProcessor.process(invalidFieldQuery);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'UNKNOWN_FIELD',
          field: 'invalid_field'
        })
      );
    });

    test('should provide helpful suggestions for typos', async () => {
      const typoQueries = [
        'Find usrs', // Should suggest 'users'
        'Show ordrs', // Should suggest 'orders'
        'Get prodcts' // Should suggest 'products'
      ];

      for (const query of typoQueries) {
        const result = await nlProcessor.process(query);
        
        expect(result.didYouMean).toBeDefined();
        expect(result.didYouMean.suggestions).toBeDefined();
        expect(result.didYouMean.suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Query Learning and Improvement', () => {
    test('should learn from query patterns', async () => {
      const commonQueries = [
        'Find engineers in New York',
        'Show engineers from New York',
        'Get New York engineers'
      ];

      // Process similar queries multiple times
      for (const query of commonQueries) {
        await nlProcessor.process(query);
      }

      // Check that processor learned the pattern
      const patterns = await nlProcessor.getLearnedPatterns();
      expect(patterns).toContainEqual(
        expect.objectContaining({
          pattern: expect.stringContaining('engineer'),
          confidence: expect.any(Number)
        })
      );
    });

    test('should improve query interpretation over time', async () => {
      const query = 'Find high-performing engineers';
      
      // First interpretation (baseline)
      const initialResult = await nlProcessor.process(query);
      const initialConfidence = initialResult.interpretation.confidence;
      
      // Provide feedback to improve interpretation
      await nlProcessor.provideFeedback(query, {
        correctInterpretation: {
          operation: 'find',
          collection: 'users',
          filters: {
            department: 'Engineering',
            salary: { $gt: 80000 }
          }
        },
        rating: 5
      });
      
      // Process same query again
      const improvedResult = await nlProcessor.process(query);
      const improvedConfidence = improvedResult.interpretation.confidence;
      
      expect(improvedConfidence).toBeGreaterThan(initialConfidence);
    });
  });

  describe('MCP Integration', () => {
    test('should process NLQ through MCP server', async () => {
      const client = new (require('../../src/mcp/client'))({
        serverUrl: `http://localhost:${server.port}`
      });
      
      await client.connect();
      
      const response = await client.request('tools/call', {
        name: 'natural_language_query',
        arguments: {
          query: 'Find all engineers with salary above 80000'
        }
      });
      
      expect(response.content.interpretation).toBeDefined();
      expect(response.content.results).toBeDefined();
      expect(response.content.results.length).toBeGreaterThan(0);
      
      await client.disconnect();
    });

    test('should handle streaming NLQ responses', async () => {
      const client = new (require('../../src/mcp/client'))({
        serverUrl: `http://localhost:${server.port}`
      });
      
      await client.connect();
      
      const chunks = [];
      await client.requestStream('tools/call', {
        name: 'natural_language_query_stream',
        arguments: {
          query: 'Find all users and show detailed information'
        }
      }, (chunk) => {
        chunks.push(chunk);
      });
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].complete).toBe(true);
      
      await client.disconnect();
    });
  });
});