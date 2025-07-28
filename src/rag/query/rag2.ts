/**
 * RAG₂ Main Controller
 * The revolutionary natural language interface that eliminates SQL forever
 */

import { 
  NaturalQuery, 
  InterpretedQuery, 
  QueryResult,
  QueryExecutionPlan,
  RAG2Config,
  MCPQueryCapability,
  QuerySource,
  QueryIntentDetails
} from '../../types/query.types';

import { NaturalLanguageParser } from './parser';
import { QueryExecutionPlanner } from './planner';
import { ResultAggregator, MCPResult } from './aggregator';
import { MCPRegistry } from '../../mcp/registry/MCPRegistry';

export class RAG2Controller {
  private parser: NaturalLanguageParser;
  private planner: QueryExecutionPlanner;
  private aggregator: ResultAggregator;
  private mcpRegistry: MCPRegistry;
  private config: RAG2Config;
  private queryCache: Map<string, QueryResult> = new Map();
  private queryHistory: Array<{ query: NaturalQuery; result: QueryResult; timestamp: number }> = [];

  constructor(mcpRegistry: MCPRegistry, config?: Partial<RAG2Config>) {
    this.mcpRegistry = mcpRegistry;
    this.config = this.initializeConfig(config);
    
    this.parser = new NaturalLanguageParser();
    this.planner = new QueryExecutionPlanner(mcpRegistry);
    this.aggregator = new ResultAggregator();
  }

  /**
   * Main entry point - process natural language query
   * This is where the magic happens - NO MORE SQL!
   */
  async query(query: string, context?: any, options?: any): Promise<QueryResult> {
    const naturalQuery: NaturalQuery = { 
      raw: query, 
      context,
      preferences: {
        responseFormat: options?.responseFormat || 'json',
        explanationLevel: options?.explanationLevel || 'basic',
        cachePreference: options?.cachePreference || 'smart',
        maxResults: options?.maxResults || 100
      }
    };
    return this.processNaturalQuery(naturalQuery);
  }

  async processNaturalQuery(query: NaturalQuery): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Check cache first
      const cacheKey = this.generateCacheKey(query);
      if (this.config.caching.enabled) {
        const cachedResult = this.queryCache.get(cacheKey);
        if (cachedResult) {
          return {
            ...cachedResult,
            caching: { ...cachedResult.caching, cached: true }
          };
        }
      }

      // Step 2: Parse natural language into structured query
      const interpretedQuery = await this.parser.parse(query);
      
      // Step 3: Create execution plan
      const executionPlan = await this.planner.createExecutionPlan(interpretedQuery);
      
      // Step 4: Execute plan across MCPs
      const mcpResults = await this.executeQueryPlan(executionPlan, interpretedQuery);
      
      // Step 5: Aggregate results
      const finalResult = await this.aggregator.aggregateResults(
        mcpResults,
        interpretedQuery.aggregationStrategy?.type || 'merge',
        executionPlan.executionId,
        query.raw
      );

      // Step 6: Cache result if enabled
      if (this.config.caching.enabled) {
        this.cacheResult(cacheKey, finalResult);
      }

      // Step 7: Learn from this query
      if (this.config.learning.enabled) {
        this.learnFromQuery(query, interpretedQuery, finalResult, Date.now() - startTime);
      }

      // Step 8: Store in history
      this.queryHistory.push({
        query,
        result: finalResult,
        timestamp: Date.now()
      });

