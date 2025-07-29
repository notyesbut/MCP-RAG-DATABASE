/**
 * MCP Communication Hub - Inter-MCP communication and coordination
 * Enables intelligent data sharing and distributed query processing
 */

import { EventEmitter } from 'events';
import { BaseMCP } from '../../core/mcp/base_mcp';
import { MCPQuery, MCPResult, MCPMetadata, MCPTier } from '../../types/mcp.types';

export interface MCPMessage {
  id: string;
  type: MCPMessageType;
  senderId: string;
  recipientIds: string[];
  payload: any;
  timestamp: Date;
  priority: MessagePriority;
  ttl: number;                   // Time to live in milliseconds
  requiresAck: boolean;
  correlationId?: string;        // For request/response patterns
}

export enum MCPMessageType {
  QUERY_REQUEST = 'query_request',
  QUERY_RESPONSE = 'query_response',
  DATA_SYNC = 'data_sync',
  CACHE_INVALIDATION = 'cache_invalidation',
  HEALTH_CHECK = 'health_check',
  PERFORMANCE_METRICS = 'performance_metrics',
  COORDINATION = 'coordination',
  MIGRATION_NOTIFICATION = 'migration_notification',
  BACKUP_REQUEST = 'backup_request',
  CUSTOM = 'custom'
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DistributedQuery {
  id: string;
  originalQuery: MCPQuery;
  strategy: QueryDistributionStrategy;
  targetMcps: string[];
  aggregationType: AggregationType;
  timeout: number;
  partialResultsAllowed: boolean;
}

export enum QueryDistributionStrategy {
  BROADCAST = 'broadcast',       // Send to all relevant MCPs
  ROUND_ROBIN = 'round_robin',   // Distribute load evenly
  FASTEST_FIRST = 'fastest_first', // Send to fastest responding MCPs
  TIER_BASED = 'tier_based',     // Query hot tier first, then warm, then cold
  CONTENT_AWARE = 'content_aware' // Route based on data content/type
}

export enum AggregationType {
  MERGE = 'merge',               // Combine all results
  FIRST_MATCH = 'first_match',   // Return first successful result
  BEST_MATCH = 'best_match',     // Return highest quality result
  MAJORITY = 'majority',         // Return result from majority of MCPs
  UNION = 'union',               // Union of all results
  INTERSECTION = 'intersection'   // Intersection of all results
}

export interface QueryResult {
  queryId: string;
  results: Map<string, MCPResult>;
  aggregatedResult: MCPResult;
  executionStats: QueryExecutionStats;
}

export interface QueryExecutionStats {
  totalMcps: number;
  successfulMcps: number;
  failedMcps: number;
  avgResponseTime: number;
  totalExecutionTime: number;
  cacheHits: number;
  networkRoundTrips: number;
}

export interface MCPTopology {
  mcps: Map<string, MCPNodeInfo>;
  connections: Map<string, string[]>;
  routingTable: Map<string, string[]>;
}

export interface MCPNodeInfo {
  id: string;
  metadata: MCPMetadata;
  capabilities: string[];
  currentLoad: number;
  avgResponseTime: number;
  reliability: number;           // 0-1 score
  lastSeen: Date;
}

export class MCPCommunicationHub extends EventEmitter {
  private mcps: Map<string, BaseMCP>;
  private messageQueue: Map<MessagePriority, MCPMessage[]>;
  private pendingQueries: Map<string, DistributedQuery>;
  private topology: MCPTopology;
  private messageHandlers: Map<MCPMessageType, ((message: MCPMessage) => Promise<void>)[]>;
  private isProcessing: boolean;
  private messageHistory: MCPMessage[];
  private performanceCache: Map<string, number>;

  constructor() {
    super();
    
    this.mcps = new Map();
    this.messageQueue = new Map();
    this.pendingQueries = new Map();
    this.messageHandlers = new Map();
    this.isProcessing = false;
    this.messageHistory = [];
    this.performanceCache = new Map();
    
    this.topology = {
      mcps: new Map(),
      connections: new Map(),
      routingTable: new Map()
    };

    // Initialize message queues
    Object.values(MessagePriority).forEach(priority => {
      this.messageQueue.set(priority, []);
    });

    // Initialize message handlers
    this.setupDefaultMessageHandlers();
    this.startMessageProcessor();
    this.startTopologyMonitor();
  }

