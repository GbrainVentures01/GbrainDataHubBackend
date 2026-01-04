/**
 * Notification service for sending Firebase Cloud Messaging notifications
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// This should be configured in your environment
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * @param {Object} serviceAccountKey - Firebase service account key
 */
async function initializeFirebase(serviceAccountKey) {
  try {
    if (!firebaseApp) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: process.env.FIREBASE_PROJECT_ID || 'fendur-notifications',
      });
      console.log('✅ [FCM] Firebase Admin SDK initialized');
    }
    return firebaseApp;
  } catch (error) {
    console.error('❌ [FCM] Firebase initialization error:', error);
    throw error;
  }
}

/**
 * Get FCM token for a user by user ID
 * @param {Number} userId - User ID
 * @returns {Promise<String|null>} - FCM token or null if not found
 */
async function getUserFCMToken(userId) {
  try {
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['fcmToken'],
    });
    return user?.fcmToken || null;
  } catch (error) {
    console.error(`❌ [FCM] Failed to fetch FCM token for user ${userId}:`, error);
    return null;
  }
}

/**
 * Send a notification to a specific user by user ID
 * @param {Number} userId - User ID from database
 * @param {Object} payload - Notification payload
 * @returns {Promise<String|null>} - Message ID or null if token not found
 */
async function sendNotificationToUser(userId, payload) {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    // Fetch user's FCM token
    const fcmToken = await getUserFCMToken(userId);
    if (!fcmToken) {
      console.warn(`⚠️ [FCM] No FCM token found for user ${userId}`);
      return null;
    }

    return await sendNotificationToToken(fcmToken, payload);
  } catch (error) {
    console.error(`❌ [FCM] Failed to send notification to user ${userId}:`, error);
    // Don't throw - allow notification failure to not block transaction
    return null;
  }
}

/**
 * Send a notification to a specific device token
 * @param {String} deviceToken - FCM device token
 * @param {Object} payload - Notification payload
 * @returns {Promise<String>} - Message ID
 */
async function sendNotificationToToken(deviceToken, payload) {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      token: deviceToken,
    };

    // Add image if provided
    if (payload.imageUrl) {
      message.android = {
        notification: {
          imageUrl: payload.imageUrl,
        },
      };
      message.apns = {
        payload: {
          aps: {
            'mutable-content': 1,
          },
        },
      };
    }

    const response = await admin.messaging().send(message);
    console.log(`✅ [FCM] Notification sent to token: ${response}`);
    return response;
  } catch (error) {
    console.error(`❌ [FCM] Failed to send notification to token:`, error);
    throw error;
  }
}

/**
 * Send a notification to multiple tokens
 * @param {Array<String>} deviceTokens - Array of FCM device tokens
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - Response with success/failure counts
 */
async function sendNotificationToTokens(deviceTokens, payload) {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    // Add image if provided
    if (payload.imageUrl) {
      message.android = {
        notification: {
          imageUrl: payload.imageUrl,
        },
      };
      message.apns = {
        payload: {
          aps: {
            'mutable-content': 1,
          },
        },
      };
    }

    const response = await admin.messaging().sendMulticast({
      ...message,
      tokens: deviceTokens,
    });

    console.log(`✅ [FCM] Sent notifications to ${deviceTokens.length} tokens`);
    console.log(`   Success: ${response.successCount}, Failed: ${response.failureCount}`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalCount: deviceTokens.length,
      responses: response.responses,
    };
  } catch (error) {
    console.error(`❌ [FCM] Failed to send multicast notifications:`, error);
    throw error;
  }
}

/**
 * Send a notification to a topic
 * @param {String} topic - Topic name
 * @param {Object} payload - Notification payload
 * @returns {Promise<String>} - Message ID
 */
async function sendNotificationToTopic(topic, payload) {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      topic: topic,
    };

    // Add image if provided
    if (payload.imageUrl) {
      message.android = {
        notification: {
          imageUrl: payload.imageUrl,
        },
      };
    }

    const response = await admin.messaging().send(message);
    console.log(`✅ [FCM] Notification sent to topic '${topic}': ${response}`);
    return response;
  } catch (error) {
    console.error(`❌ [FCM] Failed to send notification to topic:`, error);
    throw error;
  }
}

/**
 * Subscribe a device token to a topic
 * @param {String} topic - Topic name
 * @param {Array<String>} tokens - Device tokens
 * @returns {Promise<Object>} - Response
 */
async function subscribeToTopic(topic, tokens) {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    console.log(`✅ [FCM] Subscribed ${tokens.length} tokens to topic '${topic}'`);
    return response;
  } catch (error) {
    console.error(`❌ [FCM] Failed to subscribe to topic:`, error);
    throw error;
  }
}

/**
 * Unsubscribe a device token from a topic
 * @param {String} topic - Topic name
 * @param {Array<String>} tokens - Device tokens
 * @returns {Promise<Object>} - Response
 */
async function unsubscribeFromTopic(topic, tokens) {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    console.log(`✅ [FCM] Unsubscribed ${tokens.length} tokens from topic '${topic}'`);
    return response;
  } catch (error) {
    console.error(`❌ [FCM] Failed to unsubscribe from topic:`, error);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  getUserFCMToken,
  sendNotificationToUser,
  sendNotificationToToken,
  sendNotificationToTokens,
  sendNotificationToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
};
