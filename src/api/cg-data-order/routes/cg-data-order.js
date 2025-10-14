"use strict";

/**
 * cg-data-order router.
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

const defaultRouter = createCoreRouter("api::cg-data-order.cg-data-order");

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;
  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      if (!routes) routes = innerRouter.routes.concat(extraRoutes);
      return routes;
    },
  };
};

const myExtraRoutes = [
  {
    method: "POST",
    path: "/cg-data-orders/mobile-buy-data",
    handler: "api::cg-data-order.cg-data-order.mobileBuyData",
  },
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
