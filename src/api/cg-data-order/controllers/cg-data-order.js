"use strict";

/**
 *  cg-data-order controller
 */
const randomString = require("randomstring");
const customNetwork = require("../../../utils/customNetwork");
const { createCoreController } = require("@strapi/strapi").factories;
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");

module.exports = createCoreController(
  "api::cg-data-order.cg-data-order",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    // async findMe(ctx) {
    //   const user = ctx.state.user;
    //   if (!user) {
    //     return ctx.badRequest(null, [
    //       { messages: [{ id: "No authorization header was found" }] },
    //     ]);
    //   }

    //   const data = await strapi
    //     .service("api::cg-data-order.cg-data-order")
    //     .find({ user: user.id });

    //   if (!data) {
    //     return ctx.notFound();
    //   }

    //   ctx.send(data);
    //   // return this.transformResponse(sanitizedEntity);
    // },
    // // find all data orders
    // async find(ctx) {
    //   let entities;

    //   entities = await strapi
    //     .service("api::sme-data-order.sme-data-order")
    //     .find();

    //   const sanitizedEntity = await this.sanitizeOutput(entities, ctx);
    //   return ctx.send(this.transformResponse(sanitizedEntity));

    //   // return this.transformResponse(sanitizedEntity);
    // },

    // //find a data order
    // async findOne(ctx) {
    //   const { id } = ctx.params;

    //   const entity = await strapi
    //     .service("api::sme-data-order.sme-data-order")
    //     .findOne({
    //       where: {
    //         id: id,
    //       },
    //     });
    //   const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    //   return ctx.send(this.transformResponse(sanitizedEntity));
    // },

    async create(ctx) {
      const { data } = ctx.request.body;
      console.log(data);

      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (user.AccountBalance < Number(data.amount)) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }

      const { pin, ...restofdata } = data;
      const newOrder = {
        data: { ...restofdata, user: id },
      };
      console.log(newOrder);
      await strapi.service("api::cg-data-order.cg-data-order").create(newOrder);
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: {
          AccountBalance: user.AccountBalance - Number(data.amount),
        },
      });

      const payload = {
        network: data.network_id,
        plan: data.plan_id,
        mobile_number: data.beneficiary,
        Ported_number: true,
      };
      try {
        const res = await customNetwork({
          method: "POST",
          target: "data_house",
          path: "data",
          requestBody: payload,
          headers: {
            Authorization: `Token ${process.env.DATA_HOUSE_SECRET}`,
          },
        });
        console.log(res.body);
        if (res.status === 200) {
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "qeued",
            },
          });
          return ctx.send({ data: { message: `Processing...` } });
        } else if (res.status !== 200 || res.status !== 201) {
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
            },
          });
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance + Number(data.amount),
            },
          });
          ctx.throw(503, "Sorry transaction was not succesful");
        } else {
          ctx.throw(500, "Something went wrong");
        }
      } catch (error) {
        console.log(error);
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
