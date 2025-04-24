"use strict";

const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const customNetwork = require("../../../utils/customNetwork");
const { base64encode } = require("nodejs-base64");
const requeryTransaction = require("../../../utils/vtpass/requeryTransaction");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const checkduplicate = require("../../../utils/checkduplicate");

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
      if (await checkduplicate(id, data, "api::airtime-order.airtime-order")) {
        return ctx.badRequest(
          "Possible Duplicate Transaction, Kindly check the history before retrying or try again after 90 seconds."
        );
      }
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

      try {
        const { pin, ...restofdata } = data;
        const newOrder = {
          data: {
            ...restofdata,
            user: id,
            current_balance: user.AccountBalance,
            previous_balance: user.AccountBalance,
          },
        };
        await strapi
          .service("api::airtime-order.airtime-order")
          .create(newOrder);

        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(data.amount),
            },
          });

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
              current_balance: updatedUser.AccountBalance,
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
              current_balance: updatedUser.AccountBalance,
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
          if (status.code === "000" || status.code === "099") {
            await strapi.query("api::airtime-order.airtime-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "delivered",
                current_balance: updatedUser.AccountBalance,
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

            const updatedUser = await strapi
              .query("plugin::users-permissions.user")
              .update({
                where: { id: user.id },
                data: {
                  AccountBalance: user.AccountBalance + Number(data.amount),
                },
              });
            await strapi.query("api::airtime-order.airtime-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "failed",
                current_balance: updatedUser.AccountBalance,
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
          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });

          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "failed",
              current_balance: updatedUser.AccountBalance,
            },
          });
          console.log(buyAirtime);

          return ctx.throw(400, buyAirtime?.data?.response_description);
        }
      } catch (error) {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: id },
          });
        await strapi.query("api::airtime-order.airtime-order").update({
          where: { request_id: data.request_id },
          data: {
            status: "failed",
            current_balance: user.AccountBalance,
          },
        });
        console.log(error);
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
