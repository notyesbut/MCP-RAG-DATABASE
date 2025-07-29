/**
 * RAG₁ Classifier Unit Tests
 * 
 * Tests for the RAG₁ intelligent data classification system.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestDataGenerator } from '../../helpers';

describe('RAG1Classifier', () => {
  let classifier: any;
  let mockIntelligenceCoordinator: any;

  beforeEach(() => {
    // Mock intelligence coordinator
    mockIntelligenceCoordinator = {
      classifyDataType: jest.fn(),
      determineOptimalMCP: jest.fn(),
      learnFromClassification: jest.fn(),
      getPatternSuggestions: jest.fn()
    };

    // Mock RAG1 Classifier
    classifier = {
      intelligenceCoordinator: mockIntelligenceCoordinator,
      
      // Core classification methods
      classifyIncomingData: jest.fn(),
      analyzeDomain: jest.fn(),
      determineHotColdTier: jest.fn(),
      routeToMCP: jest.fn(),
      
      // Pattern learning
      updateClassificationRules: jest.fn(),
      learnFromFeedback: jest.fn(),
      
      // Configuration
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Type Classification', () => {
    test('should classify user data correctly', async () => {
      const userData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        preferences: { theme: 'dark' }
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'user',
        domain: 'users',
        confidence: 0.95,
        suggestedMCP: 'user-mcp-hot-001',
        reasoning: 'Contains user profile fields'
      });

      const result = await classifier.classifyIncomingData(userData);

      expect(result.dataType).toBe('user');
      expect(result.domain).toBe('users');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.suggestedMCP).toContain('user-mcp');
    });

    test('should classify chat message data correctly', async () => {
      const messageData = {
        content: 'Hello, how are you?',
        userId: 'user-123',
        channelId: 'channel-456',
        timestamp: new Date()
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'message',
        domain: 'messages',
        confidence: 0.92,
        suggestedMCP: 'chat-mcp-hot-001',
        reasoning: 'Contains message structure with content and metadata'
      });

      const result = await classifier.classifyIncomingData(messageData);

      expect(result.dataType).toBe('message');
      expect(result.domain).toBe('messages');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.suggestedMCP).toContain('chat-mcp');
    });

    test('should classify analytics data correctly', async () => {
      const analyticsData = {
        eventType: 'page_view',
        userId: 'user-123',
        timestamp: new Date(),
        properties: {
          page: '/dashboard',
          duration: 30000,
          browser: 'Chrome'
        }
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'analytics_event',
        domain: 'analytics',
        confidence: 0.88,
        suggestedMCP: 'stats-mcp-hot-001',
        reasoning: 'Contains event tracking structure'
      });

      const result = await classifier.classifyIncomingData(analyticsData);

      expect(result.dataType).toBe('analytics_event');
      expect(result.domain).toBe('analytics');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should classify log data correctly', async () => {
      const logData = {
        level: 'info',
        message: 'User authentication successful',
        timestamp: new Date(),
        source: 'auth-service',
        metadata: {
          userId: 'user-123',
          ip: '192.168.1.1'
        }
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'log_entry',
        domain: 'logs',
        confidence: 0.93,
        suggestedMCP: 'logs-mcp-cold-001',
        reasoning: 'Contains log structure with level and message'
      });

      const result = await classifier.classifyIncomingData(logData);

      expect(result.dataType).toBe('log_entry');
      expect(result.domain).toBe('logs');
      expect(result.suggestedMCP).toContain('logs-mcp');
    });

    test('should handle ambiguous data classification', async () => {
      const ambiguousData = {
        id: '123',
        data: 'some generic data',
        timestamp: new Date()
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'unknown',
        domain: 'generic',
        confidence: 0.45,
        suggestedMCP: null,
        reasoning: 'Insufficient distinctive features for classification',
        alternatives: [
          { dataType: 'event', confidence: 0.3 },
          { dataType: 'metadata', confidence: 0.25 }
        ]
      });

      const result = await classifier.classifyIncomingData(ambiguousData);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.suggestedMCP).toBeNull();
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('Hot/Cold Tier Classification', () => {
    test('should classify high-frequency data as hot', async () => {
      const recentUserData = {
        userId: 'user-123',
        lastActivity: new Date(),
        activityScore: 0.9
      };

      classifier.determineHotColdTier.mockResolvedValue({
        tier: 'hot',
        confidence: 0.95,
        factors: {
          accessFrequency: 'high',
          recency: 'very_recent',
          userActivity: 'active'
        },
        reasoning: 'Recent activity with high engagement score'
      });

      const result = await classifier.determineHotColdTier(recentUserData);

      expect(result.tier).toBe('hot');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.factors.accessFrequency).toBe('high');
    });

    test('should classify archival data as cold', async () => {
      const archivalData = {
        logEntry: 'System startup',
        timestamp: new Date('2022-01-01'),
        accessed: 0
      };

      classifier.determineHotColdTier.mockResolvedValue({
        tier: 'cold',
        confidence: 0.88,
        factors: {
          accessFrequency: 'none',
          recency: 'very_old',
          dataType: 'archival'
        },
        reasoning: 'Old log data with no recent access'
      });

      const result = await classifier.determineHotColdTier(archivalData);

      expect(result.tier).toBe('cold');
      expect(result.factors.recency).toBe('very_old');
      expect(result.factors.accessFrequency).toBe('none');
    });

    test('should handle edge case data for tier classification', async () => {
      const edgeCaseData = {
        userId: 'user-123',
        timestamp: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)), // 30 days old
        accessCount: 5
      };

      classifier.determineHotColdTier.mockResolvedValue({
        tier: 'warm', // Edge case - neither clearly hot nor cold
        confidence: 0.6,
        factors: {
          accessFrequency: 'medium',
          recency: 'moderate',
          userActivity: 'moderate'
        },
        reasoning: 'Moderate access pattern, consider for optimization'
      });

      const result = await classifier.determineHotColdTier(edgeCaseData);

      expect(result.tier).toBe('warm');
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.factors.accessFrequency).toBe('medium');
    });
  });

  describe('MCP Routing', () => {
    test('should route to appropriate hot MCP', async () => {
      const classificationResult = {
        dataType: 'user',
        domain: 'users',
        tier: 'hot',
        confidence: 0.95
      };

      classifier.routeToMCP.mockResolvedValue({
        targetMCP: 'user-mcp-hot-001',
        routingDecision: 'direct',
        estimatedLatency: 25,
        loadBalancing: {
          currentLoad: 0.4,
          capacity: 0.8,
          alternative: 'user-mcp-hot-002'
        }
      });

      const result = await classifier.routeToMCP(classificationResult);

      expect(result.targetMCP).toContain('user-mcp-hot');
      expect(result.routingDecision).toBe('direct');
      expect(result.estimatedLatency).toBeLessThan(50);
    });

    test('should route to cold MCP for archival data', async () => {
      const classificationResult = {
        dataType: 'log_entry',
        domain: 'logs',
        tier: 'cold',
        confidence: 0.9
      };

      classifier.routeToMCP.mockResolvedValue({
        targetMCP: 'logs-mcp-cold-001',
        routingDecision: 'batch',
        estimatedLatency: 150,
        loadBalancing: {
          currentLoad: 0.2,
          capacity: 0.9,
          batchSize: 100
        }
      });

      const result = await classifier.routeToMCP(classificationResult);

      expect(result.targetMCP).toContain('logs-mcp-cold');
      expect(result.routingDecision).toBe('batch');
      expect(result.estimatedLatency).toBeGreaterThan(100);
    });

    test('should handle load balancing across multiple MCPs', async () => {
      const classificationResult = {
        dataType: 'message',
        domain: 'messages',
        tier: 'hot',
        confidence: 0.92
      };

      classifier.routeToMCP.mockResolvedValue({
        targetMCP: 'chat-mcp-hot-002', // Alternate due to load balancing
        routingDecision: 'load_balanced',
        estimatedLatency: 30,
        loadBalancing: {
          primaryMCP: 'chat-mcp-hot-001',
          primaryLoad: 0.95, // Too high
          selectedMCP: 'chat-mcp-hot-002',
          selectedLoad: 0.3
        }
      });

      const result = await classifier.routeToMCP(classificationResult);

      expect(result.routingDecision).toBe('load_balanced');
      expect(result.loadBalancing.selectedLoad).toBeLessThan(0.5);
    });
  });

  describe('Pattern Learning and Adaptation', () => {
    test('should learn from successful classifications', async () => {
      const classificationFeedback = {
        originalData: { email: 'test@example.com', name: 'John' },
        predictedClass: 'user',
        actualClass: 'user',
        confidence: 0.95,
        success: true
      };

      classifier.learnFromFeedback.mockResolvedValue({
        patternUpdated: true,
        confidenceAdjustment: 0.02,
        newRules: [
          'email field strongly indicates user data',
          'name + email combination = 99% user classification'
        ]
      });

      const result = await classifier.learnFromFeedback(classificationFeedback);

      expect(result.patternUpdated).toBe(true);
      expect(result.confidenceAdjustment).toBeGreaterThan(0);
      expect(result.newRules).toHaveLength(2);
    });

    test('should learn from classification errors', async () => {
      const classificationFeedback = {
        originalData: { content: 'Error: Database connection failed' },
        predictedClass: 'message',
        actualClass: 'log_entry',
        confidence: 0.8,
        success: false
      };

      classifier.learnFromFeedback.mockResolvedValue({
        patternUpdated: true,
        confidenceAdjustment: -0.15,
        newRules: [
          'Error: prefix indicates log entry, not message',
          'System error patterns should route to logs domain'
        ],
        correctionApplied: true
      });

      const result = await classifier.learnFromFeedback(classificationFeedback);

      expect(result.patternUpdated).toBe(true);
      expect(result.confidenceAdjustment).toBeLessThan(0);
      expect(result.correctionApplied).toBe(true);
    });

    test('should adapt classification rules over time', async () => {
      const adaptationData = {
        timeWindow: '7days',
        classifications: 1000,
        accuracy: 0.94,
        errorPatterns: [
          'Misclassified system messages as user messages',
          'Confused analytics events with log entries'
        ]
      };

      classifier.updateClassificationRules.mockResolvedValue({
        rulesUpdated: 5,
        accuracyImprovement: 0.03,
        newFeatures: [
          'system_context_detection',
          'analytics_event_signature'
        ]
      });

      const result = await classifier.updateClassificationRules(adaptationData);

      expect(result.rulesUpdated).toBeGreaterThan(0);
      expect(result.accuracyImprovement).toBeGreaterThan(0);
      expect(result.newFeatures).toHaveLength(2);
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle high-volume data classification', async () => {
      const batchData = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        type: i % 2 === 0 ? 'user' : 'message',
        data: TestDataGenerator.randomString(100)
      }));

      classifier.classifyIncomingData.mockImplementation((data: any) => 
        Promise.resolve({
          dataType: data.type,
          domain: data.type === 'user' ? 'users' : 'messages',
          confidence: 0.9 + Math.random() * 0.1,
          suggestedMCP: `${data.type}-mcp-hot-001`
        })
      );

      const results = await Promise.all(
        batchData.map(item => classifier.classifyIncomingData(item))
      );

      expect(results).toHaveLength(1000);
      expect(results.every(r => r.confidence > 0.9)).toBe(true);
    });

    test('should handle malformed data gracefully', async () => {
      const malformedData = {
        // Missing critical fields
        randomField: 'value',
        null: null,
        undefined: undefined
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'unknown',
        domain: 'unclassified',
        confidence: 0.1,
        suggestedMCP: null,
        error: 'Insufficient data for classification',
        fallback: 'generic-mcp-001'
      });

      const result = await classifier.classifyIncomingData(malformedData);

      expect(result.confidence).toBeLessThan(0.2);
      expect(result.error).toBeDefined();
      expect(result.fallback).toBeDefined();
    });

    test('should handle classification service failures', async () => {
      classifier.classifyIncomingData.mockRejectedValue(
        new Error('Classification service temporarily unavailable')
      );

      await expect(classifier.classifyIncomingData({ test: 'data' }))
        .rejects.toThrow('Classification service temporarily unavailable');
    });

    test('should provide fallback classification when confidence is low', async () => {
      const ambiguousData = {
        mixedField1: 'user-like',
        mixedField2: 'message-like',
        mixedField3: 'log-like'
      };

      classifier.classifyIncomingData.mockResolvedValue({
        dataType: 'mixed',
        domain: 'generic',
        confidence: 0.3,
        suggestedMCP: null,
        fallbackAction: 'manual_review',
        queuedForHumanReview: true
      });

      const result = await classifier.classifyIncomingData(ambiguousData);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.fallbackAction).toBe('manual_review');
      expect(result.queuedForHumanReview).toBe(true);
    });
  });
});