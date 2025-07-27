/**
 * Intelligence Types for RAG Database System
 * Core types for ML algorithms and AI decision-making
 */

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
  hotness: number; // 0-1 scale
  timeDistribution: number[]; // hourly access pattern
  queryTypes: string[];
}

export interface IndexCandidate {
  mcpId: string;
  field: string;
  confidence: number;
  estimatedSpeedup: number;
  cost: number;
  usageFrequency: number;
}

export interface CachePrediction {
  queryHash: string;
  probability: number;
  timeToExpiry: number;
  cacheSize: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MCPClusterMetrics {
  clusterId: string;
  mcps: string[];
  averageLoad: number;
  dataDistribution: number;
  crossClusterQueries: number;
  rebalanceRecommendation: 'urgent' | 'suggested' | 'stable';
}

export interface NeuralQueryOptimization {
  originalQuery: string;
  optimizedPlan: QueryExecutionPlan;
  confidenceScore: number;
  estimatedImprovement: number;
  learningSource: 'pattern' | 'feedback' | 'simulation';
}

export interface QueryExecutionPlan {
  steps: QueryStep[];
  estimatedTime: number;
  mcpsInvolved: string[];
  parallelizable: boolean;
  cacheOpportunities: string[];
}

export interface QueryStep {
  stepId: string;
  mcpId: string;
  operation: 'select' | 'filter' | 'aggregate' | 'join';
  estimatedCost: number;
  dependencies: string[];
}

export interface PerformanceMetrics {
  timestamp: number;
  mcpId: string;
  queryLatency: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface LearningModel {
  modelId: string;
  type: 'pattern_recognition' | 'query_optimization' | 'cache_prediction' | 'load_balancing';
  accuracy: number;
  lastTrained: number;
  trainingDataSize: number;
  predictions: number;
}

export interface PredictiveInsight {
  type: 'trending_pattern' | 'capacity_prediction' | 'performance_forecast';
  description: string;
  confidence: number;
  timeframe: string;
  impact: 'low' | 'medium' | 'high';
}

export interface QueryAnomaly {
  type: 'execution_time_spike' | 'result_size_anomaly' | 'frequency_anomaly';
  pattern: QueryPattern;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected: number;
}

export interface MLRecommendation {
  type: 'model_improvement' | 'pattern_optimization' | 'resource_scaling';
  priority: 'low' | 'medium' | 'high';
  description: string;
  action: string;
  estimatedImpact: number;
}