"use strict";

const { ApplicationError } = require("@strapi/utils/lib/errors");
const { HttpError } = require("koa");

/**
 *  data-gifting-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::data-gifting-order.data-gifting-order",
  ({ strapi }) => ({
    /**
     * return create data gfiting order and associating with current logged in user
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const { data } = ctx.request.body;
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (user.AccountBalance < Number(data.amount)) {
        return ctx.badRequest("Low Wallet Balance, Please fund wallet");
      }
      try {
        const newOrder = { data: { ...data, user: id } };
        const Order = await strapi
          .service("api::data-gifting-order.data-gifting-order")
          .create(newOrder);

        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(data.amount),
          },
        });

        return ctx.send({
          data: { message: "data gifting order successfully created", Order },
        });
      } catch (error) {
        throw new ApplicationError(error.message);
      }
    },
  })
);
