/**
 * ChatMCP - Specialized MCP optimized for message storage and retrieval
 * Handles conversations, messages, threads, and real-time chat data
 */

import { BaseMCP } from '../mcp/base_mcp';
import { MCPConfig, DataRecord, MCPType, MCPDomain } from '../../types/mcp.types';

interface ChatMessage {
  id: string;
  conversationId: string;
  threadId?: string;
  parentMessageId?: string;
  senderId: string;
  receiverId?: string;
  content: {
    type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
    text?: string;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    metadata?: Record<string, any>;
  };
  formatting?: {
    mentions: string[];
    hashtags: string[];
    links: string[];
    style?: 'plain' | 'markdown' | 'html';
  };
  reactions: {
    userId: string;
    emoji: string;
    timestamp: number;
  }[];
  editHistory: {
    content: string;
    timestamp: number;
    reason?: string;
  }[];
  delivery: {
    sent: number;
    delivered?: number;
    read?: number[];
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  };
  metadata: {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    encrypted: boolean;
    replyTo?: string;
    forwarded?: boolean;
    originalSender?: string;
    ttl?: number;
    tags?: string[];
  };
  moderation: {
    flagged: boolean;
    reasons?: string[];
    moderatorId?: string;
    action?: 'none' | 'warn' | 'hide' | 'delete';
    timestamp?: number;
  };
  created: number;
  updated: number;
}

export class ChatMCP extends BaseMCP {
  private conversationIndex: Map<string, Set<string>> = new Map(); // conversationId -> messageIds
  private senderIndex: Map<string, Set<string>> = new Map(); // senderId -> messageIds
  private receiverIndex: Map<string, Set<string>> = new Map(); // receiverId -> messageIds
  private threadIndex: Map<string, Set<string>> = new Map(); // threadId -> messageIds
  private timeIndex: Map<string, Set<string>> = new Map(); // date -> messageIds
  private contentTypeIndex: Map<string, Set<string>> = new Map(); // contentType -> messageIds
  private hashtagIndex: Map<string, Set<string>> = new Map(); // hashtag -> messageIds
  private mentionIndex: Map<string, Set<string>> = new Map(); // userId -> messageIds

  constructor(domain: MCPDomain, type: MCPType, config: Partial<MCPConfig> = {}) {
    super(domain, type, config);
    this.setupChatSpecificIndices();
  }

  protected defineCapabilities(): MCPCapabilities {
    return {
      queryTypes: ['select', 'insert', 'update', 'delete', 'search'],
      dataTypes: ['chat_message', 'string', 'object', 'array'],
      maxConnections: 500, // Higher for real-time chat
      consistencyLevels: ['eventual', 'weak'], // Chat can tolerate eventual consistency
      transactionSupport: false,
      backupSupport: true,
      replicationSupport: true,
      encryptionSupport: true,
      compressionSupport: true,
      fullTextSearch: true,
      geospatialSupport: false,
      vectorSearch: false,
      streamingSupport: true // Important for real-time chat
    };
  }

  protected optimizeForDomain() {}

  validateRecord(record: any): boolean {
    if (!record || typeof record !== 'object') return false;
    
    // Required fields validation
    if (!record.id || typeof record.id !== 'string') return false;
    if (!record.conversationId || typeof record.conversationId !== 'string') return false;
    if (!record.senderId || typeof record.senderId !== 'string') return false;
    if (!record.content || typeof record.content !== 'object') return false;
    if (!record.content.type || typeof record.content.type !== 'string') return false;
    
    // Content type validation
    const validContentTypes = ['text', 'image', 'file', 'audio', 'video', 'system'];
    if (!validContentTypes.includes(record.content.type)) return false;
    
    // Text content validation
    if (record.content.type === 'text' && !record.content.text) return false;
    
    // Media content validation
    if (['image', 'file', 'audio', 'video'].includes(record.content.type) && !record.content.mediaUrl) {
      return false;
    }
    
    // Delivery status validation
    if (record.delivery && record.delivery.status) {
      const validStatuses = ['pending', 'sent', 'delivered', 'read', 'failed'];
      if (!validStatuses.includes(record.delivery.status)) return false;
    }

    return true;
  }

