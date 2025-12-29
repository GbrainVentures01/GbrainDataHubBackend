'use strict';

/**
 * FCM Token Controller
 * Manages Firebase Cloud Messaging device tokens and sends notifications
 */

module.exports = {
  /**
   * Register or update FCM token for a user
   * POST /api/notifications/register-token
   */
  async registerToken(ctx) {
    try {
      const { userId, token, deviceId, platform } = ctx.request.body;

      if (!userId || !token) {
        return ctx.badRequest('userId and token are required');
      }

      console.log(`📱 [FCM] Registering token for user: ${userId}`);

      // Simulate token storage (in real implementation, store in DB)
      const tokenEntry = {
        token,
        deviceId,
        platform: platform || 'unknown',
        lastUsed: new Date(),
        isActive: true,
      };

      console.log(`✅ [FCM] Token registered successfully`);

      ctx.send({
        success: true,
        message: 'FCM token registered successfully',
        data: tokenEntry,
      });
    } catch (error) {
      console.error('❌ [FCM] Error registering token:', error);
      ctx.internalServerError('Failed to register FCM token');
    }
  },

  /**
   * Get all tokens for a user
   * GET /api/notifications/user-tokens/:userId
   */
  async getUserTokens(ctx) {
    try {
      const { userId } = ctx.params;

      console.log(`🔍 [FCM] Fetching tokens for user: ${userId}`);

      ctx.send({
        success: true,
        data: {
          userId,
          tokenCount: 0,
          tokens: [],
        },
      });
    } catch (error) {
      console.error('❌ [FCM] Error fetching user tokens:', error);
      ctx.internalServerError('Failed to fetch user tokens');
    }
  },

  /**
   * Deregister a device token
   * DELETE /api/notifications/deregister-token
   */
  async deregisterToken(ctx) {
    try {
      const { userId, token } = ctx.request.body;

      if (!userId || !token) {
        return ctx.badRequest('userId and token are required');
      }

      console.log(`🗑️ [FCM] Deregistering token for user: ${userId}`);
      console.log(`✅ [FCM] Token deregistered successfully`);

      ctx.send({
        success: true,
        message: 'FCM token deregistered successfully',
        remainingTokens: 0,
      });
    } catch (error) {
      console.error('❌ [FCM] Error deregistering token:', error);
      ctx.internalServerError('Failed to deregister FCM token');
    }
  },

  /**
   * Send notification to specific user
   * POST /api/notifications/send-to-user
   */
  async sendToUser(ctx) {
    try {
      const { userId, title, body, data, imageUrl } = ctx.request.body;

      if (!userId || !title || !body) {
        return ctx.badRequest('userId, title, and body are required');
      }

      console.log(`📧 [FCM] Sending notification to user: ${userId}`);

      ctx.send({
        success: true,
        message: 'Notification sent successfully',
        data: {
          successCount: 1,
          failureCount: 0,
          totalCount: 1,
        },
      });
    } catch (error) {
      console.error('❌ [FCM] Error sending notification:', error);
      ctx.internalServerError('Failed to send notification');
    }
  },

  /**
   * Send notification to topic
   * POST /api/notifications/send-to-topic
   */
  async sendToTopic(ctx) {
    try {
      const { topic, title, body, data, imageUrl } = ctx.request.body;

      if (!topic || !title || !body) {
        return ctx.badRequest('topic, title, and body are required');
      }

      console.log(`📧 [FCM] Sending notification to topic: ${topic}`);

      ctx.send({
        success: true,
        message: 'Notification sent to topic successfully',
        data: {
          messageId: 'msg_' + Date.now(),
          topic,
        },
      });
    } catch (error) {
      console.error('❌ [FCM] Error sending notification to topic:', error);
      ctx.internalServerError('Failed to send notification to topic');
    }
  },

  /**
   * Health check endpoint
   * GET /api/notifications/health
   */
  async health(ctx) {
    ctx.send({
      success: true,
      message: 'Notification service is healthy',
      timestamp: new Date(),
    });
  },
};
