/**
 * Aggregation Strategy Types for RAG₂ Aggregator
 */

/**
 * Aggregation strategy enum for the aggregator
 */
export enum AggregationStrategyType {
  MERGE = 'merge',
  DEDUPLICATE = 'deduplicate',
  PRIORITIZE_HOT = 'prioritize_hot',
  TIME_ORDERED = 'time_ordered',
  WEIGHTED_AVERAGE = 'weighted_average',
  STATISTICAL_SUMMARY = 'statistical_summary',
  CROSS_REFERENCE = 'cross_reference'
}

/**
 * Query learning data interface
 */
export interface QueryLearning {
  patterns: {
    frequency: Record<string, number>;
    userPatterns: Record<string, any>;
    temporalPatterns: any[];
  };
  performance: {
    avgQueryTime: Record<string, number>;
    optimalMCPRouting: Record<string, string[]>;
    bottlenecks: string[];
  };
  optimizations: {
    suggestedIndexes: string[];
    cacheOpportunities: string[];
    mcpReorganization: string[];
  };
}