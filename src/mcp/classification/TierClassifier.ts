/**
 * HOT/COLD Tier Classification System
 * Advanced algorithms for intelligent data tier placement and optimization
 */

import { MCPTier, MCPMetadata, MCPPerformance } from '../../types/mcp.types';

export interface ClassificationCriteria {
  // Access patterns
  accessFrequency: number;      // Accesses per hour
  lastAccessHours: number;      // Hours since last access
  accessTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Performance metrics
  avgQueryTime: number;         // Average query execution time
  cacheHitRatio: number;        // Cache effectiveness
  errorRate: number;            // Error frequency
  
  // Data characteristics
  dataSize: number;             // Size in bytes
  dataGrowthRate: number;       // Growth rate per day
  compressionRatio: number;     // How well data compresses
  
  // Business metrics
  businessCriticality: 'low' | 'medium' | 'high' | 'critical';
  costSensitivity: number;      // 0-1 scale
  complianceRequirements: string[];
}

export interface TierThresholds {
  hot: {
    minAccessFrequency: number;
    maxQueryTime: number;
    minCacheHitRatio: number;
    maxErrorRate: number;
    maxDataSize?: number;
  };
  warm: {
    minAccessFrequency: number;
    maxAccessFrequency: number;
    maxQueryTime: number;
    minCacheHitRatio: number;
    maxErrorRate: number;
  };
  cold: {
    maxAccessFrequency: number;
    minLastAccessHours: number;
    maxQueryTime?: number;
    compressionBenefit: number;
  };
}

export interface ClassificationResult {
  recommendedTier: MCPTier;
  confidence: number;           // 0-1 confidence score
  reason: string;
  alternativeTier?: MCPTier;
  migrationCost: number;        // Estimated cost/time for migration
  expectedBenefit: number;      // Expected performance/cost benefit
  warnings: string[];
}

export interface AccessPattern {
  hourlyAccess: number[];       // 24-hour access pattern
  dailyAccess: number[];        // 7-day access pattern
  seasonality: {
    detected: boolean;
    period: 'daily' | 'weekly' | 'monthly';
    strength: number;
  };
  peakHours: number[];
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  volatility: number;           // How much access varies
}

export class TierClassifier {
  private thresholds: TierThresholds;
  private accessPatterns: Map<string, AccessPattern>;
  private classificationHistory: Map<string, ClassificationResult[]>;

  constructor(thresholds?: Partial<TierThresholds>) {
    this.accessPatterns = new Map();
    this.classificationHistory = new Map();
    
    this.thresholds = {
      hot: {
        minAccessFrequency: 10,     // 10+ accesses per hour
        maxQueryTime: 100,          // < 100ms response time
        minCacheHitRatio: 0.8,      // 80%+ cache hits
        maxErrorRate: 0.01,         // < 1% errors
        maxDataSize: 10 * 1024 * 1024 * 1024 // 10GB max for hot tier
      },
      warm: {
        minAccessFrequency: 1,      // 1+ accesses per hour
        maxAccessFrequency: 10,     // < 10 accesses per hour
        maxQueryTime: 500,          // < 500ms response time
        minCacheHitRatio: 0.5,      // 50%+ cache hits
        maxErrorRate: 0.05          // < 5% errors
      },
      cold: {
        maxAccessFrequency: 1,      // < 1 access per hour
        minLastAccessHours: 168,    // 7 days since last access
        maxQueryTime: 5000,         // 5s acceptable for cold
        compressionBenefit: 0.3     // 30%+ compression savings
      },
      ...thresholds
    };
  }

  async classifyMCP(metadata: MCPMetadata, performance: MCPPerformance, accessHistory: number[]): Promise<ClassificationResult> {
    // Analyze access patterns
    const accessPattern = this.analyzeAccessPattern(metadata.id, accessHistory);
    
    // Extract classification criteria
    const criteria = this.extractCriteria(metadata, performance, accessPattern);
    
    // Run multiple classification algorithms
    const results = await Promise.all([
      this.ruleBasedClassification(criteria),
      this.mlBasedClassification(criteria, accessPattern),
      this.costOptimizedClassification(criteria),
      this.performanceOptimizedClassification(criteria)
    ]);
    
    // Ensemble the results
    const finalResult = this.ensembleResults(results, criteria);
    
    // Store classification history
    this.updateClassificationHistory(metadata.id, finalResult);
    
    return finalResult;
  }

