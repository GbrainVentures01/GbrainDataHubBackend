"use strict";

const { sanitizeEntity } = require("strapi-utils/lib");
const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const customNetwork = require("../../../utils/customNetwork");
const { base64encode } = require("nodejs-base64");
const requeryTransaction = require("../../../utils/vtpass/requeryTransaction");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::airtime-order.airtime-order",
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

      if (
        user.AccountBalance < Number(data.amount || user.AccountBalance === 0)
      ) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }
      // update latest user's details (debit user's account)
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: {
          AccountBalance: user.AccountBalance - Number(data.amount),
        },
      });
      try {
        const newOrder = { data: { pin, ...data, user: id } };
        await strapi
          .service("api::airtime-order.airtime-order")
          .create(newOrder);

        const payload = {
          request_id: data.request_id,
          serviceID: data.serviceID,
          phone: data.beneficiary,
          amount: Number(data.amount),
        };

        const buyAirtime = await customNetwork({
          method: "POST",
          path: "pay",
          requestBody: payload,
          target: "vtpass",
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });
        console.log(buyAirtime.data.content.transactions);
        if (
          buyAirtime.data.code === "000" &&
          buyAirtime.data.content.transactions.status === "delivered"
        ) {
          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "delivered",
            },
          });
          return ctx.created({ message: "Successful" });
        } else if (
          buyAirtime.data.code === "000" &&
          buyAirtime.data.content.transactions.status !== "delivered"
        ) {
          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "processing",
            },
          });
          return ctx.created({ message: "Successful" });
          // const status = requeryTransaction({
          //   requeryParams: data.request_id,
          // });
        } else if (buyAirtime.data.code === "099") {
          const status = requeryTransaction({
            requeryParams: data.request_id,
          });
          console.log(status);
          if (status.code === "000") {
            await strapi.query("api::airtime-order.airtime-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "Successful",
              },
            });
            return ctx.created({ message: "Successful" });
          } else {
            // get latest user's details snapshot from database
            const user = await strapi
              .query("plugin::users-permissions.user")
              .findOne({
                where: { id: id },
              });
            // update latest user's details (refund user exact amount debited before)

            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
            await strapi.query("api::airtime-order.airtime-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "Failed",
              },
            });
            return ctx.serviceUnavailable(
              "Sorry something came up from network"
            );
          }
        } else {
          // get latest user's details snapshot from database
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({
              where: { id: id },
            });
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance + Number(data.amount),
            },
          });

          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "Failed",
            },
          });
          console.log(buyAirtime);

          return ctx.throw(400, buyAirtime?.data?.response_description);
        }
      } catch (error) {
        await strapi.query("api::airtime-order.airtime-order").update({
          where: { request_id: data.request_id },
          data: {
            status: "Failed",
          },
        });
        console.log(error);
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
