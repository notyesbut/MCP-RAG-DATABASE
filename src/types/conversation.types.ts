/**
 * Conversation-related type definitions for the Enterprise Multi-MCP Smart Database System
 * 
 * This file contains all types related to conversation contexts, chat messages,
 * and conversation state management used throughout the RAG query parsing
 * and chat MCP implementations.
 */

import { QueryIntent, QueryEntity } from './query.types';

/**
 * Conversation context for improved query understanding
 * Tracks conversation history, entities, and user preferences
 */
export interface ConversationContext {
  /** Unique session identifier */
  sessionId: string;
  
  /** User identifier (optional) */
  userId?: string;
  
  /** Previous queries in this conversation */
  previousQueries: string[];
  
  /** Entities mentioned in the conversation indexed by type */
  contextEntities: Map<string, any>;
  
  /** Recent intent history for pattern detection */
  recentIntents: QueryIntent[];
  
  /** Timestamp of conversation start */
  startTime: number;
  
  /** Last activity timestamp */
  lastActivity: number;
  
  /** User preferences learned during conversation */
  userPreferences?: {
    /** Preferred result format */
    resultFormat?: 'summary' | 'detailed' | 'json';
    
    /** Preferred language */
    language?: string;
    
    /** Domain focus areas */
    domainFocus?: string[];
    
    /** Query complexity preference */
    complexityLevel?: 'simple' | 'intermediate' | 'advanced';
  };
  
  /** Metadata about the conversation */
  metadata?: {
    /** Client application */
    clientApp?: string;
    
    /** API version */
    apiVersion?: string;
    
    /** Geographic location */
    location?: string;
    
    /** Device type */
    deviceType?: string;
  };
}

/**
 * Chat message structure for ChatMCP
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  
  /** Conversation this message belongs to */
  conversationId: string;
  
  /** Thread identifier for nested conversations */
  threadId?: string;
  
  /** Parent message for replies */
  parentMessageId?: string;
  
  /** Message sender identifier */
  senderId: string;
  
  /** Message recipient identifier */
  receiverId?: string;
  
  /** Message content with type and data */
  content: {
    /** Content type */
    type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
    
    /** Text content */
    text?: string;
    
    /** Media URL for non-text content */
    mediaUrl?: string;
    
    /** File name for file messages */
    fileName?: string;
    
    /** File size in bytes */
    fileSize?: number;
    
    /** Duration for audio/video in seconds */
    duration?: number;
    
    /** Additional metadata */
    metadata?: Record<string, any>;
  };
  
  /** Text formatting and references */
  formatting?: {
    /** User mentions */
    mentions: string[];
    
    /** Hashtags */
    hashtags: string[];
    
    /** Extracted links */
    links: string[];
    
    /** Formatting style */
    style?: 'plain' | 'markdown' | 'html';
  };
  
  /** Message reactions */
  reactions: MessageReaction[];
  
  /** Edit history */
  editHistory: MessageEdit[];
  
  /** Delivery status and timestamps */
  delivery: MessageDelivery;
  
  /** Message metadata */
  metadata: MessageMetadata;
  
  /** Timestamp when message was created */
  timestamp: number;
  
  /** Flags for message state */
  flags: MessageFlags;
}

/**
 * Message reaction structure
 */
export interface MessageReaction {
  /** User who reacted */
  userId: string;
  
  /** Reaction emoji or type */
  emoji: string;
  
  /** Reaction timestamp */
  timestamp: number;
}

/**
 * Message edit record
 */
export interface MessageEdit {
  /** Previous content */
  content: string;
  
  /** Edit timestamp */
  timestamp: number;
  
  /** Edit reason (optional) */
  reason?: string;
}

/**
 * Message delivery tracking
 */
export interface MessageDelivery {
  /** Sent timestamp */
  sent: number;
  
  /** Delivered timestamp */
  delivered?: number;
  
  /** Read timestamps by user */
  read?: number[];
  
  /** Delivery status */
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  /** Message priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Is message encrypted */
  encrypted: boolean;
  
