"use strict";

/**
 * wallet-transaction service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::wallet-transaction.wallet-transaction"
);
