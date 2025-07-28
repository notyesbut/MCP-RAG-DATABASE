/**
 * Pattern Learning Module for RAG System
 * Learns from query patterns to improve future performance
 */

import { NaturalQuery, InterpretedQuery, QueryResult, QueryIntent } from '../../types/query.types';

/**
 * Query pattern representation
 */
interface QueryPattern {
  id: string;
  pattern: string;
  frequency: number;
  avgExecutionTime: number;
  successRate: number;
  intents: QueryIntent[];
  entities: string[];
  mcpUsage: Map<string, number>;
  temporalDistribution: TemporalDistribution;
  userSegments: string[];
  lastSeen: number;
  confidence: number;
}

/**
 * Temporal distribution of pattern usage
 */
interface TemporalDistribution {
  hourly: number[];
  daily: number[];
  weekly: number[];
  monthly: number[];
}

/**
 * User behavior pattern
 */
interface UserBehaviorPattern {
  userId: string;
  commonQueries: string[];
  querySequences: QuerySequence[];
  preferences: UserPreferences;
  performanceExpectations: PerformanceExpectations;
}

/**
 * Query sequence for pattern detection
 */
interface QuerySequence {
  queries: string[];
  frequency: number;
  avgTimeBetween: number;
  outcomes: string[];
}

/**
 * User preferences learned from behavior
 */
interface UserPreferences {
  preferredMCPs: string[];
  preferredResponseFormat: string;
  typicalQueryComplexity: number;
  dataFreshnessRequirement: 'real-time' | 'recent' | 'any';
  accuracyVsSpeedPreference: number; // 0 = speed, 1 = accuracy
}

/**
 * Performance expectations
 */
interface PerformanceExpectations {
  acceptableLatency: number;
  requiredAccuracy: number;
  dataCompletenessThreshold: number;
}

/**
 * Pattern learning system
 */
export class PatternLearner {
  private patterns: Map<string, QueryPattern> = new Map();
  private userPatterns: Map<string, UserBehaviorPattern> = new Map();
  private sequenceBuffer: Map<string, string[]> = new Map();
  private patternIndex: Map<string, Set<string>> = new Map();
  private readonly minPatternFrequency = 3;
  private readonly patternDecayRate = 0.95;
  private readonly sequenceWindowSize = 10;

  constructor() {
    this.initializePatternDetection();
    this.startPatternMaintenance();
  }

  /**
   * Initialize pattern detection system
   */
  private initializePatternDetection(): void {
    // Initialize common pattern templates
    const commonPatterns = [
      { template: 'get {entity} {filter}', intents: [QueryIntent.RETRIEVE] },
      { template: 'count {entity} where {condition}', intents: [QueryIntent.COUNT] },
      { template: 'search {entity} containing {term}', intents: [QueryIntent.SEARCH] },
      { template: 'analyze {entity} {timeframe}', intents: [QueryIntent.ANALYZE] },
      { template: 'compare {entity1} and {entity2}', intents: [QueryIntent.COMPARE] }
    ];

    commonPatterns.forEach((pattern, idx) => {
      this.patterns.set(`template_${idx}`, {
        id: `template_${idx}`,
        pattern: pattern.template,
        frequency: 0,
        avgExecutionTime: 0,
        successRate: 1,
        intents: pattern.intents,
        entities: [],
        mcpUsage: new Map(),
        temporalDistribution: this.createEmptyTemporalDistribution(),
        userSegments: [],
        lastSeen: Date.now(),
        confidence: 0.5
      });
    });
  }

  /**
   * Start periodic pattern maintenance
   */
  private startPatternMaintenance(): void {
    // Decay old patterns
    setInterval(() => {
      this.decayPatterns();
    }, 3600000); // Every hour

    // Consolidate similar patterns
    setInterval(() => {
      this.consolidatePatterns();
    }, 86400000); // Every day
  }

