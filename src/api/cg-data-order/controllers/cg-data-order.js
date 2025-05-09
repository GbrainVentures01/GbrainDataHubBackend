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

const { default: axios } = require("axios");
const moment = require("moment");
const isLessThanThreeMins = require("../../../utils/checkduplicate");
const checkduplicate = require("../../../utils/checkduplicate");

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

      const { id } = ctx.state.user;
      const isDuplicate = await checkduplicate(
        id,
        data,
        "api::cg-data-order.cg-data-order"
      );
      console.log("isDuplicate", isDuplicate);
      if (isDuplicate) {
        return ctx.badRequest(
          "Possible Duplicate Transaction, Kindly check the history before retrying or try again after 90 seconds."
        );
      }

      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (user.AccountBalance < Number(data.amount)) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      if (
        data.beneficiary.trim().length > 11 ||
        data.beneficiary.trim().length < 11
      ) {
        return ctx.badRequest(
          "Invalid beneficiary number, please use this format 08011111111"
        );
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
        data: {
          ...restofdata,
          user: id,
          current_balance: user.AccountBalance,
          previous_balance: user.AccountBalance,
        },
      };

      await strapi.service("api::cg-data-order.cg-data-order").create(newOrder);
      const updatedUser = await strapi
        .query("plugin::users-permissions.user")
        .update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(data.amount),
          },
        });
      try {
        const payload = JSON.stringify({
          network_id: `${data.network_id}`,
          plan_id: `${data.plan_id}`,
          phone: `${data.beneficiary}`,
          pin: process.env.BELLO_PIN,
          // Ported_number: true,
        });

        const res = await customNetwork({
          method: "POST",
          target: "bello",
          path: "data",
          requestBody: payload,
          headers: {
            Authorization: `Bearer ${process.env.BELLO_SECRET}`,
            "Content-Type": "application/json",
          },
        });

        console.log(res);

        if (res.status === 200 && res.data.status) {
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "delivered",
              ident: res.data.ident,
              current_balance: updatedUser.AccountBalance,
            },
          });
          return ctx.send({
            data: {
              message:
                res.data.api_response ||
                `Successful gifted ${data.plan} to ${data.beneficiary}, please check your transaction history`,
            },
          });
        } else if (!res.data.status) {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
              ident: res?.data?.ident || "-",
              current_balance: updatedUser.AccountBalance,
            },
          });
          console.log(res.data);
          ctx.throw(400, res.data.api_response);
        }
        // else if (
        //   res.data &&
        //   res.data.status !== "failed" &&
        //   res.data.status !== "successful"
        // ) {
        //   await strapi.query("api::cg-data-order.cg-data-order").update({
        //     where: { request_Id: data.request_Id },
        //     data: {
        //       status: "qeued",
        //       ident: res.data.ident,
        //     },
        //   });

        //   console.log(res.data);
        //   return ctx.send({
        //     data: { message: "pending" },
        //   });
        // }
        else {
          console.log(res.data);
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
              ident: res?.data?.ident || "-",
              current_balance: user.AccountBalance,
            },
          });
          ctx.throw(500, "Transaction was not successful");
        }
      } catch (error) {
        console.log("from error");
        console.log(error);
        if (error.response?.status === 400) {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
              ident: res?.data?.ident || "-",
              current_balance: updatedUser.AccountBalance,
            },
          });
          ctx.throw(
            400,
            "Transaction was not successful, please try again later."
          );
        } else {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi.query("api::cg-data-order.cg-data-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
              ident: res?.data?.ident || "-",
              current_balance: user.AccountBalance,
            },
          });
          ctx.throw(500, "Something went wrong, please try again later.");
        }
      }
    },
  })
);