  private setupChatSpecificIndices(): void {
    this.on('record_stored', (record: DataRecord) => {
      this.updateChatIndices(record, 'create');
    });

    this.on('record_deleted', (record: DataRecord) => {
      this.updateChatIndices(record, 'delete');
    });
  }

  private updateChatIndices(record: DataRecord, operation: 'create' | 'delete'): void {
    const messageData = record.data as ChatMessage;
    
    if (operation === 'create') {
      // Conversation index
      if (!this.conversationIndex.has(messageData.conversationId)) {
        this.conversationIndex.set(messageData.conversationId, new Set());
      }
      this.conversationIndex.get(messageData.conversationId)!.add(record.id);
      
      // Sender index
      if (!this.senderIndex.has(messageData.senderId)) {
        this.senderIndex.set(messageData.senderId, new Set());
      }
      this.senderIndex.get(messageData.senderId)!.add(record.id);
      
      // Receiver index
      if (messageData.receiverId) {
        if (!this.receiverIndex.has(messageData.receiverId)) {
          this.receiverIndex.set(messageData.receiverId, new Set());
        }
        this.receiverIndex.get(messageData.receiverId)!.add(record.id);
      }
      
      // Thread index
      if (messageData.threadId) {
        if (!this.threadIndex.has(messageData.threadId)) {
          this.threadIndex.set(messageData.threadId, new Set());
        }
        this.threadIndex.get(messageData.threadId)!.add(record.id);
      }
      
      // Time index (by day)
      const dayKey = new Date(messageData.created).toISOString().split('T')[0];
      if (!this.timeIndex.has(dayKey)) {
        this.timeIndex.set(dayKey, new Set());
      }
      this.timeIndex.get(dayKey)!.add(record.id);
      
      // Content type index
      if (!this.contentTypeIndex.has(messageData.content.type)) {
        this.contentTypeIndex.set(messageData.content.type, new Set());
      }
      this.contentTypeIndex.get(messageData.content.type)!.add(record.id);
      
      // Hashtag index
      if (messageData.formatting?.hashtags) {
        for (const hashtag of messageData.formatting.hashtags) {
          if (!this.hashtagIndex.has(hashtag)) {
            this.hashtagIndex.set(hashtag, new Set());
          }
          this.hashtagIndex.get(hashtag)!.add(record.id);
        }
      }
      
      // Mention index
      if (messageData.formatting?.mentions) {
        for (const mention of messageData.formatting.mentions) {
          if (!this.mentionIndex.has(mention)) {
            this.mentionIndex.set(mention, new Set());
          }
          this.mentionIndex.get(mention)!.add(record.id);
        }
      }
      
    } else if (operation === 'delete') {
      // Remove from all indices
      this.conversationIndex.get(messageData.conversationId)?.delete(record.id);
      this.senderIndex.get(messageData.senderId)?.delete(record.id);
      
      if (messageData.receiverId) {
        this.receiverIndex.get(messageData.receiverId)?.delete(record.id);
      }
      
      if (messageData.threadId) {
        this.threadIndex.get(messageData.threadId)?.delete(record.id);
      }
      
      const dayKey = new Date(messageData.created).toISOString().split('T')[0];
      this.timeIndex.get(dayKey)?.delete(record.id);
      this.contentTypeIndex.get(messageData.content.type)?.delete(record.id);
      
      if (messageData.formatting?.hashtags) {
        for (const hashtag of messageData.formatting.hashtags) {
          this.hashtagIndex.get(hashtag)?.delete(record.id);
        }
      }
      
      if (messageData.formatting?.mentions) {
        for (const mention of messageData.formatting.mentions) {
          this.mentionIndex.get(mention)?.delete(record.id);
        }
      }
    }
  }

  // Chat-specific query methods
  async getConversationMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<DataRecord[]> {
    const messageIds = this.conversationIndex.get(conversationId) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    // Sort by creation time (most recent first)
    messages.sort((a, b) => (b.data as ChatMessage).created - (a.data as ChatMessage).created);
    
    return messages.slice(offset, offset + limit);
  }

