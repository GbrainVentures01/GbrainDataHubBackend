"use strict";

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::data-order.data-order",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async findMe(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.badRequest(null, [
          { messages: [{ id: "No authorization header was found" }] },
        ]);
      }

      const data = await strapi
        .service("api::data-order.data-order")
        .find({ user: user.id });

      if (!data) {
        return ctx.notFound();
      }

      ctx.send(data);
      // return this.transformResponse(sanitizedEntity);
    },
    // find all data orders
    async find(ctx) {
      const { user } = ctx.state;
      const { query } = ctx;

      let entities;

      if (ctx.query._q) {
        entities = await strapi
          .service("api::data-order.data-order")
          .search({ ...ctx.query, user: user.id });
      } else {
        entities = await strapi
          .service("api::data-order.data-order")
          .find({ user: user.id });
      }
      // return entities.results.map((entity) =>
      //   sanitizeEntity(entity, {
      //     model: strapi.getModel("api::data-order.data-order"),
      //   })
      // );
      const sanitizedEntity = await this.sanitizeOutput(entities, ctx);
      return ctx.send(this.transformResponse(sanitizedEntity));

      // return this.transformResponse(sanitizedEntity);
    },

    //find a data order
    async findOne(ctx) {
      const { id } = ctx.params;
      const { user } = ctx.state;
      const { query } = ctx;

      const entity = await strapi
        .service("api::data-order.data-order")
        .findOne(id);
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return ctx.send(this.transformResponse(sanitizedEntity));
    },

    async create(ctx) {
      const order = ctx.request.body;
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (
        user.AccountBalance <
        Number(order.data.amount || user.AccountBalance === 0)
      ) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      try {
        const newOrder = { data: { ...order.data, user: id } };
        const Order = await strapi
          .service("api::data-order.data-order")
          .create(newOrder);

        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(order.data.amount),
          },
        });

        return ctx.created("Successful");
      } catch (error) {
        throw new ApplicationError(error.message);
      }
    },
  })
);
