'use strict';

/**
 * gift-card-collection router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::gift-card-collection.gift-card-collection');

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
    path: '/gift-card-collections/rates',
    handler: 'gift-card-collection.getRates',
    config: {
      auth: false, // Make it public so users can see rates without logging in
      policies: [],
      middlewares: [],
    },
  },
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
