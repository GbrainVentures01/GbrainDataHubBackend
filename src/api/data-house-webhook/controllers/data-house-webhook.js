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

      try {
        if (reqBody.Status === "successful") {
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { ident: reqBody.ident },
            data: {
              status: "delivered",
            },
          });
          return ctx.created({
            message: "success",
          });
        } else {
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { ident: reqBody.ident },
            data: {
              status: "failed",
            },
          });
          return ctx.created({
            message: "success",
          });
        }
      } catch (error) {
        console.log(error);
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
