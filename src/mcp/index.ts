/**
 * MCP System - Main Export Index
 * Enterprise Multi-MCP Smart Database System
 */

// Core Components
export { BaseMCP, MCPType, MCPTier, MCPStatus, MCPQuery, MCPResult, MCPMetadata, MCPPerformance, MCPQueryOptions } from './core/BaseMCP';

// Registry System
export { MCPRegistry, MCPRegistryConfig, MCPCreationRequest, MCPRegistryStats } from './registry/MCPRegistry';

// Classification System
export { 
  TierClassifier, 
  ClassificationCriteria, 
  ClassificationResult, 
  TierThresholds, 
  AccessPattern,
  AggregationType
} from './classification/TierClassifier';

// Migration System
export { 
  MCPMigrationEngine, 
  MigrationPlan, 
  MigrationStrategy, 
  MigrationPriority, 
  MigrationProgress, 
  MigrationStatus, 
  MigrationPhase,
  RollbackPlan
} from './migration/MCPMigrationEngine';

// Communication System
export { 
  MCPCommunicationHub, 
  MCPMessage, 
  MCPMessageType, 
  MessagePriority, 
  DistributedQuery, 
  QueryDistributionStrategy, 
  QueryResult,
  MCPTopology,
  MCPNodeInfo
} from './communication/MCPCommunicationHub';

// Main Orchestrator
export { 
  MCPOrchestrator, 
  MCPOrchestratorConfig, 
  SystemMetrics, 
  Alert, 
  AlertLevel 
} from './MCPOrchestrator';

// Re-export aggregation type from classification for convenience
export { AggregationType as QueryAggregationType } from './classification/TierClassifier';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { MCPOrchestrator, MCPType, MCPTier } from './mcp';
 * 
 * // Initialize the orchestrator
 * const orchestrator = new MCPOrchestrator({
 *   registry: { maxMCPs: 50 },
 *   autoClassification: { enabled: true, interval: 3600000 },
 *   autoMigration: { enabled: true, maxConcurrent: 3 }
 * });
 * 
 * await orchestrator.initialize();
 * 
 * // Create an MCP
 * const mcpId = await orchestrator.createMCP({
 *   name: 'UserData',
 *   type: MCPType.VECTOR,
 *   tier: MCPTier.HOT,
 *   tags: ['users', 'embeddings']
 * });
 * 
 * // Execute a query
 * const result = await orchestrator.executeQuery({
 *   id: 'query-1',
 *   type: 'similarity_search',
 *   query: { vector: [0.1, 0.2, 0.3] },
 *   options: { limit: 10, similarity: 0.8 }
 * });
 * ```
 */