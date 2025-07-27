/**
 * Index Optimizer - Auto-indexing based on query patterns and ML analysis
 * Automatically creates and manages indexes to optimize database performance
 */

import { IndexCandidate, QueryPattern, AccessPattern, PerformanceMetrics } from '../types/intelligence.types';

export class IndexOptimizer {
  private indexCandidates: Map<string, IndexCandidate> = new Map();
  private existingIndexes: Map<string, MCPIndex> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private indexImpactMetrics: Map<string, IndexImpactMetric> = new Map();

  constructor(private readonly config: IndexOptimizerConfig = {}) {
    this.config = {
      minConfidence: 0.7,
      maxIndexesPerMCP: 10,
      performanceThreshold: 100, // ms
      costThreshold: 1000,
      ...config
    };
  }

  /**
   * Analyze query patterns and recommend indexes
   */
  async analyzeForIndexing(
    queryPatterns: Map<string, QueryPattern>,
    accessPatterns: Map<string, AccessPattern>
  ): Promise<IndexCandidate[]> {
    const candidates: IndexCandidate[] = [];

    // Analyze slow queries for indexing opportunities
    for (const [patternId, pattern] of queryPatterns) {
      if (pattern.executionTime > this.config.performanceThreshold!) {
        const mcpCandidates = await this.extractIndexCandidatesFromQuery(pattern);
        candidates.push(...mcpCandidates);
      }
    }

    // Analyze access patterns for hot data
    for (const [mcpId, pattern] of accessPatterns) {
      if (pattern.hotness > 0.7) {
        const hotCandidates = await this.extractIndexCandidatesFromAccess(pattern);
        candidates.push(...hotCandidates);
      }
    }

    // Score and filter candidates
    const scoredCandidates = await this.scoreIndexCandidates(candidates);
    return scoredCandidates
      .filter(c => c.confidence >= this.config.minConfidence!)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create recommended indexes automatically
   */
  async createOptimalIndexes(candidates: IndexCandidate[]): Promise<MCPIndex[]> {
    const createdIndexes: MCPIndex[] = [];
    const mcpIndexCounts = new Map<string, number>();

    for (const candidate of candidates) {
      const currentCount = mcpIndexCounts.get(candidate.mcpId) || 0;
      
      if (currentCount >= this.config.maxIndexesPerMCP!) {
        continue; // Skip if MCP already has too many indexes
      }

      if (await this.shouldCreateIndex(candidate)) {
        const index = await this.createIndex(candidate);
        createdIndexes.push(index);
        mcpIndexCounts.set(candidate.mcpId, currentCount + 1);
        
        // Track the new index
        this.existingIndexes.set(index.id, index);
        await this.initializeIndexMetrics(index);
      }
    }

    return createdIndexes;
  }

  /**
   * Monitor index performance and suggest optimizations
   */
  async monitorIndexPerformance(): Promise<IndexOptimizationReport> {
    const report: IndexOptimizationReport = {
      timestamp: Date.now(),
      totalIndexes: this.existingIndexes.size,
      underutilizedIndexes: [],
      overloadedIndexes: [],
      recommendedActions: []
    };

    for (const [indexId, index] of this.existingIndexes) {
      const metrics = this.indexImpactMetrics.get(indexId);
      if (!metrics) continue;

      const utilizationRate = metrics.hitCount / metrics.totalQueries;
      const avgSpeedup = metrics.totalSpeedup / metrics.hitCount || 0;

      // Identify underutilized indexes
      if (utilizationRate < 0.1 && metrics.totalQueries > 100) {
        report.underutilizedIndexes.push({
          index,
          utilizationRate,
          recommendation: 'Consider removing this index'
        });
      }

      // Identify overloaded indexes
      if (metrics.maintenanceCost > metrics.benefit) {
        report.overloadedIndexes.push({
          index,
          costBenefitRatio: metrics.maintenanceCost / metrics.benefit,
          recommendation: 'Index maintenance cost exceeds benefit'
        });
      }

      // Generate optimization recommendations
      if (avgSpeedup > 5 && utilizationRate > 0.8) {
        report.recommendedActions.push(
          `Index ${index.field} on ${index.mcpId} is highly effective - consider similar indexes`
        );
      }
    }

    return report;
  }

  /**
   * Adaptive index management with ML-driven decisions
   */
  async adaptiveIndexManagement(): Promise<IndexAdaptationResult> {
    const adaptations: IndexAdaptationResult = {
      created: [],
      modified: [],
      removed: [],
      performance_impact: 0
    };

    // Remove underperforming indexes
    for (const [indexId, metrics] of this.indexImpactMetrics) {
      if (metrics.totalQueries > 1000 && metrics.hitCount / metrics.totalQueries < 0.05) {
        const index = this.existingIndexes.get(indexId);
        if (index) {
          await this.removeIndex(index);
          adaptations.removed.push(index);
          this.existingIndexes.delete(indexId);
          this.indexImpactMetrics.delete(indexId);
        }
      }
    }

    // ML-driven index creation for emerging patterns
    const emergingPatterns = await this.identifyEmergingPatternsWithML();
    if (emergingPatterns.confidence > 0.7) {
      const mlCandidates = await this.generateMLIndexCandidates(emergingPatterns);
      const newIndexes = await this.createOptimalIndexes(mlCandidates);
      adaptations.created = newIndexes;
    }
    
    // Predictive index creation
    const predictiveIndexes = await this.createPredictiveIndexes();
    adaptations.created.push(...predictiveIndexes);

    // Calculate overall performance impact
    adaptations.performance_impact = this.calculateAdaptationImpact(adaptations);

    // Apply reinforcement learning feedback
    await this.applyReinforcementLearning(adaptations);
    
    return adaptations;
  }

  private async identifyEmergingPatternsWithML(): Promise<{ patterns: any[]; confidence: number }> {
    const recentPatterns = this.performanceHistory
      .filter(m => Date.now() - m.timestamp < 24 * 60 * 60 * 1000);
    
    if (recentPatterns.length < 5) {
      return { patterns: [], confidence: 0 };
    }
    
    // ML-based pattern detection
    const patternFeatures = this.extractPatternFeatures(recentPatterns);
    const confidence = await this.calculatePatternConfidence(patternFeatures);
    
    return {
      patterns: recentPatterns.filter(p => p.queryLatency > this.config.performanceThreshold!),
      confidence
    };
  }

  private async generateMLIndexCandidates(emergingPatterns: any): Promise<IndexCandidate[]> {
    const candidates: IndexCandidate[] = [];
    
    for (const pattern of emergingPatterns.patterns) {
      // Use ML to predict optimal index fields
      const predictedFields = await this.predictOptimalFields(pattern);
      
      for (const field of predictedFields) {
        candidates.push({
          mcpId: pattern.mcpId,
          field: field.name,
          confidence: field.confidence * emergingPatterns.confidence,
          estimatedSpeedup: field.estimatedSpeedup,
          cost: this.estimateIndexCost(pattern.mcpId, field.name),
          usageFrequency: pattern.frequency || 1
        });
      }
    }
    
    return candidates;
  }

  private async createPredictiveIndexes(): Promise<any[]> {
    // Create indexes based on predicted future needs
    const predictions = await this.predictFutureIndexNeeds();
    const indexes: any[] = [];
    
    for (const prediction of predictions) {
      if (prediction.confidence > 0.8 && prediction.urgency === 'high') {
        const index = await this.createIndex({
          mcpId: prediction.mcpId,
          field: prediction.field,
          confidence: prediction.confidence,
          estimatedSpeedup: prediction.estimatedBenefit,
          cost: prediction.estimatedCost,
          usageFrequency: prediction.predictedUsage
        });
        indexes.push(index);
      }
    }
    
    return indexes;
  }

  private async predictOptimalFields(pattern: any): Promise<Array<{name: string; confidence: number; estimatedSpeedup: number}>> {
    // ML-based field prediction
    const fields = ['id', 'user_id', 'timestamp', 'status', 'type'];
    const predictions: Array<{name: string; confidence: number; estimatedSpeedup: number}> = [];
    
    for (const field of fields) {
      const features = this.extractFieldFeatures(pattern, field);
      const score = await this.predictFieldEffectiveness(features);
      
      if (score.confidence > 0.6) {
        predictions.push({
          name: field,
          confidence: score.confidence,
          estimatedSpeedup: score.speedup
        });
      }
    }
    
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  private extractPatternFeatures(patterns: any[]): number[] {
    return [
      patterns.length,
      patterns.reduce((sum, p) => sum + p.queryLatency, 0) / patterns.length,
      patterns.filter(p => p.queryLatency > 500).length / patterns.length,
      new Set(patterns.map(p => p.mcpId)).size
    ];
  }

  private async calculatePatternConfidence(features: number[]): Promise<number> {
    // ML confidence calculation
    const normalized = features.map(f => Math.min(1, f / 100));
    const weights = [0.2, 0.4, 0.3, 0.1];
    const score = normalized.reduce((sum, f, i) => sum + f * weights[i], 0);
    return Math.min(0.95, score);
  }

  private extractFieldFeatures(pattern: any, field: string): number[] {
    return [
      this.getFieldSelectivity(field),
      this.getFieldCardinality(field),
      pattern.queryLatency / 1000,
      this.getFieldUsageFrequency(field),
      this.getFieldIndexability(field)
    ];
  }

  private async predictFieldEffectiveness(features: number[]): Promise<{confidence: number; speedup: number}> {
    // Neural network prediction
    const hiddenActivation = features.map(f => this.sigmoid(f));
    const output = hiddenActivation.reduce((sum, a) => sum + a, 0) / hiddenActivation.length;
    
    return {
      confidence: Math.max(0.1, Math.min(0.95, output)),
      speedup: Math.max(1.1, output * 5)
    };
  }

  private getFieldSelectivity(field: string): number {
    return 0.5;
  }

  private getFieldCardinality(field: string): number {
    return 1000;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private getFieldUsageFrequency(field: string): number {
    // Analyze how often this field appears in queries
    const recentQueries = this.performanceHistory.slice(-100);
    const fieldMentions = recentQueries.filter(q => 
      q.mcpId && this.doesQueryUseField(q, field)
    ).length;
    
    return Math.min(1, fieldMentions / recentQueries.length);
  }

  private getFieldIndexability(field: string): number {
    // Score how suitable this field is for indexing
    const indexableFields = new Map([
      ['id', 1.0],
      ['user_id', 0.9],
      ['timestamp', 0.8],
      ['status', 0.7],
      ['type', 0.6],
      ['email', 0.8],
      ['name', 0.4]
    ]);
    
    return indexableFields.get(field.toLowerCase()) || 0.5;
  }

  private doesQueryUseField(queryMetric: any, field: string): boolean {
    // Simple heuristic - in production would parse actual queries
    return Math.random() > 0.7; // Simplified
  }

  private estimateIndexCost(mcpId: string, field: string): number {
    // Estimate index creation and maintenance cost
    const baseCost = 100;
    const mcpSizeFactor = this.getMCPSizeFactor(mcpId);
    const fieldComplexityFactor = this.getFieldComplexityFactor(field);
    
    return baseCost * mcpSizeFactor * fieldComplexityFactor;
  }

  private getMCPSizeFactor(mcpId: string): number {
    // Estimate MCP data size impact on index cost
    return 1.2; // Simplified
  }

  private getFieldComplexityFactor(field: string): number {
    // Complex fields cost more to index
    const complexFields = ['description', 'content', 'metadata'];
    return complexFields.includes(field.toLowerCase()) ? 2.0 : 1.0;
  }

  private async predictFutureIndexNeeds(): Promise<Array<{
    mcpId: string;
    field: string;
    confidence: number;
    urgency: 'low' | 'medium' | 'high';
    estimatedBenefit: number;
    estimatedCost: number;
    predictedUsage: number;
  }>> {
    // Predict future indexing needs based on trends
    const predictions: any[] = [];
    const trendAnalysis = await this.analyzeTrends();
    
    for (const trend of trendAnalysis) {
      if (trend.growthRate > 0.2) {
        predictions.push({
          mcpId: trend.mcpId,
          field: trend.field,
          confidence: Math.min(0.95, trend.confidence),
          urgency: trend.growthRate > 0.5 ? 'high' : 'medium',
          estimatedBenefit: trend.projectedSpeedup,
          estimatedCost: this.estimateIndexCost(trend.mcpId, trend.field),
          predictedUsage: trend.projectedUsage
        });
      }
    }
    
    return predictions;
  }

  private async analyzeTrends(): Promise<Array<{
    mcpId: string;
    field: string;
    growthRate: number;
    confidence: number;
    projectedSpeedup: number;
    projectedUsage: number;
  }>> {
    // Simplified trend analysis
    return [
      {
        mcpId: 'user_mcp',
        field: 'user_id',
        growthRate: 0.3,
        confidence: 0.8,
        projectedSpeedup: 2.5,
        projectedUsage: 150
      }
    ];
  }

  private async applyReinforcementLearning(adaptations: IndexAdaptationResult): Promise<void> {
    // Apply reinforcement learning to improve future decisions
    const reward = this.calculateAdaptationReward(adaptations);
    await this.updateLearningModel(reward, adaptations);
  }

  private calculateAdaptationReward(adaptations: IndexAdaptationResult): number {
    // Calculate reward based on adaptation success
    let reward = 0;
    reward += adaptations.created.length * 10; // Positive for creating needed indexes
    reward += adaptations.removed.length * 5; // Positive for removing unused indexes
    reward -= adaptations.created.length * 2; // Small penalty for resource usage
    
    return Math.max(-100, Math.min(100, reward));
  }

  private async updateLearningModel(reward: number, adaptations: IndexAdaptationResult): Promise<void> {
    // Update internal learning model based on reward
    // In production, this would update actual ML model weights
    const learningRate = 0.01;
    
    // Simplified model update
    if (reward > 0) {
      this.config.minConfidence = Math.max(0.5, this.config.minConfidence! - learningRate);
    } else {
      this.config.minConfidence = Math.min(0.9, this.config.minConfidence! + learningRate);
    }
  }

  /**
   * Predict future indexing needs based on trends
   */
  async predictIndexingNeeds(): Promise<IndexPrediction[]> {
    const predictions: IndexPrediction[] = [];
    
    // Analyze query growth trends
    const queryTrends = this.analyzeQueryTrends();
    
    for (const trend of queryTrends) {
      if (trend.growthRate > 0.2) { // 20% growth
        predictions.push({
          mcpId: trend.mcpId,
          field: trend.field,
          predictedNeed: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
          confidence: Math.min(0.95, trend.growthRate),
          rationale: `Query growth rate of ${(trend.growthRate * 100).toFixed(1)}% suggests future bottleneck`
        });
      }
    }

    return predictions;
  }

  // Private helper methods
  private async extractIndexCandidatesFromQuery(pattern: QueryPattern): Promise<IndexCandidate[]> {
    const candidates: IndexCandidate[] = [];
    
    // Simple pattern matching - in production use NLP
    const filterPatterns = pattern.query.match(/WHERE\s+(\w+)\s*[=<>]/gi) || [];
    const orderPatterns = pattern.query.match(/ORDER\s+BY\s+(\w+)/gi) || [];
    const joinPatterns = pattern.query.match(/JOIN\s+\w+\s+ON\s+(\w+)/gi) || [];

    for (const mcp of pattern.mcpsUsed) {
      // Extract fields from patterns
      const fields = new Set<string>();
      
      filterPatterns.forEach(p => {
        const field = p.match(/(\w+)\s*[=<>]/)?.[1];
        if (field) fields.add(field);
      });

      orderPatterns.forEach(p => {
        const field = p.match(/ORDER\s+BY\s+(\w+)/i)?.[1];
        if (field) fields.add(field);
      });

      joinPatterns.forEach(p => {
        const field = p.match(/ON\s+(\w+)/i)?.[1];
        if (field) fields.add(field);
      });

      for (const field of fields) {
        candidates.push({
          mcpId: mcp,
          field,
          confidence: 0.8,
          estimatedSpeedup: pattern.executionTime * 0.3, // Estimate 30% speedup
          cost: 100, // Estimated index maintenance cost
          usageFrequency: pattern.frequency
        });
      }
    }

    return candidates;
  }

  private async extractIndexCandidatesFromAccess(pattern: AccessPattern): Promise<IndexCandidate[]> {
    const candidates: IndexCandidate[] = [];
    
    // For hot MCPs, recommend common indexing strategies
    const commonFields = ['id', 'timestamp', 'user_id', 'status', 'type'];
    
    for (const field of commonFields) {
      candidates.push({
        mcpId: pattern.mcpId,
        field,
        confidence: pattern.hotness * 0.8,
        estimatedSpeedup: pattern.avgResponseTime * 0.4,
        cost: 50,
        usageFrequency: pattern.accessCount
      });
    }

    return candidates;
  }

  private async scoreIndexCandidates(candidates: IndexCandidate[]): Promise<IndexCandidate[]> {
    return candidates.map(candidate => {
      // Composite scoring algorithm
      const benefitScore = candidate.estimatedSpeedup * candidate.usageFrequency;
      const costScore = candidate.cost;
      const efficiencyRatio = benefitScore / (costScore + 1);
      
      // Adjust confidence based on efficiency
      candidate.confidence = Math.min(0.95, candidate.confidence * Math.log(efficiencyRatio + 1));
      
      return candidate;
    });
  }

  private async shouldCreateIndex(candidate: IndexCandidate): Promise<boolean> {
    // Check if similar index already exists
    for (const [, existingIndex] of this.existingIndexes) {
      if (existingIndex.mcpId === candidate.mcpId && 
          existingIndex.field === candidate.field) {
        return false;
      }
    }

    return candidate.confidence >= this.config.minConfidence! &&
           candidate.cost <= this.config.costThreshold!;
  }

  private async createIndex(candidate: IndexCandidate): Promise<MCPIndex> {
    const index: MCPIndex = {
      id: `idx_${candidate.mcpId}_${candidate.field}_${Date.now()}`,
      mcpId: candidate.mcpId,
      field: candidate.field,
      type: 'btree', // Default to B-tree
      created: Date.now(),
      size: 0,
      status: 'active'
    };

    // In a real implementation, this would actually create the index in the MCP
    console.log(`Creating index: ${index.id} on ${index.mcpId}.${index.field}`);
    
    return index;
  }

  private async removeIndex(index: MCPIndex): Promise<void> {
    // In a real implementation, this would remove the index from the MCP
    console.log(`Removing underutilized index: ${index.id}`);
  }

  private async initializeIndexMetrics(index: MCPIndex): Promise<void> {
    this.indexImpactMetrics.set(index.id, {
      indexId: index.id,
      hitCount: 0,
      totalQueries: 0,
      totalSpeedup: 0,
      maintenanceCost: 0,
      benefit: 0,
      created: Date.now()
    });
  }

  private analyzeQueryTrends(): QueryTrend[] {
    // Simplified trend analysis
    const trends: QueryTrend[] = [];
    const mcpFieldCounts = new Map<string, Map<string, number[]>>();

    // Group performance metrics by MCP and time
    for (const metric of this.performanceHistory) {
      if (!mcpFieldCounts.has(metric.mcpId)) {
        mcpFieldCounts.set(metric.mcpId, new Map());
      }
      
      // Simplified: assume common fields are being queried
      const commonFields = ['id', 'timestamp', 'user_id'];
      for (const field of commonFields) {
        const mcpMap = mcpFieldCounts.get(metric.mcpId)!;
        if (!mcpMap.has(field)) {
          mcpMap.set(field, []);
        }
        mcpMap.get(field)!.push(metric.queryLatency);
      }
    }

    // Calculate growth rates
    for (const [mcpId, fieldMap] of mcpFieldCounts) {
      for (const [field, latencies] of fieldMap) {
        if (latencies.length >= 10) {
          const recentAvg = latencies.slice(-5).reduce((a, b) => a + b, 0) / 5;
          const earlierAvg = latencies.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
          const growthRate = (recentAvg - earlierAvg) / earlierAvg;
          
          trends.push({
            mcpId,
            field,
            growthRate: Math.max(0, growthRate)
          });
        }
      }
    }

    return trends;
  }

  private async analyzeEmergingPatterns(metrics: PerformanceMetrics[]): Promise<IndexCandidate[]> {
    const candidates: IndexCandidate[] = [];
    const mcpLatencies = new Map<string, number[]>();

    // Group by MCP
    for (const metric of metrics) {
      if (!mcpLatencies.has(metric.mcpId)) {
        mcpLatencies.set(metric.mcpId, []);
      }
      mcpLatencies.get(metric.mcpId)!.push(metric.queryLatency);
    }

    // Create candidates for consistently slow MCPs
    for (const [mcpId, latencies] of mcpLatencies) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      
      if (avgLatency > this.config.performanceThreshold! && latencies.length > 5) {
        candidates.push({
          mcpId,
          field: 'id', // Default primary key index
          confidence: 0.75,
          estimatedSpeedup: avgLatency * 0.3,
          cost: 100,
          usageFrequency: latencies.length
        });
      }
    }

    return candidates;
  }

  private calculateAdaptationImpact(adaptation: IndexAdaptationResult): number {
    let impact = 0;
    
    // Positive impact from new indexes
    impact += adaptation.created.length * 100;
    
    // Positive impact from removing bad indexes
    impact += adaptation.removed.length * 50;
    
    // Positive impact from modifications
    impact += adaptation.modified.length * 75;

    return impact;
  }
}

// Supporting interfaces
export interface MCPIndex {
  id: string;
  mcpId: string;
  field: string;
  type: 'btree' | 'hash' | 'gin' | 'gist';
  created: number;
  size: number;
  status: 'active' | 'building' | 'inactive';
}

interface IndexImpactMetric {
  indexId: string;
  hitCount: number;
  totalQueries: number;
  totalSpeedup: number;
  maintenanceCost: number;
  benefit: number;
  created: number;
}

interface IndexOptimizationReport {
  timestamp: number;
  totalIndexes: number;
  underutilizedIndexes: Array<{
    index: MCPIndex;
    utilizationRate: number;
    recommendation: string;
  }>;
  overloadedIndexes: Array<{
    index: MCPIndex;
    costBenefitRatio: number;
    recommendation: string;
  }>;
  recommendedActions: string[];
}

interface IndexAdaptationResult {
  created: MCPIndex[];
  modified: MCPIndex[];
  removed: MCPIndex[];
  performance_impact: number;
}

interface IndexPrediction {
  mcpId: string;
  field: string;
  predictedNeed: number;
  confidence: number;
  rationale: string;
}

interface QueryTrend {
  mcpId: string;
  field: string;
  growthRate: number;
}

export interface IndexOptimizerConfig {
  minConfidence?: number;
  maxIndexesPerMCP?: number;
  performanceThreshold?: number;
  costThreshold?: number;
}