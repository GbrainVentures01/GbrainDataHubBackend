"use strict";

const { ApplicationError } = require("@strapi/utils/lib/errors");
const { HttpError } = require("koa");

/**
 *  airtime-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::airtime-order.airtime-order",
  ({ strapi }) => ({
    /**
     * return create airtime order and associating with current logged in user
     * @param {Object} ctx
     * @returns
     */
      async create(ctx) {
      const order = ctx.request.body;
      const { id } = ctx.state.user;
      const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: id}
      });
    
        if (user.AccountBalance < Number(order.data.amount)) {
          return ctx.badRequest("Low Wallet Balance, Please fund wallet") 
        }
try {
       const newOrder = { data: { ...order.data, user: id } };
      const Order = await strapi
        .service("api::airtime-order.airtime-order")
        .create(newOrder);
        ctx.response.status = 201

      await strapi.query('plugin::users-permissions.user').update({where:{id:user.id}, data:{
          AccountBalance:user.AccountBalance - Number(order.data.amount)
      }})

      return ctx.send({data: {message:"airtime order successfully created", Order}})
  
} catch (error) {
  throw new ApplicationError(error.message)
}
 
      
    },
//find a airtime order
  async findOne(ctx) {
      const { id } = ctx.params;
      const { user } = ctx.state;
      const { query } = ctx;

      const entity = await strapi
        .service("api::airtime-order.airtime-order")
        .findOne(id);
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },

    //find all airtimes orders
      async find(ctx) {
      const { user } = ctx.state;
      const { query } = ctx;

      let entities;

      if (ctx.query._q) {
        entities = await strapi
          .service("api::airtime-order.airtime-order")
          .search({ ...ctx.query, user: user.id });
      } else {
        entities = await strapi
          .service("api::airtime-order.airtime-order")
          .find({ user: user.id });
      }
      return entities.results.map((entity) =>
        sanitizeEntity(entity, {
          model: strapi.getModel("api::airtime-order.airtime-order"),
        })
      );

      // return this.transformResponse(sanitizedEntity);
    },
  })
);
