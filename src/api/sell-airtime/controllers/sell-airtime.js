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
        const { pin, amount, ...restofdata } = data;
        const newOrder = {
          data: { ...restofdata, user: id, amount: Number(amount) },
        };

        const Order = await strapi
          .service("api::sell-airtime.sell-airtime")
          .create(newOrder);

        await strapi.plugins["email"].services.email.send({
          to: "adebisidamilola6@gmail.com",
          subject: "Sell Airtime Order",
          html: `<p>Hello, you have a new Sell Airtime Order !, kindly visit the admin pannel to see  order details </p>
                 
                 <h3> Regards</h3>
                 <h3>Gbrain Coporate Ventures</h3>`,
        });

        return ctx.send({
          data: {
            message: "SUCCESSFUL, YOUR ACCOUNT WILL BE CREDITED IN 10 - 30MIN",
            Order,
          },
        });
      } catch (error) {
        throw new ApplicationError(error.message);
      }
    },
  })
);
