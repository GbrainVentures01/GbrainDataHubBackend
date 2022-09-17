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
  "api::tvcables-order.tvcables-order",
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

      const verifyParams = {
        billersCode: `${Number(data.billersCode)}`,
        serviceID: `${data.serviceID}`,
      };

      if (
        user.AccountBalance < Number(data.amount || user.AccountBalance === 0)
      ) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      try {
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
            .service("api::tvcables-order.tvcables-order")
            .create(newOrder);
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });

          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(data.amount),
            },
          });
          const makeCablePurchase = await customNetwork({
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

          if (makeCablePurchase.data.code === "000") {
            await strapi.query("api::tvcables-order.tvcables-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "Successful",
              },
            });

            return ctx.created({ message: "Successful" });
          } else if (makeCablePurchase.data.code === "099") {
            const status = requeryTransaction({
              requeryParams: data.request_id,
            });
            if (status.code === "000") {
              await strapi.query("api::tvcables-order.tvcables-order").update({
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
              await strapi.query("api::tvcables-order.tvcables-order").update({
                where: { request_id: data.request_id },
                data: {
                  status: "Failed",
                },
              });
              return ctx.serviceUnavailable("Sorry something came up");
            }
          } else {
            console.log(makeCablePurchase.data.code);
            const user = await strapi
              .query("plugin::users-permissions.user")
              .findOne({ where: { id: id } });

            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
            await strapi.query("api::tvcables-order.tvcables-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "Failed",
              },
            });
            return ctx.throw(
              500,
              makeCablePurchase?.data?.response_description
            );
          }
        } else {
          return ctx.badRequest(verifiedDetails.data?.content?.error);
        }
      } catch (error) {
        console.log(error);
      }
    },
  })
);
