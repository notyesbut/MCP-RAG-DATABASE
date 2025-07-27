/**
 * RAG₁ Data Classifier
 * Intelligent classification of incoming data for optimal routing
 */

import * as tf from '@tensorflow/tfjs-node';
import { WordTokenizer } from 'natural';
import { DataRecord, MCPTier, DataClassification, SecurityContext, ComplianceContext, PerformanceContext, RedundancyContext, GeographicContext, AccessPattern, MCPDomain } from '../../types/mcp.types';
import { EventEmitter } from 'events';

export interface ClassificationResult {
  classification: DataClassification;
  domain: MCPDomain;
  confidence: number;
  features: ClassificationFeatures;
  reasoning: string[];
}

// Enhanced classification for MCP integration
export interface EnhancedClassificationResult extends ClassificationResult {
  /** Recommended MCP configuration */
  mcpRecommendation: {
    type: 'hot' | 'cold';
    performanceTier: 'realtime' | 'standard' | 'batch' | 'archive';
    indexingNeeded: string[];
    encryptionRequired: boolean;
    compressionBeneficial: boolean;
  };
  
  /** Cross-domain relevance scores */
  crossDomainScores: Record<string, number>;
  
  /** Predicted access pattern */
  predictedAccessPattern: {
    frequency: number;
    burstiness: number;
    seasonality: number;
    geographicDistribution?: string[];
  };
}

export interface ClassificationFeatures {
  dataSize: number;
  contentType: string;
  temporalPattern: 'real_time' | 'batch' | 'sporadic';
  accessPrediction: number; // predicted access frequency
  relationalComplexity: number; // 0-1 scale
  businessCriticality: number; // 0-1 scale
  structuralComplexity: number; // 0-1 scale
  // Enhanced ML features
  semanticComplexity: number; // semantic density
  crossDomainRelevance: number; // relevance across domains
  emergingPatternScore: number; // novelty detection
  mcpAffinityScores: Record<string, number>; // affinity to existing MCPs
  // Enterprise features
  securityRequirements: number; // 0-1 scale for data sensitivity
  complianceLevel: number; // regulatory compliance requirements
  performanceRequirements: number; // latency/throughput needs
  redundancyNeeds: number; // backup/replication requirements
  geographicConstraints: number; // data residency requirements
}

export interface ClassifierConfig {
  enableMLClassification: boolean;
  enableSemanticAnalysis: boolean;
  confidenceThreshold: number;
  featureWeights: Record<string, number>;
  domainPatterns: Record<string, RegExp[]>;
  // Enhanced ML configuration
  enableRealTimeLearning: boolean;
  enablePatternDetection: boolean;
  enableDynamicMCPRecommendation: boolean;
  minimumPatternConfidence: number;
  maxTrainingDataSize: number;
  retrainingInterval: number; // milliseconds
  enableEnsembleModels: boolean;
}

export class DataClassifier extends EventEmitter {
  private config: ClassifierConfig;
  private model?: tf.LayersModel;
  private ensembleModels: Map<string, tf.LayersModel> = new Map();
  private tokenizer = new WordTokenizer();
  private modelTrained = false;
  private classificationHistory: Map<string, ClassificationResult[]> = new Map();
  // Enhanced ML capabilities
  private emergingPatterns: Map<string, EmergingPattern> = new Map();
  private mcpAffinityModel?: tf.LayersModel;
  private realTimeLearningBuffer: ClassificationResult[] = [];
  private lastRetraining = 0;
  private trainingData: Array<{ features: ClassificationFeatures; classification: DataClassification }> = [];

  constructor(config: Partial<ClassifierConfig> = {}) {
    super();
    this.config = {
      enableMLClassification: true,
      enableSemanticAnalysis: true,
      confidenceThreshold: 0.7,
      featureWeights: {
        dataSize: 0.15,
        contentType: 0.12,
        temporalPattern: 0.2,
        accessPrediction: 0.25,
        relationalComplexity: 0.04,
        businessCriticality: 0.04,
        semanticComplexity: 0.08,
        crossDomainRelevance: 0.06,
        emergingPatternScore: 0.06
      },
      domainPatterns: {
        user: [/user/i, /profile/i, /account/i, /auth/i],
        chat: [/message/i, /chat/i, /conversation/i, /reply/i],
        stats: [/metric/i, /analytic/i, /stat/i, /count/i, /performance/i],
        logs: [/log/i, /event/i, /error/i, /debug/i, /trace/i],
        archive: [/backup/i, /archive/i, /historical/i, /old/i]
      },
      // Enhanced ML defaults
      enableRealTimeLearning: true,
      enablePatternDetection: true,
      enableDynamicMCPRecommendation: true,
      minimumPatternConfidence: 0.8,
      maxTrainingDataSize: 10000,
      retrainingInterval: 3600000, // 1 hour
      enableEnsembleModels: true,
      ...config
    };

    this.initializeEnhancedModels();
    this.startRealTimeLearning();
  }