  async getMessagesBySender(senderId: string, limit: number = 100): Promise<DataRecord[]> {
    const messageIds = this.senderIndex.get(senderId) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    messages.sort((a, b) => (b.data as ChatMessage).created - (a.data as ChatMessage).created);
    return messages.slice(0, limit);
  }

  async getThreadMessages(threadId: string): Promise<DataRecord[]> {
    const messageIds = this.threadIndex.get(threadId) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    messages.sort((a, b) => (a.data as ChatMessage).created - (b.data as ChatMessage).created);
    return messages;
  }

  async getMessagesByHashtag(hashtag: string): Promise<DataRecord[]> {
    const messageIds = this.hashtagIndex.get(hashtag) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    return messages;
  }

  async getMentions(userId: string): Promise<DataRecord[]> {
    const messageIds = this.mentionIndex.get(userId) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    messages.sort((a, b) => (b.data as ChatMessage).created - (a.data as ChatMessage).created);
    return messages;
  }

  async getMessagesByDate(date: string): Promise<DataRecord[]> {
    const messageIds = this.timeIndex.get(date) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    return messages;
  }

  async getMessagesByContentType(contentType: string): Promise<DataRecord[]> {
    const messageIds = this.contentTypeIndex.get(contentType) || new Set();
    const messages: DataRecord[] = [];
    
    for (const messageId of messageIds) {
      const message = await this.retrieve(messageId);
      if (message) messages.push(message);
    }
    
    return messages;
  }

  // Message interaction methods
  async addReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const message = await this.retrieve(messageId);
    if (!message) return false;
    
    const messageData = message.data as ChatMessage;
    
    // Remove existing reaction from this user if any
    messageData.reactions = messageData.reactions.filter(r => r.userId !== userId);
    
    // Add new reaction
    messageData.reactions.push({
      userId,
      emoji,
      timestamp: Date.now()
    });
    
