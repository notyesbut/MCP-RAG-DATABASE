/**
 * Unit Tests for MCP Server Operations
 * Tests server communication, coordination, and MCP protocol compliance
 */

const { MCPServer } = require('../../../src/mcp/server');
const { MCPClient } = require('../../../src/mcp/client');

describe('MCP Server Operations', () => {
  let server;
  let client;

  beforeEach(async () => {
    server = await global.testHelpers.createTestMCPServer();
    await server.start();
    
    client = new MCPClient({
      serverUrl: `http://localhost:${server.port}`
    });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('Server Initialization', () => {
    test('should start server on available port', () => {
      expect(server.isRunning()).toBe(true);
      expect(server.port).toBeGreaterThan(0);
    });

    test('should register required MCP tools', async () => {
      const tools = await server.getTools();
      
      expect(tools).toContainEqual(
        expect.objectContaining({ name: 'database_query' })
      );
      expect(tools).toContainEqual(
        expect.objectContaining({ name: 'natural_language_query' })
      );
      expect(tools).toContainEqual(
        expect.objectContaining({ name: 'database_insert' })
      );
    });

    test('should handle server configuration', async () => {
      const config = server.getConfiguration();
      expect(config).toHaveProperty('maxConnections');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('rateLimiting');
    });
  });

  describe('MCP Protocol Compliance', () => {
    test('should respond to initialize request', async () => {
      const response = await client.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: true,
          resources: true
        }
      });
      
      expect(response.protocolVersion).toBe('2024-11-05');
      expect(response.capabilities).toBeDefined();
    });

    test('should handle tool list requests', async () => {
      const tools = await client.request('tools/list');
      
      expect(Array.isArray(tools.tools)).toBe(true);
      expect(tools.tools.length).toBeGreaterThan(0);
      
      tools.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      });
    });

    test('should validate tool call parameters', async () => {
      await expect(client.request('tools/call', {
        name: 'database_query',
        arguments: {
          // Missing required parameters
        }
      })).rejects.toThrow('Missing required parameter');
    });

    test('should handle resource requests', async () => {
      const resources = await client.request('resources/list');
      
      expect(Array.isArray(resources.resources)).toBe(true);
    });
  });

  describe('Database Tool Operations', () => {
    test('should execute database queries through MCP', async () => {
      const response = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'test_collection',
          query: { test: true },
          options: { limit: 10 }
        }
      });
      
      expect(response.content).toBeDefined();
      expect(response.isError).toBe(false);
    });

    test('should handle database insertions through MCP', async () => {
      const testDoc = global.testHelpers.generateTestRecord();
      
      const response = await client.request('tools/call', {
        name: 'database_insert',
        arguments: {
          collection: 'test_collection',
          document: testDoc
        }
      });
      
      expect(response.content.success).toBe(true);
      expect(response.content.insertedId).toBeDefined();
    });

    test('should process natural language queries', async () => {
      // Insert test data first
      await client.request('tools/call', {
        name: 'database_insert',
        arguments: {
          collection: 'nlq_test',
          document: { name: 'John Doe', age: 30, city: 'New York' }
        }
      });
      
      const response = await client.request('tools/call', {
        name: 'natural_language_query',
        arguments: {
          query: 'Find all people named John who live in New York'
        }
      });
      
      expect(response.content.results).toBeDefined();
      expect(response.content.interpretation).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests gracefully', async () => {
      await expect(client.request('invalid_method', {}))
        .rejects.toThrow('Method not found');
    });

    test('should validate tool parameters', async () => {
      await expect(client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: null, // Invalid parameter
          query: 'invalid query format'
        }
      })).rejects.toThrow('Invalid parameters');
    });

    test('should handle database connection errors', async () => {
      // Simulate database disconnection
      await server.database.close();
      
      const response = await client.request('tools/call', {
        name: 'database_query',
        arguments: {
          collection: 'test_collection',
          query: {}
        }
      });
      
      expect(response.isError).toBe(true);
      expect(response.content).toContain('Database connection error');
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 20 }, (_, i) => 
        client.request('tools/call', {
          name: 'database_query',
          arguments: {
            collection: 'concurrent_test',
            query: { index: i }
          }
        })
      );
      
      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.isError).toBe(false);
      });
    });

    test('should respect rate limiting', async () => {
      // Configure aggressive rate limiting
      server.setRateLimit(5, 1000); // 5 requests per second
      
      const startTime = Date.now();
      const requests = Array.from({ length: 10 }, () => 
        client.request('tools/call', {
          name: 'database_query',
          arguments: {
            collection: 'rate_limit_test',
            query: {}
          }
        })
      );
      
      await Promise.all(requests);
      const endTime = Date.now();
      
      // Should take at least 1 second due to rate limiting
      expect(endTime - startTime).toBeGreaterThan(1000);
    });

    test('should handle connection timeouts', async () => {
      // Create client with short timeout
      const timeoutClient = new MCPClient({
        serverUrl: `http://localhost:${server.port}`,
        timeout: 100 // 100ms timeout
      });
      
      await expect(timeoutClient.request('tools/call', {
        name: 'slow_operation', // Simulate slow operation
        arguments: {}
      })).rejects.toThrow('Timeout');
      
      await timeoutClient.disconnect();
    });
  });

  describe('Security and Authentication', () => {
    test('should validate client capabilities', async () => {
      const restrictedClient = new MCPClient({
        serverUrl: `http://localhost:${server.port}`,
        capabilities: { tools: false } // No tool access
      });
      
      await expect(restrictedClient.request('tools/call', {
        name: 'database_query',
        arguments: {}
      })).rejects.toThrow('Insufficient capabilities');
      
      await restrictedClient.disconnect();
    });

    test('should sanitize input parameters', async () => {
      const maliciousInput = {
        collection: 'test'; DROP TABLE documents; --',
        query: { $where: 'function() { while(1); }' }
      };
      
      const response = await client.request('tools/call', {
        name: 'database_query',
        arguments: maliciousInput
      });
      
      expect(response.isError).toBe(true);
      expect(response.content).toContain('Invalid input');
    });
  });
});