  // MCP Registration and Discovery
  async registerMCP(mcp: BaseMCP): Promise<void> {
    const metadata = await mcp.getMetadata();
    this.mcps.set(metadata.id, mcp);
    
    const nodeInfo: MCPNodeInfo = {
      id: metadata.id,
      metadata,
      capabilities: this.extractCapabilities(mcp),
      currentLoad: 0,
      avgResponseTime: 0,
      reliability: 1.0,
      lastSeen: new Date()
    };
    
    this.topology.mcps.set(metadata.id, nodeInfo);
    this.updateTopology();
    
    // Setup MCP event handlers
    this.setupMCPEventHandlers(mcp);
    
    this.emit('mcp-registered', { mcpId: metadata.id, nodeInfo });
  }

  async unregisterMCP(mcpId: string): Promise<void> {
    this.mcps.delete(mcpId);
    this.topology.mcps.delete(mcpId);
    this.topology.connections.delete(mcpId);
    
    // Remove from other MCP connections
    for (const [id, connections] of this.topology.connections) {
      const index = connections.indexOf(mcpId);
      if (index > -1) {
        connections.splice(index, 1);
      }
    }
    
    this.updateTopology();
    this.emit('mcp-unregistered', { mcpId });
  }

  // Distributed Query Processing
  async executeDistributedQuery(query: MCPQuery, strategy: QueryDistributionStrategy = QueryDistributionStrategy.TIER_BASED): Promise<QueryResult> {
    const distributedQuery: DistributedQuery = {
      id: this.generateQueryId(),
      originalQuery: query,
      strategy,
      targetMcps: this.selectTargetMCPs(query, strategy),
      aggregationType: this.determineAggregationType(query),
      timeout: 10000, // Default timeout
      partialResultsAllowed: true
    };

    this.pendingQueries.set(distributedQuery.id, distributedQuery);
    
    const startTime = Date.now();
    const results = new Map<string, MCPResult>();
    
    try {
      // Execute query on target MCPs
      const queryPromises = distributedQuery.targetMcps.map(async (mcpId) => {
        try {
          const mcp = this.mcps.get(mcpId);
          if (!mcp) {
            throw new Error(`MCP not found: ${mcpId}`);
          }

          const result = await this.executeQueryWithTimeout(mcp, query, distributedQuery.timeout);
          results.set(mcpId, result);
          
          // Update performance metrics
          this.updateMCPPerformance(mcpId, result.executionTime);
          
          return { mcpId, result };
        } catch (error) {
          const errorResult: MCPResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executionTime: 0,
            fromCache: false,
            mcpId
          };
          
          results.set(mcpId, errorResult);
          return { mcpId, result: errorResult };
        }
      });

      await Promise.allSettled(queryPromises);
      
      // Aggregate results
      const aggregatedResult = this.aggregateResults(results, distributedQuery.aggregationType);
      
      const executionStats: QueryExecutionStats = {
        totalMcps: distributedQuery.targetMcps.length,
        successfulMcps: Array.from(results.values()).filter(r => r.success).length,
        failedMcps: Array.from(results.values()).filter(r => !r.success).length,
        avgResponseTime: this.calculateAverageResponseTime(results),
        totalExecutionTime: Date.now() - startTime,
        cacheHits: Array.from(results.values()).filter(r => r.fromCache).length,
        networkRoundTrips: distributedQuery.targetMcps.length
      };

      const queryResult: QueryResult = {
        queryId: distributedQuery.id,
        results,
        aggregatedResult,
        executionStats
      };

      this.emit('distributed-query-completed', queryResult);
      return queryResult;

    } finally {
      this.pendingQueries.delete(distributedQuery.id);
    }
  }

  // Message Broadcasting and Routing
  async broadcastMessage(message: Omit<MCPMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: MCPMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date()
    };

    if (message.recipientIds.length === 0) {
      // Broadcast to all MCPs
      fullMessage.recipientIds = Array.from(this.mcps.keys());
    }

