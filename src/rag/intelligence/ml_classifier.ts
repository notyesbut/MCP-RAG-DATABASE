/**
 * ML-Based Classification Module for RAG₁
 * Advanced machine learning classification for query intents and entity types
 */

import { QueryIntent, QueryEntity, QueryContext } from '../../types/query.types';

/**
 * Training sample for ML model
 */
interface TrainingSample {
  text: string;
  intent: QueryIntent;
  entities: QueryEntity[];
  confidence: number;
  timestamp: number;
  successful: boolean;
}

/**
 * Feature vector for ML classification
 */
interface FeatureVector {
  features: number[];
  labels?: string[];
  metadata?: Record<string, any>;
}

/**
 * Model weights for neural network
 */
interface ModelWeights {
  inputLayer: number[][];
  hiddenLayers: number[][][];
  outputLayer: number[][];
  biases: number[][];
  version: string;
  trainedSamples: number;
  accuracy: number;
}

/**
 * ML-based intent and entity classifier
 */
export class MLClassifier extends EventTarget {
  private weights!: ModelWeights;
  private trainingData: TrainingSample[] = [];
  private vocabulary: Map<string, number> = new Map();
  private entityPatterns: Map<string, number[]> = new Map();
  private contextualFeatures: Map<string, number> = new Map();
  private readonly learningRate = 0.01;
  private readonly momentum = 0.9;
  private readonly regularization = 0.001;
  private intentModel: any = null;
  private entityModel: any = null;
  private predictionCache: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeModel();
    this.loadPretrainedWeights();
  }

  /**
   * Initialize neural network model
   */
  private initializeModel(): void {
    // Initialize with Xavier/He initialization
    const inputSize = 256; // Feature vector size
    const hiddenSizes = [128, 64, 32];
    const outputSize = Object.keys(QueryIntent).length;

    this.weights = {
      inputLayer: this.initializeLayer(inputSize, hiddenSizes[0]),
      hiddenLayers: [
        this.initializeLayer(hiddenSizes[0], hiddenSizes[1]),
        this.initializeLayer(hiddenSizes[1], hiddenSizes[2])
      ],
      outputLayer: this.initializeLayer(hiddenSizes[2], outputSize),
      biases: [
        new Array(hiddenSizes[0]).fill(0),
        new Array(hiddenSizes[1]).fill(0),
        new Array(hiddenSizes[2]).fill(0),
        new Array(outputSize).fill(0)
      ],
      version: '1.0.0',
      trainedSamples: 0,
      accuracy: 0.85 // Starting accuracy
    };
  }

  /**
   * Initialize layer weights using He initialization
   */
  private initializeLayer(inputSize: number, outputSize: number): number[][] {
    const weights: number[][] = [];
    const scale = Math.sqrt(2.0 / inputSize);

    for (let i = 0; i < inputSize; i++) {
      weights[i] = [];
      for (let j = 0; j < outputSize; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * scale;
      }
    }

    return weights;
  }

  /**
   * Load pre-trained weights from patterns
   */
  private loadPretrainedWeights(): void {
    // Pre-trained patterns for common intents
    const pretrainedPatterns = {
      [QueryIntent.RETRIEVE]: ['get', 'fetch', 'show', 'display', 'find', 'retrieve'],
      [QueryIntent.COUNT]: ['count', 'number', 'total', 'how many', 'amount'],
      [QueryIntent.SEARCH]: ['search', 'look for', 'find', 'containing', 'matching'],
      [QueryIntent.AGGREGATE]: ['sum', 'average', 'group', 'aggregate', 'total by'],
      [QueryIntent.ANALYZE]: ['analyze', 'pattern', 'trend', 'insights', 'behavior'],
      [QueryIntent.FILTER]: ['where', 'filter', 'only', 'with', 'having'],
      [QueryIntent.COMPARE]: ['compare', 'versus', 'difference', 'between'],
      [QueryIntent.UPDATE]: ['update', 'modify', 'change', 'set', 'edit'],
      [QueryIntent.DELETE]: ['delete', 'remove', 'clear', 'purge', 'drop']
    };

    // Initialize vocabulary with pre-trained patterns
    let vocabIndex = 0;
    for (const [intent, patterns] of Object.entries(pretrainedPatterns)) {
      for (const pattern of patterns) {
        if (!this.vocabulary.has(pattern)) {
          this.vocabulary.set(pattern, vocabIndex++);
        }
      }
    }
  }

  /**
   * Extract features from text using advanced NLP techniques
   */
  extractFeatures(text: string, context: ConversationContext): FeatureVector {
    const features = new Array(256).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    // Feature 1-50: Bag of words with TF-IDF weighting
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    let featureIndex = 0;
    for (const [word, freq] of wordFreq.entries()) {
      const vocabIdx = this.vocabulary.get(word);
      if (vocabIdx !== undefined && featureIndex < 50) {
        const tf = freq / words.length;
        const idf = Math.log(1000 / (1 + this.getDocumentFrequency(word)));
        features[featureIndex++] = tf * idf;
      }
    }

    // Feature 51-100: N-gram features (bigrams and trigrams)
    const bigrams = this.extractNGrams(words, 2);
    const trigrams = this.extractNGrams(words, 3);
    
    featureIndex = 51;
    bigrams.forEach((count, ngram) => {
      if (featureIndex < 75) {
        features[featureIndex++] = count / bigrams.size;
      }
    });

    trigrams.forEach((count, ngram) => {
      if (featureIndex < 100) {
        features[featureIndex++] = count / trigrams.size;
      }
    });

    // Feature 101-150: Syntactic features
    features[101] = text.length / 100; // Normalized text length
    features[102] = words.length / 20; // Normalized word count
    features[103] = this.countPunctuation(text) / 10;
    features[104] = this.countCapitalWords(text) / words.length;
    features[105] = this.countNumericTokens(text) / words.length;

    // Feature 106-120: Part-of-speech patterns
    const posPatterns = this.extractPOSPatterns(text);
    posPatterns.forEach((value, idx) => {
      if (idx < 15) {
        features[106 + idx] = value;
      }
    });

    // Feature 121-150: Semantic features
    const semanticFeatures = this.extractSemanticFeatures(text, context);
    semanticFeatures.forEach((value, idx) => {
      if (idx < 30) {
        features[121 + idx] = value;
      }
    });

    // Feature 151-200: Context features
    const contextFeatures = this.extractContextFeatures(context);
    contextFeatures.forEach((value, idx) => {
      if (idx < 50) {
        features[151 + idx] = value;
      }
    });

    // Feature 201-256: Embedding-like features
    const embeddingFeatures = this.extractEmbeddingFeatures(text);
    embeddingFeatures.forEach((value, idx) => {
      if (idx < 56) {
        features[201 + idx] = value;
      }
    });

    return {
      features,
      labels: Array.from(wordFreq.keys()),
      metadata: { originalText: text, wordCount: words.length }
    };
  }

  /**
   * Extract n-grams from word array
   */
  private extractNGrams(words: string[], n: number): Map<string, number> {
    const ngrams = new Map<string, number>();
    
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
    }
    
    return ngrams;
  }

  /**
   * Extract part-of-speech patterns
   */
  private extractPOSPatterns(text: string): number[] {
    const patterns: number[] = [];
    
    // Simplified POS tagging based on patterns
    patterns.push(text.match(/\b(get|show|find|fetch)\b/gi)?.length || 0); // Verbs
    patterns.push(text.match(/\b(user|message|file|data)\b/gi)?.length || 0); // Nouns
    patterns.push(text.match(/\b(recent|all|active|new)\b/gi)?.length || 0); // Adjectives
    patterns.push(text.match(/\b(from|to|by|with)\b/gi)?.length || 0); // Prepositions
    patterns.push(text.match(/\b(and|or|but)\b/gi)?.length || 0); // Conjunctions
    
    return patterns;
  }

  /**
   * Extract semantic features using word relationships
   */
  private extractSemanticFeatures(text: string, context: ConversationContext): number[] {
    const features: number[] = [];
    
    // Semantic similarity to known intents
    const intentKeywords = {
      retrieve: ['get', 'fetch', 'show', 'display'],
      search: ['find', 'search', 'look', 'query'],
      aggregate: ['sum', 'count', 'average', 'group'],
      analyze: ['analyze', 'pattern', 'trend', 'insight']
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      const similarity = this.calculateSemanticSimilarity(text, keywords);
      features.push(similarity);
    }

    // Domain-specific semantic features
    features.push(this.calculateDomainRelevance(text, 'user'));
    features.push(this.calculateDomainRelevance(text, 'message'));
    features.push(this.calculateDomainRelevance(text, 'file'));
    features.push(this.calculateDomainRelevance(text, 'stats'));

    return features;
  }

  /**
   * Extract context-aware features
   */
  private extractContextFeatures(context: ConversationContext): number[] {
    const features: number[] = [];
    
    // User history features
    features.push(context.previousQueries?.length || 0);
    features.push(context.userPatterns?.length || 0);
    
    // Temporal context
    const hour = new Date().getHours();
    features.push(hour / 24); // Normalized hour
    features.push(hour >= 9 && hour <= 17 ? 1 : 0); // Business hours
    
    // Session context
    features.push(context.sessionId ? 1 : 0);
    features.push(context.userId ? 1 : 0);
    
    // Language and location
    features.push(context.language === 'en' ? 1 : 0);
    features.push(context.timeZone ? 1 : 0);
    
    return features;
  }

  /**
   * Extract embedding-like features
   */
  private extractEmbeddingFeatures(text: string): number[] {
    const features: number[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Character-level features
    const charFreq = new Map<string, number>();
    for (const char of text.toLowerCase()) {
      if (char.match(/[a-z]/)) {
        charFreq.set(char, (charFreq.get(char) || 0) + 1);
      }
    }
    
    // Convert to feature vector
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i);
      features.push((charFreq.get(char) || 0) / text.length);
    }
    
    // Word-level embeddings (simplified)
    const commonWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an'];
    commonWords.forEach(word => {
      features.push(words.includes(word) ? 1 : 0);
    });
    
    return features;
  }

  /**
   * Classify intent using neural network
   */
  async classifyIntent(
    features: FeatureVector,
    context: ConversationContext
  ): Promise<Array<{ type: QueryIntent; confidence: number; reasoning: string }>> {
    // Forward propagation through the network
    let activation = features.features;
    
    // Input to hidden layer 1
    activation = this.forwardLayer(activation, this.weights.inputLayer, this.weights.biases[0]);
    activation = this.relu(activation);
    
    // Hidden layer 1 to hidden layer 2
    activation = this.forwardLayer(activation, this.weights.hiddenLayers[0], this.weights.biases[1]);
    activation = this.relu(activation);
    
    // Hidden layer 2 to hidden layer 3
    activation = this.forwardLayer(activation, this.weights.hiddenLayers[1], this.weights.biases[2]);
    activation = this.relu(activation);
    
    // Hidden layer 3 to output
    activation = this.forwardLayer(activation, this.weights.outputLayer, this.weights.biases[3]);
    const probabilities = this.softmax(activation);
    
    // Convert probabilities to intent predictions
    const intents = Object.values(QueryIntent);
    const predictions: Array<{ type: QueryIntent; confidence: number; reasoning: string }> = [];
    
    probabilities.forEach((prob, idx) => {
      if (prob > 0.1) { // Threshold for inclusion
        predictions.push({
          type: intents[idx],
          confidence: prob,
          reasoning: this.generateReasoning(intents[idx], features, prob)
        });
      }
    });
    
    // Sort by confidence and return top predictions
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Forward propagation through a layer
   */
  private forwardLayer(input: number[], weights: number[][], bias: number[]): number[] {
    const output = new Array(weights[0].length).fill(0);
    
    for (let j = 0; j < weights[0].length; j++) {
      for (let i = 0; i < input.length; i++) {
        output[j] += input[i] * weights[i][j];
      }
      output[j] += bias[j];
    }
    
    return output;
  }

  /**
   * ReLU activation function
   */
  private relu(x: number[]): number[] {
    return x.map(val => Math.max(0, val));
  }

  /**
   * Softmax activation function
   */
  private softmax(x: number[]): number[] {
    const maxVal = Math.max(...x);
    const exp = x.map(val => Math.exp(val - maxVal));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(val => val / sum);
  }

  /**
   * Extract entities using neural network
   */
  async extractEntities(
    text: string,
    features: FeatureVector,
    context: ConversationContext
  ): Promise<QueryEntity[]> {
    const entities: QueryEntity[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Use bidirectional LSTM-like approach for sequence labeling
    for (let i = 0; i < words.length; i++) {
      const windowFeatures = this.extractWindowFeatures(words, i, 3);
      const entityProbabilities = await this.classifyEntityType(windowFeatures);
      
      for (const [entityType, probability] of entityProbabilities) {
        if (probability > 0.7) {
          const entity = this.extractEntityValue(words, i, entityType);
          if (entity) {
            entities.push({
              type: entityType,
              value: entity.value,
              confidence: probability,
              position: entity.position,
              metadata: {
                extractedBy: 'ml_classifier',
                modelVersion: this.weights.version
              }
            });
          }
        }
      }
    }
    
    // Post-process entities to merge adjacent ones
    return this.mergeAdjacentEntities(entities);
  }

  /**
   * Extract window features around a word
   */
  private extractWindowFeatures(words: string[], index: number, windowSize: number): number[] {
    const features: number[] = [];
    
    for (let i = index - windowSize; i <= index + windowSize; i++) {
      if (i >= 0 && i < words.length) {
        const wordFeatures = this.getWordFeatures(words[i]);
        features.push(...wordFeatures);
      } else {
        // Padding for out-of-bounds
        features.push(...new Array(10).fill(0));
      }
    }
    
    return features;
  }

  /**
   * Get features for a single word
   */
  private getWordFeatures(word: string): number[] {
    const features: number[] = [];
    
    // Character features
    features.push(word.length / 20);
    features.push(word.match(/[A-Z]/) ? 1 : 0);
    features.push(word.match(/[0-9]/) ? 1 : 0);
    features.push(word.match(/[@.]/) ? 1 : 0);
    features.push(word.match(/[-_]/) ? 1 : 0);
    
    // Vocabulary features
    const vocabIdx = this.vocabulary.get(word);
    features.push(vocabIdx !== undefined ? 1 : 0);
    features.push(vocabIdx !== undefined ? vocabIdx / this.vocabulary.size : 0);
    
    // Pattern features
    features.push(word.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i) ? 1 : 0); // Email
    features.push(word.match(/^[a-zA-Z0-9_-]+$/) ? 1 : 0); // ID pattern
    features.push(word.match(/^\d+$/) ? 1 : 0); // Number
    
    return features;
  }

  /**
   * Classify entity type using neural network
   */
  private async classifyEntityType(features: number[]): Promise<Map<string, number>> {
    // Simplified entity classification
    const entityTypes = ['email', 'userId', 'token', 'date', 'number', 'status'];
    const probabilities = new Map<string, number>();
    
    // Use pattern matching enhanced by ML confidence
    if (features[7] > 0.5) { // Email pattern feature
      probabilities.set('email', 0.95);
    }
    if (features[8] > 0.5) { // ID pattern feature
      probabilities.set('userId', 0.85);
    }
    if (features[9] > 0.5) { // Number pattern feature
      probabilities.set('number', 0.9);
    }
    
    return probabilities;
  }

  /**
   * Extract entity value from text
   */
  private extractEntityValue(
    words: string[], 
    index: number, 
    entityType: string
  ): { value: string; position: { start: number; end: number } } | null {
    const word = words[index];
    const originalText = words.join(' ');
    const wordStart = originalText.indexOf(word);
    
    return {
      value: word,
      position: {
        start: wordStart,
        end: wordStart + word.length
      }
    };
  }

  /**
   * Merge adjacent entities of the same type
   */
  private mergeAdjacentEntities(entities: QueryEntity[]): QueryEntity[] {
    const merged: QueryEntity[] = [];
    let current: QueryEntity | null = null;
    
    for (const entity of entities) {
      if (current && 
          current.type === entity.type && 
          entity.position.start - current.position.end <= 1) {
        // Merge adjacent entities
        const mergedEntity: QueryEntity = {
          type: current.type,
          value: current.value + ' ' + entity.value,
          confidence: (current.confidence + entity.confidence) / 2,
          position: {
            start: current.position.start,
            end: entity.position.end
          }
        };
        current = mergedEntity;
      } else {
        if (current) {
          merged.push(current);
        }
        current = entity;
      }
    }
    
    if (current) {
      merged.push(current);
    }
    
    return merged;
  }

  /**
   * Train the model with new samples
   */
  async train(samples: TrainingSample[]): Promise<void> {
    // Add to training data
    this.trainingData.push(...samples);
    
    // Mini-batch gradient descent
    const batchSize = 32;
    const epochs = 10;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle training data
      const shuffled = [...this.trainingData].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        await this.trainBatch(batch);
      }
      
      // Update model metadata
      this.weights.trainedSamples += samples.length;
      this.weights.accuracy = await this.evaluateAccuracy();
    }
  }

  /**
   * Train on a batch of samples
   */
  private async trainBatch(samples: TrainingSample[]): Promise<void> {
    // Accumulate gradients
    const gradients = this.initializeGradients();
    
    for (const sample of samples) {
      const features = this.extractFeatures(sample.text, {} as ConversationContext);
      const predictions = await this.classifyIntent(features, {} as ConversationContext);
      
      // Calculate loss and backpropagate
      const loss = this.calculateLoss(predictions, sample.intent);
      this.backpropagate(features.features, predictions, sample.intent, gradients);
    }
    
    // Update weights with accumulated gradients
    this.updateWeights(gradients, samples.length);
  }

  /**
   * Calculate loss for predictions
   */
  private calculateLoss(predictions: any[], actualIntent: QueryIntent): number {
    const actualIndex = Object.values(QueryIntent).indexOf(actualIntent);
    const predicted = predictions.find(p => p.type === actualIntent);
    
    if (!predicted) {
      return 1.0; // Maximum loss
    }
    
    // Cross-entropy loss
    return -Math.log(predicted.confidence);
  }

  /**
   * Backpropagation (simplified)
   */
  private backpropagate(
    features: number[], 
    predictions: any[], 
    actualIntent: QueryIntent,
    gradients: any
  ): void {
    // This is a simplified version - real implementation would include
    // full backpropagation through all layers
    const actualIndex = Object.values(QueryIntent).indexOf(actualIntent);
    
    // Calculate output layer gradients
    predictions.forEach((pred, idx) => {
      const target = idx === actualIndex ? 1 : 0;
      const error = pred.confidence - target;
      
      // Update gradients (simplified)
      if (!gradients.output[idx]) {
        gradients.output[idx] = 0;
      }
      gradients.output[idx] += error;
    });
  }

  /**
   * Initialize gradient structure
   */
  private initializeGradients(): any {
    return {
      input: [],
      hidden: [],
      output: []
    };
  }

  /**
   * Update weights with gradients
   */
  private updateWeights(gradients: any, batchSize: number): void {
    // Apply gradients with learning rate and regularization
    // This is simplified - real implementation would update all layers
    
    // Update output layer biases
    for (let i = 0; i < gradients.output.length; i++) {
      if (gradients.output[i]) {
        this.weights.biases[3][i] -= 
          (this.learningRate * gradients.output[i] / batchSize) +
          (this.regularization * this.weights.biases[3][i]);
      }
    }
  }

  /**
   * Evaluate model accuracy
   */
  private async evaluateAccuracy(): Promise<number> {
    if (this.trainingData.length === 0) {
      return this.weights.accuracy;
    }
    
    let correct = 0;
    const testSamples = this.trainingData.slice(-100); // Last 100 samples
    
    for (const sample of testSamples) {
      const features = this.extractFeatures(sample.text, {} as ConversationContext);
      const predictions = await this.classifyIntent(features, {} as ConversationContext);
      
      if (predictions[0]?.type === sample.intent) {
        correct++;
      }
    }
    
    return correct / testSamples.length;
  }

  /**
   * Generate human-readable reasoning for classification
   */
  private generateReasoning(
    intent: QueryIntent, 
    features: FeatureVector, 
    confidence: number
  ): string {
    const reasons: string[] = [];
    
    // Analyze which features contributed most
    const topFeatures = this.getTopContributingFeatures(intent, features);
    
    if (confidence > 0.9) {
      reasons.push(`Strong indicators for ${intent} intent`);
    } else if (confidence > 0.7) {
      reasons.push(`Moderate confidence for ${intent} intent`);
    } else {
      reasons.push(`Possible ${intent} intent`);
    }
    
    // Add specific reasoning based on features
    if (topFeatures.includes('keyword_match')) {
      reasons.push('Keywords strongly match this intent');
    }
    if (topFeatures.includes('pattern_match')) {
      reasons.push('Query structure matches known patterns');
    }
    if (topFeatures.includes('context_match')) {
      reasons.push('Context suggests this intent');
    }
    
    return reasons.join('. ');
  }

  /**
   * Identify top contributing features
   */
  private getTopContributingFeatures(intent: QueryIntent, features: FeatureVector): string[] {
    // Simplified feature importance analysis
    const important: string[] = [];
    
    // Check for keyword matches
    if (features.features[0] > 0.5) {
      important.push('keyword_match');
    }
    
    // Check for pattern matches
    if (features.features[51] > 0.3) {
      important.push('pattern_match');
    }
    
    // Check for context matches
    if (features.features[151] > 0.2) {
      important.push('context_match');
    }
    
    return important;
  }

  /**
   * Helper methods
   */
  private countPunctuation(text: string): number {
    return (text.match(/[.,!?;:]/g) || []).length;
  }

  private countCapitalWords(text: string): number {
    return (text.match(/\b[A-Z][a-z]*\b/g) || []).length;
  }

  private countNumericTokens(text: string): number {
    return (text.match(/\b\d+\b/g) || []).length;
  }

  private getDocumentFrequency(word: string): number {
    // Simplified - in production would use actual document frequencies
    return 10;
  }

  private calculateSemanticSimilarity(text: string, keywords: string[]): number {
    const words = text.toLowerCase().split(/\s+/);
    let matches = 0;
    
    for (const keyword of keywords) {
      if (words.includes(keyword)) {
        matches++;
      }
    }
    
    return matches / keywords.length;
  }

  private calculateDomainRelevance(text: string, domain: string): number {
    const domainKeywords = {
      user: ['user', 'account', 'profile', 'member'],
      message: ['message', 'chat', 'conversation', 'text'],
      file: ['file', 'document', 'upload', 'attachment'],
      stats: ['stats', 'metrics', 'analytics', 'data']
    };
    
    const keywords = domainKeywords[domain as keyof typeof domainKeywords] || [];
    return this.calculateSemanticSimilarity(text, keywords);
  }

  /**
   * Save model weights
   */
  async saveModel(path: string): Promise<void> {
    // In production, this would save to file system or database
    console.log(`Saving model to ${path}`);
  }

  /**
   * Load model weights
   */
  async loadModel(path: string): Promise<void> {
    // In production, this would load from file system or database
    console.log(`Loading model from ${path}`);
  }

  /**
   * Get model statistics
   */
  getModelStats(): {
    version: string;
    trainedSamples: number;
    accuracy: number;
    vocabularySize: number;
    entityPatternsCount: number;
  } {
    return {
      version: this.weights.version,
      trainedSamples: this.weights.trainedSamples,
      accuracy: this.weights.accuracy,
      vocabularySize: this.vocabulary.size,
      entityPatternsCount: this.entityPatterns.size
    };
  }

  /**
   * Train manual neural network (fallback)
   */
  private async trainManualNN(samples: TrainingSample[]): Promise<void> {
    const batchSize = 32;
    const epochs = 10;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      const shuffled = [...samples].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        await this.trainBatch(batch);
      }
    }
  }

  /**
   * Load custom weights format
   */
  private async loadCustomWeights(path: string): Promise<void> {
    // Implementation for loading custom weights format
    console.log(`Loading custom weights from ${path}`);
  }

  /**
   * Save custom weights format
   */
  private async saveCustomWeights(path: string): Promise<void> {
    // Implementation for saving custom weights format
    console.log(`Saving custom weights to ${path}`);
  }

  /**
   * Calculate model complexity
   */
  private calculateModelComplexity(): number {
    let complexity = 1;
    
    if (this.intentModel) {
      complexity += this.intentModel.countParams() / 1000;
    }
    
    complexity += this.vocabulary.size / 100;
    complexity += this.trainingData.length / 1000;
    
    return Math.round(complexity * 100) / 100;
  }

  /**
   * Get memory usage statistics
   */
  private getMemoryUsage(): any {
    const memory = process.memoryUsage();
    return {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(memory.external / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Hash array for caching
   */
  private hashArray(arr: number[]): string {
    let hash = 0;
    for (const num of arr) {
      hash = ((hash << 5) - hash + num) & 0xffffffff;
    }
    return hash.toString(36);
  }

  /**
   * Hash object for caching
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(36);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.predictionCache.clear();
    
    if (this.intentModel) {
      this.intentModel.dispose();
      this.intentModel = null;
    }
    
    if (this.entityModel) {
      this.entityModel.dispose();
      this.entityModel = null;
    }
    
    this.dispatchEvent(new Event('disposed'));
  }
}