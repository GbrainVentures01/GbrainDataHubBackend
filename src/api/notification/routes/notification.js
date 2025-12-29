'use strict';

/**
 * Notification routes
 * FCM notification endpoints
 */

const defaultRouter = require('@strapi/strapi').factories.createCoreRouter(
  'api::notification.notification'
);

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

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;

  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      if (!routes) {
        routes = extraRoutes.concat(innerRouter.routes);
      }
      return routes;
    },
  };
};

module.exports = customRouter(defaultRouter, customRoutes);
