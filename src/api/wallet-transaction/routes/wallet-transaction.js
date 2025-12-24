"use strict";

/**
 * wallet-transaction router
 */

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/wallet-transfers",
      handler: "wallet-transaction.transfer",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/wallet-transactions",
      handler: "wallet-transaction.find",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