  /**
   * Learn from a query execution
   */
  async learnFromQuery(
    query: NaturalQuery,
    interpretation: InterpretedQuery,
    result: QueryResult,
    userId?: string
  ): Promise<void> {
    // Extract pattern from query
    const pattern = this.extractPattern(query.raw, interpretation);
    
    // Update or create pattern
    await this.updatePattern(pattern, interpretation, result);
    
    // Update user patterns if userId provided
    if (userId) {
      await this.updateUserPattern(userId, query, interpretation, result);
    }
    
    // Detect query sequences
    await this.detectQuerySequences(userId || 'anonymous', query.raw);
    
    // Update pattern indices
    this.updatePatternIndices(pattern, interpretation);
    
    // Trigger pattern consolidation if needed
    if (this.patterns.size > 1000) {
      await this.consolidatePatterns();
    }
  }

  /**
   * Extract pattern from query
   */
  private extractPattern(query: string, interpretation: InterpretedQuery): string {
    let pattern = query.toLowerCase();
    
    // Replace specific values with placeholders
    // Email addresses
    pattern = pattern.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '{email}');
    
    // User IDs
    pattern = pattern.replace(/user\s+[a-zA-Z0-9_-]+/g, 'user {userId}');
    
    // Tokens
    pattern = pattern.replace(/token\s+[a-zA-Z0-9]+/g, 'token {token}');
    
    // Numbers
    pattern = pattern.replace(/\b\d+\b/g, '{number}');
    
    // Dates
    pattern = pattern.replace(/\d{4}-\d{2}-\d{2}/g, '{date}');
    pattern = pattern.replace(/\b(today|yesterday|tomorrow)\b/g, '{relative_date}');
    pattern = pattern.replace(/\b(last|this|next)\s+(week|month|year)\b/g, '{time_period}');
    
    // Quoted strings
    pattern = pattern.replace(/"[^"]+"/g, '{quoted_string}');
    pattern = pattern.replace(/'[^']+'/g, '{quoted_string}');
    
    // Normalize whitespace
    pattern = pattern.replace(/\s+/g, ' ').trim();
    
