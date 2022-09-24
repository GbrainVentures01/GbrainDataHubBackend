"use strict";

/**
 *  sell-airtime controller
 */
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::sell-airtime.sell-airtime",
  ({ strapi }) => ({
    /**
     * create sell airtime order
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const { data } = ctx.request.body;
      console.log(data);
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }

      try {
        const { pin, ...restofdata } = data;
        const newOrder = { data: { ...restofdata, user: id } };
        const Order = await strapi
          .service("api::sell-airtime.sell-airtime")
          .create(newOrder);

        return ctx.send({
          data: {
            message: "success, your account will be credited soon",
            Order,
          },
        });
      } catch (error) {
        throw new ApplicationError(error.message);
      }
    },
  })
);
