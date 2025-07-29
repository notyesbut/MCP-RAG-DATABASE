/**
 * Test mocks for integration tests
 */

import { jest } from '@jest/globals';
import { MCPRegistry } from '../../src/mcp/registry/MCPRegistry';
import { RAG1Controller } from '../../src/rag/ingest/rag1';
import { RAG2Controller } from '../../src/rag/query/rag2';

export function createMockMCPRegistry() {
  return {
    createMCP: jest.fn(),
    getMCP: jest.fn(),
    getAllMCPs: jest.fn(),
    removeMCP: jest.fn(),
    updateMCPConfig: jest.fn(),
    listMCPs: jest.fn()
  };
}

export function createMockRAG1Controller() {
  return {
    ingest: jest.fn().mockResolvedValue({ 
      recordId: 'test-record-id',
      success: true,
      mcpTarget: 'test-mcp',
      processingTime: 100
    }),
    ingestBatch: jest.fn().mockResolvedValue({ 
      success: true,
      successCount: 2,
      errorCount: 0,
      records: [],
      errors: [],
      totalProcessingTime: 200
    }),
    getMetrics: jest.fn().mockResolvedValue({ 
      totalIngested: 100,
      totalClassified: 100,
      totalRouted: 100,
      averageProcessingTime: 50,
      avgIngestionTime: 50,
      ingestionsPerSecond: 10,
      classificationAccuracy: 0.95,
      routingSuccessRate: 0.98,
      dynamicMCPsCreated: 5,
      patternsLearned: 20,
      errors: 0
    }),
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true)
  };
}

export function createMockRAG2Controller() {
  return {
    query: jest.fn().mockResolvedValue({ 
      success: true,
      results: [],
      totalResults: 0,
      mcpSources: [],
      processingTime: 100,
      confidence: 0.95
    }),
    queryBulk: jest.fn().mockResolvedValue([]),
    getQueryHistory: jest.fn().mockResolvedValue({ queries: [] }),
    getMetrics: jest.fn().mockResolvedValue({
      totalQueries: 100,
      averageResponseTime: 50,
      querySuccessRate: 0.98,
      cacheHitRate: 0.6
    })
  };
}