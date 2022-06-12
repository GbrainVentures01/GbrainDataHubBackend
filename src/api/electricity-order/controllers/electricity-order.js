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
  "api::electricity-order.electricity-order",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async create(ctx) {
      const { data } = ctx.request.body;

      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      const verifyParams = {
        billersCode: `${Number(data.billersCode)}`,
        serviceID: `${data.serviceID}`,
        type: `${data.variation_code}`,
      };

      try {
        if (
          user.AccountBalance < Number(data.amount || user.AccountBalance === 0)
        ) {
          return ctx.badRequest("Low Wallet Balance, please fund your wallet");
        }

        const verifiedDetails = await customNetwork({
          method: "POST",
          target: "vtpass",
          path: "merchant-verify",
          requestBody: verifyParams,
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });
        console.log(verifiedDetails);

        if (!verifiedDetails.data.content.error) {
          const newOrder = { data: { ...data, user: id } };
          const Order = await strapi
            .service("api::electricity-order.electricity-order")
            .create(newOrder);

          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(data.amount),
            },
          });
          const makeElectricityPurchase = await customNetwork({
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
          console.log(makeElectricityPurchase);
          if (makeElectricityPurchase.data.code === "000") {
            await strapi
              .query("api::electricity-order.electricity-order")
              .update({
                where: { request_id: data.request_id },
                data: {
                  status: "Successful",
                },
              });
            return ctx.created({ message: "Successful" });
          } else if (makeElectricityPurchase.data.code === "099") {
            const status = requeryTransaction({
              requeryParams: data.request_id,
            });
            if (status.code === "000") {
              await strapi
                .query("api::electricity-order.electricity-order")
                .update({
                  where: { request_id: data.request_id },
                  data: {
                    status: "Successful",
                  },
                });
              return ctx.created({ message: "Successful" });
            } else {
              await strapi.query("plugin::users-permissions.user").update({
                where: { id: user.id },
                data: {
                  AccountBalance: user.AccountBalance + Number(data.amount),
                },
              });
              await strapi
                .query("api::electricity-order.electricity-order")
                .update({
                  where: { request_id: data.request_id },
                  data: {
                    status: "Failed",
                  },
                });
              return ctx.serviceUnavailable("Sorry something came up");
            }
          } else {
            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
            await strapi
              .query("api::electricity-order.electricity-order")
              .update({
                where: { request_id: data.request_id },
                data: {
                  status: "Failed",
                },
              });
            return ctx.serviceUnavailable("Sorry something came up");
          }
        } else {
          return ctx.badRequest(verifiedDetails.data.content.error);
        }
      } catch (error) {
        throw new ApplicationError(error.message);
      }
    },
  })
);
