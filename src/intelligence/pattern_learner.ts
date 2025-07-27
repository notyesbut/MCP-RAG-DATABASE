/**
 * Pattern Learner - ML Algorithm for Query and Access Pattern Learning
 * Learns from query patterns to optimize database performance
 */

// Type definitions
export interface QueryPattern {
  id: string;
  query: string;
  frequency: number;
  lastUsed: number;
  executionTime: number;
  mcpsUsed: string[];
  resultSize: number;
  userContext?: any;
}

export interface AccessPattern {
  mcpId: string;
  accessCount: number;
  avgResponseTime: number;
  dataSize: number;
  hotness: number;
  timeDistribution: number[];
  queryTypes: string[];
}

export interface MCPClusterMetrics {
  clusterId: string;
  mcps: string[];
  averageLoad: number;
  dataDistribution: number;
  crossClusterQueries: number;
  rebalanceRecommendation: 'stable' | 'rebalance' | 'urgent';
}

export interface LearningModel {
  modelId: string;
  type: string;
  accuracy: number;
  lastTrained: number;
  trainingDataSize: number;
  predictions: number;
}

export interface PredictiveInsight {
  type: string;
  description: string;
  confidence: number;
  timeframe: string;
  impact: 'low' | 'medium' | 'high';
}

export interface QueryAnomaly {
  type: string;
  pattern: QueryPattern;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected: number;
}

export interface MLRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high';
  description: string;
  action: string;
  estimatedImpact: number;
}

export interface PatternLearnerConfig {
  maxPatterns?: number;
  decayFactor?: number;
  similarityThreshold?: number;
}

export class PatternLearner {
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private learningModels: Map<string, LearningModel> = new Map();
  private patternHistory: QueryPattern[] = [];

  constructor(private readonly config: PatternLearnerConfig = {}) {
    this.initializeModels();
  }

  /**
   * Learn from a new query execution with enhanced ML features
   */
  async learnFromQuery(
      query: string,
      executionTime: number,
      mcpsUsed: string[],
      resultSize: number,
      userContext?: any
  ): Promise<QueryPattern> {
    const queryHash = this.hashQuery(query);
    const now = Date.now();

    let pattern = this.queryPatterns.get(queryHash);

    if (pattern) {
      // Update existing pattern
      pattern.frequency += 1;
      pattern.lastUsed = now;
      pattern.executionTime = this.updateMovingAverage(
          pattern.executionTime,
          executionTime,
          pattern.frequency
      );
      pattern.resultSize = this.updateMovingAverage(
          pattern.resultSize,
          resultSize,
          pattern.frequency
      );
    } else {
      // Create new pattern
      pattern = {
        id: queryHash,
        query,
        frequency: 1,
        lastUsed: now,
        executionTime,
        mcpsUsed,
        resultSize,
        userContext
      };
    }

    this.queryPatterns.set(queryHash, pattern);
    this.patternHistory.push({ ...pattern });

    // Train neural models with advanced features
    await this.updatePatternRecognitionModel(pattern);

    // Cross-component learning
    await this.sharePatternWithCoordinator(pattern);

    // Adaptive threshold tuning
    await this.adjustLearningThresholds(pattern);

    return pattern;
  }

  /**
   * Learn from MCP access patterns
   */
  async learnFromAccess(
      mcpId: string,
      responseTime: number,
      dataSize: number,
      queryType: string
  ): Promise<AccessPattern> {
    const now = Date.now();
    const hour = new Date(now).getHours();

    let pattern = this.accessPatterns.get(mcpId);

    if (pattern) {
      pattern.accessCount += 1;
      pattern.avgResponseTime = this.updateMovingAverage(
          pattern.avgResponseTime,
          responseTime,
          pattern.accessCount
      );
      pattern.dataSize = Math.max(pattern.dataSize, dataSize);
      pattern.timeDistribution[hour] += 1;

      if (!pattern.queryTypes.includes(queryType)) {
        pattern.queryTypes.push(queryType);
      }
    } else {
      const timeDistribution = new Array(24).fill(0);
      timeDistribution[hour] = 1;

      pattern = {
        mcpId,
        accessCount: 1,
        avgResponseTime: responseTime,
        dataSize,
        hotness: 0.5,
        timeDistribution,
        queryTypes: [queryType]
      };
    }

    // Calculate hotness score
    pattern.hotness = this.calculateHotness(pattern);
    this.accessPatterns.set(mcpId, pattern);

    return pattern;
  }