    return pattern;
  }

  /**
   * Update pattern statistics
   */
  private async updatePattern(
    patternString: string,
    interpretation: InterpretedQuery,
    result: QueryResult
  ): Promise<void> {
    const patternId = this.generatePatternId(patternString);
    
    if (!this.patterns.has(patternId)) {
      this.patterns.set(patternId, {
        id: patternId,
        pattern: patternString,
        frequency: 0,
        avgExecutionTime: 0,
        successRate: 0,
        intents: [],
        entities: [],
        mcpUsage: new Map(),
        temporalDistribution: this.createEmptyTemporalDistribution(),
        userSegments: [],
        lastSeen: Date.now(),
        confidence: 0.5
      });
    }
    
    const pattern = this.patterns.get(patternId)!;
    
    // Update frequency
    pattern.frequency++;
    
    // Update execution time (moving average)
    pattern.avgExecutionTime = 
      (pattern.avgExecutionTime * (pattern.frequency - 1) + result.duration) / pattern.frequency;
    
    // Update success rate
    const successValue = result.success ? 1 : 0;
    pattern.successRate = 
      (pattern.successRate * (pattern.frequency - 1) + successValue) / pattern.frequency;
    
    // Update intents
    interpretation.intents.forEach(intentDetail => {
      const intentType = intentDetail.type;
      if (!pattern.intents.includes(intentType as QueryIntent)) {
        pattern.intents.push(intentType as QueryIntent);
      }
    });
    
    // Update entities
    interpretation.entities.extractedEntities?.forEach(entity => {
      if (!pattern.entities.includes(entity.type)) {
        pattern.entities.push(entity.type);
      }
    });
    
    // Update MCP usage
    result.data?.metadata?.sources?.forEach(source => {
      const count = pattern.mcpUsage.get(source.mcpId) || 0;
      pattern.mcpUsage.set(source.mcpId, count + 1);
    });
    
    // Update temporal distribution
    this.updateTemporalDistribution(pattern.temporalDistribution);
    
    // Update last seen
    pattern.lastSeen = Date.now();
    
    // Update confidence based on frequency and success rate
    pattern.confidence = Math.min(
      0.95,
      (pattern.frequency / 100) * 0.5 + pattern.successRate * 0.5
    );
  }

  /**
   * Update user behavior pattern
   */
  private async updateUserPattern(
    userId: string,
    query: NaturalQuery,
    interpretation: InterpretedQuery,
    result: QueryResult
  ): Promise<void> {
    if (!this.userPatterns.has(userId)) {
      this.userPatterns.set(userId, {
        userId,
        commonQueries: [],
        querySequences: [],
        preferences: {
          preferredMCPs: [],
          preferredResponseFormat: 'json',
          typicalQueryComplexity: 1,
          dataFreshnessRequirement: 'any',
          accuracyVsSpeedPreference: 0.5
        },
        performanceExpectations: {
          acceptableLatency: 1000,
          requiredAccuracy: 0.9,
          dataCompletenessThreshold: 0.8
        }
      });
    }
    
    const userPattern = this.userPatterns.get(userId)!;
    
    // Update common queries
    const queryPattern = this.extractPattern(query.raw, interpretation);
    if (!userPattern.commonQueries.includes(queryPattern)) {
      userPattern.commonQueries.push(queryPattern);
      // Keep only top 20 patterns
      if (userPattern.commonQueries.length > 20) {
        userPattern.commonQueries.shift();
      }
    }
    
    // Update preferences based on query characteristics
    this.updateUserPreferences(userPattern.preferences, interpretation, result);
    
    // Update performance expectations
    this.updatePerformanceExpectations(userPattern.performanceExpectations, result);
  }

  /**
   * Update user preferences
   */
  private updateUserPreferences(
    preferences: UserPreferences,
    interpretation: InterpretedQuery,
    result: QueryResult
  ): void {
    // Update preferred MCPs
    result.data?.metadata?.sources?.forEach(source => {
      if (!preferences.preferredMCPs.includes(source.mcpId)) {
        preferences.preferredMCPs.push(source.mcpId);
      }
    });
    
    // Update query complexity preference
    const complexity = this.calculateQueryComplexity(interpretation);
    preferences.typicalQueryComplexity = 
      preferences.typicalQueryComplexity * 0.9 + complexity * 0.1;
    
    // Update data freshness requirement
    if (interpretation.entities.temporal === 'recent' || interpretation.entities.temporal === 'today') {
      preferences.dataFreshnessRequirement = 'recent';
    }
    
    // Update accuracy vs speed preference based on result usage
    if (result.duration < 500 && result.success) {
      preferences.accuracyVsSpeedPreference = 
        Math.max(0, preferences.accuracyVsSpeedPreference - 0.01);
    } else if (result.duration > 2000) {
      preferences.accuracyVsSpeedPreference = 
        Math.min(1, preferences.accuracyVsSpeedPreference + 0.01);
    }
  }

  /**
   * Update performance expectations
   */
  private updatePerformanceExpectations(
    expectations: PerformanceExpectations,
    result: QueryResult
  ): void {
    // Update acceptable latency (exponential moving average)
    expectations.acceptableLatency = 
      expectations.acceptableLatency * 0.95 + result.duration * 0.05;
    
    // Update required accuracy based on success patterns
    if (result.success) {
      expectations.requiredAccuracy = 
        Math.min(0.99, expectations.requiredAccuracy * 1.01);
    } else {
      expectations.requiredAccuracy = 
        Math.max(0.8, expectations.requiredAccuracy * 0.99);
    }
  }

  /**
   * Detect query sequences
   */
  private async detectQuerySequences(userId: string, query: string): Promise<void> {
    if (!this.sequenceBuffer.has(userId)) {
      this.sequenceBuffer.set(userId, []);
    }
    
    const buffer = this.sequenceBuffer.get(userId)!;
    buffer.push(query);
    
    // Keep only recent queries
    if (buffer.length > this.sequenceWindowSize) {
      buffer.shift();
    }
    
    // Detect patterns in sequences
    if (buffer.length >= 3) {
      const sequences = this.findSequencePatterns(buffer);
      
      if (sequences.length > 0) {
        const userPattern = this.userPatterns.get(userId);
        if (userPattern) {
          sequences.forEach(seq => {
            const existing = userPattern.querySequences.find(
              s => JSON.stringify(s.queries) === JSON.stringify(seq.queries)
            );
            
            if (existing) {
              existing.frequency++;
              existing.avgTimeBetween = 
                (existing.avgTimeBetween * (existing.frequency - 1) + seq.avgTimeBetween) / 
                existing.frequency;
            } else {
              userPattern.querySequences.push(seq);
            }
          });
        }
      }
    }
  }

  /**
   * Find patterns in query sequences
   */
  private findSequencePatterns(queries: string[]): QuerySequence[] {
    const sequences: QuerySequence[] = [];
    
    // Look for repeated subsequences
    for (let length = 2; length <= Math.min(5, queries.length - 1); length++) {
      for (let start = 0; start <= queries.length - length; start++) {
        const subsequence = queries.slice(start, start + length);
        const pattern = subsequence.map(q => this.extractPattern(q, {} as InterpretedQuery));
        
        // Check if this pattern appears multiple times
        let occurrences = 0;
        for (let i = 0; i <= queries.length - length; i++) {
          const candidate = queries.slice(i, i + length);
          const candidatePattern = candidate.map(q => this.extractPattern(q, {} as InterpretedQuery));
          
          if (JSON.stringify(pattern) === JSON.stringify(candidatePattern)) {
            occurrences++;
          }
        }
        
        if (occurrences >= 2) {
          sequences.push({
            queries: pattern,
            frequency: occurrences,
            avgTimeBetween: 5000, // Default 5 seconds
            outcomes: []
          });
        }
      }
    }
    
    return sequences;
  }

  /**
   * Get pattern predictions for a query
   */
  async getPredictions(
    query: string,
    userId?: string
  ): Promise<{
    likelyIntents: Array<{ intent: QueryIntent; confidence: number }>;
    expectedMCPs: Array<{ mcpId: string; probability: number }>;
    estimatedExecutionTime: number;
    suggestedOptimizations: string[];
    nextLikelyQueries: string[];
  }> {
    const pattern = this.extractPattern(query, {} as InterpretedQuery);
    const matchingPatterns = this.findMatchingPatterns(pattern);
    
    // Aggregate predictions from matching patterns
    const intentScores = new Map<QueryIntent, number>();
    const mcpScores = new Map<string, number>();
    let totalExecutionTime = 0;
    let totalWeight = 0;
    
    for (const match of matchingPatterns) {
      const weight = match.confidence * match.frequency;
      
      // Aggregate intents
      match.intents.forEach(intent => {
        const score = intentScores.get(intent) || 0;
        intentScores.set(intent, score + weight);
      });
      
      // Aggregate MCPs
      match.mcpUsage.forEach((count, mcpId) => {
        const score = mcpScores.get(mcpId) || 0;
        mcpScores.set(mcpId, score + count * weight);
      });
      
      // Aggregate execution time
      totalExecutionTime += match.avgExecutionTime * weight;
      totalWeight += weight;
    }
    
    // Get user-specific predictions
    let userPredictions;
    if (userId) {
      userPredictions = await this.getUserSpecificPredictions(userId, query);
    }
    
    // Normalize and sort predictions
    const likelyIntents = Array.from(intentScores.entries())
      .map(([intent, score]) => ({
        intent,
        confidence: totalWeight > 0 ? score / totalWeight : 0
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    const expectedMCPs = Array.from(mcpScores.entries())
      .map(([mcpId, score]) => ({
        mcpId,
        probability: totalWeight > 0 ? score / totalWeight : 0
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);
    
    const estimatedExecutionTime = totalWeight > 0 ? totalExecutionTime / totalWeight : 500;
    
    return {
      likelyIntents,
      expectedMCPs,
      estimatedExecutionTime,
      suggestedOptimizations: this.generateOptimizationSuggestions(matchingPatterns, userPredictions),
      nextLikelyQueries: userPredictions?.nextQueries || []
    };
  }

  /**
   * Find patterns matching a query
   */
  private findMatchingPatterns(pattern: string): QueryPattern[] {
    const matches: QueryPattern[] = [];
    const patternTokens = pattern.split(' ');
    
    for (const [, storedPattern] of this.patterns) {
      const storedTokens = storedPattern.pattern.split(' ');
      
      // Calculate similarity
      const similarity = this.calculatePatternSimilarity(patternTokens, storedTokens);
      
      if (similarity > 0.7) {
        matches.push(storedPattern);
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate pattern similarity
   */
  private calculatePatternSimilarity(pattern1: string[], pattern2: string[]): number {
    if (pattern1.length !== pattern2.length) {
      return 0;
    }
    
    let matches = 0;
    for (let i = 0; i < pattern1.length; i++) {
      if (pattern1[i] === pattern2[i] || 
          pattern1[i].startsWith('{') || 
          pattern2[i].startsWith('{')) {
        matches++;
      }
    }
    
    return matches / pattern1.length;
  }

  /**
   * Get user-specific predictions
   */
  private async getUserSpecificPredictions(
    userId: string,
    query: string
  ): Promise<{
    preferredMCPs: string[];
    expectedLatency: number;
    nextQueries: string[];
  } | null> {
    const userPattern = this.userPatterns.get(userId);
    if (!userPattern) return null;
    
    // Find matching sequences
    const buffer = this.sequenceBuffer.get(userId) || [];
    const recentQueries = [...buffer, query];
    
    const nextQueries: string[] = [];
    for (const sequence of userPattern.querySequences) {
      // Check if recent queries match the beginning of this sequence
      if (sequence.queries.length > recentQueries.length) {
        let matches = true;
        for (let i = 0; i < recentQueries.length; i++) {
          const queryPattern = this.extractPattern(recentQueries[i], {} as InterpretedQuery);
          if (queryPattern !== sequence.queries[i]) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          // Predict next query in sequence
          nextQueries.push(sequence.queries[recentQueries.length]);
        }
      }
    }
    
    return {
      preferredMCPs: userPattern.preferences.preferredMCPs,
      expectedLatency: userPattern.performanceExpectations.acceptableLatency,
      nextQueries: nextQueries.slice(0, 3)
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    patterns: QueryPattern[],
    userPredictions: any
  ): string[] {
    const suggestions: string[] = [];
    
    // Analyze pattern performance
    const avgExecutionTime = patterns.reduce((sum, p) => sum + p.avgExecutionTime, 0) / patterns.length;
    const avgSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;
    
    if (avgExecutionTime > 1000) {
      suggestions.push('Consider caching results for this query pattern');
    }
    
    if (avgSuccessRate < 0.9) {
      suggestions.push('This query pattern has lower success rate - consider refining');
    }
    
    // Check for MCP optimization opportunities
    const mcpUsage = new Map<string, number>();
    patterns.forEach(p => {
      p.mcpUsage.forEach((count, mcpId) => {
        mcpUsage.set(mcpId, (mcpUsage.get(mcpId) || 0) + count);
      });
    });
    
    const sortedMCPs = Array.from(mcpUsage.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedMCPs.length > 1 && sortedMCPs[0][1] > sortedMCPs[1][1] * 2) {
      suggestions.push(`Consider creating an index on ${sortedMCPs[0][0]} for this pattern`);
    }
    
    return suggestions;
  }

  /**
   * Update pattern indices
   */
  private updatePatternIndices(pattern: string, interpretation: InterpretedQuery): void {
    // Index by intent
    interpretation.intents.forEach(intent => {
      if (!this.patternIndex.has(`intent:${intent}`)) {
        this.patternIndex.set(`intent:${intent}`, new Set());
      }
      this.patternIndex.get(`intent:${intent}`)!.add(pattern);
    });
    
    // Index by entity type
    interpretation.entities.extractedEntities?.forEach(entity => {
      if (!this.patternIndex.has(`entity:${entity.type}`)) {
        this.patternIndex.set(`entity:${entity.type}`, new Set());
      }
      this.patternIndex.get(`entity:${entity.type}`)!.add(pattern);
    });
  }

  /**
   * Create empty temporal distribution
   */
  private createEmptyTemporalDistribution(): TemporalDistribution {
    return {
      hourly: new Array(24).fill(0),
      daily: new Array(7).fill(0),
      weekly: new Array(4).fill(0),
      monthly: new Array(12).fill(0)
    };
  }

  /**
   * Update temporal distribution
   */
  private updateTemporalDistribution(distribution: TemporalDistribution): void {
    const now = new Date();
    
    distribution.hourly[now.getHours()]++;
    distribution.daily[now.getDay()]++;
    distribution.weekly[Math.floor(now.getDate() / 7)]++;
    distribution.monthly[now.getMonth()]++;
  }

  /**
   * Calculate query complexity
   */
  private calculateQueryComplexity(interpretation: InterpretedQuery): number {
    let complexity = 1;
    
    // Intent complexity
    complexity += interpretation.intents.length * 0.5;
    
    // Filter complexity
    complexity += (interpretation.entities.filters?.length || 0) * 0.2;
    
    // Join complexity
    complexity += (interpretation.entities.joins?.length || 0) * 0.5;
    
    // Aggregation complexity
    if (interpretation.aggregationStrategy) {
      complexity += 0.5;
    }
    
    return Math.min(5, complexity);
  }

  /**
   * Decay old patterns
   */
  private decayPatterns(): void {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    for (const [id, pattern] of this.patterns) {
      const age = now - pattern.lastSeen;
      
      // Remove very old patterns
      if (age > maxAge && pattern.frequency < this.minPatternFrequency) {
        this.patterns.delete(id);
        continue;
      }
      
      // Decay confidence of old patterns
      if (age > 7 * 24 * 60 * 60 * 1000) { // 7 days
        pattern.confidence *= this.patternDecayRate;
      }
    }
  }

  /**
   * Consolidate similar patterns
   */
  private async consolidatePatterns(): Promise<void> {
    const consolidated = new Map<string, QueryPattern>();
    const processed = new Set<string>();
    
    for (const [id, pattern] of this.patterns) {
      if (processed.has(id)) continue;
      
      // Find similar patterns
      const similar = this.findSimilarPatterns(pattern);
      
      if (similar.length > 1) {
        // Merge patterns
        const merged = this.mergePatterns([pattern, ...similar.slice(1)]);
        consolidated.set(merged.id, merged);
        
        // Mark as processed
        similar.forEach(p => processed.add(p.id));
      } else {
        consolidated.set(id, pattern);
      }
    }
    
    this.patterns = consolidated;
  }

  /**
   * Find similar patterns
   */
  private findSimilarPatterns(target: QueryPattern): QueryPattern[] {
    const similar: QueryPattern[] = [];
    
    for (const [, pattern] of this.patterns) {
      if (pattern.id === target.id) continue;
      
      const similarity = this.calculatePatternSimilarity(
        target.pattern.split(' '),
        pattern.pattern.split(' ')
      );
      
      if (similarity > 0.9) {
        similar.push(pattern);
      }
    }
    
    return [target, ...similar];
  }

  /**
   * Merge multiple patterns
   */
  private mergePatterns(patterns: QueryPattern[]): QueryPattern {
    const merged = { ...patterns[0] };
    
    // Aggregate statistics
    let totalFrequency = 0;
    let totalExecutionTime = 0;
    let totalSuccess = 0;
    
    patterns.forEach(p => {
      totalFrequency += p.frequency;
      totalExecutionTime += p.avgExecutionTime * p.frequency;
      totalSuccess += p.successRate * p.frequency;
      
      // Merge intents
      p.intents.forEach(intent => {
        if (!merged.intents.includes(intent)) {
          merged.intents.push(intent);
        }
      });
      
      // Merge entities
      p.entities.forEach(entity => {
        if (!merged.entities.includes(entity)) {
          merged.entities.push(entity);
        }
      });
      
      // Merge MCP usage
      p.mcpUsage.forEach((count, mcpId) => {
        const existing = merged.mcpUsage.get(mcpId) || 0;
        merged.mcpUsage.set(mcpId, existing + count);
      });
    });
    
    merged.frequency = totalFrequency;
    merged.avgExecutionTime = totalExecutionTime / totalFrequency;
    merged.successRate = totalSuccess / totalFrequency;
    merged.confidence = Math.min(0.95, merged.frequency / 100);
    
    return merged;
  }

  /**
   * Generate pattern ID
   */
  private generatePatternId(pattern: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `pattern_${Math.abs(hash)}`;
  }

  /**
   * Get pattern insights
   */
  getPatternInsights(): {
    topPatterns: QueryPattern[];
    emergingPatterns: QueryPattern[];
    problematicPatterns: QueryPattern[];
    temporalTrends: any;
    userSegments: any;
  } {
    const patterns = Array.from(this.patterns.values());
    
    // Top patterns by frequency
    const topPatterns = patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    
    // Emerging patterns (high growth rate)
    const recentPatterns = patterns.filter(p => 
      Date.now() - p.lastSeen < 24 * 60 * 60 * 1000
    );
    const emergingPatterns = recentPatterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    
    // Problematic patterns (low success rate)
    const problematicPatterns = patterns
      .filter(p => p.successRate < 0.8 && p.frequency > 5)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5);
    
    // Temporal trends
    const temporalTrends = this.analyzeTemporalTrends(patterns);
    
    // User segments
    const userSegments = this.analyzeUserSegments();
    
    return {
      topPatterns,
      emergingPatterns,
      problematicPatterns,
      temporalTrends,
      userSegments
    };
  }

  /**
   * Analyze temporal trends
   */
  private analyzeTemporalTrends(patterns: QueryPattern[]): any {
    const hourlyTotal = new Array(24).fill(0);
    const dailyTotal = new Array(7).fill(0);
    
    patterns.forEach(p => {
      p.temporalDistribution.hourly.forEach((count, hour) => {
        hourlyTotal[hour] += count;
      });
      p.temporalDistribution.daily.forEach((count, day) => {
        dailyTotal[day] += count;
      });
    });
    
    return {
      peakHours: hourlyTotal
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      peakDays: dailyTotal
        .map((count, day) => ({ day, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
    };
  }

  /**
   * Analyze user segments
   */
  private analyzeUserSegments(): any {
    const segments = {
      powerUsers: [] as string[],
      occasionalUsers: [] as string[],
      complexQueryUsers: [] as string[],
      simpleQueryUsers: [] as string[]
    };
    
    this.userPatterns.forEach((pattern, userId) => {
      if (pattern.commonQueries.length > 15) {
        segments.powerUsers.push(userId);
      } else if (pattern.commonQueries.length < 5) {
        segments.occasionalUsers.push(userId);
      }
      
      if (pattern.preferences.typicalQueryComplexity > 3) {
        segments.complexQueryUsers.push(userId);
      } else if (pattern.preferences.typicalQueryComplexity < 1.5) {
        segments.simpleQueryUsers.push(userId);
      }
    });
    
    return segments;
  }
}