  /** Reply to message ID */
  replyTo?: string;
  
  /** Forward from message ID */
  forwardedFrom?: string;
  
  /** Is this a broadcast message */
  broadcast: boolean;
  
  /** Message language */
  language?: string;
  
  /** Sentiment analysis result */
  sentiment?: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
  };
  
  /** Message categories/labels */
  labels?: string[];
}

/**
 * Message state flags
 */
export interface MessageFlags {
  /** Is message pinned */
  pinned: boolean;
  
  /** Is message starred/favorited */
  starred: boolean;
  
  /** Is message deleted */
  deleted: boolean;
  
  /** Is message flagged for moderation */
  flagged: boolean;
  
  /** Is message archived */
  archived: boolean;
}

/**
 * Conversation metadata and statistics
 */
export interface ConversationMetadata {
  /** Conversation identifier */
  id: string;
  
  /** Conversation title */
  title?: string;
  
  /** Conversation participants */
  participants: string[];
  
  /** Conversation type */
  type: 'direct' | 'group' | 'channel' | 'broadcast';
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last activity timestamp */
  lastActivity: number;
  
  /** Message count */
  messageCount: number;
  
  /** Unread count per participant */
  unreadCounts: Map<string, number>;
  
  /** Conversation settings */
  settings: ConversationSettings;
  
  /** Conversation state */
  state: 'active' | 'archived' | 'deleted' | 'muted';
}

/**
 * Conversation settings
 */
export interface ConversationSettings {
  /** Mute notifications */
  muted: boolean;
  
  /** Mute until timestamp */
  mutedUntil?: number;
  
  /** Allow notifications */
  notifications: boolean;
  
  /** Message retention days */
  retentionDays?: number;
  
  /** Auto-archive after days of inactivity */
  autoArchiveDays?: number;
  
  /** Encryption enabled */
  encrypted: boolean;
  
  /** Allowed message types */
  allowedMessageTypes?: string[];
}

/**
 * Thread structure for nested conversations
 */
export interface ConversationThread {
  /** Thread identifier */
  id: string;
  
  /** Parent conversation */
  conversationId: string;
  
  /** Root message that started the thread */
  rootMessageId: string;
  
  /** Thread participants */
  participants: string[];
  
  /** Thread message count */
  messageCount: number;
  
  /** Last reply timestamp */
  lastReply: number;
  
  /** Thread metadata */
  metadata?: {
    /** Thread topic */
    topic?: string;
    
    /** Is thread resolved */
    resolved?: boolean;
    
    /** Resolution timestamp */
    resolvedAt?: number;
    
    /** Resolved by user */
    resolvedBy?: string;
  };
}

/**
 * Type guards for conversation types
 */
export const ConversationTypeGuards = {
  /**
   * Check if object is a valid ConversationContext
   */
  isConversationContext: (obj: any): obj is ConversationContext => {
    return obj &&
      typeof obj.sessionId === 'string' &&
      Array.isArray(obj.previousQueries) &&
      obj.contextEntities instanceof Map &&
      Array.isArray(obj.recentIntents) &&
      typeof obj.startTime === 'number' &&
      typeof obj.lastActivity === 'number';
  },

  /**
   * Check if object is a valid ChatMessage
   */
  isChatMessage: (obj: any): obj is ChatMessage => {
    return obj &&
      typeof obj.id === 'string' &&
      typeof obj.conversationId === 'string' &&
      typeof obj.senderId === 'string' &&
      typeof obj.content === 'object' &&
      typeof obj.timestamp === 'number' &&
      Array.isArray(obj.reactions) &&
      Array.isArray(obj.editHistory);
  },

  /**
   * Check if object is a valid ConversationMetadata
   */
  isConversationMetadata: (obj: any): obj is ConversationMetadata => {
    return obj &&
      typeof obj.id === 'string' &&
      Array.isArray(obj.participants) &&
      ['direct', 'group', 'channel', 'broadcast'].includes(obj.type) &&
      typeof obj.createdAt === 'number' &&
      typeof obj.messageCount === 'number';
  }
};