    await this.queueMessage(fullMessage);
    this.emit('message-broadcasted', fullMessage);
  }

  async sendMessage(senderId: string, recipientId: string, type: MCPMessageType, payload: any, options: Partial<{
    priority: MessagePriority;
    ttl: number;
    requiresAck: boolean;
    correlationId: string;
  }> = {}): Promise<void> {
    const message: MCPMessage = {
      id: this.generateMessageId(),
      type,
      senderId,
      recipientIds: [recipientId],
      payload,
      timestamp: new Date(),
      priority: options.priority || MessagePriority.NORMAL,
      ttl: options.ttl || 60000, // 1 minute default
      requiresAck: options.requiresAck || false,
      correlationId: options.correlationId
    };

    await this.queueMessage(message);
  }

  // Cache Coordination
  async invalidateCache(mcpIds: string[], cacheKeys: string[]): Promise<void> {
    const message = {
      type: MCPMessageType.CACHE_INVALIDATION,
      senderId: 'hub',
      recipientIds: mcpIds,
      payload: { cacheKeys },
      priority: MessagePriority.HIGH,
      ttl: 30000,
      requiresAck: true
    };

    await this.broadcastMessage(message);
  }

  async syncData(sourceMcpId: string, targetMcpIds: string[], data: any[]): Promise<void> {
    const message = {
      type: MCPMessageType.DATA_SYNC,
      senderId: sourceMcpId,
      recipientIds: targetMcpIds,
      payload: { data, syncTimestamp: new Date() },
      priority: MessagePriority.NORMAL,
      ttl: 300000, // 5 minutes
      requiresAck: true
    };

    await this.broadcastMessage(message);
  }

  // Health and Performance Monitoring
  async performHealthCheck(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();
    
    const healthPromises = Array.from(this.mcps.entries()).map(async ([mcpId, mcp]) => {
      try {
        const health = await mcp.getHealth();
        healthStatus.set(mcpId, health.status === 'healthy');
        
        // Update topology
        const nodeInfo = this.topology.mcps.get(mcpId);
        if (nodeInfo) {
          nodeInfo.lastSeen = new Date();
          nodeInfo.reliability = health.status === 'healthy' ? Math.min(1.0, nodeInfo.reliability + 0.1) : nodeInfo.reliability * 0.9;
        }
        
        return { mcpId, healthy: health.status === 'healthy' };
      } catch (error) {
        healthStatus.set(mcpId, false);
        return { mcpId, healthy: false };
      }
    });

    await Promise.allSettled(healthPromises);
    
    this.emit('health-check-completed', healthStatus);
    return healthStatus;
  }

  async collectPerformanceMetrics(): Promise<Map<string, any>> {
    const metrics = new Map<string, any>();
    
    for (const [mcpId, mcp] of this.mcps) {
      try {
        const performance = await mcp.getMetrics();
        metrics.set(mcpId, performance);
        
        // Update topology
        const nodeInfo = this.topology.mcps.get(mcpId);
        if (nodeInfo) {
          nodeInfo.avgResponseTime = performance.avgReadLatency;
          nodeInfo.currentLoad = performance.cpuUsage;
        }
      } catch (error) {
        this.emit('metrics-collection-error', { mcpId, error });
      }
    }
    
    return metrics;
  }

  // Topology Management
  getTopology(): MCPTopology {
    return {
      mcps: new Map(this.topology.mcps),
      connections: new Map(this.topology.connections),
      routingTable: new Map(this.topology.routingTable)
    };
  }

  async optimizeTopology(): Promise<void> {
    // Analyze current performance and adjust connections
    const metrics = await this.collectPerformanceMetrics();
    
    // Implement topology optimization logic
    for (const [mcpId, nodeInfo] of this.topology.mcps) {
      // Connect high-performance nodes more densely
      if (nodeInfo.reliability > 0.9 && nodeInfo.avgResponseTime < 100) {
        this.ensureHighConnectivity(mcpId);
      }
      
      // Reduce connections for poor-performing nodes
      if (nodeInfo.reliability < 0.5 || nodeInfo.avgResponseTime > 1000) {
        this.reduceConnectivity(mcpId);
      }
    }
    
    this.updateRoutingTable();
    this.emit('topology-optimized');
  }

  // Message Handler Registration
  registerMessageHandler(type: MCPMessageType, handler: (message: MCPMessage) => Promise<void>): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler);
  }

  unregisterMessageHandler(type: MCPMessageType, handler: (message: MCPMessage) => Promise<void>): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Private helper methods
  private async queueMessage(message: MCPMessage): Promise<void> {
    const queue = this.messageQueue.get(message.priority)!;
    queue.push(message);
    
    this.messageHistory.push(message);
    
    // Keep only last 1000 messages
    if (this.messageHistory.length > 1000) {
      this.messageHistory.splice(0, this.messageHistory.length - 1000);
    }
  }

  private startMessageProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      
      try {
        // Process messages by priority
        for (const priority of [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.NORMAL, MessagePriority.LOW]) {
          const queue = this.messageQueue.get(priority)!;
          
          while (queue.length > 0) {
            const message = queue.shift()!;
            
            // Check TTL
            if (Date.now() - message.timestamp.getTime() > message.ttl) {
              this.emit('message-expired', message);
              continue;
            }
            
            await this.processMessage(message);
          }
        }
      } catch (error) {
        this.emit('message-processor-error', error);
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Process every 100ms
  }

  private async processMessage(message: MCPMessage): Promise<void> {
    try {
      // Route to handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      
      for (const handler of handlers) {
        await handler(message);
      }
      
      this.emit('message-processed', message);
      
    } catch (error) {
      this.emit('message-processing-error', { message, error });
    }
  }

  private setupDefaultMessageHandlers(): void {
    this.registerMessageHandler(MCPMessageType.QUERY_REQUEST, async (message) => {
      // Handle distributed query requests
      if (message.payload.query) {
        const result = await this.executeDistributedQuery(message.payload.query);
        
        // Send response back
        await this.sendMessage('hub', message.senderId, MCPMessageType.QUERY_RESPONSE, {
          result,
          correlationId: message.id
        });
      }
    });

    this.registerMessageHandler(MCPMessageType.HEALTH_CHECK, async (message) => {
      // Respond to health checks
      await this.sendMessage('hub', message.senderId, MCPMessageType.HEALTH_CHECK, {
        status: 'healthy',
        timestamp: new Date(),
        correlationId: message.id
      });
    });

    this.registerMessageHandler(MCPMessageType.CACHE_INVALIDATION, async (message) => {
      // Handle cache invalidation
      const { cacheKeys } = message.payload;
      
      for (const recipientId of message.recipientIds) {
        const mcp = this.mcps.get(recipientId);
        if (mcp) {
          await mcp.clearCache();
        }
      }
    });
  }

  private setupMCPEventHandlers(mcp: BaseMCP): void {
    mcp.on('performance-updated', async (performance) => {
      const metadata = await mcp.getMetadata();
      
      // Broadcast performance update
      await this.broadcastMessage({
        type: MCPMessageType.PERFORMANCE_METRICS,
        senderId: metadata.id,
        recipientIds: [],
        payload: { performance },
        priority: MessagePriority.LOW,
        ttl: 60000,
        requiresAck: false
      });
    });

    mcp.on('migration-started', async (event) => {
      await this.broadcastMessage({
        type: MCPMessageType.MIGRATION_NOTIFICATION,
        senderId: event.mcpId,
        recipientIds: [],
        payload: { event: 'migration-started', ...event },
        priority: MessagePriority.HIGH,
        ttl: 300000,
        requiresAck: false
      });
    });
  }

  private selectTargetMCPs(query: MCPQuery, strategy: QueryDistributionStrategy): string[] {
    const allMcpIds = Array.from(this.mcps.keys());
    
    switch (strategy) {
      case QueryDistributionStrategy.BROADCAST:
        return allMcpIds;
        
      case QueryDistributionStrategy.FASTEST_FIRST:
        return allMcpIds
          .sort((a, b) => {
            const nodeA = this.topology.mcps.get(a);
            const nodeB = this.topology.mcps.get(b);
            return (nodeA?.avgResponseTime || 1000) - (nodeB?.avgResponseTime || 1000);
          })
          .slice(0, Math.min(3, allMcpIds.length));
          
      case QueryDistributionStrategy.TIER_BASED:
        // Prefer hot tier, then warm, then cold
        return allMcpIds.sort((a, b) => {
          const nodeA = this.topology.mcps.get(a);
          const nodeB = this.topology.mcps.get(b);
          const tierOrder: Record<MCPTier, number> = { hot: 0, warm: 1, cold: 2, archive: 3 };
          return tierOrder[nodeA?.metadata.type || 'warm'] - tierOrder[nodeB?.metadata.type || 'warm'];
        });
        
      default:
        return allMcpIds;
    }
  }

  private determineAggregationType(query: MCPQuery): AggregationType {
    // Simple heuristic - would be more sophisticated in production
    if (query.limit === 1) {
      return AggregationType.FIRST_MATCH;
    }
    
    return AggregationType.MERGE;
  }

  private aggregateResults(results: Map<string, MCPResult>, type: AggregationType): MCPResult {
    const successfulResults = Array.from(results.values()).filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return {
        success: false,
        error: 'No successful results from any MCP',
        executionTime: 0,
        fromCache: false,
        mcpId: 'hub'
      };
    }

    switch (type) {
      case AggregationType.FIRST_MATCH:
        return successfulResults[0];
        
      case AggregationType.MERGE:
        return {
          success: true,
          data: successfulResults.flatMap(r => r.data || []),
          executionTime: Math.max(...successfulResults.map(r => r.executionTime)),
          fromCache: successfulResults.some(r => r.fromCache),
          mcpId: 'hub'
        };
        
      default:
        return successfulResults[0];
    }
  }

  private async executeQueryWithTimeout(mcp: BaseMCP, query: MCPQuery, timeout: number): Promise<MCPResult> {
    const startTime = Date.now();
    
    try {
      const data = await Promise.race([
        mcp.query(query.filters || {}),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);
      
      return {
        success: true,
        data,
        executionTime: Date.now() - startTime,
        mcpId: mcp.getId()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        mcpId: mcp.getId()
      };
    }
  }

  private updateMCPPerformance(mcpId: string, responseTime: number): void {
    const nodeInfo = this.topology.mcps.get(mcpId);
    if (nodeInfo) {
      // Update rolling average
      nodeInfo.avgResponseTime = (nodeInfo.avgResponseTime * 0.9) + (responseTime * 0.1);
      nodeInfo.lastSeen = new Date();
    }
  }

  private calculateAverageResponseTime(results: Map<string, MCPResult>): number {
    const responseTimes = Array.from(results.values()).map(r => r.executionTime);
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  private updateTopology(): void {
    // Rebuild routing table
    this.updateRoutingTable();
    this.emit('topology-updated', this.topology);
  }

  private updateRoutingTable(): void {
    // Simple routing - each MCP can reach every other MCP
    for (const mcpId of this.topology.mcps.keys()) {
      const otherMcps = Array.from(this.topology.mcps.keys()).filter(id => id !== mcpId);
      this.topology.routingTable.set(mcpId, otherMcps);
    }
  }

  private extractCapabilities(mcp: BaseMCP): string[] {
    // Extract capabilities from MCP - simplified implementation
    return ['query', 'insert', 'update', 'delete'];
  }

  private ensureHighConnectivity(mcpId: string): void {
    // Ensure high-performing MCPs are well connected
    if (!this.topology.connections.has(mcpId)) {
      this.topology.connections.set(mcpId, []);
    }
    
    const connections = this.topology.connections.get(mcpId)!;
    const allMcpIds = Array.from(this.topology.mcps.keys()).filter(id => id !== mcpId);
    
    // Connect to top 5 performing MCPs
    const topPerformers = allMcpIds
      .sort((a, b) => {
        const nodeA = this.topology.mcps.get(a);
        const nodeB = this.topology.mcps.get(b);
        return (nodeB?.reliability || 0) - (nodeA?.reliability || 0);
      })
      .slice(0, 5);
    
    for (const performerId of topPerformers) {
      if (!connections.includes(performerId)) {
        connections.push(performerId);
      }
    }
  }

  private reduceConnectivity(mcpId: string): void {
    // Reduce connections for poor-performing MCPs
    const connections = this.topology.connections.get(mcpId) || [];
    if (connections.length > 2) {
      this.topology.connections.set(mcpId, connections.slice(0, 2));
    }
  }

  private startTopologyMonitor(): void {
    setInterval(async () => {
      await this.performHealthCheck();
      await this.collectPerformanceMetrics();
      await this.optimizeTopology();
    }, 60000); // Every minute
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default MCPCommunicationHub;