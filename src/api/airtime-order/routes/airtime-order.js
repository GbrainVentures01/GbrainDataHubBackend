"use strict";

/**
 * airtime-order router.
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

const defaultRouter = createCoreRouter("api::airtime-order.airtime-order");

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
    path: "/airtime-orders/mobile-buy-airtime",
    handler: "api::airtime-order.airtime-order.mobileBuyAirtime",
  },
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
