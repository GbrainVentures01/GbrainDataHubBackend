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

      const newOrder = {
        data: {
          network: reqBody.network,
          mobile_number: reqBody.mobile_number,
          status: reqBody.Status,
          balance_before: reqBody.balance_before,
          balance_after: reqBody.balance_after,
          plan_amount: reqBody.plan_amount,
          ident: reqBody.ident,
          api_response: reqBody.api_response,
          refund: reqBody.refund,
        },
      };

      try {
        await strapi
          .service("api::data-house-webhook.data-house-webhook")
          .create(newOrder);
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
