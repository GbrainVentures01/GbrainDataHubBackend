"use strict";

/**
 *  vt-pass-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::vt-pass-webhook.vt-pass-webhook",
  ({ strapi }) => ({
    /**
     * accept webhook from ogdams sim hosting  about data vending status
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const reqBody = ctx.request.body;
      console.log(reqBody);
      ctx.send({
        response: "success",
      });
      //   const user = await strapi
      //     .query("plugin::users-permissions.user")
      //     .findOne({ where: { email: reqBody.customer.email } });
      //   const payload ={
      //     data:{
      //         status:
      //     }
      //   }
    },
  })
);
