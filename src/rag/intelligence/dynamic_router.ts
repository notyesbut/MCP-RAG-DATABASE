/**
 * Dynamic Routing Module for RAG₁
 * Intelligent MCP selection and query routing based on real-time performance
 */

import { InterpretedQuery, MCPQueryCapability } from '../../types/query.types';
import { MCPRegistry } from '../../core/mcp/registry';

/**
 * Routing decision with scoring
 */
interface RoutingDecision {
  mcpId: string;
  score: number;
  reasons: string[];
  estimatedLatency: number;
  reliability: number;
  cost: number;
  priority: number;
}

/**
 * Performance metrics for routing
 */
interface MCPPerformanceMetrics {
  mcpId: string;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  lastUpdated: number;
  historicalPerformance: PerformanceHistory[];
}

/**
 * Historical performance data point
 */
interface PerformanceHistory {
  timestamp: number;
  latency: number;
  success: boolean;
  dataSize: number;
  queryComplexity: number;
}

/**
 * Routing strategy configuration
 */
interface RoutingStrategy {
  name: string;
  weightLatency: number;
  weightReliability: number;
  weightCost: number;
  weightDataFreshness: number;
  minReliability: number;
  maxLatency: number;
}

/**
 * Dynamic query router with ML-based optimization
 */
export class DynamicRouter {
  private performanceMetrics: Map<string, MCPPerformanceMetrics> = new Map();
  private routingHistory: Map<string, RoutingDecision[]> = new Map();
  private strategies: Map<string, RoutingStrategy> = new Map();
  private mcpRegistry: MCPRegistry;
  private learningRate = 0.1;
  private decayFactor = 0.95;

