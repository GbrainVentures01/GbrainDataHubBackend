"use strict";

/**
 * airtime-order service.
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::data-gifting-order.data-gifting-order"
);
