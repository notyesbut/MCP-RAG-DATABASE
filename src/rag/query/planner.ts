/**
 * RAG₂ Query Execution Planner
 * Intelligently plans cross-MCP query execution for optimal performance
 */

import { 
  InterpretedQuery, 
  QueryExecutionPlan, 
  MCPQueryCapability,
  QueryExecutionPhase,
  MCPQueryFragment,
  QueryOptimization
} from '../../types/query.types';
import { MCPRegistry } from '../../mcp/registry/MCPRegistry';
import { BaseMCP } from '../../core/mcp/base_mcp';

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
    
    // Calculate total estimated time
    const estimatedTime = phases.reduce((sum, phase) => {
      return sum + (phase.estimatedDuration || 0);
    }, 0);
    
    // Calculate resource requirements
    const resourceRequirements = this.calculateResourceRequirements(phases);
    
    // Generate optimization notes
    const optimizations = this.generateOptimizations(interpretedQuery, mcpStates);
    
    return {
      executionId,
      phases,
      estimatedTime,
      resourceRequirements,
      optimizations,
      strategy: strategy || {
        type: 'sequential',
        estimatedTotalTime: estimatedTime,
        resourceRequirements
      },
      fallbacks,
      // Legacy properties for compatibility
      steps: [],
      optimizationStrategy: strategy ? strategy.type as any : 'standard',
      parallelization: {
        parallel: strategy?.type === 'parallel',
        maxParallelism: 5,
        groups: [],
        synchronizationPoints: []
      }
    };
  }

  /**
   * Analyze current state of all target MCPs with enhanced intelligence
   */
  private async analyzeMCPStates(targetMCPs: string[]) {
    const mcpStates = [];
    
    for (const mcpId of targetMCPs) {
      try {
        // Get real MCP instance from registry
        const mcpInstancePromise = this.mcpRegistry.getMCP(mcpId);
        const mcpInstance = await mcpInstancePromise;
        if (!mcpInstance) {
          console.warn(`MCP ${mcpId} not found in registry`);
          continue;
        }
        
        // Gather comprehensive MCP state information
        const [health, metrics] = await Promise.all([
          mcpInstance.getHealth(),
          mcpInstance.getMetrics()
        ]);
        
        // Create capabilities from available data
        const capabilities = {
          type: mcpInstance.type,
          tier: mcpInstance.tier,
          supportedQueries: ['basic', 'aggregation', 'search'],
          maxQuerySize: 10000
        };
        
        const historicalPerformance = this.performanceHistory.get(mcpId) || [100];
        const avgLatency = historicalPerformance.reduce((a, b) => a + b) / historicalPerformance.length;
        
        // Calculate intelligent load and priority
        const currentLoad = this.calculateCurrentLoad(health, metrics);
        const priority = this.calculateMCPPriority(mcpId, capabilities, health);
        
        mcpStates.push({
          mcpId,
          capabilities,
          currentLoad,
          health: health.status,
          healthDetails: health,
          metrics,
          avgPerformance: avgLatency,
          estimatedLatency: avgLatency,
          adjustedLatency: this.calculateAdjustedLatency(avgLatency, currentLoad, health.status),
          priority,
          type: this.determineMCPType(mcpId),
          reliability: this.calculateReliability(historicalPerformance),
          lastUpdate: Date.now()
        });
      } catch (error) {
        console.error(`Failed to analyze MCP ${mcpId}:`, error);
        // Add fallback state for failed MCPs
        mcpStates.push({
          mcpId,
          capabilities: null,
          currentLoad: 100, // Max load for failed MCP
          health: 'unhealthy',
          avgPerformance: 1000, // High latency penalty
          estimatedLatency: 1000,
          adjustedLatency: Infinity,
          priority: 10, // Lowest priority
          type: 'unknown',
          reliability: 0,
          lastUpdate: Date.now(),
          error: (error as Error).message
        });
      }
    }
    
    return mcpStates.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Calculate current load based on health and metrics
   */
  private calculateCurrentLoad(health: any, metrics: any): number {
    const cpuWeight = 0.4;
    const memoryWeight = 0.3;
    const responseTimeWeight = 0.2;
    const throughputWeight = 0.1;
    
    const cpuLoad = health.cpuUsage || 0;
    const memoryLoad = health.memoryUsage || 0;
    const responseTimeLoad = Math.min((metrics.avgQueryTime || 100) / 1000 * 100, 100);
    const throughputLoad = Math.max(0, 100 - (metrics.queryCount || 0) / 10); // Inverse of throughput
    
    return cpuLoad * cpuWeight + 
           memoryLoad * memoryWeight + 
           responseTimeLoad * responseTimeWeight + 
           throughputLoad * throughputWeight;
  }
  
  /**
   * Calculate MCP priority based on capabilities and health
   */
  private calculateMCPPriority(mcpId: string, capabilities: any, health: any): number {
    let priority = 5; // Base priority
    
    // Adjust based on MCP type
    if (mcpId.includes('user')) priority = 1; // Users are highest priority
    else if (mcpId.includes('chat')) priority = 2;
    else if (mcpId.includes('stats')) priority = 3;
    else if (mcpId.includes('logs')) priority = 4;
    
    // Adjust based on health
    if (health.status === 'healthy') priority -= 0;
    else if (health.status === 'degraded') priority += 1;
    else if (health.status === 'unhealthy') priority += 3;
    
    // Adjust based on capabilities
    if (capabilities?.transactionSupport) priority -= 0.5;
    if (capabilities?.fullTextSearch) priority -= 0.3;
    if (capabilities?.streamingSupport) priority -= 0.2;
    
    return Math.max(1, priority);
  }
  
  /**
   * Determine MCP type (hot/cold) based on ID and characteristics
   */
  private determineMCPType(mcpId: string): 'hot' | 'cold' | 'unknown' {
    if (mcpId.includes('hot')) return 'hot';
    if (mcpId.includes('cold')) return 'cold';
    
    // Intelligent type detection based on MCP characteristics
    if (mcpId.includes('user') || mcpId.includes('chat')) return 'hot';
    if (mcpId.includes('logs') || mcpId.includes('archive')) return 'cold';
    
    return 'unknown';
  }
  
  /**
   * Calculate reliability score based on historical performance
   */
  private calculateReliability(performanceHistory: number[]): number {
    if (performanceHistory.length === 0) return 0.5;
    
    const avgResponseTime = performanceHistory.reduce((a, b) => a + b) / performanceHistory.length;
    const variance = performanceHistory.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / performanceHistory.length;
    const stability = Math.max(0, 1 - Math.sqrt(variance) / avgResponseTime);
    
    // Good response time (< 100ms) and stability
    const responseScore = Math.max(0, 1 - avgResponseTime / 1000);
    
    return (responseScore * 0.6) + (stability * 0.4);
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
      cpu: Math.max(...mcpStates.map(mcp => this.estimateCPUUsage(mcp))),
      memory: mcpStates.reduce((sum, mcp) => sum + this.estimateMemoryUsage(mcp), 0),
      diskIO: 100, // Default disk I/O estimate
      networkBandwidth: mcpStates.reduce((sum, mcp) => sum + this.estimateNetworkUsage(mcp), 0),
      dataSize: 1000 // Default data size estimate
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
    strategy: any
  ): Promise<QueryExecutionPhase[]> {
    const phases: QueryExecutionPhase[] = [];
    
    if (strategy.type === 'parallel') {
      // Single phase with all MCPs in parallel
      phases.push({
        phase: '1',
        parallelizable: true,
        mcpQueries: mcpStates.map(mcp => ({
          mcpId: mcp.mcpId,
          query: this.buildMCPSpecificQuery(mcp, interpretedQuery),
          priority: 1,
          expectedResultSize: 100,
          timeout: 10000
        })),
        dependencies: [],
        estimatedDuration: Math.max(...mcpStates.map(mcp => mcp.estimatedLatency || 100))
      });
    } else if (strategy.type === 'sequential') {
      // Multiple phases, one MCP per phase
      mcpStates
        .sort((a, b) => a.priority - b.priority)
        .forEach((mcp, index) => {
          phases.push({
            phase: (index + 1).toString(),
            parallelizable: false,
            mcpQueries: [{
              mcpId: mcp.mcpId,
              query: this.buildMCPSpecificQuery(mcp, interpretedQuery),
              priority: 1,
              expectedResultSize: 100,
              timeout: 10000
            }],
            dependencies: index > 0 ? [(index).toString()] : [],
            estimatedDuration: mcp.estimatedLatency || 100
          });
        });
    } else if (strategy.type === 'hybrid') {
      // Group by dependencies and create hybrid phases
      const groups = this.groupMCPsByDependencies(mcpStates, interpretedQuery);
      
      groups.forEach((group, index) => {
        phases.push({
          phase: (index + 1).toString(),
          parallelizable: group.length > 1,
          mcpQueries: group.map(mcp => ({
            mcpId: mcp.mcpId,
            query: this.buildMCPSpecificQuery(mcp, interpretedQuery),
            priority: 1,
            expectedResultSize: 100,
            timeout: 10000
          })),
          dependencies: index > 0 ? [(index).toString()] : [],
          estimatedDuration: group.length > 1 
            ? Math.max(...group.map(mcp => mcp.estimatedLatency || 100))
            : group[0].estimatedLatency || 100
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
          useCache: interpretedQuery.optimizations.find(opt => opt.useCache)?.useCache || false,
          indexHints: interpretedQuery.optimizations
            .flatMap(opt => opt.suggestedIndexes || [])
            .filter(idx => idx.includes('user'))
        };

      case 'chat-mcp':
        return {
          ...baseQuery,
          includeMetadata: true,
          sortBy: interpretedQuery.entities.temporal && ['recent', 'today', 'yesterday'].includes(interpretedQuery.entities.temporal) 
            ? 'timestamp_desc' 
            : 'relevance',
          limit: this.calculateOptimalLimit(interpretedQuery.intents)
        };

      case 'token-mcp':
        return {
          ...baseQuery,
          validateOnly: interpretedQuery.intents[0]?.type === 'filter',
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
  ): Promise<any[]> {
    const fallbacks: any[] = [];

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
    if (interpretedQuery.aggregationStrategy && 
        interpretedQuery.aggregationStrategy.type === 'custom' && 
        interpretedQuery.aggregationStrategy.mergeStrategy === 'custom') {
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
      (!interpretedQuery.aggregationStrategy || !interpretedQuery.aggregationStrategy.toString().includes('cross'))
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
    
    const mcpFields = fieldSets[mcpType as keyof typeof fieldSets];
    if (!mcpFields) return ['*'];
    
    return (mcpFields as any)[primaryIntent] || ['*'];
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

  private mapAggregationStrategy(strategy: any): string {
    if (!strategy || !strategy.type) return 'MERGE';
    
    const mapping: Record<string, string> = {
      'statistical_summary': 'GROUP_STATS',
      'merge': 'UNION',
      'cross_reference': 'JOIN',
      'time_ordered': 'ORDER_BY_TIME',
      'prioritize_hot': 'HOT_FIRST'
    };
    
    return mapping[strategy.type] || 'MERGE';
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
      targetMCPs: alternativeMCPs.map(mcp => mcp.mcpId)
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
      targetMCPs: resilientMCPs.map(mcp => mcp.mcpId)
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

  /**
   * Calculate total resource requirements for execution phases
   */
  private calculateResourceRequirements(phases: QueryExecutionPhase[]): any {
    const totalCPU = Math.max(...phases.map(phase => 
      phase.mcpQueries.reduce((sum, query) => sum + this.estimateCPUForQuery(query), 0)
    ));
    
    const totalMemory = phases.reduce((sum, phase) => 
      sum + phase.mcpQueries.reduce((phaseSum, query) => phaseSum + this.estimateMemoryForQuery(query), 0)
    , 0);
    
    const totalDiskIO = phases.reduce((sum, phase) => 
      sum + phase.mcpQueries.reduce((phaseSum, query) => phaseSum + this.estimateDiskIOForQuery(query), 0)
    , 0);
    
    const totalNetworkBandwidth = phases.reduce((sum, phase) => 
      sum + phase.mcpQueries.reduce((phaseSum, query) => phaseSum + this.estimateNetworkForQuery(query), 0)
    , 0);
    
    const estimatedDataSize = phases.reduce((sum, phase) => 
      sum + phase.mcpQueries.reduce((phaseSum, query) => phaseSum + (query.expectedResultSize || 100), 0)
    , 0);
    
    return {
      cpu: totalCPU,
      memory: totalMemory,
      diskIO: totalDiskIO,
      networkBandwidth: totalNetworkBandwidth,
      dataSize: estimatedDataSize
    };
  }

  /**
   * Generate optimization suggestions for the query
   */
  private generateOptimizations(interpretedQuery: InterpretedQuery, mcpStates: any[]): string[] {
    const optimizations: string[] = [];
    
    // Check if parallel execution is possible
    if (mcpStates.length > 1 && this.areQueriesIndependent(interpretedQuery, mcpStates)) {
      optimizations.push('Execute queries in parallel for faster results');
    }
    
    // Check for caching opportunities
    if (interpretedQuery.optimizations.some(opt => opt.useCache)) {
      optimizations.push('Use cached results where available');
    }
    
    // Check for index usage
    const suggestedIndexes = interpretedQuery.optimizations.flatMap(opt => opt.suggestedIndexes || []);
    if (suggestedIndexes.length > 0) {
      optimizations.push(`Use indexes: ${suggestedIndexes.join(', ')}`);
    }
    
    // Check for hot MCP prioritization
    const hotMCPs = mcpStates.filter(mcp => mcp.type === 'hot');
    if (hotMCPs.length > 0) {
      optimizations.push('Prioritize hot MCPs for recent data');
    }
    
    return optimizations;
  }

  /**
   * Estimate CPU usage for a query
   */
  private estimateCPUForQuery(query: MCPQueryFragment): number {
    const baseCPU = {
      'user-mcp': 20,
      'chat-mcp': 30,
      'stats-mcp': 50,
      'logs-mcp': 40,
      'token-mcp': 10
    };
    
    return baseCPU[query.mcpId as keyof typeof baseCPU] || 25;
  }

  /**
   * Estimate memory usage for a query
   */
  private estimateMemoryForQuery(query: MCPQueryFragment): number {
    const baseMemory = {
      'user-mcp': 50,
      'chat-mcp': 100,
      'stats-mcp': 75,
      'logs-mcp': 200,
      'token-mcp': 10
    };
    
    const base = baseMemory[query.mcpId as keyof typeof baseMemory] || 50;
    // Scale by expected result size
    return base * (query.expectedResultSize / 100);
  }

  /**
   * Estimate disk I/O for a query
   */
  private estimateDiskIOForQuery(query: MCPQueryFragment): number {
    const baseDiskIO = {
      'user-mcp': 10,
      'chat-mcp': 50,
      'stats-mcp': 30,
      'logs-mcp': 100,
      'token-mcp': 5
    };
    
    return baseDiskIO[query.mcpId as keyof typeof baseDiskIO] || 25;
  }

  /**
   * Estimate network bandwidth for a query
   */
  private estimateNetworkForQuery(query: MCPQueryFragment): number {
    const baseNetwork = {
      'user-mcp': 10,
      'chat-mcp': 50,
      'stats-mcp': 25,
      'logs-mcp': 100,
      'token-mcp': 5
    };
    
    return baseNetwork[query.mcpId as keyof typeof baseNetwork] || 25;
  }
}