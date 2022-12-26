"use strict";

/**
 *  data-house-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::data-house-webhook.data-house-webhook",
  ({ strapi }) => ({
    async create(ctx) {
      const reqBody = ctx.request.body;
      console.log(reqBody);
    },
  })
);
