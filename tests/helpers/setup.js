/**
 * Global Test Setup for Enterprise Multi-MCP Smart Database System
 * Configures test environment, mocks, and utilities
 */

const { jest } = require('@jest/globals');
const path = require('path');
const fs = require('fs').promises;

// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.MCP_TEST_MODE = 'true';

// Global test utilities
global.testHelpers = {
  // Database helpers
  async createTestDatabase() {
    const { Database } = require('../../src/core/database');
    const db = new Database(':memory:');
    await db.initialize();
    return db;
  },

  // MCP Server helpers
  async createTestMCPServer(config = {}) {
    const { MCPServer } = require('../../src/mcp/server');
    return new MCPServer({
      port: 0, // Random port for testing
      ...config
    });
  },

  // Mock data generators
  generateTestRecord(overrides = {}) {
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: `Test Record ${Date.now()}`,
      data: { test: true, timestamp: Date.now() },
      created_at: new Date().toISOString(),
      ...overrides
    };
  },

  generateBulkTestData(count = 100, overrides = {}) {
    return Array.from({ length: count }, (_, i) => 
      this.generateTestRecord({ 
        name: `Test Record ${i}`,
        index: i,
        ...overrides 
      })
    );
  },

  // Performance measurement
  async measurePerformance(fn, iterations = 1) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      results.push(Number(end - start) / 1_000_000); // Convert to milliseconds
    }
    
    return {
      min: Math.min(...results),
      max: Math.max(...results),
      avg: results.reduce((a, b) => a + b, 0) / results.length,
      median: results.sort((a, b) => a - b)[Math.floor(results.length / 2)],
      results
    };
  },

  // Memory usage tracking
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100
    };
  },

  // Test data cleanup
  async cleanup() {
    // Clean up test databases
    // Clean up temporary files
    // Reset global state
  }
};

// Mock console methods in test environment to reduce noise
if (process.env.JEST_QUIET === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: console.warn,
    error: console.error
  };
}

// Jest custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHavePerformanceUnder(received, maxTime) {
    const pass = received.avg < maxTime;
    if (pass) {
      return {
        message: () => `expected average time ${received.avg}ms not to be under ${maxTime}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected average time ${received.avg}ms to be under ${maxTime}ms`,
        pass: false,
      };
    }
  }
});

// Global beforeEach setup
beforeEach(async () => {
  // Reset any global state
  jest.clearAllMocks();
});

// Global afterEach cleanup
afterEach(async () => {
  await global.testHelpers.cleanup();
});