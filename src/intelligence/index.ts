/**
 * Intelligence Engine - Export all intelligence components
 * Main entry point for the AI brain of the RAG database system
 */

export { PatternLearner } from './pattern_learner';
export { IndexOptimizer } from './index_optimizer';
export { CachePredictor } from './cache_predictor';
export { NeuralQueryOptimizer } from './neural_query_optimizer';
export { IntelligenceCoordinator } from './intelligence_coordinator';

// Export all types
export * from '../types/intelligence.types';

/**
 * Initialize the complete intelligence system
 */
export function createIntelligenceEngine(config?: any) {
  return new IntelligenceCoordinator(config);
}

/**
 * Intelligence Engine capabilities summary:
 * 
 * 🧠 Pattern Learning:
 *   - Query pattern recognition and frequency analysis
 *   - Access pattern tracking and hotness calculation
 *   - Predictive next-MCP recommendations
 *   - Cluster recommendation based on co-occurrence
 * 
 * 🗂️ Auto-Indexing:
 *   - ML-based index candidate generation
 *   - Performance-driven index creation
 *   - Adaptive index management and removal
 *   - Future indexing needs prediction
 * 
 * 🚀 Predictive Caching:
 *   - Neural network-based cache predictions
 *   - Intelligent cache replacement strategies
 *   - Real-time cache optimization
 *   - Cross-user behavior pattern analysis
 * 
 * 🤖 Neural Query Optimization:
 *   - AI-powered query execution plan optimization
 *   - Adaptive query routing and load balancing
 *   - Dynamic query rewriting for performance
 *   - Real-time optimization adjustments
 * 
 * 🎯 Intelligence Coordination:
 *   - Cross-component optimization and learning
 *   - Predictive system scaling
 *   - Adaptive performance tuning
 *   - Comprehensive intelligence reporting
 */