  async batchClassifyMCPs(mcpData: Array<{
    metadata: MCPMetadata;
    performance: MCPPerformance;
    accessHistory: number[];
  }>): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();
    
    // Process in parallel batches
    const batchSize = 10;
    for (let i = 0; i < mcpData.length; i += batchSize) {
      const batch = mcpData.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async ({ metadata, performance, accessHistory }) => ({
          id: metadata.id,
          result: await this.classifyMCP(metadata, performance, accessHistory)
        }))
      );
      
      batchResults.forEach(({ id, result }) => {
        results.set(id, result);
      });
    }
    
    return results;
  }

  // Rule-based classification (traditional approach)
  private async ruleBasedClassification(criteria: ClassificationCriteria): Promise<ClassificationResult> {
    const warnings: string[] = [];
    let tier: MCPTier;
    let confidence = 1.0;
    let reason = '';

    // Hot tier evaluation
    if (criteria.accessFrequency >= this.thresholds.hot.minAccessFrequency &&
        criteria.avgQueryTime <= this.thresholds.hot.maxQueryTime &&
        criteria.cacheHitRatio >= this.thresholds.hot.minCacheHitRatio &&
        criteria.errorRate <= this.thresholds.hot.maxErrorRate) {
      
      tier = MCPTier.HOT;
      reason = 'High access frequency with excellent performance metrics';
      
      if (this.thresholds.hot.maxDataSize && criteria.dataSize > this.thresholds.hot.maxDataSize) {
        warnings.push('Data size exceeds hot tier recommendations');
        confidence *= 0.8;
      }
    }
    // Cold tier evaluation
    else if (criteria.accessFrequency <= this.thresholds.cold.maxAccessFrequency &&
             criteria.lastAccessHours >= this.thresholds.cold.minLastAccessHours) {
      
      tier = MCPTier.COLD;
      reason = 'Low access frequency and stale data suitable for archival';
      
      if (criteria.compressionRatio < this.thresholds.cold.compressionBenefit) {
        warnings.push('Low compression benefit may not justify cold storage');
        confidence *= 0.9;
      }
    }
    // Warm tier (default)
    else {
      tier = MCPTier.WARM;
      reason = 'Moderate access patterns suitable for balanced storage';
      
      if (criteria.avgQueryTime > this.thresholds.warm.maxQueryTime) {
        warnings.push('Query performance may benefit from hot tier promotion');
      }
    }

    return {
      recommendedTier: tier,
      confidence,
      reason,
      migrationCost: this.estimateMigrationCost(criteria, tier),
      expectedBenefit: this.estimateBenefit(criteria, tier),
      warnings
    };
  }

  // ML-based classification using access patterns
  private async mlBasedClassification(criteria: ClassificationCriteria, accessPattern: AccessPattern): Promise<ClassificationResult> {
    // Simplified ML-like scoring system
    let hotScore = 0;
    let warmScore = 0;
    let coldScore = 0;

    // Access frequency weight
    const accessWeight = Math.min(criteria.accessFrequency / 10, 1);
    hotScore += accessWeight * 0.4;
    warmScore += (1 - Math.abs(accessWeight - 0.5)) * 0.3;
    coldScore += (1 - accessWeight) * 0.4;

    // Performance weight
    const perfWeight = Math.max(0, 1 - (criteria.avgQueryTime / 1000));
    hotScore += perfWeight * 0.3;
    warmScore += perfWeight * 0.2;

    // Trend analysis
    if (accessPattern.trendDirection === 'increasing') {
      hotScore += 0.2;
    } else if (accessPattern.trendDirection === 'decreasing') {
      coldScore += 0.3;
    } else {
      warmScore += 0.2;
    }

    // Seasonality consideration
    if (accessPattern.seasonality.detected) {
      warmScore += 0.1; // Seasonal data often fits warm tier
    }

    // Volatility consideration
    if (accessPattern.volatility > 0.5) {
      warmScore += 0.1; // High volatility suggests warm tier
    }

    // Business criticality
    switch (criteria.businessCriticality) {
      case 'critical':
        hotScore += 0.3;
        break;
      case 'high':
        hotScore += 0.2;
        break;
      case 'medium':
        warmScore += 0.2;
        break;
      case 'low':
        coldScore += 0.2;
        break;
    }

    // Determine winner
    const scores = { hot: hotScore, warm: warmScore, cold: coldScore };
    const maxScore = Math.max(hotScore, warmScore, coldScore);
    
    let recommendedTier: MCPTier;
    if (maxScore === hotScore) {
      recommendedTier = MCPTier.HOT;
    } else if (maxScore === coldScore) {
      recommendedTier = MCPTier.COLD;
    } else {
      recommendedTier = MCPTier.WARM;
    }

    return {
      recommendedTier,
      confidence: maxScore,
      reason: `ML-based analysis (hot: ${hotScore.toFixed(2)}, warm: ${warmScore.toFixed(2)}, cold: ${coldScore.toFixed(2)})`,
      migrationCost: this.estimateMigrationCost(criteria, recommendedTier),
      expectedBenefit: this.estimateBenefit(criteria, recommendedTier),
      warnings: []
    };
  }

  // Cost-optimized classification
  private async costOptimizedClassification(criteria: ClassificationCriteria): Promise<ClassificationResult> {
    const storageCosts = {
      [MCPTier.HOT]: criteria.dataSize * 0.10,   // $0.10 per GB
      [MCPTier.WARM]: criteria.dataSize * 0.05,  // $0.05 per GB
      [MCPTier.COLD]: criteria.dataSize * 0.01,  // $0.01 per GB
      [MCPTier.ARCHIVE]: criteria.dataSize * 0.001 // $0.001 per GB
    };

    const operationalCosts = {
      [MCPTier.HOT]: criteria.accessFrequency * 0.001,   // $0.001 per access
      [MCPTier.WARM]: criteria.accessFrequency * 0.0005, // $0.0005 per access
      [MCPTier.COLD]: criteria.accessFrequency * 0.01,   // $0.01 per access (retrieval cost)
      [MCPTier.ARCHIVE]: criteria.accessFrequency * 0.05 // $0.05 per access (high retrieval cost)
    };

    const totalCosts = Object.entries(storageCosts).map(([tier, storageCost]) => ({
      tier: tier as MCPTier,
      cost: storageCost + operationalCosts[tier as MCPTier]
    }));

    const optimalTier = totalCosts.reduce((min, current) =>
      current.cost < min.cost ? current : min
    );

    return {
      recommendedTier: optimalTier.tier,
      confidence: 0.8,
      reason: `Cost-optimized choice (${optimalTier.tier}: $${optimalTier.cost.toFixed(2)}/month)`,
      migrationCost: this.estimateMigrationCost(criteria, optimalTier.tier),
      expectedBenefit: this.estimateBenefit(criteria, optimalTier.tier),
      warnings: criteria.costSensitivity < 0.3 ? ['Cost optimization may impact performance'] : []
    };
  }

  // Performance-optimized classification
  private async performanceOptimizedClassification(criteria: ClassificationCriteria): Promise<ClassificationResult> {
    // Prioritize performance over cost
    if (criteria.avgQueryTime > 500) {
      return {
        recommendedTier: MCPTier.HOT,
        confidence: 0.9,
        reason: 'Performance optimization requires hot tier for query speed',
        migrationCost: this.estimateMigrationCost(criteria, MCPTier.HOT),
        expectedBenefit: this.estimateBenefit(criteria, MCPTier.HOT),
        warnings: ['Higher storage costs for performance gains']
      };
    }

    if (criteria.cacheHitRatio < 0.5) {
      return {
        recommendedTier: MCPTier.WARM,
        confidence: 0.8,
        reason: 'Low cache performance suggests warm tier with better caching',
        migrationCost: this.estimateMigrationCost(criteria, MCPTier.WARM),
        expectedBenefit: this.estimateBenefit(criteria, MCPTier.WARM),
        warnings: []
      };
    }

    return {
      recommendedTier: MCPTier.WARM,
      confidence: 0.7,
      reason: 'Acceptable performance metrics for warm tier',
      migrationCost: this.estimateMigrationCost(criteria, MCPTier.WARM),
      expectedBenefit: this.estimateBenefit(criteria, MCPTier.WARM),
      warnings: []
    };
  }

  // Ensemble multiple classification results
  private ensembleResults(results: ClassificationResult[], criteria: ClassificationCriteria): ClassificationResult {
    // Weight the results based on confidence and criteria
    const weights = {
      rule: 0.3,
      ml: 0.4,
      cost: criteria.costSensitivity,
      performance: 1 - criteria.costSensitivity
    };

    // Normalize weights
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(key => {
      weights[key as keyof typeof weights] /= totalWeight;
    });

    // Calculate weighted scores for each tier
    const tierScores = {
      [MCPTier.HOT]: 0,
      [MCPTier.WARM]: 0,
      [MCPTier.COLD]: 0,
      [MCPTier.ARCHIVE]: 0
    };

    results.forEach((result, index) => {
      const weight = Object.values(weights)[index];
      tierScores[result.recommendedTier] += result.confidence * weight;
    });

    // Find the winning tier
    const winningTier = Object.entries(tierScores).reduce((max, [tier, score]) =>
      score > max.score ? { tier: tier as MCPTier, score } : max,
      { tier: MCPTier.WARM, score: 0 }
    ).tier;

    // Combine warnings
    const allWarnings = results.flatMap(r => r.warnings);
    const uniqueWarnings = [...new Set(allWarnings)];

    // Find alternative tier (second highest score)
    const sortedTiers = Object.entries(tierScores).sort(([,a], [,b]) => b - a);
    const alternativeTier = sortedTiers[1][0] as MCPTier;

    return {
      recommendedTier: winningTier,
      confidence: tierScores[winningTier],
      reason: `Ensemble of ${results.length} algorithms (confidence: ${tierScores[winningTier].toFixed(2)})`,
      alternativeTier: alternativeTier !== winningTier ? alternativeTier : undefined,
      migrationCost: this.estimateMigrationCost(criteria, winningTier),
      expectedBenefit: this.estimateBenefit(criteria, winningTier),
      warnings: uniqueWarnings
    };
  }

  private analyzeAccessPattern(mcpId: string, accessHistory: number[]): AccessPattern {
    // Simple pattern analysis - would be more sophisticated in production
    const hourlyAccess = new Array(24).fill(0);
    const dailyAccess = new Array(7).fill(0);
    
    // Calculate basic statistics
    const total = accessHistory.reduce((sum, count) => sum + count, 0);
    const average = total / accessHistory.length;
    const variance = accessHistory.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / accessHistory.length;
    const volatility = Math.sqrt(variance) / average;

    // Detect trend (simplified)
    const firstHalf = accessHistory.slice(0, Math.floor(accessHistory.length / 2));
    const secondHalf = accessHistory.slice(Math.floor(accessHistory.length / 2));
    const firstAvg = firstHalf.reduce((sum, count) => sum + count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, count) => sum + count, 0) / secondHalf.length;
    
    let trendDirection: 'increasing' | 'decreasing' | 'stable';
    if (secondAvg > firstAvg * 1.1) {
      trendDirection = 'increasing';
    } else if (secondAvg < firstAvg * 0.9) {
      trendDirection = 'decreasing';
    } else {
      trendDirection = 'stable';
    }

    return {
      hourlyAccess,
      dailyAccess,
      seasonality: {
        detected: false, // Simplified
        period: 'daily',
        strength: 0
      },
      peakHours: [9, 10, 11, 14, 15, 16], // Business hours
      trendDirection,
      volatility: Math.min(volatility, 1)
    };
  }

  private extractCriteria(metadata: MCPMetadata, performance: MCPPerformance, accessPattern: AccessPattern): ClassificationCriteria {
    const now = Date.now();
    const lastAccessHours = metadata.lastAccessed ? (now - metadata.lastAccessed) / (1000 * 60 * 60) : 0;
    
    return {
      accessFrequency: metadata.accessFrequency || 0, // Per hour average
      lastAccessHours,
      accessTrend: accessPattern.trendDirection,
      avgQueryTime: performance.averageResponseTime || performance.avgReadLatency || 0,
      cacheHitRatio: performance.cacheHitRatio || 0,
      errorRate: performance.errorRate || 0,
      dataSize: metadata.totalSize || 0,
      dataGrowthRate: 0, // Would be calculated from historical data
      compressionRatio: 0.5, // Estimated compression ratio
      businessCriticality: 'medium', // Would come from metadata
      costSensitivity: 0.5,
      complianceRequirements: []
    };
  }

  private estimateMigrationCost(criteria: ClassificationCriteria, targetTier: MCPTier): number {
    // Simplified cost estimation based on data size and complexity
    const baseCost = criteria.dataSize / (1024 * 1024 * 1024); // Cost per GB
    const complexityMultiplier = criteria.accessFrequency > 10 ? 1.5 : 1.0;
    
    return baseCost * complexityMultiplier;
  }

  private estimateBenefit(criteria: ClassificationCriteria, targetTier: MCPTier): number {
    // Simplified benefit calculation
    const performanceBenefit = targetTier === MCPTier.HOT ? 0.8 : 
                              targetTier === MCPTier.WARM ? 0.5 : 0.2;
    
    const costBenefit = targetTier === MCPTier.COLD ? 0.8 :
                       targetTier === MCPTier.WARM ? 0.5 : 0.2;
    
    return (performanceBenefit + costBenefit) / 2;
  }

  private updateClassificationHistory(mcpId: string, result: ClassificationResult): void {
    if (!this.classificationHistory.has(mcpId)) {
      this.classificationHistory.set(mcpId, []);
    }
    
    const history = this.classificationHistory.get(mcpId)!;
    history.push(result);
    
    // Keep only last 10 classifications
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  // Public methods for accessing patterns and history
  getAccessPattern(mcpId: string): AccessPattern | null {
    return this.accessPatterns.get(mcpId) || null;
  }

  getClassificationHistory(mcpId: string): ClassificationResult[] {
    return this.classificationHistory.get(mcpId) || [];
  }

  updateThresholds(newThresholds: Partial<TierThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  getThresholds(): TierThresholds {
    return { ...this.thresholds };
  }

  /**
   * Integration with MCPRegistry for automatic tier optimization
   */
  async optimizeRegistryTiers(registry: any): Promise<{
    optimized: number;
    promoted: string[];
    demoted: string[];
    errors: string[];
  }> {
    const promoted: string[] = [];
    const demoted: string[] = [];
    const errors: string[] = [];
    let optimized = 0;

    try {
      const allMCPs = await registry.getAllMCPs();
      
      for (const [mcpId, mcp] of allMCPs) {
        try {
          const metadata = await mcp.getMetadata();
          const metrics = await mcp.getMetrics();
          
          // Create performance object compatible with classifier
          const performance: MCPPerformance = {
            avgQueryTime: metrics.avgQueryTime,
            avgReadLatency: metrics.avgQueryTime,
            avgWriteLatency: metrics.avgQueryTime, // Use same value for write
            throughput: metrics.queryCount / 24, // queries per hour
            cacheHitRatio: 0.5, // Default value
            cacheHitRate: 0.5, // Alias
            errorRate: metrics.errorRate,
            cpuUsage: metrics.cpuUsage,
            memoryUsage: metrics.memoryUsage,
            storageUsed: metrics.storageUsed,
            lastUpdated: new Date(),
            averageResponseTime: metrics.avgQueryTime
          };
          
          // Generate access history (simplified)
          const accessHistory = Array.from({ length: 24 }, () => Math.floor(Math.random() * 10));
          
          const classification = await this.classifyMCP(metadata, performance, accessHistory);
          
          // Apply optimization if different from current tier
          if (classification.recommendedTier !== metadata.tier && classification.confidence > 0.7) {
            await registry.updateMetadata(mcpId, { tier: classification.recommendedTier });
            
            if (this.isPromotion(metadata.tier, classification.recommendedTier)) {
              promoted.push(mcpId);
            } else {
              demoted.push(mcpId);
            }
            
            optimized++;
          }
        } catch (error) {
          errors.push(`Failed to optimize MCP ${mcpId}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errors.push(`Registry optimization failed: ${(error as Error).message}`);
    }

    return {
      optimized,
      promoted,
      demoted,
      errors
    };
  }

  private isPromotion(currentTier: MCPTier, newTier: MCPTier): boolean {
    const tierHierarchy = {
      [MCPTier.COLD]: 0,
      [MCPTier.ARCHIVE]: 0,
      [MCPTier.WARM]: 1,
      [MCPTier.HOT]: 2
    };
    
    return tierHierarchy[newTier] > tierHierarchy[currentTier];
  }
}

export default TierClassifier;