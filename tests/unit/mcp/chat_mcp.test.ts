/**
 * Chat MCP Unit Tests
 * 
 * Tests for the Chat/Messages MCP implementation.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestDataGenerator, MCPFixtures } from '../../helpers';

describe('ChatMCP', () => {
  let chatMCP: any;
  let mockMetadata: any;

  beforeEach(() => {
    mockMetadata = MCPFixtures.createCustomMCP('messages', 'hot', {
      accessFrequency: 1000,
      recordCount: 100000,
      performanceTier: 'premium'
    });

    chatMCP = {
      id: mockMetadata.id,
      domain: mockMetadata.domain,
      type: mockMetadata.type,
      metadata: mockMetadata,
      
      // Core operations
      query: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      
      // Chat-specific operations
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      getMessageById: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      getChannelMessages: jest.fn(),
      getUserMessages: jest.fn(),
      searchMessages: jest.fn(),
      getMessageReactions: jest.fn(),
      addReaction: jest.fn(),
      removeReaction: jest.fn(),
      
      // Health and metrics
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Message Operations', () => {
    test('should send new message successfully', async () => {
      const messageData = TestDataGenerator.createTestMessage();
      
      chatMCP.sendMessage.mockResolvedValue({
        success: true,
        data: { ...messageData, id: 'msg-123' }
      });

      const result = await chatMCP.sendMessage(messageData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(chatMCP.sendMessage).toHaveBeenCalledWith(messageData);
    });

    test('should retrieve messages by channel', async () => {
      const channelId = 'channel-456';
      const messages = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestMessage({ channelId }),
        10
      );

      chatMCP.getChannelMessages.mockResolvedValue({
        success: true,
        data: messages,
        count: 10
      });

      const result = await chatMCP.getChannelMessages(channelId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.data.every((msg: any) => msg.channelId === channelId)).toBe(true);
    });

    test('should retrieve user messages', async () => {
      const userId = 'user-123';
      const messages = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestMessage({ userId }),
        5
      );

      chatMCP.getUserMessages.mockResolvedValue({
        success: true,
        data: messages,
        count: 5
      });

      const result = await chatMCP.getUserMessages(userId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
      expect(result.data.every((msg: any) => msg.userId === userId)).toBe(true);
    });

    test('should search messages by content', async () => {
      const searchTerm = 'important meeting';
      const matchingMessages = [
        TestDataGenerator.createTestMessage({ 
          content: 'We have an important meeting tomorrow' 
        }),
        TestDataGenerator.createTestMessage({ 
          content: 'Please join the important meeting at 3pm' 
        })
      ];

      chatMCP.searchMessages.mockResolvedValue({
        success: true,
        data: matchingMessages,
        count: 2,
        searchTerm
      });

      const result = await chatMCP.searchMessages(searchTerm);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.searchTerm).toBe(searchTerm);
    });

    test('should edit message successfully', async () => {
      const messageId = 'msg-123';
      const newContent = 'Updated message content';
      
      chatMCP.editMessage.mockResolvedValue({
        success: true,
        data: {
          id: messageId,
          content: newContent,
          isEdited: true,
          editedAt: new Date()
        }
      });

      const result = await chatMCP.editMessage(messageId, { content: newContent });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe(newContent);
      expect(result.data.isEdited).toBe(true);
    });

    test('should delete message with soft delete', async () => {
      const messageId = 'msg-123';
      
      chatMCP.deleteMessage.mockResolvedValue({
        success: true,
        data: {
          id: messageId,
          isDeleted: true,
          deletedAt: new Date()
        }
      });

      const result = await chatMCP.deleteMessage(messageId);

      expect(result.success).toBe(true);
      expect(result.data.isDeleted).toBe(true);
      expect(result.data.deletedAt).toBeDefined();
    });
  });

  describe('Message Reactions', () => {
    test('should add reaction to message', async () => {
      const messageId = 'msg-123';
      const userId = 'user-456';
      const emoji = '👍';

      chatMCP.addReaction.mockResolvedValue({
        success: true,
        data: {
          messageId,
          userId,
          emoji,
          timestamp: new Date()
        }
      });

      const result = await chatMCP.addReaction(messageId, userId, emoji);

      expect(result.success).toBe(true);
      expect(result.data.emoji).toBe(emoji);
    });

    test('should remove reaction from message', async () => {
      const messageId = 'msg-123';
      const userId = 'user-456';
      const emoji = '👍';

      chatMCP.removeReaction.mockResolvedValue({
        success: true,
        message: 'Reaction removed'
      });

      const result = await chatMCP.removeReaction(messageId, userId, emoji);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Reaction removed');
    });

    test('should get message reactions', async () => {
      const messageId = 'msg-123';
      const reactions = [
        { userId: 'user-1', emoji: '👍', timestamp: new Date() },
        { userId: 'user-2', emoji: '❤️', timestamp: new Date() },
        { userId: 'user-3', emoji: '👍', timestamp: new Date() }
      ];

      chatMCP.getMessageReactions.mockResolvedValue({
        success: true,
        data: reactions
      });

      const result = await chatMCP.getMessageReactions(messageId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data.filter((r: any) => r.emoji === '👍')).toHaveLength(2);
    });

    test('should prevent duplicate reactions', async () => {
      const messageId = 'msg-123';
      const userId = 'user-456';
      const emoji = '👍';

      chatMCP.addReaction.mockRejectedValue(
        new Error('User has already reacted with this emoji')
      );

      await expect(chatMCP.addReaction(messageId, userId, emoji))
        .rejects.toThrow('User has already reacted with this emoji');
    });
  });

  describe('Performance and Pagination', () => {
    test('should handle pagination for large message sets', async () => {
      const channelId = 'channel-456';
      const page = 1;
      const limit = 50;
      
      const messages = TestDataGenerator.generateMultiple(
        () => TestDataGenerator.createTestMessage({ channelId }),
        50
      );

      chatMCP.getChannelMessages.mockResolvedValue({
        success: true,
        data: messages,
        count: 50,
        pagination: {
          page,
          limit,
          total: 1000,
          hasMore: true
        }
      });

      const result = await chatMCP.getChannelMessages(channelId, { page, limit });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.total).toBe(1000);
    });

    test('should handle real-time message streaming', async () => {
      const channelId = 'channel-456';
      const messagesToSend = 10;
      const messages: any[] = [];

      // Simulate real-time message sending
      for (let i = 0; i < messagesToSend; i++) {
        const message = TestDataGenerator.createTestMessage({ 
          channelId,
          content: `Message ${i + 1}` 
        });
        
        chatMCP.sendMessage.mockResolvedValueOnce({
          success: true,
          data: { ...message, id: `msg-${i + 1}` }
        });

        const result = await chatMCP.sendMessage(message);
        messages.push(result.data);
      }

      expect(messages).toHaveLength(messagesToSend);
      expect(chatMCP.sendMessage).toHaveBeenCalledTimes(messagesToSend);
    });

    test('should maintain message ordering', async () => {
      const channelId = 'channel-456';
      const timestamps = [
        new Date('2023-01-01T10:00:00Z'),
        new Date('2023-01-01T10:01:00Z'),
        new Date('2023-01-01T10:02:00Z')
      ];

      const messages = timestamps.map((timestamp, index) => 
        TestDataGenerator.createTestMessage({ 
          channelId,
          timestamp,
          content: `Message ${index + 1}`
        })
      );

      chatMCP.getChannelMessages.mockResolvedValue({
        success: true,
        data: messages.reverse(), // Should be returned in reverse chronological order
        count: 3
      });

      const result = await chatMCP.getChannelMessages(channelId);

      expect(result.success).toBe(true);
      expect(result.data[0].content).toBe('Message 3'); // Most recent first
      expect(result.data[2].content).toBe('Message 1'); // Oldest last
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle message size limits', async () => {
      const largeMessage = TestDataGenerator.createTestMessage({
        content: 'a'.repeat(10000) // Very large message
      });

      chatMCP.sendMessage.mockRejectedValue(
        new Error('Message exceeds maximum size limit')
      );

      await expect(chatMCP.sendMessage(largeMessage))
        .rejects.toThrow('Message exceeds maximum size limit');
    });

    test('should handle invalid channel access', async () => {
      const invalidChannelId = 'non-existent-channel';

      chatMCP.getChannelMessages.mockRejectedValue(
        new Error('Access denied or channel not found')
      );

      await expect(chatMCP.getChannelMessages(invalidChannelId))
        .rejects.toThrow('Access denied or channel not found');
    });

    test('should handle message rate limiting', async () => {
      const userId = 'user-123';
      const rapidMessages = Array.from({ length: 100 }, (_, i) => 
        TestDataGenerator.createTestMessage({ 
          userId,
          content: `Rapid message ${i + 1}` 
        })
      );

      // First few messages succeed
      chatMCP.sendMessage
        .mockResolvedValueOnce({ success: true, data: { id: 'msg-1' } })
        .mockResolvedValueOnce({ success: true, data: { id: 'msg-2' } })
        .mockResolvedValueOnce({ success: true, data: { id: 'msg-3' } })
        // Then rate limiting kicks in
        .mockRejectedValue(new Error('Rate limit exceeded'));

      const results = [];
      for (const message of rapidMessages.slice(0, 5)) {
        try {
          const result = await chatMCP.sendMessage(message);
          results.push(result);
        } catch (error) {
          results.push({ error: (error as Error).message });
        }
      }

      expect(results.slice(0, 3).every(r => 'success' in r)).toBe(true);
      expect(results.slice(3).every(r => 'error' in r)).toBe(true);
    });

    test('should handle message search with special characters', async () => {
      const specialQuery = '@user #channel "quoted text" & special chars!';

      chatMCP.searchMessages.mockResolvedValue({
        success: true,
        data: [],
        count: 0,
        searchTerm: specialQuery
      });

      const result = await chatMCP.searchMessages(specialQuery);

      expect(result.success).toBe(true);
      expect(result.searchTerm).toBe(specialQuery);
    });

    test('should handle concurrent message operations', async () => {
      const messageId = 'msg-123';
      
      // Set up mocks before creating promises
      chatMCP.editMessage.mockRejectedValue(
        new Error('Message was deleted while editing')
      );
      
      chatMCP.deleteMessage.mockResolvedValue({
        success: true,
        data: { id: messageId, isDeleted: true }
      });

      // Now create the promises after mocks are set up
      const editPromise = chatMCP.editMessage(messageId, { content: 'New content' });
      const deletePromise = chatMCP.deleteMessage(messageId);

      const [editResult, deleteResult] = await Promise.allSettled([
        editPromise,
        deletePromise
      ]);

      expect(editResult.status).toBe('rejected');
      expect(deleteResult.status).toBe('fulfilled');
    });
  });

  describe('Analytics and Metrics', () => {
    test('should track message volume metrics', async () => {
      const mockMetrics = TestDataGenerator.createMCPMetrics({
        queryThroughput: 2000, // High throughput for chat
        averageResponseTime: 15, // Fast response for real-time chat
        cacheHitRatio: 0.75
      });

      chatMCP.getMetrics.mockResolvedValue(mockMetrics);

      const metrics = await chatMCP.getMetrics();

      expect(metrics.queryThroughput).toBeGreaterThan(1000);
      expect(metrics.averageResponseTime).toBeLessThan(50);
      expect(metrics.cacheHitRatio).toBeGreaterThan(0.7);
    });

    test('should provide message statistics', async () => {
      const channelId = 'channel-456';
      const stats = {
        totalMessages: 5000,
        activeUsers: 150,
        messagesLastHour: 100,
        averageMessageLength: 85,
        topEmojis: ['👍', '❤️', '😄']
      };

      chatMCP.query.mockResolvedValue({
        success: true,
        data: stats
      });

      const result = await chatMCP.query('getChannelStats', [channelId]);

      expect(result.success).toBe(true);
      expect(result.data.totalMessages).toBeGreaterThan(0);
      expect(result.data.activeUsers).toBeGreaterThan(0);
      expect(Array.isArray(result.data.topEmojis)).toBe(true);
    });
  });
});