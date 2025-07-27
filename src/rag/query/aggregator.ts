/**
 * RAG₂ Result Aggregator
 * Intelligently combines results from multiple MCPs into unified responses
 */

import { QueryResult, QueryError, QueryWarning } from '../../types/query.types';
import { AggregationStrategyType, QueryLearning } from './aggregator.types';

export interface MCPResult {
  mcpId: string;
  success: boolean;
  data: any[];
  metadata: {
    recordCount: number;
    queryTime: number;
    cacheHit: boolean;
    error?: string;
  };
  queryFragment: any;
}

export class ResultAggregator {
  private learningData: QueryLearning;
  private cacheStore: Map<string, any> = new Map();

  constructor() {
    this.learningData = this.initializeLearningData();
  }

  /**
   * Aggregate results from multiple MCPs using the specified strategy
   */
  async aggregateResults(
    mcpResults: MCPResult[],
    strategy: string,
    executionId: string,
    originalQuery: string
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    // Filter successful results
    const successfulResults = mcpResults.filter(result => result.success);
    const failedResults = mcpResults.filter(result => !result.success);
    
    // Apply aggregation strategy
    const aggregatedData = await this.applyAggregationStrategy(successfulResults, strategy);
    
    // Calculate metadata
    const metadata = this.calculateAggregationMetadata(successfulResults, strategy);
    
    // Generate insights
    const insights = this.generateInsights(successfulResults, strategy, originalQuery);
    
    // Handle errors from failed MCPs
    const errors = this.handleErrors(failedResults);
    
    // Calculate caching information
    const caching = this.calculateCachingInfo(mcpResults, executionId);
    
    // Update learning data
    this.updateLearningData(successfulResults, strategy, Date.now() - startTime);

    return {
      executionId,
      success: successfulResults.length > 0,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      results: aggregatedData,
      metadata,
      insights,
      errors: errors.length > 0 ? errors : undefined,
      caching
    };
  }

  /**
   * Apply the specified aggregation strategy
   */
  private async applyAggregationStrategy(
    results: MCPResult[], 
    strategy: string
  ): Promise<any[]> {
    switch (strategy) {
      case AggregationStrategyType.MERGE:
        return this.mergeResults(results);
      
      case AggregationStrategyType.DEDUPLICATE:
        return this.deduplicateResults(results);
      
      case AggregationStrategyType.PRIORITIZE_HOT:
        return this.prioritizeHotResults(results);
      
      case AggregationStrategyType.TIME_ORDERED:
        return this.timeOrderedResults(results);
      
      case AggregationStrategyType.WEIGHTED_AVERAGE:
        return this.weightedAverageResults(results);
      
      case AggregationStrategyType.STATISTICAL_SUMMARY:
        return this.statisticalSummaryResults(results);
      
      case AggregationStrategyType.CROSS_REFERENCE:
        return this.crossReferenceResults(results);
      
      default:
        return this.mergeResults(results);
    }
  }

  /**
   * Simple merge strategy - combine all results
   */
  private mergeResults(results: MCPResult[]): any[] {
    const merged: any[] = [];
    
    for (const result of results) {
      if (Array.isArray(result.data)) {
        merged.push(...result.data);
      } else {
        merged.push(result.data);
      }
    }
    
    return merged;
  }

  /**
   * Deduplicate strategy - remove duplicate entries
   */
  private deduplicateResults(results: MCPResult[]): any[] {
    const merged = this.mergeResults(results);
    const seen = new Set();
    const deduplicated: any[] = [];
    
    for (const item of merged) {
      // Create unique key based on item properties
      const key = this.createDeduplicationKey(item);
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }
    
    return deduplicated;
  }

  /**
   * Prioritize hot MCP results
   */
  private prioritizeHotResults(results: MCPResult[]): any[] {
    // Sort results by MCP type (hot first)
    const sorted = results.sort((a, b) => {
      const aIsHot = a.mcpId.includes('hot') || a.metadata.queryTime < 100;
      const bIsHot = b.mcpId.includes('hot') || b.metadata.queryTime < 100;
      
      if (aIsHot && !bIsHot) return -1;
      if (!aIsHot && bIsHot) return 1;
      return 0;
    });
    
    return this.mergeResults(sorted);
  }

  /**
   * Time-ordered strategy - sort by timestamp
   */
  private timeOrderedResults(results: MCPResult[]): any[] {
    const merged = this.mergeResults(results);
    
    return merged.sort((a, b) => {
      const timeA = a.timestamp || a.created_at || a.date || 0;
      const timeB = b.timestamp || b.created_at || b.date || 0;
      return timeB - timeA; // Newest first
    });
  }