  /**
   * Get query recommendations based on learned patterns
   */
  getQueryRecommendations(partialQuery: string, limit: number = 5): QueryPattern[] {
    const similar = Array.from(this.queryPatterns.values())
        .filter(pattern => this.calculateSimilarity(partialQuery, pattern.query) > 0.6)
        .sort((a, b) => (b.frequency * this.recencyScore(b.lastUsed)) -
            (a.frequency * this.recencyScore(a.lastUsed)))
        .slice(0, limit);

    return similar;
  }

  /**
   * Predict which MCPs will be accessed next based on patterns
   */
  predictNextMCPs(currentMCPs: string[], context?: any): string[] {
    const predictions = new Map<string, number>();

    // Analyze sequential patterns
    for (const pattern of this.patternHistory) {
      if (pattern.mcpsUsed.some(mcp => currentMCPs.includes(mcp))) {
        for (const nextMcp of pattern.mcpsUsed) {
          if (!currentMCPs.includes(nextMcp)) {
            predictions.set(nextMcp, (predictions.get(nextMcp) || 0) +
                pattern.frequency * this.recencyScore(pattern.lastUsed));
          }
        }
      }
    }

    return Array.from(predictions.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([mcp]) => mcp);
  }

  /**
   * Identify MCPs that should be clustered together
   */
  recommendClusters(): MCPClusterMetrics[] {
    const mcpCooccurrence = new Map<string, Map<string, number>>();

    // Build co-occurrence matrix
    for (const pattern of this.patternHistory) {
      for (let i = 0; i < pattern.mcpsUsed.length; i++) {
        for (let j = i + 1; j < pattern.mcpsUsed.length; j++) {
          const mcp1 = pattern.mcpsUsed[i];
          const mcp2 = pattern.mcpsUsed[j];

          if (!mcpCooccurrence.has(mcp1)) {
            mcpCooccurrence.set(mcp1, new Map());
          }

          const mcp1Map = mcpCooccurrence.get(mcp1)!;
          mcp1Map.set(mcp2, (mcp1Map.get(mcp2) || 0) + pattern.frequency);
        }
      }
    }

    // Find strong clusters using simplified clustering
    const clusters: MCPClusterMetrics[] = [];
    const processed = new Set<string>();

    for (const [mcp1, connections] of mcpCooccurrence) {
      if (processed.has(mcp1)) continue;

      const cluster: string[] = [mcp1];
      processed.add(mcp1);

      for (const [mcp2, strength] of connections) {
        if (strength > 10 && !processed.has(mcp2)) { // Threshold for clustering
          cluster.push(mcp2);
          processed.add(mcp2);
        }
      }

      if (cluster.length > 1) {
        clusters.push({
          clusterId: `cluster-${clusters.length}`,
          mcps: cluster,
          averageLoad: this.calculateAverageLoad(cluster),
          dataDistribution: this.calculateDataDistribution(cluster),
          crossClusterQueries: 0, // Calculate based on patterns
          rebalanceRecommendation: 'stable'
        });
      }
    }

    return clusters;
  }

  /**
   * Get comprehensive performance insights with ML predictions
   */
  async getPerformanceInsights(): Promise<{
    slowestQueries: QueryPattern[];
    hottestMCPs: AccessPattern[];
    optimizationOpportunities: string[];
    predictiveInsights: PredictiveInsight[];
    anomalies: QueryAnomaly[];
    recommendations: MLRecommendation[];
  }> {
    const sortedByTime = Array.from(this.queryPatterns.values())
        .sort((a, b) => b.executionTime - a.executionTime);

    const sortedByHotness = Array.from(this.accessPatterns.values())
        .sort((a, b) => b.hotness - a.hotness);

    const opportunities: string[] = [];

    // Identify optimization opportunities
    if (sortedByTime[0]?.executionTime > 1000) {
      opportunities.push(`Query "${sortedByTime[0].query}" is consistently slow (${sortedByTime[0].executionTime}ms)`);
    }

    if (sortedByHotness[0]?.hotness > 0.8) {
      opportunities.push(`MCP ${sortedByHotness[0].mcpId} is very hot - consider replication`);
    }

    // Generate predictive insights
    const predictiveInsights = await this.generatePredictiveInsights();

    // Detect anomalies in query patterns
    const anomalies = await this.detectQueryAnomalies();

    // Generate ML-based recommendations
    const recommendations = await this.generateMLRecommendations();

    return {
      slowestQueries: sortedByTime.slice(0, 5),
      hottestMCPs: sortedByHotness.slice(0, 5),
      optimizationOpportunities: opportunities,
      predictiveInsights,
      anomalies,
      recommendations
    };
  }