    return await this.store(message);
  }

  async removeReaction(messageId: string, userId: string): Promise<boolean> {
    const message = await this.retrieve(messageId);
    if (!message) return false;
    
    const messageData = message.data as ChatMessage;
    messageData.reactions = messageData.reactions.filter(r => r.userId !== userId);
    
    return await this.store(message);
  }

  async editMessage(messageId: string, newContent: string, reason?: string): Promise<boolean> {
    const message = await this.retrieve(messageId);
    if (!message) return false;
    
    const messageData = message.data as ChatMessage;
    
    // Add to edit history
    messageData.editHistory.push({
      content: messageData.content.text || '',
      timestamp: Date.now(),
      reason
    });
    
    // Update content
    messageData.content.text = newContent;
    messageData.updated = Date.now();
    
    return await this.store(message);
  }

  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    const message = await this.retrieve(messageId);
    if (!message) return false;
    
    const messageData = message.data as ChatMessage;
    
    if (!messageData.delivery.read) {
      messageData.delivery.read = [];
    }
    
    if (!messageData.delivery.read.includes(Number(userId))) {
      messageData.delivery.read.push(Number(userId));
      messageData.delivery.status = 'read';
    }
    
    return await this.store(message);
  }

  // Analytics methods
  async getChatStats(conversationId?: string): Promise<{
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesByDay: Record<string, number>;
    topSenders: { userId: string; count: number }[];
    topHashtags: { hashtag: string; count: number }[];
  }> {
    const stats = {
      totalMessages: conversationId ? 
        this.conversationIndex.get(conversationId)?.size || 0 : 
        this.records.size,
      messagesByType: {} as Record<string, number>,
      messagesByDay: {} as Record<string, number>,
      topSenders: [] as { userId: string; count: number }[],
      topHashtags: [] as { hashtag: string; count: number }[]
    };

    // Count by content type
    for (const [type, messageIds] of this.contentTypeIndex) {
      if (conversationId) {
        const conversationMessages = this.conversationIndex.get(conversationId) || new Set();
        const intersection = new Set([...messageIds].filter(x => conversationMessages.has(x)));
        stats.messagesByType[type] = intersection.size;
      } else {
        stats.messagesByType[type] = messageIds.size;
      }
    }

    // Count by day
    for (const [day, messageIds] of this.timeIndex) {
      if (conversationId) {
        const conversationMessages = this.conversationIndex.get(conversationId) || new Set();
        const intersection = new Set([...messageIds].filter(x => conversationMessages.has(x)));
        stats.messagesByDay[day] = intersection.size;
      } else {
        stats.messagesByDay[day] = messageIds.size;
      }
    }

    // Top senders
    const senderCounts: Record<string, number> = {};
    for (const [senderId, messageIds] of this.senderIndex) {
      if (conversationId) {
        const conversationMessages = this.conversationIndex.get(conversationId) || new Set();
        const intersection = new Set([...messageIds].filter(x => conversationMessages.has(x)));
        senderCounts[senderId] = intersection.size;
      } else {
        senderCounts[senderId] = messageIds.size;
      }
    }
    
    stats.topSenders = Object.entries(senderCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top hashtags
    const hashtagCounts: Record<string, number> = {};
    for (const [hashtag, messageIds] of this.hashtagIndex) {
      if (conversationId) {
        const conversationMessages = this.conversationIndex.get(conversationId) || new Set();
        const intersection = new Set([...messageIds].filter(x => conversationMessages.has(x)));
        hashtagCounts[hashtag] = intersection.size;
      } else {
        hashtagCounts[hashtag] = messageIds.size;
      }
    }
    
    stats.topHashtags = Object.entries(hashtagCounts)
      .map(([hashtag, count]) => ({ hashtag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  // Search methods
  async searchMessages(query: string, options?: {
    conversationId?: string;
    senderId?: string;
    contentType?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
  }): Promise<DataRecord[]> {
    const messages: DataRecord[] = [];
    const queryLower = query.toLowerCase();
    
    for (const [, record] of this.records) {
      const messageData = record.data as ChatMessage;
      
      // Apply filters
      if (options?.conversationId && messageData.conversationId !== options.conversationId) continue;
      if (options?.senderId && messageData.senderId !== options.senderId) continue;
      if (options?.contentType && messageData.content.type !== options.contentType) continue;
      if (options?.dateFrom && messageData.created < options.dateFrom) continue;
      if (options?.dateTo && messageData.created > options.dateTo) continue;
      
      // Text search
      if (messageData.content.text && messageData.content.text.toLowerCase().includes(queryLower)) {
        messages.push(record);
      }
    }
    
    messages.sort((a, b) => (b.data as ChatMessage).created - (a.data as ChatMessage).created);
    return options?.limit ? messages.slice(0, options.limit) : messages;
  }

  // Override query method to properly implement the interface
  async query(filters: Record<string, any>): Promise<DataRecord[]> {
    if (filters.conversationId) {
      return this.getConversationMessages(filters.conversationId, filters.limit, filters.offset);
    }
    if (filters.senderId) {
      return this.getMessagesBySender(filters.senderId, filters.limit);
    }
    if (filters.threadId) {
      return this.getThreadMessages(filters.threadId);
    }
    if (filters.hashtag) {
      return this.getMessagesByHashtag(filters.hashtag);
    }
    if (filters.userId && filters.mentions) {
      return this.getMentions(filters.userId);
    }
    if (filters.date) {
      return this.getMessagesByDate(filters.date);
    }
    if (filters.contentType) {
      return this.getMessagesByContentType(filters.contentType);
    }
    
    // Default to parent query implementation
    return super.query(filters);
  }

  async createIndex(definition: any): Promise<any> {
    return { success: true };
  }

  protected async performOptimization(): Promise<any> {
    return { success: true };
  }

  protected async performBackup(destination: string): Promise<any> {
    return { success: true };
  }

  protected async performRestore(source: string): Promise<any> {
    return { success: true };
  }

  protected async createSnapshot(): Promise<any> {
    return { success: true };
  }

  protected async restoreFromSnapshot(snapshot: any): Promise<any> {
    return { success: true };
  }
}