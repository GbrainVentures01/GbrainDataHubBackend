"use strict";

/**
 * data-purchase-router router
 */

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/data-purchase/mobile-buy-data",
      handler: "data-purchase-router.mobileBuyData",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/data-purchase/plan-types",
      handler: "data-purchase-router.getPlanTypes",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
