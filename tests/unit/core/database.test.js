/**
 * Unit Tests for Core Database Operations
 * Tests all CRUD operations, indexing, transactions, and edge cases
 */

const { Database } = require('../../../src/core/database');
const path = require('path');

describe('Database Core Operations', () => {
  let db;

  beforeEach(async () => {
    db = await global.testHelpers.createTestDatabase();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('Database Initialization', () => {
    test('should initialize with in-memory database', async () => {
      expect(db).toBeDefined();
      expect(db.isInitialized()).toBe(true);
    });

    test('should create required tables on initialization', async () => {
      const tables = await db.getTables();
      expect(tables).toContain('documents');
      expect(tables).toContain('indexes');
      expect(tables).toContain('metadata');
    });

    test('should handle initialization errors gracefully', async () => {
      const invalidDb = new Database('/invalid/path/to/database.db');
      await expect(invalidDb.initialize()).rejects.toThrow();
    });
  });

  describe('CRUD Operations', () => {
    describe('Create Operations', () => {
      test('should insert single document', async () => {
        const doc = global.testHelpers.generateTestRecord();
        const result = await db.insert('test_collection', doc);
        
        expect(result.id).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.insertedCount).toBe(1);
      });

      test('should insert multiple documents in batch', async () => {
        const docs = global.testHelpers.generateBulkTestData(100);
        const result = await db.insertMany('test_collection', docs);
        
        expect(result.success).toBe(true);
        expect(result.insertedCount).toBe(100);
        expect(result.ids).toHaveLength(100);
      });

      test('should validate document structure before insertion', async () => {
        const invalidDoc = { invalid: 'structure' };
        await expect(db.insert('test_collection', invalidDoc, {
          validate: true,
          schema: { required: ['name', 'data'] }
        })).rejects.toThrow('Validation failed');
      });

      test('should handle duplicate key errors', async () => {
        const doc = global.testHelpers.generateTestRecord({ id: 'duplicate-test' });
        await db.insert('test_collection', doc);
        
        await expect(db.insert('test_collection', doc))
          .rejects.toThrow('Duplicate key');
      });
    });

    describe('Read Operations', () => {
      beforeEach(async () => {
        // Insert test data
        const testDocs = global.testHelpers.generateBulkTestData(50);
        await db.insertMany('test_collection', testDocs);
      });

      test('should find documents by simple query', async () => {
        const results = await db.find('test_collection', { 'data.test': true });
        expect(results).toHaveLength(50);
      });

      test('should find documents with complex queries', async () => {
        const results = await db.find('test_collection', {
          $and: [
            { 'data.test': true },
            { index: { $gte: 25 } }
          ]
        });
        expect(results.length).toBeGreaterThan(0);
      });

      test('should support pagination', async () => {
        const page1 = await db.find('test_collection', {}, { 
          limit: 10, 
          offset: 0 
        });
        const page2 = await db.find('test_collection', {}, { 
          limit: 10, 
          offset: 10 
        });
        
        expect(page1).toHaveLength(10);
        expect(page2).toHaveLength(10);
        expect(page1[0].id).not.toBe(page2[0].id);
      });

      test('should support sorting', async () => {
        const results = await db.find('test_collection', {}, {
          sort: { index: -1 },
          limit: 5
        });
        
        expect(results[0].index).toBeGreaterThan(results[1].index);
      });

      test('should count documents', async () => {
        const count = await db.count('test_collection', { 'data.test': true });
        expect(count).toBe(50);
      });

      test('should find single document by ID', async () => {
        const allDocs = await db.find('test_collection', {});
        const firstDoc = allDocs[0];
        
        const foundDoc = await db.findById('test_collection', firstDoc.id);
        expect(foundDoc.id).toBe(firstDoc.id);
      });
    });

    describe('Update Operations', () => {
      let testDocId;

      beforeEach(async () => {
        const doc = global.testHelpers.generateTestRecord();
        const result = await db.insert('test_collection', doc);
        testDocId = result.id;
      });

      test('should update single document', async () => {
        const result = await db.update('test_collection', 
          { id: testDocId },
          { $set: { 'data.updated': true } }
        );
        
        expect(result.modifiedCount).toBe(1);
        
        const updated = await db.findById('test_collection', testDocId);
        expect(updated.data.updated).toBe(true);
      });

      test('should update multiple documents', async () => {
        // Insert more test data
        await db.insertMany('test_collection', 
          global.testHelpers.generateBulkTestData(10, { category: 'bulk_update' })
        );
        
        const result = await db.updateMany('test_collection',
          { category: 'bulk_update' },
          { $set: { updated_at: new Date().toISOString() } }
        );
        
        expect(result.modifiedCount).toBe(10);
      });

      test('should support upsert operations', async () => {
        const result = await db.update('test_collection',
          { id: 'non-existent-id' },
          { $set: { name: 'Upserted Document' } },
          { upsert: true }
        );
        
        expect(result.upsertedCount).toBe(1);
        expect(result.upsertedId).toBeDefined();
      });

      test('should validate update operations', async () => {
        await expect(db.update('test_collection',
          { id: testDocId },
          { $invalid: 'operation' }
        )).rejects.toThrow('Invalid update operation');
      });
    });

    describe('Delete Operations', () => {
      let testDocs;

      beforeEach(async () => {
        testDocs = global.testHelpers.generateBulkTestData(20);
        await db.insertMany('test_collection', testDocs);
      });

      test('should delete single document', async () => {
        const docToDelete = testDocs[0];
        const result = await db.delete('test_collection', { id: docToDelete.id });
        
        expect(result.deletedCount).toBe(1);
        
        const deleted = await db.findById('test_collection', docToDelete.id);
        expect(deleted).toBeNull();
      });

      test('should delete multiple documents', async () => {
        const result = await db.deleteMany('test_collection', {
          index: { $gte: 10 }
        });
        
        expect(result.deletedCount).toBeGreaterThan(0);
      });

      test('should handle cascade deletes', async () => {
        // Create related documents
        await db.insert('related_collection', {
          parent_id: testDocs[0].id,
          data: 'related data'
        });
        
        const result = await db.delete('test_collection', 
          { id: testDocs[0].id },
          { cascade: ['related_collection'] }
        );
        
        expect(result.cascadeDeleted).toBeDefined();
      });
    });
  });

  describe('Indexing Operations', () => {
    beforeEach(async () => {
      await db.insertMany('indexed_collection', 
        global.testHelpers.generateBulkTestData(1000)
      );
    });

    test('should create single field index', async () => {
      const result = await db.createIndex('indexed_collection', { name: 1 });
      expect(result.success).toBe(true);
      expect(result.indexName).toBeDefined();
    });

    test('should create compound index', async () => {
      const result = await db.createIndex('indexed_collection', {
        name: 1,
        'data.timestamp': -1
      });
      expect(result.success).toBe(true);
    });

    test('should create text index for full-text search', async () => {
      const result = await db.createIndex('indexed_collection', {
        name: 'text',
        'data.$**': 'text'
      });
      expect(result.success).toBe(true);
    });

    test('should improve query performance with indexes', async () => {
      // Measure performance without index
      const withoutIndex = await global.testHelpers.measurePerformance(
        () => db.find('indexed_collection', { name: 'Test Record 500' }),
        10
      );
      
      // Create index
      await db.createIndex('indexed_collection', { name: 1 });
      
      // Measure performance with index
      const withIndex = await global.testHelpers.measurePerformance(
        () => db.find('indexed_collection', { name: 'Test Record 500' }),
        10
      );
      
      expect(withIndex.avg).toBeLessThan(withoutIndex.avg);
    });

    test('should list all indexes', async () => {
      await db.createIndex('indexed_collection', { name: 1 });
      await db.createIndex('indexed_collection', { 'data.timestamp': -1 });
      
      const indexes = await db.getIndexes('indexed_collection');
      expect(indexes.length).toBeGreaterThanOrEqual(2);
    });

    test('should drop indexes', async () => {
      const createResult = await db.createIndex('indexed_collection', { name: 1 });
      const dropResult = await db.dropIndex('indexed_collection', createResult.indexName);
      
      expect(dropResult.success).toBe(true);
    });
  });

  describe('Transaction Operations', () => {
    test('should execute simple transaction', async () => {
      const result = await db.transaction(async (session) => {
        await session.insert('transaction_test', { step: 1 });
        await session.insert('transaction_test', { step: 2 });
        return { success: true };
      });
      
      expect(result.success).toBe(true);
      
      const docs = await db.find('transaction_test', {});
      expect(docs).toHaveLength(2);
    });

    test('should rollback on error', async () => {
      await expect(db.transaction(async (session) => {
        await session.insert('transaction_test', { step: 1 });
        throw new Error('Simulated error');
      })).rejects.toThrow('Simulated error');
      
      const docs = await db.find('transaction_test', {});
      expect(docs).toHaveLength(0);
    });

    test('should handle nested transactions', async () => {
      const result = await db.transaction(async (session) => {
        await session.insert('nested_test', { level: 1 });
        
        return await session.transaction(async (nestedSession) => {
          await nestedSession.insert('nested_test', { level: 2 });
          return { nested: true };
        });
      });
      
      expect(result.nested).toBe(true);
      
      const docs = await db.find('nested_test', {});
      expect(docs).toHaveLength(2);
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large dataset operations efficiently', async () => {
      const largeDataset = global.testHelpers.generateBulkTestData(10000);
      
      const insertPerf = await global.testHelpers.measurePerformance(
        () => db.insertMany('performance_test', largeDataset)
      );
      
      expect(insertPerf).toHavePerformanceUnder(5000); // 5 seconds max
    });

    test('should not leak memory during operations', async () => {
      const initialMemory = global.testHelpers.getMemoryUsage();
      
      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        const data = global.testHelpers.generateBulkTestData(1000);
        await db.insertMany('memory_test', data);
        await db.find('memory_test', {});
        await db.deleteMany('memory_test', {});
      }
      
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      const finalMemory = global.testHelpers.getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
});