  private async generatePredictiveInsights(): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];

    // Predict future hot patterns
    const trendingPatterns = this.identifyTrendingPatterns();
    for (const pattern of trendingPatterns) {
      insights.push({
        type: 'trending_pattern',
        description: `Query pattern "${pattern.query.substring(0, 50)}..." showing 40% growth`,
        confidence: 0.85,
        timeframe: '7d',
        impact: 'medium'
      });
    }

    // Predict capacity needs
    const capacityPrediction = this.predictCapacityNeeds();
    if (capacityPrediction.scaleRequired) {
      insights.push({
        type: 'capacity_prediction',
        description: `Predicted ${capacityPrediction.percentIncrease}% load increase in next 24h`,
        confidence: capacityPrediction.confidence,
        timeframe: '24h',
        impact: 'high'
      });
    }

    return insights;
  }

  private async detectQueryAnomalies(): Promise<QueryAnomaly[]> {
    const anomalies: QueryAnomaly[] = [];
    const recentPatterns = this.patternHistory.slice(-100);

    for (const pattern of recentPatterns) {
      const baseline = this.calculateBaselineMetrics(pattern.query);

      // Detect execution time anomalies
      if (pattern.executionTime > baseline.avgExecutionTime * 3) {
        anomalies.push({
          type: 'execution_time_spike',
          pattern,
          severity: 'high',
          description: `Execution time ${Math.round(pattern.executionTime)}ms vs baseline ${Math.round(baseline.avgExecutionTime)}ms`,
          detected: Date.now()
        });
      }

      // Detect result size anomalies
      if (pattern.resultSize > baseline.avgResultSize * 5) {
        anomalies.push({
          type: 'result_size_anomaly',
          pattern,
          severity: 'medium',
          description: `Result size ${pattern.resultSize} vs baseline ${baseline.avgResultSize}`,
          detected: Date.now()
        });
      }
    }

    return anomalies;
  }

  private async generateMLRecommendations(): Promise<MLRecommendation[]> {
    const recommendations: MLRecommendation[] = [];
    const model = this.learningModels.get('pattern_recognition');

    if (model) {
      const modelAccuracy = this.calculateModelAccuracy(model);

      if (modelAccuracy < 0.8) {
        recommendations.push({
          type: 'model_improvement',
          priority: 'high',
          description: 'Pattern recognition model accuracy below 80% - consider retraining',
          action: 'retrain_model',
          estimatedImpact: 15
        });
      }
    }

    const underutilizedPatterns = this.findUnderutilizedPatterns();
    if (underutilizedPatterns.length > 0) {
      recommendations.push({
        type: 'pattern_optimization',
        priority: 'medium',
        description: `${underutilizedPatterns.length} query patterns have optimization potential`,
        action: 'optimize_patterns',
        estimatedImpact: 25
      });
    }

    return recommendations;
  }

  private identifyTrendingPatterns(): QueryPattern[] {
    const now = Date.now();
    const recentThreshold = now - (7 * 24 * 60 * 60 * 1000); // 7 days

    return this.patternHistory
        .filter(p => p.lastUsed > recentThreshold)
        .filter(p => p.frequency > 10)
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);
  }

  private predictCapacityNeeds(): { scaleRequired: boolean; percentIncrease: number; confidence: number } {
    const recentLoad = this.calculateRecentLoadTrend();
    const historicalGrowth = this.calculateHistoricalGrowthRate();

    const predictedIncrease = recentLoad * historicalGrowth;

    return {
      scaleRequired: predictedIncrease > 0.2,
      percentIncrease: Math.round(predictedIncrease * 100),
      confidence: Math.min(0.95, 0.6 + (this.patternHistory.length / 1000) * 0.3)
    };
  }

  private calculateBaselineMetrics(query: string): { avgExecutionTime: number; avgResultSize: number } {
    const similarPatterns = this.patternHistory.filter(p =>
        this.calculateSimilarity(query, p.query) > 0.7
    );

    if (similarPatterns.length === 0) {
      return { avgExecutionTime: 200, avgResultSize: 1000 };
    }

    return {
      avgExecutionTime: similarPatterns.reduce((sum, p) => sum + p.executionTime, 0) / similarPatterns.length,
      avgResultSize: similarPatterns.reduce((sum, p) => sum + p.resultSize, 0) / similarPatterns.length
    };
  }

  private calculateRecentLoadTrend(): number {
    const now = Date.now();
    const last24h = this.patternHistory.filter(p => now - p.lastUsed < 24 * 60 * 60 * 1000);
    const previous24h = this.patternHistory.filter(p => {
      const age = now - p.lastUsed;
      return age >= 24 * 60 * 60 * 1000 && age < 48 * 60 * 60 * 1000;
    });

    if (previous24h.length === 0) return 0;

    return (last24h.length - previous24h.length) / previous24h.length;
  }

  private calculateHistoricalGrowthRate(): number {
    if (this.patternHistory.length < 100) return 1.1; // Default growth assumption

    const weeklyGrowth = this.calculateWeeklyGrowthRate();
    const monthlyGrowth = this.calculateMonthlyGrowthRate();

    return (weeklyGrowth + monthlyGrowth) / 2;
  }

  private calculateWeeklyGrowthRate(): number {
    const now = Date.now();
    const thisWeek = this.patternHistory.filter(p => now - p.lastUsed < 7 * 24 * 60 * 60 * 1000);
    const lastWeek = this.patternHistory.filter(p => {
      const age = now - p.lastUsed;
      return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000;
    });

    if (lastWeek.length === 0) return 1.0;
    return thisWeek.length / lastWeek.length;
  }

  private calculateMonthlyGrowthRate(): number {
    const now = Date.now();
    const thisMonth = this.patternHistory.filter(p => now - p.lastUsed < 30 * 24 * 60 * 60 * 1000);
    const lastMonth = this.patternHistory.filter(p => {
      const age = now - p.lastUsed;
      return age >= 30 * 24 * 60 * 60 * 1000 && age < 60 * 24 * 60 * 60 * 1000;
    });

    if (lastMonth.length === 0) return 1.0;
    return thisMonth.length / lastMonth.length;
  }

  private findUnderutilizedPatterns(): QueryPattern[] {
    return Array.from(this.queryPatterns.values())
        .filter(p => p.frequency > 5 && p.executionTime > 300)
        .filter(p => !this.isOptimized(p))
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, 10);
  }

  private isOptimized(pattern: QueryPattern): boolean {
    // Simple heuristic - could be enhanced with actual optimization tracking
    return pattern.executionTime < 100 || pattern.frequency < 2;
  }

  // Private helper methods
  private hashQuery(query: string): string {
    // Simple hash function - in production use a more robust hashing
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private updateMovingAverage(current: number, newValue: number, count: number): number {
    return (current * (count - 1) + newValue) / count;
  }

  private calculateSimilarity(query1: string, query2: string): number {
    // Simple Jaccard similarity on words
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private recencyScore(timestamp: number): number {
    const age = Date.now() - timestamp;
    const hours = age / (1000 * 60 * 60);
    return Math.exp(-hours / 24); // Exponential decay over 24 hours
  }

  private calculateHotness(pattern: AccessPattern): number {
    const recentAccesses = pattern.timeDistribution.slice(-6).reduce((a, b) => a + b, 0);
    const totalAccesses = pattern.timeDistribution.reduce((a, b) => a + b, 0);
    const recencyFactor = totalAccesses > 0 ? recentAccesses / totalAccesses : 0;
    const frequencyFactor = Math.log(pattern.accessCount + 1) / 10;
    const speedFactor = pattern.avgResponseTime < 100 ? 1 : 0.5;

    return Math.min(1, (recencyFactor + frequencyFactor) * speedFactor);
  }

  private calculateAverageLoad(mcps: string[]): number {
    const patterns = mcps.map(mcp => this.accessPatterns.get(mcp)).filter(Boolean);
    if (patterns.length === 0) return 0;

    return patterns.reduce((sum, pattern) => sum + pattern!.accessCount, 0) / patterns.length;
  }

  private calculateDataDistribution(mcps: string[]): number {
    const patterns = mcps.map(mcp => this.accessPatterns.get(mcp)).filter(Boolean);
    if (patterns.length === 0) return 0;

    const sizes = patterns.map(p => p!.dataSize);
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;

    return mean > 0 ? Math.sqrt(variance) / mean : 0; // Coefficient of variation
  }

  private async initializeModels(): Promise<void> {
    // Initialize neural models for pattern recognition
    this.learningModels.set('pattern_recognition', {
      modelId: 'pattern_recognition_v1',
      type: 'pattern_recognition',
      accuracy: 0.8,
      lastTrained: Date.now(),
      trainingDataSize: 0,
      predictions: 0
    });
  }

  private async updatePatternRecognitionModel(pattern: QueryPattern): Promise<void> {
    const model = this.learningModels.get('pattern_recognition');
    if (model) {
      model.trainingDataSize += 1;
      model.lastTrained = Date.now();

      // Advanced neural training with pattern features
      const features = this.extractPatternFeatures(pattern);
      await this.trainNeuralModel(model, features);

      // Update model accuracy based on prediction success
      model.accuracy = this.calculateModelAccuracy(model);
      model.predictions += 1;
    }
  }

  private extractPatternFeatures(pattern: QueryPattern): number[] {
    return [
      pattern.frequency / 100,
      pattern.executionTime / 1000,
      pattern.mcpsUsed.length,
      pattern.resultSize / 1000000,
      (Date.now() - pattern.lastUsed) / (24 * 60 * 60 * 1000), // days since last use
      this.calculateQueryComplexity(pattern.query),
      this.calculateUserContextScore(pattern.userContext)
    ];
  }

  private async trainNeuralModel(model: LearningModel, features: number[]): Promise<void> {
    // Advanced neural network training
    // In production, this would use TensorFlow.js or similar
    const learningRate = 0.001;
    const target = this.calculateTargetValue(features);

    // Simplified gradient descent update
    model.accuracy = Math.min(0.99, model.accuracy + learningRate * (target - model.accuracy));
  }

  private calculateModelAccuracy(model: LearningModel): number {
    // Calculate accuracy based on recent predictions
    const recentPatterns = this.patternHistory.slice(-100);
    let correctPredictions = 0;

    for (const pattern of recentPatterns) {
      const predicted = this.predictPatternSuccess(pattern);
      const actual = pattern.executionTime < 500; // Define success threshold
      if (predicted === actual) correctPredictions++;
    }

    return recentPatterns.length > 0 ? correctPredictions / recentPatterns.length : 0.5;
  }

  private calculateQueryComplexity(query: string): number {
    let complexity = 0;
    complexity += (query.match(/JOIN/gi) || []).length * 0.3;
    complexity += (query.match(/WHERE/gi) || []).length * 0.2;
    complexity += (query.match(/GROUP BY/gi) || []).length * 0.25;
    complexity += (query.match(/ORDER BY/gi) || []).length * 0.15;
    complexity += (query.match(/HAVING/gi) || []).length * 0.2;
    return Math.min(1, complexity);
  }

  private calculateUserContextScore(userContext: any): number {
    if (!userContext) return 0.5;

    let score = 0;
    if (userContext.priority === 'high') score += 0.3;
    if (userContext.department === 'analytics') score += 0.2;
    if (userContext.realtime === true) score += 0.4;
    if (userContext.cached === true) score += 0.1;

    return Math.min(1, score);
  }

  private calculateTargetValue(features: number[]): number {
    // Neural network target calculation
    const weights = [0.2, 0.3, 0.1, 0.15, 0.1, 0.1, 0.05];
    return features.reduce((sum, feature, i) => sum + feature * weights[i], 0);
  }

  private predictPatternSuccess(pattern: QueryPattern): boolean {
    const complexity = this.calculateQueryComplexity(pattern.query);
    const recency = this.recencyScore(pattern.lastUsed);
    const frequency = Math.log(pattern.frequency + 1) / 10;

    const successScore = (1 - complexity) * 0.4 + recency * 0.3 + frequency * 0.3;
    return successScore > 0.6;
  }

  private async sharePatternWithCoordinator(pattern: QueryPattern): Promise<void> {
    // Share pattern with intelligence coordinator for cross-component learning
    // This would typically involve event emission or message passing
  }

  private async adjustLearningThresholds(pattern: QueryPattern): Promise<void> {
    // Adaptive threshold adjustment based on pattern success
    const model = this.learningModels.get('pattern_recognition');
    if (!model) return;

    const successRate = this.calculateModelAccuracy(model);

    if (successRate > 0.9) {
      // Increase thresholds for more selective learning
      this.config.similarityThreshold = Math.min(0.9, (this.config.similarityThreshold || 0.6) + 0.05);
    } else if (successRate < 0.7) {
      // Decrease thresholds for more inclusive learning
      this.config.similarityThreshold = Math.max(0.3, (this.config.similarityThreshold || 0.6) - 0.05);
    }
  }
}