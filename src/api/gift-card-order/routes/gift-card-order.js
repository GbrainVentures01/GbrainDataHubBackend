'use strict';

/**
 * gift-card-order router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::gift-card-order.gift-card-order');

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;
  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      // Put custom routes BEFORE default routes so they match first
      if (!routes) routes = extraRoutes.concat(innerRouter.routes);
      return routes;
    },
  };
};

const myExtraRoutes = [
  {
    method: 'GET',
    path: '/gift-card-orders/trade-history',
    handler: 'gift-card-order.getTradeHistory',
    config: {
      policies: [],
      middlewares: [],
    },
  },
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
