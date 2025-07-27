/**
 * RAG₂ Query Execution Planner
 * Intelligently plans cross-MCP query execution for optimal performance
 */

import { 
  InterpretedQuery, 
  QueryExecutionPlan, 
  MCPQueryCapability,
  AggregationStrategy 
} from '../../types/query.types';
import { MCPRegistry } from '../../mcp/registry/MCPRegistry';

export class QueryExecutionPlanner {
  private mcpRegistry: MCPRegistry;
  private performanceHistory: Map<string, number[]> = new Map();
  private loadBalancingEnabled: boolean = true;

  constructor(mcpRegistry: MCPRegistry) {
    this.mcpRegistry = mcpRegistry;
  }

  /**
   * Create optimal execution plan for cross-MCP queries
   */
  async createExecutionPlan(interpretedQuery: InterpretedQuery): Promise<QueryExecutionPlan> {
    const executionId = this.generateExecutionId();
    
    // Analyze MCP capabilities and current state
    const mcpStates = await this.analyzeMCPStates(interpretedQuery.targetMCPs);
    
    // Determine execution strategy
    const strategy = await this.determineExecutionStrategy(interpretedQuery, mcpStates);
    
    // Create execution phases
    const phases = await this.createExecutionPhases(interpretedQuery, mcpStates, strategy);
    
    // Generate fallback plans
    const fallbacks = await this.generateFallbackPlans(interpretedQuery, mcpStates);
    
    return {
      executionId,
      phases,
      strategy,
      fallbacks
    };
  }

  /**
   * Analyze current state of all target MCPs
   */
  private async analyzeMCPStates(targetMCPs: InterpretedQuery['targetMCPs']) {
    const mcpStates = [];
    
    for (const mcpTarget of targetMCPs) {
      const capabilities = await this.mcpRegistry.getMCPCapabilities(mcpTarget.mcpId);
      const currentLoad = await this.mcpRegistry.getMCPLoad(mcpTarget.mcpId);
      const health = await this.mcpRegistry.getMCPHealth(mcpTarget.mcpId);
      const historicalPerformance = this.performanceHistory.get(mcpTarget.mcpId) || [100];
      
      mcpStates.push({
        ...mcpTarget,
        capabilities,
        currentLoad,
        health,
        avgPerformance: historicalPerformance.reduce((a, b) => a + b) / historicalPerformance.length,
        adjustedLatency: this.calculateAdjustedLatency(mcpTarget.estimatedLatency, currentLoad, health)
      });
    }
    
    return mcpStates;
  }

  /**
   * Determine optimal execution strategy
   */
  private async determineExecutionStrategy(
    interpretedQuery: InterpretedQuery, 
    mcpStates: any[]
  ): Promise<QueryExecutionPlan['strategy']> {
    const totalMCPs = mcpStates.length;
    const hasIndependentQueries = this.areQueriesIndependent(interpretedQuery, mcpStates);
    const estimatedTotalTime = this.estimateTotalExecutionTime(mcpStates, hasIndependentQueries);
    
    // Resource requirements calculation
    const resourceRequirements = {
      memory: mcpStates.reduce((sum, mcp) => sum + this.estimateMemoryUsage(mcp), 0),
      cpu: Math.max(...mcpStates.map(mcp => this.estimateCPUUsage(mcp))),
      network: mcpStates.reduce((sum, mcp) => sum + this.estimateNetworkUsage(mcp), 0)
    };

    // Strategy decision logic
    let type: 'sequential' | 'parallel' | 'hybrid';
    
    if (totalMCPs === 1) {
      type = 'sequential';
    } else if (hasIndependentQueries && resourceRequirements.memory < 1000 && resourceRequirements.cpu < 80) {
      type = 'parallel';
    } else if (totalMCPs > 3 && hasIndependentQueries) {
      type = 'hybrid'; // Parallel groups with sequential phases
    } else {
      type = 'sequential';
    }

    return {
      type,
      estimatedTotalTime,
      resourceRequirements
    };
  }