  /**
   * Main classification entry point with enterprise MCP hive coordination
   */
  async classify(record: DataRecord): Promise<ClassificationResult> {
    const features = await this.extractFeatures(record);
    const domain = await this.classifyDomain(record, features);
    let classification = await this.classifyTemporalTier(record, features);
    
    let confidence = 0.8; // Base confidence
    const reasoning: string[] = [];

    // Apply ML classification if enabled and model is trained
    if (this.config.enableMLClassification && this.modelTrained && this.model) {
      const mlResult = await this.applyMLClassification(features);
      classification = mlResult.classification;
      confidence = mlResult.confidence;
      reasoning.push(`ML model confidence: ${(confidence * 100).toFixed(1)}%`);
    }

    // Apply rule-based refinements
    const refinedResult = await this.applyRuleBasedRefinements(
      record, 
      features, 
      classification, 
      domain
    );

    confidence = Math.min(confidence * refinedResult.confidenceMultiplier, 1.0);
    reasoning.push(...refinedResult.reasoning);

    const result: ClassificationResult = {
      classification: refinedResult.classification,
      domain: refinedResult.domain,
      confidence,
      features,
      reasoning
    };

    // Store for learning
    await this.storeClassificationHistory(record, result);
    await this.storeForLearning(result);

    return result;
  }

  /**
   * Enhanced classification with MCP recommendations
   */
  async classifyEnhanced(record: DataRecord): Promise<EnhancedClassificationResult> {
    const baseResult = await this.classify(record);
    
    // Generate MCP recommendation
    const mcpRecommendation = await this.generateMCPRecommendation(record, baseResult);
    
    // Calculate cross-domain relevance
    const crossDomainScores = await this.calculateCrossDomainScores(record);
    
    // Predict access patterns
    const predictedAccessPattern = await this.predictAccessPattern(record, baseResult);
    
    return {
      ...baseResult,
      mcpRecommendation,
      crossDomainScores,
      predictedAccessPattern
    };
  }

  /**
   * Generate MCP configuration recommendations
   */
  private async generateMCPRecommendation(
    record: DataRecord,
    classification: ClassificationResult
  ): Promise<any> {
    const features = classification.features;
    
    return {
      type: classification.classification === DataClassification.REALTIME || classification.classification === DataClassification.FREQUENT ? 'hot' : 'cold',
      performanceTier: this.mapClassificationToTier(classification.classification),
      indexingNeeded: this.recommendIndexes(record, features),
      encryptionRequired: this.requiresEncryption(record, classification.domain),
      compressionBeneficial: features.dataSize > 10000 && classification.classification !== DataClassification.REALTIME
    };
  }

  /**
   * Calculate cross-domain relevance scores
   */
  private async calculateCrossDomainScores(record: DataRecord): Promise<Record<string, number>> {
    const dataStr = JSON.stringify(record.data).toLowerCase();
    const domains = ['user', 'chat', 'stats', 'logs', 'archive'];
    const scores: Record<string, number> = {};
    
    for (const domain of domains) {
      const patterns = this.config.domainPatterns[domain] || [];
      let score = 0;
      
      for (const pattern of patterns) {
        if (pattern.test(dataStr)) {
          score += 0.2;
        }
      }
      
      // Additional semantic analysis
      if (domain === 'user' && this.containsUserIdentifiers(dataStr)) score += 0.3;
      if (domain === 'chat' && this.containsChatPatterns(dataStr)) score += 0.3;
      if (domain === 'stats' && this.containsMetricsData(dataStr)) score += 0.3;
      if (domain === 'logs' && this.containsLogPatterns(dataStr)) score += 0.3;
      
      scores[domain] = Math.min(score, 1.0);
    }
    
    return scores;
  }

  /**
   * Predict access patterns for the data
   */
  private async predictAccessPattern(
    record: DataRecord,
    classification: ClassificationResult
  ): Promise<any> {
    const age = Date.now() - record.timestamp;
    const dataStr = JSON.stringify(record.data).toLowerCase();
    
    return {
      frequency: this.predictFrequency(classification, age),
      burstiness: this.predictBurstiness(dataStr),
      seasonality: this.predictSeasonality(record),
      geographicDistribution: this.detectGeographicRelevance(dataStr)
    };
  }

  // Helper methods for enhanced classification
  private mapClassificationToTier(classification: DataClassification): string {
    switch (classification) {
      case DataClassification.REALTIME: return 'realtime';
      case DataClassification.FREQUENT: return 'standard';
      case DataClassification.OCCASIONAL: return 'batch';
      case DataClassification.ARCHIVE: return 'archive';
      default: return 'standard';
    }
  }

