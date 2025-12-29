'use strict';

/**
 * Notification routes
 * FCM notification endpoints
 */

const customRoutes = [
  {
    method: 'POST',
    path: '/notifications/register-token',
    handler: 'notification.registerToken',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'GET',
    path: '/notifications/user-tokens/:userId',
    handler: 'notification.getUserTokens',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'POST',
    path: '/notifications/deregister-token',
    handler: 'notification.deregisterToken',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'POST',
    path: '/notifications/send-to-user',
    handler: 'notification.sendToUser',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'POST',
    path: '/notifications/send-to-topic',
    handler: 'notification.sendToTopic',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'GET',
    path: '/notifications/health',
    handler: 'notification.health',
    config: {
      policies: [],
      middlewares: [],
    },
  },
];

module.exports = {
  routes: customRoutes,
};