  /**
   * Create execution phases with dependency management
   */
  private async createExecutionPhases(
    interpretedQuery: InterpretedQuery,
    mcpStates: any[],
    strategy: QueryExecutionPlan['strategy']
  ): Promise<QueryExecutionPlan['phases']> {
    const phases: QueryExecutionPlan['phases'] = [];
    
    if (strategy.type === 'parallel') {
      // Single phase with all MCPs in parallel
      phases.push({
        phase: '1',
        description: 'Parallel execution across all MCPs',
        mcpQueries: mcpStates.map(mcp => ({
          mcpId: mcp.mcpId,
          query: this.buildMCPSpecificQuery(mcp, interpretedQuery),
          priority: 1,
          expectedResultSize: 100,
          timeout: 10000,
          dependencies: []
        })),
        parallelizable: true
      });
    } else if (strategy.type === 'sequential') {
      // Multiple phases, one MCP per phase
      mcpStates
        .sort((a, b) => a.priority - b.priority)
        .forEach((mcp, index) => {
          phases.push({
            phase: (index + 1).toString(),
            description: `Query ${mcp.mcpId} - ${mcp.type} MCP`,
            mcpQueries: [{
              mcpId: mcp.mcpId,
              query: this.buildMCPSpecificQuery(mcp, interpretedQuery),
              priority: 1,
              expectedResultSize: 100,
              timeout: 10000,
              dependencies: index > 0 ? [mcpStates[index - 1].mcpId] : []
            }],
            parallelizable: false
          });
        });
    } else if (strategy.type === 'hybrid') {
      // Group by dependencies and create hybrid phases
      const groups = this.groupMCPsByDependencies(mcpStates, interpretedQuery);
      
      groups.forEach((group, index) => {
        phases.push({
          phase: (index + 1).toString(),
          description: `Hybrid phase ${index + 1} - ${group.length} MCPs`,
          mcpQueries: group.map(mcp => ({
            mcpId: mcp.mcpId,
            query: this.buildMCPSpecificQuery(mcp, interpretedQuery),
            priority: 1,
            expectedResultSize: 100,
            timeout: 10000,
            dependencies: index > 0 ? [groups[index - 1][0].mcpId] : []
          })),
          parallelizable: group.length > 1
        });
      });
    }

    return phases;
  }

