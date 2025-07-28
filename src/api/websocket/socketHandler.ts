/**
 * WebSocket Handler for Real-time Features
 * Complete WebSocket implementation with authentication, room management, and real-time updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { validateToken } from '../middleware/auth';
import { WebSocketMessage, RealtimeQuerySubscription, User } from '../../types/api.types';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Store active connections and subscriptions
const activeConnections = new Map<string, {
  socket: Socket;
  user: User | undefined;
  subscriptions: Set<string>;
  joinedAt: Date;
  lastActivity: Date;
}>();

const activeSubscriptions = new Map<string, RealtimeQuerySubscription>();

// Rate limiting for WebSocket messages
const rateLimits = new Map<string, {
  messages: number;
  resetTime: number;
}>();

const MAX_MESSAGES_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

/**
 * Check rate limit for a socket
 */
function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(socketId);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(socketId, {
      messages: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (limit.messages >= MAX_MESSAGES_PER_MINUTE) {
    return false;
  }

  limit.messages++;
  return true;
}

/**
 * Send message with rate limiting check
 */
function sendMessage(socket: Socket, message: WebSocketMessage): void {
  if (!checkRateLimit(socket.id)) {
    socket.emit('error', {
      type: 'rate_limit',
      message: 'Too many messages, please slow down',
      timestamp: new Date().toISOString()
    });
    return;
  }

  socket.emit('message', message);
}

/**
 * Authenticate WebSocket connection
 */
async function authenticateSocket(socket: Socket, token?: string): Promise<User | null> {
  if (!token) {
    return null;
  }

  try {
    const user = await validateToken(token);
    if (user) {
      logger.info('WebSocket client authenticated', {
        socketId: socket.id,
        userId: user.id,
        username: user.username
      });
    }
    return user;
  } catch (error) {
    logger.warn('WebSocket authentication failed', {
      socketId: socket.id,
      error: (error as Error).message
    });
    return null;
  }
}

/**
 * Handle query subscription
 */
function handleQuerySubscription(socket: Socket, data: any): void {
  const connection = activeConnections.get(socket.id);
  if (!connection) return;

  try {
    const subscription: RealtimeQuerySubscription = {
      id: uuidv4(),
      query: data.query,
      filters: data.filters,
      updateInterval: data.updateInterval || 5000, // 5 seconds default
      clientId: socket.id
    };

    // Store subscription
    activeSubscriptions.set(subscription.id, subscription);
    connection.subscriptions.add(subscription.id);

    // Join subscription room
    socket.join(`subscription:${subscription.id}`);

    sendMessage(socket, {
      type: 'query',
      payload: {
        subscriptionId: subscription.id,
        status: 'subscribed',
        message: 'Query subscription created successfully'
      },
      requestId: data.requestId,
      timestamp: new Date().toISOString()
    });

    logger.info('Query subscription created', {
      socketId: socket.id,
      subscriptionId: subscription.id,
      query: subscription.query,
      userId: connection.user?.id
    });

    // TODO: Implement actual query execution and result streaming
    // This would integrate with your RAG₂ system for real-time queries

  } catch (error) {
    sendMessage(socket, {
      type: 'error',
      payload: {
        error: 'Failed to create subscription',
        message: (error as Error).message
      },
      requestId: data.requestId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle subscription cancellation
 */
function handleUnsubscribe(socket: Socket, data: any): void {
  const connection = activeConnections.get(socket.id);
  if (!connection) return;

  const subscriptionId = data.subscriptionId;
  if (connection.subscriptions.has(subscriptionId)) {
    // Remove subscription
    activeSubscriptions.delete(subscriptionId);
    connection.subscriptions.delete(subscriptionId);

    // Leave subscription room
    socket.leave(`subscription:${subscriptionId}`);

    sendMessage(socket, {
      type: 'query',
      payload: {
        subscriptionId,
        status: 'unsubscribed',
        message: 'Subscription cancelled successfully'
      },
      requestId: data.requestId,
      timestamp: new Date().toISOString()
    });

    logger.info('Query subscription cancelled', {
      socketId: socket.id,
      subscriptionId,
      userId: connection.user?.id
    });
  }
}

/**
 * Handle ingestion status updates
 */
function handleIngestionStatus(socket: Socket, data: any): void {
  const connection = activeConnections.get(socket.id);
  if (!connection?.user) {
    socket.emit('error', { message: 'Authentication required for ingestion updates' });
    return;
  }

  // Join ingestion updates room for this user
  socket.join(`ingestion:${connection.user.id}`);

  sendMessage(socket, {
    type: 'ingestion',
    payload: {
      status: 'subscribed',
      message: 'Subscribed to ingestion updates'
    },
    requestId: data.requestId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Clean up disconnected socket
 */
function cleanupSocket(socketId: string): void {
  const connection = activeConnections.get(socketId);
  if (!connection) return;

  // Remove all subscriptions
  for (const subscriptionId of connection.subscriptions) {
    activeSubscriptions.delete(subscriptionId);
  }

  // Remove connection
  activeConnections.delete(socketId);
  rateLimits.delete(socketId);

  logger.info('Socket cleanup completed', {
    socketId,
    subscriptionsRemoved: connection.subscriptions.size,
    userId: connection.user?.id
  });
}

/**
 * Broadcast to subscription rooms
 */
export function broadcastQueryUpdate(subscriptionId: string, data: any): void {
  const io = getIOInstance();
  if (io) {
    io.to(`subscription:${subscriptionId}`).emit('query_update', {
      subscriptionId,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Broadcast ingestion updates to user
 */
export function broadcastIngestionUpdate(userId: string, data: any): void {
  const io = getIOInstance();
  if (io) {
    io.to(`ingestion:${userId}`).emit('ingestion_update', {
      userId,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Broadcast system notifications
 */
export function broadcastSystemNotification(notification: any): void {
  const io = getIOInstance();
  if (io) {
    io.emit('system_notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }
}

// Store IO instance for broadcasting
let ioInstance: SocketIOServer | null = null;

function getIOInstance(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Main WebSocket setup function
 */
export function setupWebSocket(io: SocketIOServer): void {
  ioInstance = io;
  
  logger.info('🔌 Setting up enhanced WebSocket handlers...');

  // Middleware for authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    const user = await authenticateSocket(socket, token);
    
    // Store user in socket data (optional authentication)
    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as User | undefined;
    
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: user?.id,
      username: user?.username,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });

    // Store connection
    activeConnections.set(socket.id, {
      socket,
      user,
      subscriptions: new Set(),
      joinedAt: new Date(),
      lastActivity: new Date()
    });

    // Send welcome message
    sendMessage(socket, {
      type: 'notification',
      payload: {
        message: 'Connected to Enterprise Multi-MCP Smart Database',
        authenticated: !!user,
        features: [
          'Real-time query subscriptions',
          'Ingestion status updates',
          'System notifications'
        ]
      },
      timestamp: new Date().toISOString()
    });

    // Heartbeat/ping handler
    socket.on('ping', (callback) => {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
      }
      
      if (typeof callback === 'function') {
        callback({
          pong: true,
          timestamp: new Date().toISOString(),
          serverTime: Date.now()
        });
      }
    });

    // Query subscription handler
    socket.on('subscribe_query', (data) => {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
        handleQuerySubscription(socket, data);
      }
    });

    // Unsubscribe handler
    socket.on('unsubscribe', (data) => {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
        handleUnsubscribe(socket, data);
      }
    });

    // Ingestion updates subscription
    socket.on('subscribe_ingestion', (data) => {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
        handleIngestionStatus(socket, data);
      }
    });

    // Get connection info
    socket.on('get_info', (callback) => {
      const connection = activeConnections.get(socket.id);
      if (connection && typeof callback === 'function') {
        callback({
          socketId: socket.id,
          authenticated: !!connection.user,
          user: connection.user ? {
            id: connection.user.id,
            username: connection.user.username,
            role: connection.user.role
          } : null,
          activeSubscriptions: Array.from(connection.subscriptions),
          joinedAt: connection.joinedAt,
          lastActivity: connection.lastActivity
        });
      }
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        userId: user?.id,
        error: error.message || error
      });
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: user?.id,
        reason,
        duration: Date.now() - new Date(activeConnections.get(socket.id)?.joinedAt || 0).getTime()
      });

      cleanupSocket(socket.id);
    });
  });

  // Periodic cleanup of inactive connections
  setInterval(() => {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    for (const [socketId, connection] of activeConnections.entries()) {
      if (now - connection.lastActivity.getTime() > INACTIVE_TIMEOUT) {
        logger.info('Cleaning up inactive WebSocket connection', {
          socketId,
          userId: connection.user?.id,
          inactiveFor: now - connection.lastActivity.getTime()
        });
        
        connection.socket.disconnect(true);
        cleanupSocket(socketId);
      }
    }

    // Clean up rate limits
    for (const [socketId, limit] of rateLimits.entries()) {
      if (now > limit.resetTime) {
        rateLimits.delete(socketId);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  logger.info('✅ WebSocket handlers setup complete', {
    features: [
      'Authentication support',
      'Rate limiting',
      'Query subscriptions',
      'Ingestion updates',
      'System notifications',
      'Connection management',
      'Automatic cleanup'
    ]
  });
}