"use strict";

const { sanitizeEntity } = require("strapi-utils/lib");
const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const customNetwork = require("../../../utils/customNetwork");
const { base64encode } = require("nodejs-base64");
const requeryTransaction = require("../../../utils/vtpass/requeryTransaction");

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::exam-pin-order.exam-pin-order",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
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

      if (
        user.AccountBalance < Number(data.amount || user.AccountBalance === 0)
      ) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }

      if (data) {
        const newOrder = { data: { ...data, user: id } };
        await strapi
          .service("api::exam-pin-order.exam-pin-order")
          .create(newOrder);

        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(data.amount),
          },
        });

        const purchaseExamPin = await customNetwork({
          method: "POST",
          path: "pay",
          requestBody: data,
          target: "vtpass",
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });

        if (purchaseExamPin.data.code === "000") {
          await strapi.query("api::exam-pin-order.exam-pin-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "Successful",
            },
          });
          return ctx.created({ message: "Successful" });
        } else if (purchaseExamPin.data.code === "099") {
          const status = requeryTransaction({
            requeryParams: data.request_id,
          });
          if (status.code === "000") {
            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "Successful",
              },
            });
            return ctx.created({ message: "Successful" });
          } else {
            const user = await strapi
              .query("plugin::users-permissions.user")
              .findOne({ where: { id: id } });
            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "Failed",
              },
            });
            return ctx.serviceUnavailable("Sorry something came up");
          }
        } else {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance + Number(data.amount),
            },
          });
          await strapi.query("api::exam-pin-order.exam-pin-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "Failed",
            },
          });
          return ctx.throw(400, purchaseExamPin?.data?.response_description);
        }
      } else {
        return ctx.badRequest(purchaseExamPin.data.content.error);
      }
    },
  })
);
