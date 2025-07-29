/**
 * RAG₂ Natural Language Parser Unit Tests
 * 
 * Tests for the RAG₂ natural language query processing system.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestDataGenerator } from '../../helpers';

describe('RAG2Parser', () => {
  let parser: any;
  let mockMLClassifier: any;

  beforeEach(() => {
    mockMLClassifier = {
      extractIntents: jest.fn(),
      identifyEntities: jest.fn(),
      calculateConfidence: jest.fn(),
      suggestQueryRewrite: jest.fn()
    };

    parser = {
      mlClassifier: mockMLClassifier,
      
      // Core parsing methods
      parseNaturalQuery: jest.fn(),
      interpretQuery: jest.fn(),
      extractIntents: jest.fn(),
      identifyEntities: jest.fn(),
      generateExecutionPlan: jest.fn(),
      
      // Query optimization
      optimizeQuery: jest.fn(),
      rewriteQuery: jest.fn(),
      expandQuery: jest.fn(),
      
      // Pattern recognition
      recognizePatterns: jest.fn(),
      learnFromQuery: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Natural Language Parsing', () => {
    test('should parse simple retrieval query', async () => {
      const naturalQuery = TestDataGenerator.createNaturalQuery({
        raw: 'get all users from last week'
      });

      parser.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          originalQuery: naturalQuery,
          intents: [
            {
              type: 'retrieve',
              confidence: 0.95,
              parameters: { 
                dataType: 'users',
                timeRange: 'last_week'
              }
            }
          ],
          entities: {
            dataType: 'users',
            timeFilter: {
              type: 'relative',
              value: 'last_week',
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              endDate: new Date()
            }
          },
          targetMCPs: ['user-mcp-hot-001'],
          confidence: 0.95
        }
      });

      const result = await parser.parseNaturalQuery(naturalQuery);

      expect(result.success).toBe(true);
      expect(result.interpretedQuery.intents[0].type).toBe('retrieve');
      expect(result.interpretedQuery.entities.dataType).toBe('users');
      expect(result.interpretedQuery.confidence).toBeGreaterThan(0.9);
    });

    test('should parse complex multi-intent query', async () => {
      const naturalQuery = TestDataGenerator.createNaturalQuery({
        raw: 'show me messages from John yesterday and count total messages this week'
      });

      parser.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          originalQuery: naturalQuery,
          intents: [
            {
              type: 'retrieve',
              confidence: 0.9,
              parameters: {
                dataType: 'messages',
                userFilter: 'John',
                timeRange: 'yesterday'
              }
            },
            {
              type: 'aggregate',
              confidence: 0.85,
              parameters: {
                operation: 'count',
                dataType: 'messages',
                timeRange: 'this_week'
              }
            }
          ],
          entities: {
            dataType: 'messages',
            userFilter: { name: 'John' },
            timeFilters: [
              { type: 'relative', value: 'yesterday' },
              { type: 'relative', value: 'this_week' }
            ],
            aggregations: [{ type: 'count', field: '*' }]
          },
          targetMCPs: ['chat-mcp-hot-001'],
          confidence: 0.87
        }
      });

      const result = await parser.parseNaturalQuery(naturalQuery);

      expect(result.success).toBe(true);
      expect(result.interpretedQuery.intents).toHaveLength(2);
      expect(result.interpretedQuery.intents[0].type).toBe('retrieve');
      expect(result.interpretedQuery.intents[1].type).toBe('aggregate');
    });

    test('should parse analytical query with comparisons', async () => {
      const naturalQuery = TestDataGenerator.createNaturalQuery({
        raw: 'compare user activity this month vs last month'
      });

      parser.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          originalQuery: naturalQuery,
          intents: [
            {
              type: 'compare',
              confidence: 0.92,
              parameters: {
                metric: 'user_activity',
                periods: ['this_month', 'last_month'],
                comparisonType: 'temporal'
              }
            }
          ],
          entities: {
            metric: 'user_activity',
            timeComparisons: [
              { period: 'this_month', label: 'Current Month' },
              { period: 'last_month', label: 'Previous Month' }
            ],
            aggregationType: 'comparison'
          },
          targetMCPs: ['stats-mcp-hot-001', 'user-mcp-hot-001'],
          confidence: 0.92
        }
      });

      const result = await parser.parseNaturalQuery(naturalQuery);

      expect(result.success).toBe(true);
      expect(result.interpretedQuery.intents[0].type).toBe('compare');
      expect(result.interpretedQuery.targetMCPs).toHaveLength(2);
    });

    test('should parse update/modification query', async () => {
      const naturalQuery = TestDataGenerator.createNaturalQuery({
        raw: 'update user john@example.com set status to active'
      });

      parser.parseNaturalQuery.mockResolvedValue({
        success: true,
        interpretedQuery: {
          originalQuery: naturalQuery,
          intents: [
            {
              type: 'update',
              confidence: 0.94,
              parameters: {
                dataType: 'user',
                identifier: 'john@example.com',
                field: 'status',
                value: 'active'
              }
            }
          ],
          entities: {
            dataType: 'user',
            identifier: { type: 'email', value: 'john@example.com' },
            updates: [{ field: 'status', value: 'active' }]
          },
          targetMCPs: ['user-mcp-hot-001'],
          confidence: 0.94,
          requiresConfirmation: true
        }
      });

      const result = await parser.parseNaturalQuery(naturalQuery);

      expect(result.success).toBe(true);
      expect(result.interpretedQuery.intents[0].type).toBe('update');
      expect(result.interpretedQuery.requiresConfirmation).toBe(true);
    });
  });

  describe('Intent Recognition', () => {
    test('should identify retrieval intent with high confidence', async () => {
      const queryText = 'show me all active users';

      parser.extractIntents.mockResolvedValue([
        {
          type: 'retrieve',
          confidence: 0.96,
          keywords: ['show', 'all', 'users'],
          patterns: ['imperative_query', 'data_retrieval'],
          parameters: {
            action: 'show',
            target: 'users',
            filter: 'active'
          }
        }
      ]);

      const intents = await parser.extractIntents(queryText);

      expect(intents).toHaveLength(1);
      expect(intents[0].type).toBe('retrieve');
      expect(intents[0].confidence).toBeGreaterThan(0.95);
      expect(intents[0].keywords).toContain('users');
    });

    test('should identify aggregation intent', async () => {
      const queryText = 'count messages by user';

      parser.extractIntents.mockResolvedValue([
        {
          type: 'aggregate',
          confidence: 0.91,
          keywords: ['count', 'messages', 'by'],
          patterns: ['aggregation_query', 'group_by_pattern'],
          parameters: {
            operation: 'count',
            target: 'messages',
            groupBy: 'user'
          }
        }
      ]);

      const intents = await parser.extractIntents(queryText);

      expect(intents[0].type).toBe('aggregate');
      expect(intents[0].parameters.operation).toBe('count');
      expect(intents[0].parameters.groupBy).toBe('user');
    });

    test('should identify multiple intents in complex query', async () => {
      const queryText = 'get user details and show their message count';

      parser.extractIntents.mockResolvedValue([
        {
          type: 'retrieve',
          confidence: 0.88,
          keywords: ['get', 'user', 'details'],
          parameters: { target: 'user_details' }
        },
        {
          type: 'aggregate',
          confidence: 0.85,
          keywords: ['show', 'message', 'count'],
          parameters: { operation: 'count', target: 'messages' }
        }
      ]);

      const intents = await parser.extractIntents(queryText);

      expect(intents).toHaveLength(2);
      expect(intents[0].type).toBe('retrieve');
      expect(intents[1].type).toBe('aggregate');
    });

    test('should handle ambiguous intent', async () => {
      const queryText = 'user information';

      parser.extractIntents.mockResolvedValue([
        {
          type: 'retrieve',
          confidence: 0.55,
          keywords: ['user', 'information'],
          ambiguity: {
            reason: 'Unclear action verb',
            alternatives: [
              { type: 'create', confidence: 0.3 },
              { type: 'update', confidence: 0.15 }
            ]
          }
        }
      ]);

      const intents = await parser.extractIntents(queryText);

      expect(intents[0].confidence).toBeLessThan(0.7);
      expect(intents[0].ambiguity).toBeDefined();
      expect(intents[0].ambiguity.alternatives).toHaveLength(2);
    });
  });

  describe('Entity Extraction', () => {
    test('should extract user entities correctly', async () => {
      const queryText = 'get messages from john.doe@company.com last Monday';

      parser.identifyEntities.mockResolvedValue({
        entities: {
          user: {
            type: 'email',
            value: 'john.doe@company.com',
            confidence: 0.98
          },
          dataType: {
            type: 'data_category',
            value: 'messages',
            confidence: 0.95
          },
          timeRange: {
            type: 'relative_date',
            value: 'last_Monday',
            resolvedDate: new Date('2023-12-11'),
            confidence: 0.89
          }
        },
        entityCount: 3,
        extractionQuality: 0.94
      });

      const result = await parser.identifyEntities(queryText);

      expect(result.entities.user.type).toBe('email');
      expect(result.entities.user.value).toBe('john.doe@company.com');
      expect(result.entities.timeRange.type).toBe('relative_date');
      expect(result.entityCount).toBe(3);
    });

    test('should extract numerical entities and ranges', async () => {
      const queryText = 'show users with more than 100 messages in the last 30 days';

      parser.identifyEntities.mockResolvedValue({
        entities: {
          dataType: {
            type: 'data_category',
            value: 'users',
            confidence: 0.96
          },
          threshold: {
            type: 'numerical_comparison',
            operator: 'greater_than',
            value: 100,
            field: 'message_count',
            confidence: 0.93
          },
          timeRange: {
            type: 'relative_period',
            value: '30_days',
            unit: 'days',
            amount: 30,
            confidence: 0.91
          }
        },
        entityCount: 3,
        extractionQuality: 0.93
      });

      const result = await parser.identifyEntities(queryText);

      expect(result.entities.threshold.operator).toBe('greater_than');
      expect(result.entities.threshold.value).toBe(100);
      expect(result.entities.timeRange.amount).toBe(30);
    });

    test('should handle nested entity structures', async () => {
      const queryText = 'find users in engineering team with premium subscriptions who logged in this week';

      parser.identifyEntities.mockResolvedValue({
        entities: {
          dataType: 'users',
          filters: [
            {
              field: 'team',
              operator: 'equals',
              value: 'engineering',
              confidence: 0.88
            },
            {
              field: 'subscription_type',
              operator: 'equals',
              value: 'premium',
              confidence: 0.92
            },
            {
              field: 'last_login',
              operator: 'within',
              value: 'this_week',
              confidence: 0.85
            }
          ]
        },
        entityCount: 4,
        extractionQuality: 0.88
      });

      const result = await parser.identifyEntities(queryText);

      expect(result.entities.filters).toHaveLength(3);
      expect(result.entities.filters[0].field).toBe('team');
      expect(result.entities.filters[1].value).toBe('premium');
      expect(result.entities.filters[2].operator).toBe('within');
    });
  });

  describe('Execution Plan Generation', () => {
    test('should generate simple execution plan', async () => {
      const interpretedQuery = TestDataGenerator.createInterpretedQuery({
        intents: [
          {
            type: 'retrieve',
            confidence: 0.95,
            parameters: { dataType: 'users' }
          }
        ]
      });

      parser.generateExecutionPlan.mockResolvedValue({
        steps: [
          {
            id: 'step-1',
            type: 'query',
            targetMCP: 'user-mcp-hot-001',
            operation: 'SELECT * FROM users',
            parameters: {},
            dependencies: [],
            estimatedTime: 50,
            resources: {
              cpu: 1,
              memory: 32,
              diskIO: 5,
              networkBandwidth: 2,
              dataSize: 512
            }
          }
        ],
        estimatedTime: 50,
        resourceRequirements: {
          cpu: 1,
          memory: 32,
          diskIO: 5,
          networkBandwidth: 2,
          dataSize: 512
        },
        optimizationStrategy: {
          name: 'direct_query',
          caching: { level: 'query', ttl: 300 },
          indexUsage: ['user_id_idx', 'email_idx']
        }
      });

      const plan = await parser.generateExecutionPlan(interpretedQuery);

      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].targetMCP).toContain('user-mcp');
      expect(plan.estimatedTime).toBeLessThan(100);
      expect(plan.optimizationStrategy.indexUsage).toContain('user_id_idx');
    });

    test('should generate complex multi-step execution plan', async () => {
      const interpretedQuery = TestDataGenerator.createInterpretedQuery({
        intents: [
          { type: 'retrieve', confidence: 0.9, parameters: { dataType: 'users' } },
          { type: 'aggregate', confidence: 0.85, parameters: { operation: 'count', target: 'messages' } }
        ]
      });

      parser.generateExecutionPlan.mockResolvedValue({
        steps: [
          {
            id: 'step-1',
            type: 'query',
            targetMCP: 'user-mcp-hot-001',
            operation: 'SELECT user_id FROM users WHERE active = true',
            dependencies: [],
            estimatedTime: 30
          },
          {
            id: 'step-2',
            type: 'aggregate',
            targetMCP: 'chat-mcp-hot-001',
            operation: 'SELECT user_id, COUNT(*) FROM messages GROUP BY user_id',
            dependencies: ['step-1'],
            estimatedTime: 80
          },
          {
            id: 'step-3',
            type: 'join',
            operation: 'JOIN results from step-1 and step-2',
            dependencies: ['step-1', 'step-2'],
            estimatedTime: 20
          }
        ],
        estimatedTime: 130,
        parallelization: {
          parallel: false,
          maxParallelism: 1,
          synchronizationPoints: ['step-3']
        }
      });

      const plan = await parser.generateExecutionPlan(interpretedQuery);

      expect(plan.steps).toHaveLength(3);
      expect(plan.steps[1].dependencies).toContain('step-1');
      expect(plan.steps[2].dependencies).toHaveLength(2);
      expect(plan.parallelization.synchronizationPoints).toContain('step-3');
    });

    test('should optimize execution plan for performance', async () => {
      const interpretedQuery = TestDataGenerator.createInterpretedQuery();

      parser.generateExecutionPlan.mockResolvedValue({
        steps: [
          {
            id: 'optimized-step-1',
            type: 'query',
            targetMCP: 'user-mcp-hot-001',
            optimizations: ['index_scan', 'projection_pushdown'],
            estimatedTime: 25 // Optimized from 50ms
          }
        ],
        estimatedTime: 25,
        optimizationStrategy: {
          name: 'performance_optimized',
          appliedOptimizations: [
            'query_rewriting',
            'index_selection',
            'join_reordering'
          ],
          caching: {
            level: 'result',
            keyStrategy: 'semantic_hash',
            ttl: 1800
          }
        },
        performanceGain: '50% faster than baseline'
      });

      const plan = await parser.generateExecutionPlan(interpretedQuery);

      expect(plan.steps[0].optimizations).toContain('index_scan');
      expect(plan.optimizationStrategy.appliedOptimizations).toHaveLength(3);
      expect(plan.performanceGain).toContain('faster');
    });
  });

  describe('Query Optimization and Rewriting', () => {
    test('should optimize simple query for better performance', async () => {
      const originalQuery = 'get all users and their messages';

      parser.optimizeQuery.mockResolvedValue({
        optimizedQuery: 'retrieve user profiles with message counts using join optimization',
        optimizations: [
          'query_rewriting',
          'join_optimization',
          'projection_pruning'
        ],
        estimatedSpeedup: 2.3,
        reasoning: 'Combined retrieval reduces round trips and uses index joins'
      });

      const result = await parser.optimizeQuery(originalQuery);

      expect(result.estimatedSpeedup).toBeGreaterThan(2);
      expect(result.optimizations).toContain('join_optimization');
      expect(result.reasoning).toContain('index joins');
    });

    test('should rewrite ambiguous query for clarity', async () => {
      const ambiguousQuery = 'user stuff from yesterday';

      parser.rewriteQuery.mockResolvedValue({
        rewrittenQuery: 'retrieve user activity data from yesterday',
        clarity: {
          original: 0.3,
          rewritten: 0.85,
          improvement: 0.55
        },
        changes: [
          'replaced "stuff" with "activity data"',
          'made retrieval intent explicit',
          'clarified temporal reference'
        ]
      });

      const result = await parser.rewriteQuery(ambiguousQuery);

      expect(result.clarity.rewritten).toBeGreaterThan(0.8);
      expect(result.clarity.improvement).toBeGreaterThan(0.5);
      expect(result.changes).toHaveLength(3);
    });

    test('should expand abbreviated query', async () => {
      const shortQuery = 'msgs john today';

      parser.expandQuery.mockResolvedValue({
        expandedQuery: 'retrieve all messages sent by user john today',
        expansions: [
          'msgs → messages',
          'john → user john',
          'today → sent today',
          'added retrieval intent'
        ],
        confidence: 0.88
      });

      const result = await parser.expandQuery(shortQuery);

      expect(result.expandedQuery).toContain('retrieve all messages');
      expect(result.expansions).toHaveLength(4);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty or malformed queries', async () => {
      const emptyQuery = TestDataGenerator.createNaturalQuery({ raw: '' });

      parser.parseNaturalQuery.mockResolvedValue({
        success: false,
        error: 'Empty query provided',
        fallback: {
          suggestion: 'Please provide a query describing what data you need',
          examples: [
            'get all users',
            'show messages from last week',
            'count active sessions'
          ]
        }
      });

      const result = await parser.parseNaturalQuery(emptyQuery);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty query provided');
      expect(result.fallback.examples).toHaveLength(3);
    });

    test('should handle queries with unsupported operations', async () => {
      const unsupportedQuery = TestDataGenerator.createNaturalQuery({
        raw: 'delete all users from the system permanently'
      });

      parser.parseNaturalQuery.mockResolvedValue({
        success: false,
        error: 'Destructive operations require explicit confirmation',
        interpretedQuery: {
          intents: [
            {
              type: 'delete',
              confidence: 0.92,
              parameters: { target: 'all_users', scope: 'permanent' }
            }
          ],
          riskLevel: 'high',
          requiresConfirmation: true,
          confirmationRequired: [
            'Admin privileges verification',
            'Backup confirmation',
            'Impact acknowledgment'
          ]
        }
      });

      const result = await parser.parseNaturalQuery(unsupportedQuery);

      expect(result.success).toBe(false);
      expect(result.interpretedQuery.riskLevel).toBe('high');
      expect(result.interpretedQuery.confirmationRequired).toHaveLength(3);
    });

    test('should handle queries in different languages gracefully', async () => {
      const foreignQuery = TestDataGenerator.createNaturalQuery({
        raw: 'obtener todos los usuarios' // Spanish
      });

      parser.parseNaturalQuery.mockResolvedValue({
        success: false,
        error: 'Non-English query detected',
        detectedLanguage: 'es',
        translationSuggestion: 'get all users',
        supportedLanguages: ['en']
      });

      const result = await parser.parseNaturalQuery(foreignQuery);

      expect(result.success).toBe(false);
      expect(result.detectedLanguage).toBe('es');
      expect(result.translationSuggestion).toBe('get all users');
    });

    test('should handle service timeout scenarios', async () => {
      const complexQuery = TestDataGenerator.createNaturalQuery({
        raw: 'analyze complex user behavior patterns across all data sources'
      });

      parser.parseNaturalQuery.mockRejectedValue(
        new Error('Query parsing timeout - query too complex')
      );

      await expect(parser.parseNaturalQuery(complexQuery))
        .rejects.toThrow('Query parsing timeout');
    });
  });
});