"use strict";

const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const customNetwork = require("../../../utils/customNetwork");
const { base64encode } = require("nodejs-base64");
const requeryTransaction = require("../../../utils/vtpass/requeryTransaction");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");

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

    async verifyMeter(ctx) {
      const data = ctx.request.body;
      console.log(data);
      const verifyParams = {
        billersCode: `${data.billersCode}`,
        serviceID: `${data.serviceID}`,
        type: `${data.variation_code}`,
      };
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
        return verifiedDetails.data.content;
      }
      return ctx.badRequest(verifiedDetails.data?.content?.error);
    },

    async create(ctx) {
      const { data } = ctx.request.body;
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });
      const verifyParams = {
        billersCode: `${data.billersCode}`,
        serviceID: `${data.serviceID}`,
        type: `${data.variation_code}`,
      };
      console.log(verifyParams);

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
          // fetch latest user detais from database
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({
              where: { id: id },
            });
        
          const { pin, ...restofdata } = data;
          const newOrder = { data: { ...restofdata, user: id, current_balance:user.AccountBalance, previous_balance:user.AccountBalance } };

          await strapi
            .service("api::electricity-order.electricity-order")
            .create(newOrder);

  // update latest user's details (debit user's account)
 const updatedUser = await strapi.query("plugin::users-permissions.user").update({
    where: { id: user.id },
    data: {
      AccountBalance: user.AccountBalance - Number(data.amount),
    },
  });       
             const { amount, phone, ...payload } = restofdata;
             const makePurchaseParams = {
             amount: Number(amount),
             phone: Number(phone),
            ...payload,
          };

          const makeElectricityPurchase = await customNetwork({
            method: "POST",
            path: "pay",
            requestBody: makePurchaseParams,
            target: "vtpass",
            headers: {
              Authorization: `Basic ${base64encode(
                `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
              )}`,
            },
          });
          console.log(makeElectricityPurchase);
          console.log(makeElectricityPurchase.data.content.transactions);

          if (makeElectricityPurchase.data.code === "000") {
            await strapi
              .query("api::electricity-order.electricity-order")
              .update({
                where: { request_id: data.request_id },
                data: {
                  status: "Successful",
                  purchased_token: makeElectricityPurchase.data.purchased_code,
                  current_balance:updatedUser.AccountBalance
                },
              });
            return ctx.created({
              message:
                "Successful, copy your token  below and enter into your meter or view history to fetch the purchased token",
              data: makeElectricityPurchase.data.purchased_code,
            });
          } else if (makeElectricityPurchase.data.code === "099") {
            const status = requeryTransaction({
              requeryParams: data.request_id,
            });
            if (status.code === "000" || status.code === "099") {
              await strapi
                .query("api::electricity-order.electricity-order")
                .update({
                  where: { request_id: data.request_id },
                  data: {
                    status: "Successful",
                    purchased_token:
                      makeElectricityPurchase.data.purchased_code,
                      current_balance:updatedUser.AccountBalance
                  },
                });
              return ctx.created({
                message:
                  "Successful, copy your token  below and enter into your meter or view history to fetch the purchased token",
                data: makeElectricityPurchase.data.purchased_code,
              });
            } else {
              // get latest user's details snapshot from database
              const user = await strapi
                .query("plugin::users-permissions.user")
                .findOne({
                  where: { id: id },
                });
              // update latest user's details (refund user exact amount debited before)

            const updatedUser =   await strapi.query("plugin::users-permissions.user").update({
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
                    current_balance:updatedUser.AccountBalance
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
        const updatedUser = await strapi.query("plugin::users-permissions.user").update({
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
                  current_balance:updatedUser.AccountBalance
                },
              });

            return ctx.throw(
              400,
              makeElectricityPurchase?.data?.response_description
            );
          }
        } else {
          const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: id },
          });
          await strapi
          .query("api::electricity-order.electricity-order")
          .update({
            where: { request_id: data.request_id },
            data: {
              status: "Failed",
              current_balance:user.AccountBalance
            },
          });

          return ctx.badRequest(verifiedDetails.data.content.error);
        }
      } catch (error) {
        console.log(error);
        const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: id },
        });
        await strapi
        .query("api::electricity-order.electricity-order")
        .update({
          where: { request_id: data.request_id },
          data: {
            status: "Failed",
            current_balance:user.AccountBalance
          },
        });
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
