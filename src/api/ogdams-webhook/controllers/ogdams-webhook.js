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
      console.log(reqBody.event.data.reference);
      if (reqBody.status === true) {
        await strapi.query("api::sme-data-order.sme-data-order").update({
          where: { ref: reqBody.event.data.reference },
          data: {
            status: "delivered",
          },
        });
      } else {
        await strapi.query("api::sme-data-order.sme-data-order").update({
          where: { ref: reqBody.event.data.reference },
          data: {
            status: "failed",
          },
        });
      }
    },
  })
);