  constructor(mcpRegistry: MCPRegistry) {
    this.mcpRegistry = mcpRegistry;
    this.initializeStrategies();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize routing strategies
   */
  private initializeStrategies(): void {
    // Performance-first strategy
    this.strategies.set('performance', {
      name: 'performance',
      weightLatency: 0.7,
      weightReliability: 0.2,
      weightCost: 0.05,
      weightDataFreshness: 0.05,
      minReliability: 0.9,
      maxLatency: 1000
    });

    // Reliability-first strategy
    this.strategies.set('reliability', {
      name: 'reliability',
      weightLatency: 0.2,
      weightReliability: 0.7,
      weightCost: 0.05,
      weightDataFreshness: 0.05,
      minReliability: 0.99,
      maxLatency: 5000
    });

    // Cost-optimized strategy
    this.strategies.set('cost', {
      name: 'cost',
      weightLatency: 0.2,
      weightReliability: 0.3,
      weightCost: 0.4,
      weightDataFreshness: 0.1,
      minReliability: 0.85,
      maxLatency: 10000
    });

    // Real-time strategy
    this.strategies.set('realtime', {
      name: 'realtime',
      weightLatency: 0.8,
      weightReliability: 0.15,
      weightCost: 0.03,
      weightDataFreshness: 0.02,
      minReliability: 0.8,
      maxLatency: 100
    });

    // Balanced strategy
    this.strategies.set('balanced', {
      name: 'balanced',
      weightLatency: 0.35,
      weightReliability: 0.35,
      weightCost: 0.15,
      weightDataFreshness: 0.15,
      minReliability: 0.9,
      maxLatency: 2000
    });
  }

  /**
   * Start continuous performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Set up periodic metric updates
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Update every 5 seconds

    // Set up decay for old metrics
    setInterval(() => {
      this.decayOldMetrics();
    }, 60000); // Decay every minute
  }

  /**
   * Route query to optimal MCPs
   */
  async routeQuery(
    query: InterpretedQuery,
    availableMCPs: string[],
    strategyName: string = 'balanced'
  ): Promise<RoutingDecision[]> {
    const strategy = this.strategies.get(strategyName) || this.strategies.get('balanced')!;
    const decisions: RoutingDecision[] = [];

    // Get current state of all available MCPs
    const mcpStates = await this.getMCPStates(availableMCPs);

    // Score each MCP based on query requirements
    for (const mcpState of mcpStates) {
      const decision = await this.scoreMCP(mcpState, query, strategy);
      if (decision.score > 0.3) { // Minimum threshold
        decisions.push(decision);
      }
    }

    // Sort by score and apply intelligent selection
    const selectedMCPs = this.applyIntelligentSelection(decisions, query);

    // Record routing decisions for learning
    this.recordRoutingDecisions(query, selectedMCPs);

    return selectedMCPs;
  }

  /**
   * Get current state of MCPs
   */
  private async getMCPStates(mcpIds: string[]): Promise<MCPQueryCapability[]> {
    const states: MCPQueryCapability[] = [];

    for (const mcpId of mcpIds) {
      const mcp = await this.mcpRegistry.getMCP(mcpId);
      if (!mcp) continue;
      
      const health = await mcp.getHealth();
      const metrics = await mcp.getMetrics();
      const capability = {
        supportedQueries: ['basic', 'aggregation', 'search'],
        maxQuerySize: 10000,
        features: []
      };
      const load = metrics.totalRecords / mcp.getConfiguration().maxRecords;
      const performanceMetrics = this.performanceMetrics.get(mcpId);

      states.push({
        mcpId,
        ...capability,
        currentLoad: load,
        avgResponseTime: metrics?.avgLatency || capability.performance?.avgLatency || 100,
        priority: this.calculateMCPPriority(mcpId, health, load, metrics)
      });
    }

    return states;
  }

  /**
   * Score an MCP for a specific query
   */
  private async scoreMCP(
    mcpState: MCPQueryCapability,
    query: InterpretedQuery,
    strategy: RoutingStrategy
  ): Promise<RoutingDecision> {
    const scores = {
      latency: 0,
      reliability: 0,
      cost: 0,
      dataFreshness: 0,
      capability: 0
    };

    const metrics = this.performanceMetrics.get(mcpState.mcpId);

    // Latency score (lower is better)
    const estimatedLatency = this.estimateLatency(mcpState, query, metrics);
    scores.latency = Math.max(0, 1 - (estimatedLatency / strategy.maxLatency));

    // Reliability score
    const reliability = metrics?.successRate || 0.95;
    scores.reliability = reliability;

    // Cost score (simplified - could be based on actual pricing)
    const cost = this.estimateCost(mcpState, query);
    scores.cost = Math.max(0, 1 - cost);

    // Data freshness score
    scores.dataFreshness = this.calculateDataFreshnessScore(mcpState, query);

    // Capability match score
    scores.capability = this.calculateCapabilityScore(mcpState, query);

    // Calculate weighted total score
    const totalScore = 
      scores.latency * strategy.weightLatency +
      scores.reliability * strategy.weightReliability +
      scores.cost * strategy.weightCost +
      scores.dataFreshness * strategy.weightDataFreshness +
      scores.capability * 0.2; // Always consider capability

    // Apply constraints
    const meetsConstraints = 
      reliability >= strategy.minReliability &&
      estimatedLatency <= strategy.maxLatency;

    const reasons = this.generateRoutingReasons(scores, strategy, meetsConstraints);

    return {
      mcpId: mcpState.mcpId,
      score: meetsConstraints ? totalScore : totalScore * 0.1, // Penalize if constraints not met
      reasons,
      estimatedLatency,
      reliability,
      cost,
      priority: mcpState.priority
    };
  }

  /**
   * Estimate latency for a query
   */
  private estimateLatency(
    mcpState: MCPQueryCapability,
    query: InterpretedQuery,
    metrics?: MCPPerformanceMetrics
  ): number {
    // Base latency from historical data
    let baseLatency = metrics?.avgLatency || mcpState.avgResponseTime;

    // Adjust for current load
    const loadFactor = 1 + (mcpState.currentLoad / 100) * 0.5;
    baseLatency *= loadFactor;

    // Adjust for query complexity
    const complexityFactor = this.calculateQueryComplexity(query);
    baseLatency *= complexityFactor;

    // Adjust for data size
    const dataSizeFactor = this.estimateDataSizeFactor(query);
    baseLatency *= dataSizeFactor;

    // Apply ML-based adjustment from historical patterns
    if (metrics && metrics.historicalPerformance.length > 10) {
      const mlAdjustment = this.applyMLLatencyPrediction(query, metrics);
      baseLatency = baseLatency * 0.7 + mlAdjustment * 0.3;
    }

    return Math.round(baseLatency);
  }

  /**
   * Apply ML-based latency prediction
   */
  private applyMLLatencyPrediction(
    query: InterpretedQuery,
    metrics: MCPPerformanceMetrics
  ): number {
    // Simple regression based on recent performance
    const recentData = metrics.historicalPerformance.slice(-50);
    
    // Extract features
    const features = {
      avgComplexity: recentData.reduce((sum, d) => sum + d.queryComplexity, 0) / recentData.length,
      avgDataSize: recentData.reduce((sum, d) => sum + d.dataSize, 0) / recentData.length,
      successRate: recentData.filter(d => d.success).length / recentData.length
    };

    // Simple linear regression prediction
    const queryComplexity = this.calculateQueryComplexity(query);
    const prediction = 
      metrics.avgLatency * 0.5 +
      (queryComplexity / features.avgComplexity) * metrics.avgLatency * 0.3 +
      (1 - features.successRate) * 200 * 0.2;

    return prediction;
  }

  /**
   * Calculate query complexity
   */
  private calculateQueryComplexity(query: InterpretedQuery): number {
    let complexity = 1.0;

    // Intent complexity
    const intentComplexity = {
      retrieve: 1.0,
      filter: 1.2,
      search: 1.5,
      aggregate: 2.0,
      analyze: 2.5,
      compare: 2.0,
      relationship: 3.0
    };

    const primaryIntent = query.intents[0];
    const intentType = primaryIntent.type;
    complexity *= intentComplexity[intentType as keyof typeof intentComplexity] || 1.0;

    // Filter complexity
    complexity *= 1 + (query.entities.filters?.length || 0) * 0.1;

    // Join complexity
    complexity *= 1 + (query.entities.joins?.length || 0) * 0.5;

    // Aggregation complexity
    if (query.aggregationStrategy) {
      complexity *= 1.3;
    }

    return complexity;
  }

  /**
   * Estimate data size factor
   */
  private estimateDataSizeFactor(query: InterpretedQuery): number {
    // Estimate based on query characteristics
    let factor = 1.0;

    // No pagination = potentially large result
    if (!query.entities.pagination) {
      factor *= 1.5;
    }

    // Time range queries
    if (query.entities.temporal) {
      const temporalFactors = {
        today: 0.7,
        yesterday: 0.8,
        recent: 0.9,
        last_week: 1.2,
        last_month: 1.5,
        historical: 2.0
      };
      factor *= temporalFactors[query.entities.temporal as keyof typeof temporalFactors] || 1.0;
    }

    return factor;
  }

  /**
   * Estimate cost for a query
   */
  private estimateCost(mcpState: MCPQueryCapability, query: InterpretedQuery): number {
    // Simplified cost model
    let baseCost = 0.1; // Base cost per query

    // Tier-based pricing
    if (mcpState.tier === 'hot') {
      baseCost *= 2; // Hot tier is more expensive
    }

    // Data volume cost
    const estimatedDataSize = this.estimateDataSizeFactor(query);
    baseCost *= estimatedDataSize;

    // Complexity cost
    const complexity = this.calculateQueryComplexity(query);
    baseCost *= complexity;

    return Math.min(baseCost, 1.0); // Normalize to 0-1
  }

  /**
   * Calculate data freshness score
   */
  private calculateDataFreshnessScore(mcpState: MCPQueryCapability, query: InterpretedQuery): number {
    // Check if query requires fresh data
    const requiresFreshData = 
      query.entities.temporal === 'recent' ||
      query.entities.temporal === 'today' ||
      query.intents.includes('realtime' as any);

    if (!requiresFreshData) {
      return 0.5; // Neutral score if freshness doesn't matter
    }

    // Hot tier has fresher data
    if (mcpState.tier === 'hot') {
      return 0.9;
    }

    // Cold tier has older data
    return 0.3;
  }

  /**
   * Calculate capability match score
   */
  private calculateCapabilityScore(mcpState: MCPQueryCapability, query: InterpretedQuery): number {
    let score = 0;
    let checks = 0;

    // Check data type support
    if (mcpState.domains.includes(query.entities.dataType)) {
      score += 1;
    }
    checks++;

    // Check intent support
    const primaryIntent = query.intents[0];
    const intentType = primaryIntent.type;
    if (mcpState.queryTypes?.includes(intentType)) {
      score += 1;
    }
    checks++;

    // Check feature requirements
    const hasSearchIntent = query.intents.some(intent => intent.type === 'search');
    if (hasSearchIntent && (mcpState as any).features?.fullTextSearch) {
      score += 1;
    }
    if (query.entities.temporal && (mcpState as any).features?.temporalQueries) {
      score += 1;
    }
    if (query.aggregationStrategy && (mcpState as any).features?.aggregations) {
      score += 1;
    }
    checks += 3;

    return score / checks;
  }

  /**
   * Generate human-readable routing reasons
   */
  private generateRoutingReasons(
    scores: any,
    strategy: RoutingStrategy,
    meetsConstraints: boolean
  ): string[] {
    const reasons: string[] = [];

    if (!meetsConstraints) {
      reasons.push('Does not meet minimum constraints');
    }

    // Analyze scores
    const sortedScores = Object.entries(scores)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    for (const [metric, scoreValue] of sortedScores.slice(0, 3)) {
      const score = scoreValue as number;
      if (score > 0.7) {
        reasons.push(`High ${metric} score: ${(score * 100).toFixed(0)}%`);
      } else if (score < 0.3) {
        reasons.push(`Low ${metric} score: ${(score * 100).toFixed(0)}%`);
      }
    }

    // Strategy-specific reasons
    reasons.push(`Using ${strategy.name} routing strategy`);

    return reasons;
  }

  /**
   * Apply intelligent selection algorithms
   */
  private applyIntelligentSelection(
    decisions: RoutingDecision[],
    query: InterpretedQuery
  ): RoutingDecision[] {
    // Sort by score
    const sorted = decisions.sort((a, b) => b.score - a.score);

    // Apply selection strategies based on query type
    if (query.intents.includes('aggregate' as any) || query.intents.includes('analyze' as any)) {
      // For complex queries, may need multiple MCPs
      return this.selectForComplexQuery(sorted, query);
    } else {
      // For simple queries, usually one MCP is enough
      return this.selectForSimpleQuery(sorted, query);
    }
  }

  /**
   * Select MCPs for complex queries
   */
  private selectForComplexQuery(
    decisions: RoutingDecision[],
    query: InterpretedQuery
  ): RoutingDecision[] {
    const selected: RoutingDecision[] = [];
    const maxMCPs = 3;
    const minScore = 0.5;

    // Select complementary MCPs
    for (const decision of decisions) {
      if (selected.length >= maxMCPs) break;
      if (decision.score < minScore) break;

      // Check if this MCP adds value
      const addsValue = this.checkComplementaryValue(decision, selected, query);
      if (addsValue) {
        selected.push(decision);
      }
    }

    return selected;
  }

  /**
   * Select MCPs for simple queries
   */
  private selectForSimpleQuery(
    decisions: RoutingDecision[],
    query: InterpretedQuery
  ): RoutingDecision[] {
    // Usually just take the best one
    if (decisions.length === 0) return [];

    const best = decisions[0];
    const selected = [best];

    // Add a backup if the best isn't very reliable
    if (best.reliability < 0.95 && decisions.length > 1) {
      const backup = decisions.find(d => d.mcpId !== best.mcpId && d.reliability > 0.9);
      if (backup) {
        selected.push(backup);
      }
    }

    return selected;
  }

  /**
   * Check if an MCP adds complementary value
   */
  private checkComplementaryValue(
    candidate: RoutingDecision,
    selected: RoutingDecision[],
    query: InterpretedQuery
  ): boolean {
    // Don't select same MCP twice
    if (selected.some(s => s.mcpId === candidate.mcpId)) {
      return false;
    }

    // Check for complementary capabilities
    // This is simplified - real implementation would check actual capabilities
    return true;
  }

  /**
   * Calculate MCP priority based on current state
   */
  private calculateMCPPriority(
    mcpId: string,
    health: any,
    load: number,
    metrics?: MCPPerformanceMetrics
  ): number {
    let priority = 5; // Base priority

    // Health factor
    if (health.status === 'healthy') {
      priority += 2;
    } else if (health.status === 'degraded') {
      priority -= 2;
    } else {
      priority -= 5;
    }

    // Load factor
    if (load < 30) {
      priority += 2;
    } else if (load > 70) {
      priority -= 2;
    }

    // Performance factor
    if (metrics) {
      if (metrics.successRate > 0.95) {
        priority += 1;
      }
      if (metrics.avgLatency < 100) {
        priority += 1;
      }
    }

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * Record routing decisions for learning
   */
  private recordRoutingDecisions(query: InterpretedQuery, decisions: RoutingDecision[]): void {
    const key = this.generateQueryKey(query);
    
    if (!this.routingHistory.has(key)) {
      this.routingHistory.set(key, []);
    }
    
    this.routingHistory.get(key)!.push(...decisions);

    // Keep only recent history
    const history = this.routingHistory.get(key)!;
    if (history.length > 100) {
      this.routingHistory.set(key, history.slice(-100));
    }
  }

  /**
   * Generate a key for query patterns
   */
  private generateQueryKey(query: InterpretedQuery): string {
    return `${query.intents[0]}_${query.entities.dataType}_${query.entities.filters?.length || 0}`;
  }

  /**
   * Update performance metrics from actual results
   */
  updatePerformanceFromResult(
    mcpId: string,
    latency: number,
    success: boolean,
    dataSize: number,
    queryComplexity: number
  ): void {
    if (!this.performanceMetrics.has(mcpId)) {
      this.performanceMetrics.set(mcpId, {
        mcpId,
        avgLatency: latency,
        p95Latency: latency,
        p99Latency: latency,
        successRate: success ? 1 : 0,
        errorRate: success ? 0 : 1,
        throughput: 1,
        lastUpdated: Date.now(),
        historicalPerformance: []
      });
    }

    const metrics = this.performanceMetrics.get(mcpId)!;

    // Update with exponential moving average
    metrics.avgLatency = metrics.avgLatency * (1 - this.learningRate) + latency * this.learningRate;
    metrics.successRate = metrics.successRate * (1 - this.learningRate) + (success ? 1 : 0) * this.learningRate;
    metrics.errorRate = 1 - metrics.successRate;
    metrics.lastUpdated = Date.now();

    // Add to historical data
    metrics.historicalPerformance.push({
      timestamp: Date.now(),
      latency,
      success,
      dataSize,
      queryComplexity
    });

    // Keep only recent history
    if (metrics.historicalPerformance.length > 1000) {
      metrics.historicalPerformance = metrics.historicalPerformance.slice(-1000);
    }

    // Update percentiles
    this.updatePercentiles(metrics);
  }

  /**
   * Update latency percentiles
   */
  private updatePercentiles(metrics: MCPPerformanceMetrics): void {
    const latencies = metrics.historicalPerformance
      .map(h => h.latency)
      .sort((a, b) => a - b);

    if (latencies.length > 0) {
      const p95Index = Math.floor(latencies.length * 0.95);
      const p99Index = Math.floor(latencies.length * 0.99);
      
      metrics.p95Latency = latencies[p95Index];
      metrics.p99Latency = latencies[p99Index];
    }
  }

  /**
   * Update performance metrics periodically
   */
  private updatePerformanceMetrics(): void {
    // This would fetch real metrics from monitoring systems
    // For now, we'll just decay old metrics
    for (const metrics of this.performanceMetrics.values()) {
      const age = Date.now() - metrics.lastUpdated;
      if (age > 300000) { // 5 minutes
        // Reduce confidence in old metrics
        metrics.successRate = metrics.successRate * 0.95 + 0.9 * 0.05;
      }
    }
  }

  /**
   * Decay old metrics to adapt to changing conditions
   */
  private decayOldMetrics(): void {
    for (const metrics of this.performanceMetrics.values()) {
      // Remove very old historical data
      const cutoff = Date.now() - 3600000; // 1 hour
      metrics.historicalPerformance = metrics.historicalPerformance
        .filter(h => h.timestamp > cutoff);
    }
  }

  /**
   * Get routing recommendations
   */
  getRoutingRecommendations(query: InterpretedQuery): {
    recommendedStrategy: string;
    reasons: string[];
    alternativeStrategies: string[];
  } {
    const recommendations = {
      recommendedStrategy: 'balanced',
      reasons: [] as string[],
      alternativeStrategies: [] as string[]
    };

    // Analyze query characteristics
    if (query.intents.includes('realtime' as any) || query.entities.temporal === 'recent') {
      recommendations.recommendedStrategy = 'realtime';
      recommendations.reasons.push('Query requires real-time or recent data');
      recommendations.alternativeStrategies = ['performance'];
    } else if (query.intents.includes('analyze' as any) || query.intents.includes('aggregate' as any)) {
      recommendations.recommendedStrategy = 'reliability';
      recommendations.reasons.push('Complex analytical query requires high reliability');
      recommendations.alternativeStrategies = ['balanced'];
    } else if (query.entities.filters?.length > 5) {
      recommendations.recommendedStrategy = 'performance';
      recommendations.reasons.push('Complex filtering requires optimized performance');
      recommendations.alternativeStrategies = ['balanced', 'cost'];
    }

    return recommendations;
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): {
    topPerformers: string[];
    problematicMCPs: string[];
    recommendations: string[];
  } {
    const insights = {
      topPerformers: [] as string[],
      problematicMCPs: [] as string[],
      recommendations: [] as string[]
    };

    // Analyze metrics
    const sortedByPerformance = Array.from(this.performanceMetrics.entries())
      .sort((a, b) => a[1].avgLatency - b[1].avgLatency);

    // Top performers
    insights.topPerformers = sortedByPerformance
      .slice(0, 3)
      .filter(([, m]) => m.successRate > 0.95)
      .map(([id]) => id);

    // Problematic MCPs
    insights.problematicMCPs = Array.from(this.performanceMetrics.entries())
      .filter(([, m]) => m.successRate < 0.9 || m.avgLatency > 1000)
      .map(([id]) => id);

    // Generate recommendations
    if (insights.problematicMCPs.length > 0) {
      insights.recommendations.push('Consider removing or fixing problematic MCPs');
    }
    if (insights.topPerformers.length < 3) {
      insights.recommendations.push('Limited high-performing MCPs available');
    }

    return insights;
  }
}