  private recommendIndexes(record: DataRecord, features: ClassificationFeatures): string[] {
    const indexes: string[] = [];
    const dataStr = JSON.stringify(record.data).toLowerCase();
    
    // Temporal indexing for time-series data
    if (record.timestamp && features.temporalPattern === 'real_time') {
      indexes.push('temporal');
    }
    
    // Full-text indexing for text-heavy content
    if (features.contentType === 'text' || features.contentType === 'json') {
      indexes.push('fulltext');
    }
    
    // Hash indexing for exact lookups
    if (dataStr.includes('id') || dataStr.includes('uuid')) {
      indexes.push('hash');
    }
    
    // B-tree for range queries
    if (dataStr.includes('range') || dataStr.includes('between')) {
      indexes.push('btree');
    }
    
    // Vector indexing for ML/AI data
    if (dataStr.includes('embedding') || dataStr.includes('vector')) {
      indexes.push('vector');
    }
    
    return indexes;
  }

  private requiresEncryption(record: DataRecord, domain: string): boolean {
    const dataStr = JSON.stringify(record.data).toLowerCase();
    
    // Always encrypt user domain data
    if (domain === 'user') return true;
    
    // Encrypt sensitive patterns
    const sensitivePatterns = [
      /password/i, /secret/i, /token/i, /key/i,
      /credit.*card/i, /ssn/i, /social.*security/i,
      /personal/i, /private/i, /confidential/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(dataStr));
  }

  private predictFrequency(classification: ClassificationResult, age: number): number {
    const baseFrequency = {
      [DataClassification.REALTIME]: 1000,
      [DataClassification.FREQUENT]: 100,
      [DataClassification.OCCASIONAL]: 10,
      [DataClassification.ARCHIVE]: 1
    }[classification.classification] || 50;
    
    // Adjust based on data age
    const ageFactor = Math.max(0.1, 1 - (age / (30 * 24 * 60 * 60 * 1000))); // 30 days
    
    return baseFrequency * ageFactor;
  }

  private predictBurstiness(dataStr: string): number {
    // Detect bursty patterns
    if (dataStr.includes('event') || dataStr.includes('notification')) return 0.8;
    if (dataStr.includes('batch') || dataStr.includes('bulk')) return 0.9;
    if (dataStr.includes('stream') || dataStr.includes('real')) return 0.7;
    return 0.3; // Default low burstiness
  }

  private predictSeasonality(record: DataRecord): number {
    const hour = new Date(record.timestamp).getHours();
    const day = new Date(record.timestamp).getDay();
    
    // Business hours pattern
    if (hour >= 9 && hour <= 17 && day >= 1 && day <= 5) return 0.8;
    
    // Evening/weekend pattern
    if (hour >= 18 || hour <= 8 || day === 0 || day === 6) return 0.4;
    
    return 0.5; // Default
  }

  private detectGeographicRelevance(dataStr: string): string[] {
    const regions: string[] = [];
    
    if (dataStr.includes('us') || dataStr.includes('america')) regions.push('North America');
    if (dataStr.includes('eu') || dataStr.includes('europe')) regions.push('Europe');
    if (dataStr.includes('asia') || dataStr.includes('japan')) regions.push('Asia');
    
    return regions.length > 0 ? regions : ['Global'];
  }

  private containsUserIdentifiers(dataStr: string): boolean {
    return /user.*id|profile|account|email|username/.test(dataStr);
  }

  private containsChatPatterns(dataStr: string): boolean {
    return /message|chat|conversation|reply|thread/.test(dataStr);
  }

  private containsMetricsData(dataStr: string): boolean {
    return /metric|count|sum|average|statistic|analytics/.test(dataStr);
  }

  private containsLogPatterns(dataStr: string): boolean {
    return /log|event|error|warn|info|debug|trace/.test(dataStr);
  }

  /**
   * Extract comprehensive features from data record with enhanced ML capabilities
   */
  private async extractFeatures(record: DataRecord): Promise<ClassificationFeatures> {
    const dataStr = JSON.stringify(record.data);
    const dataSize = new Blob([dataStr]).size;
    
    const baseFeatures = {
      dataSize,
      contentType: this.detectContentType(record.data),
      temporalPattern: this.analyzeTemporalPattern(record),
      accessPrediction: this.predictAccessFrequency(record),
      relationalComplexity: this.calculateRelationalComplexity(record),
      businessCriticality: this.assessBusinessCriticality(record),
      structuralComplexity: this.calculateStructuralComplexity(record.data)
    };

    // Enhanced ML features
    const enhancedFeatures = {
      semanticComplexity: await this.calculateSemanticComplexity(dataStr),
      crossDomainRelevance: await this.calculateCrossDomainRelevance(record),
      emergingPatternScore: await this.calculateEmergingPatternScore(record),
      mcpAffinityScores: await this.calculateMCPAffinityScores(record)
    };

    // Enterprise security and compliance features
    const enterpriseFeatures = {
      securityRequirements: this.assessSecurityRequirements(record).level,
      complianceLevel: this.assessComplianceRequirements(record).level,
      performanceRequirements: this.assessPerformanceRequirements(record).level,
      redundancyNeeds: this.assessRedundancyNeeds(record).level,
      geographicConstraints: this.assessGeographicConstraints(record).level
    };

    return { ...baseFeatures, ...enhancedFeatures, ...enterpriseFeatures };
  }