      return finalResult;

    } catch (error) {
      // Handle errors gracefully
      return this.handleQueryError(query, error as Error, Date.now() - startTime);
    }
  }

  /**
   * Execute the query plan across multiple MCPs
   */
  private async executeQueryPlan(
    plan: QueryExecutionPlan,
    interpretedQuery: InterpretedQuery
  ): Promise<MCPResult[]> {
    const results: MCPResult[] = [];
    const errors: any[] = [];

    for (const phase of plan.phases) {
      if (phase.parallelizable) {
        // Execute MCPs in parallel
        const phasePromises = phase.mcpQueries.map(mcpQuery => 
          this.executeMCPQuery(mcpQuery.mcpId, mcpQuery.query)
        );

        try {
          const phaseResults = await Promise.allSettled(phasePromises);
          
          phaseResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              errors.push({
                mcpId: phase.mcpQueries[index].mcpId,
                error: result.reason,
                phase: phase.phase
              });
            }
          });
        } catch (error) {
          console.error(`Phase ${phase.phase} execution failed:`, error);
        }
      } else {
        // Execute MCPs sequentially
        for (const mcpQuery of phase.mcpQueries) {
          try {
            const result = await this.executeMCPQuery(mcpQuery.mcpId, mcpQuery.query);
            results.push(result);
          } catch (error) {
            errors.push({
              mcpId: mcpQuery.mcpId,
              error: error,
              phase: phase.phase
            });
            
            // Check if we should continue or fail
            if (this.isCriticalMCP(mcpQuery.mcpId, interpretedQuery)) {
              throw new Error(`Critical MCP ${mcpQuery.mcpId} failed: ${error}`);
            }
          }
        }
      }
    }

    // Handle partial failures
    if (results.length === 0 && errors.length > 0) {
      throw new Error(`All MCPs failed: ${errors.map(e => e.error).join(', ')}`);
    }

    return results;
  }

  /**
   * Execute query on a specific MCP
   */
  private async executeMCPQuery(mcpId: string, query: any): Promise<MCPResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the actual MCP client
      // For now, we'll simulate the MCP query execution
      const mcpClient = await this.getMCPClient(mcpId);
      const data = await mcpClient.query(query);
      
      return {
        mcpId,
        success: true,
        data: Array.isArray(data) ? data : [data],
        metadata: {
          recordCount: Array.isArray(data) ? data.length : 1,
          queryTime: Date.now() - startTime,
          cacheHit: false // MCP would provide this
        },
        queryFragment: query
      };
    } catch (error) {
      return {
        mcpId,
        success: false,
        data: [],
        metadata: {
          recordCount: 0,
          queryTime: Date.now() - startTime,
          cacheHit: false,
          error: (error as Error).message
        },
        queryFragment: query
      };
    }
  }

  /**
   * Get or create MCP client
   */
  private async getMCPClient(mcpId: string): Promise<any> {
    // This would return the actual MCP client
    // For simulation purposes, we'll return a mock client
    return {
      query: async (query: any) => {
        // Simulate different MCP responses
        switch (mcpId) {
          case 'user-mcp':
            return this.simulateUserMCPResponse(query);
          case 'chat-mcp':
            return this.simulateChatMCPResponse(query);
          case 'stats-mcp':
            return this.simulateStatsMCPResponse(query);
          case 'token-mcp':
            return this.simulateTokenMCPResponse(query);
          default:
            return this.simulateGenericMCPResponse(query);
        }
      }
    };
  }

  /**
   * Handle query errors gracefully
   */
  private handleQueryError(query: NaturalQuery, error: Error, duration: number): QueryResult {
    return {
      executionId: `error_${Date.now()}`,
      success: false,
      duration,
      timestamp: Date.now(),
      data: {
        primary: [],
        metadata: {
          totalRecords: 0,
          sources: [],
          aggregationApplied: 'merge'
        }
      },
      insights: {
        interpretation: `Failed to process query: "${query.raw}"`,
        performanceNotes: [`Query failed after ${duration}ms`],
        suggestions: [
          'Try rephrasing your query',
          'Check if the requested data exists',
          'Verify your permissions'
        ]
      },
      errors: [{
        mcpId: 'system',
        error: error.message,
        severity: 'critical',
        handlingStrategy: 'Return error response with suggestions'
      }],
      caching: {
        cached: false
      }
    };
  }

  /**
   * Learn from successful and failed queries
   */
  private learnFromQuery(
    query: NaturalQuery,
    interpreted: InterpretedQuery,
    result: QueryResult,
    duration: number
  ): void {
    // Record performance for each MCP
    if (result.data?.metadata?.sources) {
      for (const source of result.data.metadata.sources) {
        this.planner.recordPerformance(source.mcpId, source.queryTime);
      }
    }

    // Learn query patterns
    this.recordQueryPattern(query.raw, interpreted.intents[0], duration);
    
    // Learn optimal MCP routing
    this.recordMCPRouting(interpreted.entities.dataType, interpreted.targetMCPs);
  }

  /**
   * Utility methods for learning
   */
  private recordQueryPattern(query: string, intent: QueryIntentDetails | undefined, duration: number): void {
    // This would update the learning database
    // For now, we'll just log it
    console.log(`Learning: Query "${query}" with intent "${intent?.type}" took ${duration}ms`);
  }

  private recordMCPRouting(dataType: string, mcpIds: string[]): void {
    // This would update optimal routing patterns
    console.log(`Learning: DataType "${dataType}" routes to MCPs: ${mcpIds.join(', ')}`);
  }

  /**
   * Caching methods
   */
  private generateCacheKey(query: NaturalQuery): string {
    const keyData = {
      raw: query.raw.toLowerCase().trim(),
      context: query.context?.userId || 'anonymous'
    };
    return `rag2_${JSON.stringify(keyData)}`;
  }

  private cacheResult(cacheKey: string, result: QueryResult): void {
    // Set TTL based on data freshness
    const ttl = result.caching.cacheTTL || this.config.caching.default_ttl;
    
    // In a real implementation, this would use Redis or similar
    this.queryCache.set(cacheKey, {
      ...result,
      caching: { ...result.caching, cached: true, cacheTTL: ttl }
    });

    // Clean up old cache entries
    if (this.queryCache.size > this.config.caching.max_cache_size) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }
  }

  /**
   * Determine if an MCP is critical for the query
   */
  private isCriticalMCP(mcpId: string, interpreted: InterpretedQuery): boolean {
    // Primary data MCPs are critical
    // targetMCPs is now an array of strings, not objects
    if (interpreted.targetMCPs[0] === mcpId) {
      return true;
    }
    
    // Token validation is critical for auth queries
    if (mcpId === 'token-mcp' && interpreted.entities.filters.some(f => f.field === 'token')) {
      return true;
    }
    
    return false;
  }

  /**
   * Simulation methods for development/testing
   */
  private simulateUserMCPResponse(query: any): any[] {
    return [
      { id: 'u1', email: 'user@example.com', name: 'John Doe', status: 'active' },
      { id: 'u2', email: 'admin@example.com', name: 'Admin User', status: 'active' }
    ];
  }

  private simulateChatMCPResponse(query: any): any[] {
    return [
      { id: 'm1', message: 'Hello world', userId: 'u1', timestamp: Date.now() },
      { id: 'm2', message: 'How are you?', userId: 'u2', timestamp: Date.now() - 1000 }
    ];
  }

  private simulateStatsMCPResponse(query: any): any[] {
    return [
      { metric: 'active_users', value: 150, timestamp: Date.now() },
      { metric: 'messages_today', value: 1250, timestamp: Date.now() }
    ];
  }

  private simulateTokenMCPResponse(query: any): any[] {
    return [
      { token: query.token || 'xyz123', valid: true, expires: Date.now() + 3600000 }
    ];
  }

  private simulateGenericMCPResponse(query: any): any[] {
    return [
      { id: 'generic1', data: 'sample data', timestamp: Date.now() }
    ];
  }

  /**
   * Initialize configuration with defaults
   */
  private initializeConfig(config?: Partial<RAG2Config>): RAG2Config {
    return {
      nlp: {
        confidence_threshold: 0.7,
        entity_extraction_model: 'built-in',
        intent_recognition_model: 'built-in',
        language_models: ['en']
      },
      execution: {
        max_parallel_mcps: 5,
        query_timeout: 30000,
        retry_attempts: 2,
        fallback_enabled: true
      },
      caching: {
        enabled: true,
        default_ttl: 3600,
        max_cache_size: 1000,
        intelligent_invalidation: true
      },
      learning: {
        enabled: true,
        pattern_learning_rate: 0.1,
        performance_tracking: true,
        auto_optimization: true
      },
      ...config
    };
  }

  /**
   * Public API methods
   */

  /**
   * Get query history for analysis
   */
  getQueryHistory(limit: number = 100): Array<{ query: NaturalQuery; result: QueryResult; timestamp: number }> {
    return this.queryHistory.slice(-limit);
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): any {
    return {
      planner: this.planner.getPerformanceInsights(),
      aggregator: this.aggregator.getLearningInsights(),
      cache: {
        size: this.queryCache.size,
        hitRate: this.calculateCacheHitRate()
      }
    };
  }

  /**
   * Clear all caches and reset learning
   */
  reset(): void {
    this.queryCache.clear();
    this.queryHistory.length = 0;
    this.aggregator.resetLearningData();
  }

  /**
   * Test natural language understanding
   */
  async plan(query: string): Promise<InterpretedQuery> {
    const naturalQuery: NaturalQuery = {
      raw: query,
      metadata: {
        id: 'test',
        timestamp: Date.now(),
        source: 'api',
        priority: 'high'
      }
    };
    
    return this.parser.parse(naturalQuery);
  }

  /**
   * Get supported query examples
   */
  getExamples(): string[] {
    return [
      'get messages token xyz123',
      'show user activity last week',
      'find all messages from john about project X',
      'get stats for premium users in Europe',
      'count active users today',
      'search messages containing error',
      'show recent logs for user admin@example.com',
      'analyze user behavior patterns',
      'compare this week vs last week stats',
      'get all files uploaded yesterday'
    ];
  }

  private calculateCacheHitRate(): number {
    // This would be tracked in a real implementation
    return 0.75; // 75% cache hit rate simulation
  }

  public async getMetrics(): Promise<any> {
    return {};
  }

  public async getLogs(options: { level?: string, limit?: number }): Promise<any[]> {
    return [];
  }

  public async getHistory(userId?: string, limit?: number): Promise<any> {
    return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
  }

  public async clearCache(): Promise<void> {
    this.queryCache.clear();
  }

  public async healthCheck(): Promise<any> {
    return { status: 'healthy' };
  }

  public async queryBulk(queries: string[], context?: any): Promise<any[]> {
    return [];
  }
}

/**
 * Factory function to create RAG2 controller
 */
export function createRAG2Controller(mcpRegistry: MCPRegistry, config?: Partial<RAG2Config>): RAG2Controller {
  return new RAG2Controller(mcpRegistry, config);
}

/**
 * Express middleware for natural language queries
 */
export function rag2Middleware(rag2Controller: RAG2Controller) {
  return async (req: any, res: any, next: any) => {
    if (req.body && req.body.naturalQuery) {
      try {
        const result = await rag2Controller.processNaturalQuery({
          raw: req.body.naturalQuery,
          context: {
            userId: req.user?.id,
            sessionId: req.session?.id
          },
          metadata: {
            id: 'api',
            timestamp: Date.now(),
            source: 'api',
            priority: 'high'
          }
        });
        
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: 'Natural language processing failed',
          message: (error as Error).message
        });
      }
    } else {
      next();
    }
  };
}