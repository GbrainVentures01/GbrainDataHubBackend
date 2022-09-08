"use strict";

/**
 *  ogdams-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::ogdams-webhook.ogdams-webhook",
  ({ strapi }) => ({
    /**
     * accept webhook from ogdams sim hosting  about data vending status
     * @param {Object} ctx
     * @returns
     */

    async create(ctx) {
      const reqBody = ctx.request.body;
      console.log(reqBody);
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: reqBody.customer.email } });
    },
  })
);
