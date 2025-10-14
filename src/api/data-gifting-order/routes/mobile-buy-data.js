"use strict";

/**
 * Custom routes for data-gifting-order
 */

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/data-gifting-orders/mobile-buy-data",
      handler: "data-gifting-order.mobileBuyData",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
