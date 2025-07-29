/**
 * MCP Test Fixtures
 * 
 * Provides pre-configured MCP instances and fixtures for testing.
 */

import { TestDataGenerator } from './test_data';

// Use any type for test fixtures since actual types may not be fully implemented
type MCPMetadata = any;

export class MCPFixtures {
  /**
   * Hot MCP fixtures for high-frequency data
   */
  static getHotMCPFixtures(): MCPMetadata[] {
    return [
      TestDataGenerator.createMCPMetadata({
        id: 'user-mcp-hot-001',
        domain: 'users',
        type: 'hot',
        performanceTier: 'premium',
        accessFrequency: 1000,
        recordCount: 50000,
        averageRecordSize: 2048,
        indexStrategies: ['btree', 'hash', 'bitmap'],
        configuration: {
          ...TestDataGenerator.createMCPConfiguration(),
          maxRecords: 100000,
          cacheSize: 128,
          connectionPoolSize: 20
        }
      }),
      
      TestDataGenerator.createMCPMetadata({
        id: 'chat-mcp-hot-001',
        domain: 'messages',
        type: 'hot',
        performanceTier: 'premium',
        accessFrequency: 800,
        recordCount: 100000,
        averageRecordSize: 1024,
        indexStrategies: ['btree', 'fulltext'],
        configuration: {
          ...TestDataGenerator.createMCPConfiguration(),
          maxRecords: 200000,
          cacheSize: 256,
          connectionPoolSize: 15
        }
      }),
      
      TestDataGenerator.createMCPMetadata({
        id: 'stats-mcp-hot-001',
        domain: 'analytics',
        type: 'hot',
        performanceTier: 'standard',
        accessFrequency: 500,
        recordCount: 75000,
        averageRecordSize: 512,
        indexStrategies: ['btree', 'timeseries'],
        configuration: {
          ...TestDataGenerator.createMCPConfiguration(),
          maxRecords: 150000,
          cacheSize: 64,
          connectionPoolSize: 10
        }
      })
    ];
  }

  /**
   * Cold MCP fixtures for archival data
   */
  static getColdMCPFixtures(): MCPMetadata[] {
    return [
      TestDataGenerator.createMCPMetadata({
        id: 'logs-mcp-cold-001',
        domain: 'logs',
        type: 'cold',
        performanceTier: 'economy',
        accessFrequency: 10,
        recordCount: 500000,
        averageRecordSize: 2048,
        indexStrategies: ['btree'],
        configuration: {
          ...TestDataGenerator.createMCPConfiguration(),
          maxRecords: 1000000,
          cacheSize: 32,
          connectionPoolSize: 5,
          compressionEnabled: true
        }
      }),
      
      TestDataGenerator.createMCPMetadata({
        id: 'archive-mcp-cold-001',
        domain: 'archive',
        type: 'cold',
        performanceTier: 'economy',
        accessFrequency: 5,
        recordCount: 1000000,
        averageRecordSize: 4096,
        indexStrategies: ['btree'],
        configuration: {
          ...TestDataGenerator.createMCPConfiguration(),
          maxRecords: 2000000,
          cacheSize: 16,
          connectionPoolSize: 3,
          compressionEnabled: true,
          backupFrequency: 168 // Weekly
        }
      })
    ];
  }

  /**
   * Mixed MCP fixtures for testing scaling
   */
  static getMixedMCPFixtures(): MCPMetadata[] {
    return [
      ...MCPFixtures.getHotMCPFixtures(),
      ...MCPFixtures.getColdMCPFixtures(),
      
      // Transitional MCPs
      TestDataGenerator.createMCPMetadata({
        id: 'transition-mcp-001',
        domain: 'events',
        type: 'hot',
        performanceTier: 'standard',
        accessFrequency: 50, // Low for hot MCP - candidate for migration
        recordCount: 25000,
        configuration: {
          ...TestDataGenerator.createMCPConfiguration(),
          maxRecords: 50000
        }
      })
    ];
  }

  /**
   * Create MCP fixture with specific characteristics
   */
  static createCustomMCP(
    domain: string,
    type: 'hot' | 'cold',
    characteristics: {
      accessFrequency?: number;
      recordCount?: number;
      performanceTier?: 'economy' | 'standard' | 'premium';
    } = {}
  ): MCPMetadata {
    const defaults = type === 'hot' 
      ? { accessFrequency: 500, recordCount: 50000, performanceTier: 'standard' as const }
      : { accessFrequency: 20, recordCount: 200000, performanceTier: 'economy' as const };

    return TestDataGenerator.createMCPMetadata({
      id: `${domain}-mcp-${type}-${Date.now()}`,
      domain,
      type,
      ...defaults,
      ...characteristics
    });
  }

  /**
   * Get MCPs by domain
   */
  static getMCPsByDomain(domain: string): MCPMetadata[] {
    const allFixtures = MCPFixtures.getMixedMCPFixtures();
    return allFixtures.filter(mcp => mcp.domain === domain);
  }

  /**
   * Get MCPs by type
   */
  static getMCPsByType(type: 'hot' | 'cold'): MCPMetadata[] {
    const allFixtures = MCPFixtures.getMixedMCPFixtures();
    return allFixtures.filter(mcp => mcp.type === type);
  }

  /**
   * Get MCPs by performance tier
   */
  static getMCPsByPerformanceTier(tier: 'economy' | 'standard' | 'premium'): MCPMetadata[] {
    const allFixtures = MCPFixtures.getMixedMCPFixtures();
    return allFixtures.filter(mcp => mcp.performanceTier === tier);
  }

  /**
   * Get MCPs that are candidates for migration (hot MCPs with low access frequency)
   */
  static getMigrationCandidates(threshold: number = 100): MCPMetadata[] {
    const hotMCPs = MCPFixtures.getMCPsByType('hot');
    return hotMCPs.filter(mcp => mcp.accessFrequency < threshold);
  }

  /**
   * Get MCPs that are candidates for promotion (cold MCPs with high access frequency)
   */
  static getPromotionCandidates(threshold: number = 100): MCPMetadata[] {
    const coldMCPs = MCPFixtures.getMCPsByType('cold');
    return coldMCPs.filter(mcp => mcp.accessFrequency > threshold);
  }

  /**
   * Create load testing fixture set
   */
  static createLoadTestFixtures(count: number): MCPMetadata[] {
    return Array.from({ length: count }, (_, index) => {
      const type = index % 3 === 0 ? 'cold' : 'hot';
      const domain = ['users', 'messages', 'logs', 'stats', 'events'][index % 5];
      
      return MCPFixtures.createCustomMCP(domain, type, {
        accessFrequency: TestDataGenerator.randomNumber(1, 1000),
        recordCount: TestDataGenerator.randomNumber(1000, 100000),
        performanceTier: TestDataGenerator.randomArrayElement(['economy', 'standard', 'premium'])
      });
    });
  }

  /**
   * Reset all fixtures to initial state
   */
  static resetFixtures(): void {
    // Reset any stateful fixture data
    console.log('🔄 MCP fixtures reset');
  }

  /**
   * Validate fixture integrity
   */
  static validateFixtures(fixtures: MCPMetadata[]): boolean {
    return fixtures.every(fixture => {
      return (
        fixture.id &&
        fixture.domain &&
        ['hot', 'cold'].includes(fixture.type) &&
        typeof fixture.accessFrequency === 'number' &&
        typeof fixture.recordCount === 'number' &&
        fixture.configuration &&
        fixture.metrics
      );
    });
  }
}

export default MCPFixtures;