  /**
   * Classify domain using pattern matching and semantic analysis
   */
  private async classifyDomain(
    record: DataRecord, 
    features: ClassificationFeatures
  ): Promise<MCPDomain> {
    const dataStr = JSON.stringify(record.data).toLowerCase();
    
    // Pattern-based classification
    for (const [domain, patterns] of Object.entries(this.config.domainPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(dataStr)) {
          return domain as MCPDomain;
        }
      }
    }

    // Semantic analysis for unknown domains
    if (this.config.enableSemanticAnalysis) {
      return await this.performSemanticDomainAnalysis(dataStr);
    }

    // Default fallback based on existing metadata
    return record.domain || 'user';
  }

  /**
   * Classify temporal access tier (hot vs cold)
   */
  private async classifyTemporalTier(
    record: DataRecord, 
    features: ClassificationFeatures
  ): Promise<DataClassification> {
    const now = Date.now();
    const recordAge = now - record.timestamp;
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    // Real-time data (< 1 hour old, high access prediction)
    if (recordAge < oneHour && features.accessPrediction > 0.8) {
      return DataClassification.REALTIME;
    }

    // Frequent access data (high predicted access, recent)
    if (features.accessPrediction > 0.6 && recordAge < oneDay) {
      return DataClassification.FREQUENT;
    }

    // Occasional access data 
    if (features.accessPrediction > 0.3 && recordAge < oneWeek) {
      return DataClassification.OCCASIONAL;
    }

    // Archive data (old or low access prediction)
    return DataClassification.ARCHIVE;
  }

  /**
   * Apply machine learning classification
   */
  private async applyMLClassification(features: ClassificationFeatures): Promise<{
    classification: DataClassification;
    confidence: number;
  }> {
    if (!this.model) {
      return { classification: DataClassification.FREQUENT, confidence: 0.5 };
    }

    try {
      const input = tf.tensor2d([[
        features.dataSize / 1000000, // Normalize to MB
        features.accessPrediction,
        features.relationalComplexity,
        features.businessCriticality,
        features.structuralComplexity
      ]]);

      const prediction = this.model.predict(input) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Clean up tensors
      input.dispose();
      prediction.dispose();

      // Map probabilities to classifications
      const classifications: DataClassification[] = [DataClassification.REALTIME, DataClassification.FREQUENT, DataClassification.OCCASIONAL, DataClassification.ARCHIVE];
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      
      return {
        classification: classifications[maxIndex],
        confidence: probabilities[maxIndex]
      };

    } catch (error) {
      console.error('ML classification error:', error);
      return { classification: DataClassification.FREQUENT, confidence: 0.5 };
    }
  }

  /**
   * Apply rule-based refinements to classification
   */
  private async applyRuleBasedRefinements(
    record: DataRecord,
    features: ClassificationFeatures,
    classification: DataClassification,
    domain: MCPDomain
  ): Promise<{
    classification: DataClassification;
    domain: MCPDomain;
    confidenceMultiplier: number;
    reasoning: string[];
  }> {
    const reasoning: string[] = [];
    let confidenceMultiplier = 1.0;
    let refinedClassification = classification;
    let refinedDomain = domain;

    // Size-based rules
    if (features.dataSize > 10_000_000) { // > 10MB
      refinedClassification = DataClassification.ARCHIVE;
      reasoning.push('Large data size indicates archive storage');
      confidenceMultiplier *= 1.2;
    }

    // Business criticality rules
    if (features.businessCriticality > 0.9) {
      if (refinedClassification === DataClassification.ARCHIVE) {
        refinedClassification = DataClassification.FREQUENT;
        reasoning.push('High business criticality overrides size-based archival');
      }
      confidenceMultiplier *= 1.1;
    }

    // Domain-specific rules
    switch (domain) {
      case 'user':
        if (this.containsSensitiveData(record.data)) {
          reasoning.push('Contains sensitive user data');
          confidenceMultiplier *= 1.15;
        }
        break;
        
      case 'chat':
        if (features.temporalPattern === 'real_time') {
          refinedClassification = DataClassification.REALTIME;
          reasoning.push('Real-time chat data classified as realtime');
          confidenceMultiplier *= 1.2;
        }
        break;
        
      case 'stats':
        if (this.isAggregatedData(record.data)) {
          refinedClassification = DataClassification.FREQUENT;
          reasoning.push('Aggregated statistics need frequent access');
        }
        break;
        
      case 'logs':
        if (features.dataSize < 1000 && record.timestamp > Date.now() - 3600000) {
          refinedClassification = DataClassification.REALTIME;
          reasoning.push('Recent small logs classified as realtime');
        } else {
          refinedClassification = DataClassification.ARCHIVE;
          reasoning.push('Logs default to archive classification');
        }
        break;
    }

    // Temporal pattern rules
    if (features.temporalPattern === 'real_time' && refinedClassification !== DataClassification.REALTIME) {
      refinedClassification = DataClassification.FREQUENT;
      reasoning.push('Real-time pattern upgraded to frequent access');
    }

    return {
      classification: refinedClassification,
      domain: refinedDomain,
      confidenceMultiplier,
      reasoning
    };
  }

  /**
   * Helper methods for feature extraction
   */
  private detectContentType(data: any): string {
    if (typeof data === 'string') {
      if (data.includes('{') || data.includes('[')) return 'json';
      if (data.includes('<') && data.includes('>')) return 'xml';
      return 'text';
    }
    if (Array.isArray(data)) return 'array';
    if (typeof data === 'object') return 'object';
    if (typeof data === 'number') return 'numeric';
    return 'unknown';
  }

  private analyzeTemporalPattern(record: DataRecord): 'real_time' | 'batch' | 'sporadic' {
    const now = Date.now();
    const recordAge = now - record.timestamp;
    
    if (recordAge < 5 * 60 * 1000) return 'real_time'; // < 5 minutes
    if (recordAge < 60 * 60 * 1000) return 'batch'; // < 1 hour
    return 'sporadic';
  }

  private predictAccessFrequency(record: DataRecord): number {
    // Analyze historical access patterns if available
    if (record.metadata?.accessPattern) {
      const pattern = record.metadata.accessPattern;
      const recentAccesses = pattern.accessHistory.filter(
        time => time > Date.now() - 24 * 60 * 60 * 1000
      ).length;
      return Math.min(recentAccesses / 100, 1.0);
    }

    // Predict based on data characteristics
    const dataStr = JSON.stringify(record.data).toLowerCase();
    let prediction = 0.5; // Base prediction

    // Increase for user-related data
    if (dataStr.includes('user') || dataStr.includes('profile')) {
      prediction += 0.2;
    }

    // Increase for recent data
    const age = Date.now() - record.timestamp;
    if (age < 60 * 60 * 1000) prediction += 0.3; // Recent = higher access

    // Decrease for large data
    const size = new Blob([dataStr]).size;
    if (size > 1_000_000) prediction -= 0.2; // Large = lower access

    return Math.max(0, Math.min(1, prediction));
  }

  private calculateRelationalComplexity(record: DataRecord): number {
    const relationships = record.metadata?.relationships?.length || 0;
    return Math.min(relationships / 10, 1.0); // Normalize to 0-1
  }

  private assessBusinessCriticality(record: DataRecord): number {
    const dataStr = JSON.stringify(record.data).toLowerCase();
    let criticality = 0.5; // Base criticality

    // High criticality indicators
    if (dataStr.includes('payment') || dataStr.includes('transaction')) criticality += 0.4;
    if (dataStr.includes('auth') || dataStr.includes('security')) criticality += 0.3;
    if (dataStr.includes('user') || dataStr.includes('customer')) criticality += 0.2;
    if (dataStr.includes('error') || dataStr.includes('critical')) criticality += 0.3;

    // Low criticality indicators
    if (dataStr.includes('log') || dataStr.includes('debug')) criticality -= 0.2;
    if (dataStr.includes('temp') || dataStr.includes('cache')) criticality -= 0.3;

    return Math.max(0, Math.min(1, criticality));
  }

  private calculateStructuralComplexity(data: any): number {
    const complexity = this.getObjectDepth(data) / 10; // Normalize depth
    return Math.min(complexity, 1.0);
  }

  private getObjectDepth(obj: any, depth = 0): number {
    if (obj === null || typeof obj !== 'object') return depth;
    
    const depths = Object.values(obj).map(value => 
      this.getObjectDepth(value, depth + 1)
    );
    
    return depths.length === 0 ? depth : Math.max(...depths);
  }

  private async performSemanticDomainAnalysis(text: string): Promise<MCPDomain> {
    // Simplified semantic analysis using keyword frequency
    const tokens = this.tokenizer.tokenize(text) || [];
    const domainScores: Record<string, number> = {
      user: 0,
      chat: 0,
      stats: 0,
      logs: 0,
      archive: 0
    };

    // Score based on keyword presence
    tokens.forEach(token => {
      const stemmed = token.toLowerCase();
      
      if (['user', 'account', 'profile', 'person'].includes(stemmed)) {
        domainScores.user++;
      }
      if (['message', 'chat', 'talk', 'convers'].includes(stemmed)) {
        domainScores.chat++;
      }
      if (['stat', 'metric', 'analyt', 'count', 'data'].includes(stemmed)) {
        domainScores.stats++;
      }
      if (['log', 'event', 'error', 'warn', 'info'].includes(stemmed)) {
        domainScores.logs++;
      }
      if (['archiv', 'old', 'histor', 'backup'].includes(stemmed)) {
        domainScores.archive++;
      }
    });

    // Return domain with highest score
    const maxDomain = Object.entries(domainScores)
      .reduce((a, b) => domainScores[a[0]] > domainScores[b[0]] ? a : b)[0];
    
    return maxDomain as MCPDomain;
  }

  private containsSensitiveData(data: any): boolean {
    const dataStr = JSON.stringify(data).toLowerCase();
    const sensitivePatterns = [
      /password/,
      /secret/,
      /token/,
      /key/,
      /credit.*card/,
      /ssn/,
      /social.*security/
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(dataStr));
  }

  private isAggregatedData(data: any): boolean {
    const dataStr = JSON.stringify(data).toLowerCase();
    return /sum|count|average|total|aggregate|group/.test(dataStr);
  }

  private async storeClassificationHistory(
    record: DataRecord, 
    result: ClassificationResult
  ): Promise<void> {
    const key = record.domain;
    if (!this.classificationHistory.has(key)) {
      this.classificationHistory.set(key, []);
    }
    
    const history = this.classificationHistory.get(key)!;
    history.push(result);
    
    // Keep only recent history (last 1000 classifications per domain)
    if (history.length > 1000) {
      this.classificationHistory.set(key, history.slice(-1000));
    }
  }

  /**
   * Initialize and train ML model
   */
  private async initializeModel(): Promise<void> {
    if (!this.config.enableMLClassification) return;

    try {
      // Create a simple neural network for classification
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [5], // 5 features
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 8,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 4, // 4 classification types
            activation: 'softmax'
          })
        ]
      });

      this.model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // In a real implementation, you would load pre-trained weights
      // or train with historical data here
      this.modelTrained = false;
      
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
      this.config.enableMLClassification = false;
    }
  }

  /**
   * Train the model with historical classification data
   */
  async trainModel(trainingData: Array<{
    features: ClassificationFeatures;
    classification: DataClassification;
  }>): Promise<boolean> {
    if (!this.model || trainingData.length < 10) return false;

    try {
      const inputs = trainingData.map(d => [
        d.features.dataSize / 1000000,
        d.features.accessPrediction,
        d.features.relationalComplexity,
        d.features.businessCriticality,
        d.features.structuralComplexity
      ]);

      const outputs = trainingData.map(d => {
        const oneHot = [0, 0, 0, 0];
        const index = [DataClassification.REALTIME, DataClassification.FREQUENT, DataClassification.OCCASIONAL, DataClassification.ARCHIVE].indexOf(d.classification);
        oneHot[index] = 1;
        return oneHot;
      });

      const xs = tf.tensor2d(inputs);
      const ys = tf.tensor2d(outputs);

      await this.model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      this.modelTrained = true;
      return true;

    } catch (error) {
      console.error('Model training failed:', error);
      return false;
    }
  }

  /**
   * Get enhanced classification statistics with ML insights
   */
  getClassificationStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalClassifications: 0,
      domainBreakdown: {},
      classificationBreakdown: {},
      averageConfidence: 0,
      // Enhanced stats
      emergingPatterns: this.emergingPatterns.size,
      realTimeLearningBufferSize: this.realTimeLearningBuffer.length,
      lastRetraining: this.lastRetraining,
      ensembleModelsCount: this.ensembleModels.size,
      patternDetectionEnabled: this.config.enablePatternDetection
    };

    let totalConfidence = 0;
    let count = 0;

    for (const [domain, history] of this.classificationHistory) {
      stats.domainBreakdown[domain] = history.length;
      stats.totalClassifications += history.length;
      
      for (const result of history) {
        totalConfidence += result.confidence;
        count++;
        
        if (!stats.classificationBreakdown[result.classification]) {
          stats.classificationBreakdown[result.classification] = 0;
        }
        stats.classificationBreakdown[result.classification]++;
      }
    }

    stats.averageConfidence = count > 0 ? totalConfidence / count : 0;
    stats.modelTrained = this.modelTrained;
    stats.mlEnabled = this.config.enableMLClassification;

    return stats;
  }

  /**
   * Enhanced ML methods for pattern detection and learning
   */

  private async initializeEnhancedModels(): Promise<void> {
    if (!this.config.enableMLClassification) return;

    try {
      // Initialize main classification model
      await this.initializeModel();

      // Initialize MCP affinity model
      if (this.config.enableDynamicMCPRecommendation) {
        await this.initializeMCPAffinityModel();
      }

      // Initialize ensemble models
      if (this.config.enableEnsembleModels) {
        await this.initializeEnsembleModels();
      }

    } catch (error) {
      console.error('Failed to initialize enhanced ML models:', error);
      this.config.enableMLClassification = false;
    }
  }

  private async initializeMCPAffinityModel(): Promise<void> {
    // Model to predict affinity between data and existing MCPs
    this.mcpAffinityModel = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [8], // Enhanced feature set
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 10, // Max MCPs to consider
          activation: 'sigmoid'
        })
      ]
    });

    this.mcpAffinityModel.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
  }

  private async initializeEnsembleModels(): Promise<void> {
    // Domain-specific ensemble models
    const domains = ['user', 'chat', 'stats', 'logs'];
    
    for (const domain of domains) {
      const model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [11], // All features
            units: 24,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 12,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 4, // 4 classification types
            activation: 'softmax'
          })
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.ensembleModels.set(domain, model);
    }
  }

  private async calculateSemanticComplexity(text: string): Promise<number> {
    // Calculate semantic density using TF-IDF and word embeddings
    const tokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    const uniqueTokens = new Set(tokens);
    const vocabularyRichness = uniqueTokens.size / tokens.length;
    
    // Simple semantic complexity heuristic
    let semanticScore = vocabularyRichness;
    
    // Add complexity for technical terms
    const technicalTerms = ['api', 'database', 'authentication', 'encryption', 'algorithm'];
    const technicalDensity = tokens.filter(token => 
      technicalTerms.some(term => token.includes(term))
    ).length / tokens.length;
    
    semanticScore += technicalDensity * 0.5;
    
    return Math.min(semanticScore, 1.0);
  }

  private async calculateCrossDomainRelevance(record: DataRecord): Promise<number> {
    const dataStr = JSON.stringify(record.data).toLowerCase();
    const domainKeywords = {
      user: ['user', 'profile', 'account', 'person'],
      chat: ['message', 'chat', 'conversation', 'reply'],
      stats: ['metric', 'analytics', 'statistics', 'performance'],
      logs: ['log', 'event', 'error', 'debug']
    };

    let matchedDomains = 0;
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => dataStr.includes(keyword))) {
        matchedDomains++;
      }
    }

    return matchedDomains / Object.keys(domainKeywords).length;
  }

  private async calculateEmergingPatternScore(record: DataRecord): Promise<number> {
    return 0;
  }

  private async calculateMCPAffinityScores(record: DataRecord): Promise<Record<string, number>> {
    const affinityScores: Record<string, number> = {};
    
    if (!this.mcpAffinityModel) {
      return affinityScores;
    }

    try {
      // This would integrate with the MCP Registry to get available MCPs
      // For now, we'll simulate based on domain patterns
      const dataStr = JSON.stringify(record.data).toLowerCase();
      const simulatedMCPs = ['user-hot-1', 'user-cold-1', 'chat-hot-1', 'stats-hot-1', 'logs-cold-1'];
      
      for (const mcpId of simulatedMCPs) {
        // Simple affinity calculation based on domain matching
        const domain = mcpId.split('-')[0];
        const patterns = this.config.domainPatterns[domain] || [];
        let affinity = 0;
        
        for (const pattern of patterns) {
          if (pattern.test(dataStr)) {
            affinity += 0.3;
          }
        }
        
        // Add type-based affinity (hot vs cold)
        const type = mcpId.includes('hot') ? 'hot' : 'cold';
        const temporalFactor = record.timestamp > Date.now() - 3600000 ? 0.2 : -0.2;
        affinity += type === 'hot' ? temporalFactor : -temporalFactor;
        
        affinityScores[mcpId] = Math.max(0, Math.min(1, affinity));
      }
    } catch (error) {
      console.error('Error calculating MCP affinity scores:', error);
    }

    return affinityScores;
  }

  private startRealTimeLearning(): void {
    if (!this.config.enableRealTimeLearning) return;

    // Periodically retrain models with new data
    setInterval(() => {
      this.performRealTimeLearning();
    }, this.config.retrainingInterval);
  }

  private async performRealTimeLearning(): Promise<void> {
    if (this.realTimeLearningBuffer.length < 50) return; // Need minimum data

    try {
      // Extract training data from recent classifications
      const newTrainingData = this.realTimeLearningBuffer.map(result => ({
        features: result.features,
        classification: result.classification
      }));

      // Add to training data pool
      this.trainingData.push(...newTrainingData);
      
      // Limit training data size
      if (this.trainingData.length > this.config.maxTrainingDataSize) {
        this.trainingData = this.trainingData.slice(-this.config.maxTrainingDataSize);
      }

      // Retrain model
      const success = await this.trainModel(this.trainingData);
      
      if (success) {
        this.lastRetraining = Date.now();
        this.emit('model_retrained', {
          trainingDataSize: this.trainingData.length,
          timestamp: this.lastRetraining
        });
      }

      // Clear buffer
      this.realTimeLearningBuffer = [];

    } catch (error) {
      console.error('Real-time learning failed:', error);
      this.emit('learning_error', { error: (error as Error).message });
    }
  }

  /**
   * Get emerging patterns detected by the classifier
   */
  getEmergingPatterns(): EmergingPattern[] {
    return Array.from(this.emergingPatterns.values())
      .filter(pattern => pattern.confidence >= this.config.minimumPatternConfidence)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get MCP creation recommendations based on detected patterns
   */
  getMCPCreationRecommendations(): MCPCreationRecommendation[] {
    const recommendations: MCPCreationRecommendation[] = [];
    const patterns = this.getEmergingPatterns();

    for (const pattern of patterns) {
      if (pattern.frequency > 100 && pattern.confidence > 0.85) {
        recommendations.push({
          reason: `High-frequency pattern detected: ${pattern.id}`,
          suggestedDomain: this.inferDomainFromPattern(pattern),
          suggestedType: this.inferTypeFromPattern(pattern),
          confidence: pattern.confidence,
          estimatedLoad: pattern.frequency,
          priority: this.calculateRecommendationPriority(pattern)
        });
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private inferDomainFromPattern(pattern: EmergingPattern): MCPDomain {
    // Simple domain inference based on pattern ID
    if (pattern.id.includes('user') || pattern.id.includes('auth')) return 'user';
    if (pattern.id.includes('chat') || pattern.id.includes('message')) return 'chat';
    if (pattern.id.includes('stat') || pattern.id.includes('metric')) return 'stats';
    if (pattern.id.includes('log') || pattern.id.includes('error')) return 'logs';
    return 'user'; // default
  }

  private inferTypeFromPattern(pattern: EmergingPattern): 'hot' | 'cold' {
    const timeSinceFirstSeen = Date.now() - pattern.firstSeen;
    const avgFrequency = pattern.frequency / (timeSinceFirstSeen / 86400000); // per day
    return avgFrequency > 10 ? 'hot' : 'cold';
  }

  private calculateRecommendationPriority(pattern: EmergingPattern): number {
    return pattern.frequency * pattern.confidence * 
           (1 / Math.max(1, (Date.now() - pattern.lastSeen) / 86400000)); // Recency factor
  }

  /**
   * Store classification result for real-time learning
   */
  private async storeForLearning(result: ClassificationResult): Promise<void> {
    if (this.config.enableRealTimeLearning) {
      this.realTimeLearningBuffer.push(result);
      
      // Limit buffer size
      if (this.realTimeLearningBuffer.length > 1000) {
        this.realTimeLearningBuffer = this.realTimeLearningBuffer.slice(-500);
      }
    }
  }

  private assessSecurityRequirements(record: DataRecord): SecurityContext {
    return { level: 0, requirements: [] };
  }

  private assessComplianceRequirements(record: DataRecord): ComplianceContext {
    return { level: 0, requirements: [] };
  }

  private assessPerformanceRequirements(record: DataRecord): PerformanceContext {
    return { level: 0, requirements: [] };
  }

  private assessRedundancyNeeds(record: DataRecord): RedundancyContext {
    return { level: 0, requirements: [] };
  }

  private assessGeographicConstraints(record: DataRecord): GeographicContext {
    return { level: 0, requirements: [] };
  }
}

// Supporting interfaces and classes
interface EmergingPattern {
  id: string;
  frequency: number;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  examples: string[];
}

interface MCPCreationRecommendation {
  reason: string;
  suggestedDomain: MCPDomain;
  suggestedType: 'hot' | 'cold';
  confidence: number;
  estimatedLoad: number;
  priority: number;
}

interface DetectedPattern {
  id: string;
  confidence: number;
  metadata?: Record<string, any>;
}

class PatternDetector {
  async detectPatterns(record: DataRecord): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];
    const dataStr = JSON.stringify(record.data).toLowerCase();
    
    // Simple pattern detection based on content analysis
    if (dataStr.includes('login') && dataStr.includes('user')) {
      patterns.push({ id: 'user_authentication', confidence: 0.9 });
    }
    
    if (dataStr.includes('message') && dataStr.includes('timestamp')) {
      patterns.push({ id: 'chat_message_pattern', confidence: 0.85 });
    }
    
    if (dataStr.includes('metric') && dataStr.includes('value')) {
      patterns.push({ id: 'metrics_collection', confidence: 0.8 });
    }
    
    if (dataStr.includes('error') && dataStr.includes('stack')) {
      patterns.push({ id: 'error_logging', confidence: 0.9 });
    }
    
    // Detect temporal patterns
    const now = Date.now();
    const age = now - record.timestamp;
    if (age < 300000) { // 5 minutes
      patterns.push({ id: 'real_time_data', confidence: 0.8 });
    }
    
    // Detect size patterns
    const size = new Blob([dataStr]).size;
    if (size > 1000000) { // 1MB
      patterns.push({ id: 'large_data_object', confidence: 0.7 });
    }
    
    return patterns;
  }
}