  /**
   * Build MCP-specific query from interpreted query
   */
  private buildMCPSpecificQuery(mcpState: any, interpretedQuery: InterpretedQuery): any {
    const baseQuery = {
      type: mcpState.queryFragment.type,
      filters: interpretedQuery.entities.filters,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    // Add MCP-specific optimizations
    switch (mcpState.mcpId) {
      case 'user-mcp':
        return {
          ...baseQuery,
          fields: this.selectOptimalFields('user', interpretedQuery.intents),
          useCache: interpretedQuery.optimizations[0]?.useCache,
          indexHints: interpretedQuery.optimizations[0]?.suggestedIndexes?.filter(idx => idx.includes('user'))
        };

      case 'chat-mcp':
        return {
          ...baseQuery,
          includeMetadata: true,
          sortBy: interpretedQuery.entities.temporal === 'recent' ? 'timestamp_desc' : 'relevance',
          limit: this.calculateOptimalLimit(interpretedQuery.intents)
        };

      case 'token-mcp':
        return {
          ...baseQuery,
          validateOnly: interpretedQuery.intents[0] === 'filter',
          includeExpiration: true
        };

      case 'stats-mcp':
        return {
          ...baseQuery,
          aggregation: this.mapAggregationStrategy(interpretedQuery.aggregationStrategy),
          groupBy: this.determineGroupByFields(interpretedQuery.entities)
        };

      default:
        return baseQuery;
    }
  }

  /**
   * Generate fallback plans for failure scenarios
   */
  private async generateFallbackPlans(
    interpretedQuery: InterpretedQuery,
    mcpStates: any[]
  ): Promise<QueryExecutionPlan['fallbacks']> {
    const fallbacks: QueryExecutionPlan['fallbacks'] = [];

    // Fallback for primary MCP failure
    const primaryMCP = mcpStates.find(mcp => mcp.priority === 1);
    if (primaryMCP) {
      const alternativeMCPs = mcpStates.filter(mcp => 
        mcp.mcpId !== primaryMCP.mcpId && 
        mcp.capabilities.supportedDataTypes.includes(interpretedQuery.entities.dataType)
      );

      if (alternativeMCPs.length > 0) {
        fallbacks.push({
          condition: `${primaryMCP.mcpId}_failure`,
          alternativePlan: await this.createAlternativePlan(interpretedQuery, alternativeMCPs)
        });
      }
    }

    // Fallback for performance degradation
    fallbacks.push({
      condition: 'performance_degradation',
      alternativePlan: await this.createPerformanceOptimizedPlan(interpretedQuery, mcpStates)
    });

    // Fallback for partial failures
    fallbacks.push({
      condition: 'partial_failure',
      alternativePlan: await this.createResilientPlan(interpretedQuery, mcpStates)
    });

    return fallbacks;
  }

  /**
   * Utility methods for execution planning
   */
  private calculateAdjustedLatency(baseLatency: number, load: number, health: string): number {
    let adjusted = baseLatency;
    
    // Adjust for load (0-100 scale)
    adjusted *= (1 + load / 100);
    
    // Adjust for health
    switch (health) {
      case 'degraded':
        adjusted *= 1.5;
        break;
      case 'down':
        adjusted = Infinity;
        break;
      default:
        // healthy - no adjustment
        break;
    }
    
    return Math.round(adjusted);
  }

  private areQueriesIndependent(interpretedQuery: InterpretedQuery, mcpStates: any[]): boolean {
    // Check if any MCP depends on results from another
    const hasTokenValidation = mcpStates.some(mcp => mcp.mcpId === 'token-mcp');
    const hasDataQueries = mcpStates.some(mcp => mcp.mcpId !== 'token-mcp');
    
    // If we need token validation AND data queries, they're dependent
    if (hasTokenValidation && hasDataQueries) {
      return false;
    }
    
    // Check for cross-reference requirements
    if (interpretedQuery.aggregationStrategy === AggregationStrategy.CROSS_REFERENCE) {
      return false;
    }
    
    return true;
  }

  private estimateTotalExecutionTime(mcpStates: any[], parallel: boolean): number {
    if (parallel) {
      return Math.max(...mcpStates.map(mcp => mcp.adjustedLatency));
    } else {
      return mcpStates.reduce((sum, mcp) => sum + mcp.adjustedLatency, 0);
    }
  }

  private estimateMemoryUsage(mcpState: any): number {
    // Base memory estimate in MB
    const baseMemory = {
      'user-mcp': 50,
      'chat-mcp': 100,
      'stats-mcp': 75,
      'logs-mcp': 200,
      'token-mcp': 10
    };
    
    return baseMemory[mcpState.mcpId as keyof typeof baseMemory] || 50;
  }

  private estimateCPUUsage(mcpState: any): number {
    // CPU usage percentage estimate
    const baseCPU = {
      'user-mcp': 20,
      'chat-mcp': 30,
      'stats-mcp': 50,
      'logs-mcp': 40,
      'token-mcp': 10
    };
    
    return baseCPU[mcpState.mcpId as keyof typeof baseCPU] || 25;
  }

  private estimateNetworkUsage(mcpState: any): number {
    // Network usage in KB estimate
    const baseNetwork = {
      'user-mcp': 10,
      'chat-mcp': 50,
      'stats-mcp': 25,
      'logs-mcp': 100,
      'token-mcp': 5
    };
    
    return baseNetwork[mcpState.mcpId as keyof typeof baseNetwork] || 25;
  }

  private groupMCPsByDependencies(mcpStates: any[], interpretedQuery: InterpretedQuery): any[][] {
    const groups: any[][] = [];
    const processed = new Set<string>();
    
    // Group 1: Independent MCPs that can run in parallel
    const independent = mcpStates.filter(mcp => 
      mcp.mcpId !== 'token-mcp' && 
      !interpretedQuery.aggregationStrategy.toString().includes('cross')
    );
    
    if (independent.length > 0) {
      groups.push(independent);
      independent.forEach(mcp => processed.add(mcp.mcpId));
    }
    
    // Group 2: Dependent MCPs (like token validation)
    const dependent = mcpStates.filter(mcp => !processed.has(mcp.mcpId));
    if (dependent.length > 0) {
      groups.push(dependent);
    }
    
    return groups;
  }

  private selectOptimalFields(mcpType: string, intents: any[]): string[] {
    const primaryIntent = intents[0]?.type;
    
    const fieldSets = {
      user: {
        retrieve: ['id', 'email', 'name', 'status'],
        count: ['id'],
        analyze: ['id', 'email', 'name', 'status', 'created_at', 'last_login']
      },
      chat: {
        retrieve: ['id', 'message', 'user_id', 'timestamp'],
        search: ['id', 'message', 'user_id', 'timestamp', 'metadata'],
        count: ['id']
      }
    };
    
    return fieldSets[mcpType as keyof typeof fieldSets]?.[primaryIntent as keyof typeof fieldSets['user']] || ['*'];
  }

  private calculateOptimalLimit(intents: any[]): number {
    const primaryIntent = intents[0]?.type;
    
    const limits = {
      retrieve: 100,
      search: 50,
      count: -1, // No limit for count
      analyze: 1000
    };
    
    return limits[primaryIntent as keyof typeof limits] || 100;
  }

  private mapAggregationStrategy(strategy: AggregationStrategy): string {
    const mapping = {
      [AggregationStrategy.STATISTICAL_SUMMARY]: 'GROUP_STATS',
      [AggregationStrategy.MERGE]: 'UNION',
      [AggregationStrategy.CROSS_REFERENCE]: 'JOIN',
      [AggregationStrategy.TIME_ORDERED]: 'ORDER_BY_TIME',
      [AggregationStrategy.PRIORITIZE_HOT]: 'HOT_FIRST'
    };
    
    return mapping[strategy] || 'MERGE';
  }

  private determineGroupByFields(entities: any): string[] {
    const groupBy: string[] = [];
    
    if (entities.filters.userId) groupBy.push('user_id');
    if (entities.temporal) groupBy.push('date_bucket');
    if (entities.filters.status) groupBy.push('status');
    
    return groupBy.length > 0 ? groupBy : ['default'];
  }

  private async createAlternativePlan(
    interpretedQuery: InterpretedQuery, 
    alternativeMCPs: any[]
  ): Promise<QueryExecutionPlan> {
    // Create simplified plan with alternative MCPs
    return this.createExecutionPlan({
      ...interpretedQuery,
      targetMCPs: alternativeMCPs
    });
  }

  private async createPerformanceOptimizedPlan(
    interpretedQuery: InterpretedQuery, 
    mcpStates: any[]
  ): Promise<QueryExecutionPlan> {
    // Create plan optimized for performance (parallel, caching, etc.)
    const optimizedQuery = {
      ...interpretedQuery,
      optimizations: [{
        ...interpretedQuery.optimizations[0],
        useCache: true,
        parallelizable: true,
        estimatedComplexity: 'low' as const
      }]
    };
    
    return this.createExecutionPlan(optimizedQuery);
  }

  private async createResilientPlan(
    interpretedQuery: InterpretedQuery, 
    mcpStates: any[]
  ): Promise<QueryExecutionPlan> {
    // Create plan that can handle partial failures
    const resilientMCPs = mcpStates.filter(mcp => mcp.health === 'healthy');
    
    return this.createExecutionPlan({
      ...interpretedQuery,
      targetMCPs: resilientMCPs
    });
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Record performance metrics for future optimization
   */
  recordPerformance(mcpId: string, latency: number): void {
    if (!this.performanceHistory.has(mcpId)) {
      this.performanceHistory.set(mcpId, []);
    }
    
    const history = this.performanceHistory.get(mcpId)!;
    history.push(latency);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get performance insights for query optimization
   */
  getPerformanceInsights(): Record<string, any> {
    const insights: Record<string, any> = {};
    
    for (const [mcpId, history] of this.performanceHistory.entries()) {
      const avg = history.reduce((a, b) => a + b) / history.length;
      const min = Math.min(...history);
      const max = Math.max(...history);
      
      insights[mcpId] = {
        avgLatency: Math.round(avg),
        minLatency: min,
        maxLatency: max,
        measurements: history.length,
        trend: this.calculateTrend(history)
      };
    }
    
    return insights;
  }

  private calculateTrend(history: number[]): 'improving' | 'degrading' | 'stable' {
    if (history.length < 10) return 'stable';
    
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change < -0.1) return 'improving';
    if (change > 0.1) return 'degrading';
    return 'stable';
  }
}