  /**
   * Weighted average for numerical data
   */
  private weightedAverageResults(results: MCPResult[]): any[] {
    const aggregated: Record<string, any> = {};
    const weights: Record<string, number> = {};
    
    // Calculate weights based on MCP performance and reliability
    for (const result of results) {
      const weight = this.calculateMCPWeight(result);
      weights[result.mcpId] = weight;
    }
    
    // Aggregate numerical fields
    for (const result of results) {
      const weight = weights[result.mcpId];
      
      for (const item of result.data) {
        for (const [key, value] of Object.entries(item)) {
          if (typeof value === 'number') {
            if (!aggregated[key]) {
              aggregated[key] = { sum: 0, totalWeight: 0 };
            }
            aggregated[key].sum += value * weight;
            aggregated[key].totalWeight += weight;
          }
        }
      }
    }
    
    // Convert to final values
    const finalResults: any[] = [];
    for (const [key, agg] of Object.entries(aggregated)) {
      finalResults.push({
        field: key,
        weightedAverage: agg.sum / agg.totalWeight,
        confidence: Math.min(agg.totalWeight / results.length, 1.0)
      });
    }
    
    return finalResults;
  }

  /**
   * Statistical summary for analytical queries
   */
  private statisticalSummaryResults(results: MCPResult[]): any[] {
    const allData = this.mergeResults(results);
    const summary: any = {
      totalRecords: allData.length,
      sources: results.map(r => ({
        mcpId: r.mcpId,
        recordCount: r.metadata.recordCount,
        contribution: (r.metadata.recordCount / allData.length * 100).toFixed(2) + '%'
      })),
      statistics: {}
    };
    
    // Calculate statistics for numerical fields
    const numericalFields = this.identifyNumericalFields(allData);
    
    for (const field of numericalFields) {
      const values = allData
        .map(item => item[field])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        summary.statistics[field] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          median: this.calculateMedian(values)
        };
      }
    }
    
    return [summary];
  }

  /**
   * Cross-reference strategy for complex relationships
   */
  private crossReferenceResults(results: MCPResult[]): any[] {
    const crossReferenced: any[] = [];
    const referenceMap = new Map();
    
    // Build reference map
    for (const result of results) {
      for (const item of result.data) {
        const key = this.extractReferenceKey(item);
        if (key) {
          if (!referenceMap.has(key)) {
            referenceMap.set(key, { primary: null, references: [] });
          }
          
          const entry = referenceMap.get(key);
          if (result.mcpId.includes('primary') || !entry.primary) {
            entry.primary = { ...item, source: result.mcpId };
          } else {
            entry.references.push({ ...item, source: result.mcpId });
          }
        }
      }
    }
    
    // Build cross-referenced results
    for (const [key, data] of referenceMap.entries()) {
      if (data.primary) {
        crossReferenced.push({
          ...data.primary,
          crossReferences: data.references,
          referenceKey: key,
          referenceCount: data.references.length
        });
      }
    }
    
    return crossReferenced;
  }

  /**
   * Calculate aggregation metadata
   */
  private calculateAggregationMetadata(results: MCPResult[], strategy: string) {
    const totalRecords = results.reduce((sum, r) => sum + r.metadata.recordCount, 0);
    
    return {
      totalRecords,
      sources: results.map(r => ({
        mcpId: r.mcpId,
        recordCount: r.metadata.recordCount,
        queryTime: r.metadata.queryTime,
        cacheHit: r.metadata.cacheHit
      })),
      aggregationApplied: strategy
    };
  }

  /**
   * Generate insights about the aggregation process
   */
  private generateInsights(
    results: MCPResult[], 
    strategy: string, 
    originalQuery: string
  ): QueryResult['insights'] {
    const totalTime = results.reduce((sum, r) => sum + r.metadata.queryTime, 0);
    const cacheHits = results.filter(r => r.metadata.cacheHit).length;
    const cacheHitRate = (cacheHits / results.length * 100).toFixed(1);
    
    const performanceNotes: string[] = [];
    const suggestions: string[] = [];
    
    // Performance analysis
    if (totalTime > 1000) {
      performanceNotes.push('Query took longer than 1 second - consider optimization');
    }
    
    if (cacheHits === 0) {
      performanceNotes.push('No cache hits - results will be cached for future queries');
    }
    
    const slowMCPs = results.filter(r => r.metadata.queryTime > 500);
    if (slowMCPs.length > 0) {
      performanceNotes.push(`Slow MCPs detected: ${slowMCPs.map(r => r.mcpId).join(', ')}`);
    }
    
    // Suggestions based on query patterns
    if (strategy === AggregationStrategyType.MERGE && results.length > 3) {
      suggestions.push('Consider using deduplicate strategy for large multi-MCP queries');
    }
    
    if (originalQuery.includes('recent') || originalQuery.includes('today')) {
      suggestions.push('Hot MCP prioritization could improve performance for recent data queries');
    }
    
    // Learning patterns
    const learnedPatterns = this.identifyLearnedPatterns(originalQuery, results);
    
    return {
      interpretation: `Aggregated ${results.length} MCP results using ${strategy} strategy`,
      performanceNotes,
      suggestions,
      learnedPatterns
    };
  }

  /**
   * Handle errors from failed MCPs
   */
  private handleErrors(failedResults: MCPResult[]): QueryError[] {
    return failedResults.map(result => ({
      mcpId: result.mcpId,
      error: result.metadata.error || 'Unknown error',
      severity: this.determineSeverity(result),
      handlingStrategy: this.determineHandlingStrategy(result)
    }));
  }

  /**
   * Calculate caching information
   */
  private calculateCachingInfo(results: MCPResult[], executionId: string): QueryResult['caching'] {
    const cacheHits = results.filter(r => r.metadata.cacheHit).length;
    const cacheHitRate = cacheHits / results.length;
    
    return {
      cached: cacheHitRate > 0,
      cacheKey: `agg_${executionId}`,
      cacheTTL: this.calculateCacheTTL(results),
      cacheHitRate: cacheHitRate
    };
  }

  /**
   * Update learning data for future optimizations
   */
  private updateLearningData(results: MCPResult[], strategy: string, duration: number): void {
    // Update performance data
    for (const result of results) {
      const mcpPerf = this.learningData.performance.avgQueryTime[result.mcpId as keyof typeof this.learningData.performance.avgQueryTime];
      if (mcpPerf) {
        // Moving average
        this.learningData.performance.avgQueryTime[result.mcpId as keyof typeof this.learningData.performance.avgQueryTime] = 
          (mcpPerf + result.metadata.queryTime) / 2;
      }
    }
    
    // Update strategy effectiveness
    // This would be expanded with more sophisticated learning algorithms
  }

  /**
   * Utility methods
   */
  private createDeduplicationKey(item: any): string {
    // Create a deterministic key for deduplication
    if (item.id) return `id_${item.id}`;
    if (item.email) return `email_${item.email}`;
    if (item.token) return `token_${item.token}`;
    
    // Fallback to content hash
    return JSON.stringify(item);
  }

  private calculateMCPWeight(result: MCPResult): number {
    let weight = 1.0;
    
    // Weight based on performance
    if (result.metadata.queryTime < 100) weight += 0.3;
    else if (result.metadata.queryTime > 1000) weight -= 0.3;
    
    // Weight based on cache hit
    if (result.metadata.cacheHit) weight += 0.2;
    
    // Weight based on record count (more data = more weight)
    if (result.metadata.recordCount > 100) weight += 0.2;
    
    return Math.max(weight, 0.1); // Minimum weight
  }

  private identifyNumericalFields(data: any[]): string[] {
    const fields = new Set<string>();
    
    for (const item of data.slice(0, 10)) { // Sample first 10 items
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'number' && !isNaN(value)) {
          fields.add(key);
        }
      }
    }
    
    return Array.from(fields);
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private extractReferenceKey(item: any): string | null {
    // Extract key for cross-referencing
    if (item.userId) return `user_${item.userId}`;
    if (item.token) return `token_${item.token}`;
    if (item.sessionId) return `session_${item.sessionId}`;
    
    return null;
  }

  private determineSeverity(result: MCPResult): 'warning' | 'error' | 'critical' {
    const error = result.metadata.error || '';
    
    if (error.includes('timeout') || error.includes('network')) return 'warning';
    if (error.includes('authorization') || error.includes('forbidden')) return 'error';
    if (error.includes('critical') || error.includes('down')) return 'critical';
    
    return 'error';
  }

  private determineHandlingStrategy(result: MCPResult): string {
    const severity = this.determineSeverity(result);
    
    switch (severity) {
      case 'warning':
        return 'Retry with increased timeout';
      case 'error':
        return 'Skip this MCP and continue with others';
      case 'critical':
        return 'Fallback to alternative MCP';
      default:
        return 'Log and continue';
    }
  }

  private calculateCacheTTL(results: MCPResult[]): number {
    // Calculate cache TTL based on data freshness requirements
    const hasRecentData = results.some(r => 
      r.queryFragment.type?.includes('recent') || 
      r.metadata.queryTime < 50
    );
    
    return hasRecentData ? 300 : 3600; // 5 minutes for recent, 1 hour for others
  }

  private identifyLearnedPatterns(query: string, results: MCPResult[]): string[] {
    const patterns: string[] = [];
    
    // Pattern: Multi-MCP queries with specific data types
    if (results.length > 1) {
      patterns.push(`Multi-MCP pattern: ${results.map(r => r.mcpId).join(' + ')}`);
    }
    
    // Pattern: Performance characteristics
    const avgTime = results.reduce((sum, r) => sum + r.metadata.queryTime, 0) / results.length;
    if (avgTime < 100) {
      patterns.push('Fast query pattern detected');
    }
    
    return patterns;
  }

  private initializeLearningData(): QueryLearning {
    return {
      patterns: {
        frequency: {},
        userPatterns: {},
        temporalPatterns: []
      },
      performance: {
        avgQueryTime: {
          users: 100,
          messages: 150,
          stats: 200,
          logs: 300,
          chats: 120,
          tokens: 50,
          sessions: 80,
          events: 250,
          metrics: 180,
          files: 400
        },
        optimalMCPRouting: {},
        bottlenecks: []
      },
      optimizations: {
        suggestedIndexes: [],
        cacheOpportunities: [],
        mcpReorganization: []
      }
    };
  }

  /**
   * Get learning insights for system optimization
   */
  getLearningInsights(): QueryLearning {
    return this.learningData;
  }

  /**
   * Reset learning data (for testing or relearning)
   */
  resetLearningData(): void {
    this.learningData = this.initializeLearningData();
    this.cacheStore.clear();
  }
}