"use strict";

/**
 *  data-order controller
 */
const randomString = require("randomstring");
const customNetwork = require("../../../utils/customNetwork");
const { createCoreController } = require("@strapi/strapi").factories;
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");

module.exports = createCoreController(
  "api::sme-data-order.sme-data-order",
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
        .service("api::sme-data-order.sme-data-order")
        .find({ user: user.id });

      if (!data) {
        return ctx.notFound();
      }

      ctx.send(data);
      // return this.transformResponse(sanitizedEntity);
    },
    // find all data orders
    async find(ctx) {
      let entities;

      entities = await strapi
        .service("api::sme-data-order.sme-data-order")
        .find();

      const sanitizedEntity = await this.sanitizeOutput(entities, ctx);
      return ctx.send(this.transformResponse(sanitizedEntity));

      // return this.transformResponse(sanitizedEntity);
    },

    //find a data order
    async findOne(ctx) {
      const { id } = ctx.params;

      const entity = await strapi
        .service("api::sme-data-order.sme-data-order")
        .findOne({
          where: {
            id: id,
          },
        });
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return ctx.send(this.transformResponse(sanitizedEntity));
    },

    async create(ctx) {
      const { data } = ctx.request.body;

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
      const ref = `OGD|88|${randomString.generate(8)}`;
      const dataBasePayload = {
        user: id,
        ref: ref,
        beneficiary: data.beneficiary,
        network: data.network,
        plan: data.plan.Plan,
        amount: data.amount,
        previous_balance:user.AccountBalance ,
        current_balance:user.AccountBalance
      };
      const newOrder = {
        data: { ...dataBasePayload },
      };
      await strapi
        .service("api::sme-data-order.sme-data-order")
        .create(newOrder);



    const updatedUser =  await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: {
          AccountBalance: user.AccountBalance - Number(data.amount),
        },
      });
    

      const returnNetId = (network) => {
        switch (network) {
          case "Mtn":
            return 1;
          case "Airtel":
            return 2;
          case "Glo":
            return 3;

          default:
            break;
        }
      };
      const payload = {
        networkId: returnNetId(data.network),
        planId: data.plan.plan_id,
        phoneNumber: data.beneficiary,
        reference: ref,
      };
      try {
        const res = await customNetwork({
          method: "POST",
          target: "ogdams",
          path: "vend/data",
          requestBody: payload,
          headers: { Authorization: `Bearer ${process.env.OGDAMS_API_KEY}` },
        });
        console.log(res);
        if (res.data.code === 200) {
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "delivered",
              current_balance:updatedUser.AccountBalance
            },
          });
          return ctx.send({ data: { message: `Transaction Successful, kindly check your balance.` } });
        } 
        else if (res.data.code === 202) {
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "processing",
              current_balance:updatedUser.AccountBalance
            },
          });
          return ctx.send({ data: { message: `${res.data.data.msg}` } });
        } else if (res.data.code === 201) {
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "processing ",
              current_balance:updatedUser.AccountBalance
            },
          });
          return ctx.send({ data: { message: `${res.data.data.msg}` } });
        } else if (res.data.code === 424) {
          const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { id: id } });
            const updatedUser =  await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance + Number(data.amount),
          },
        });
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "failed",
              current_balance:updatedUser.AccountBalance
            },
          });
        
        
          ctx.throw(503, "Sorry transaction was not succesful");
        } else {
          const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: id },
          });
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "failed",
              current_balance:user.AccountBalance
            },
          });
          ctx.throw(500, "Something went wrong");
        }
      } catch (error) {
        
        console.log(error);
        const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: id },
        });
        await strapi.query("api::sme-data-order.sme-data-order").update({
          where: { ref: ref },
          data: {
            status: "failed",
            current_balance:user.AccountBalance
          },
        });
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
