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
  "api::exam-pin-order.exam-pin-order",
  ({ strapi }) => ({
    /**
     * Mobile endpoint for purchasing exam pins
     * @param {Object} ctx
     * @returns
     */
    async mobileBuyExamPin(ctx) {
      const {
        serviceID,
        request_id,
        amount,
        phone,
        variation_code,
        authMethod,
        transactionPin,
        biometricToken,
      } = ctx.request.body;
      const { id } = ctx.state.user;

      // Validate required fields
      if (!serviceID || !request_id || !amount || !phone || !variation_code) {
        return ctx.badRequest(
          "Missing required fields: serviceID, request_id, amount, phone, variation_code"
        );
      }

      if (!authMethod || (authMethod !== "pin" && authMethod !== "biometric")) {
        return ctx.badRequest(
          "Invalid authMethod. Must be 'pin' or 'biometric'"
        );
      }

      // Get user
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (!user) {
        return ctx.unauthorized("User not found");
      }

      // Check balance
      if (user.AccountBalance < Number(amount) || user.AccountBalance === 0) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }

      // Validate authentication
      if (authMethod === "pin") {
        if (!transactionPin) {
          return ctx.badRequest("Transaction PIN is required");
        }
        const validPin = await getService("user").validatePassword(
          transactionPin,
          user.pin
        );
        if (!validPin) {
          return ctx.badRequest("Incorrect PIN");
        }
      } else if (authMethod === "biometric") {
        if (!biometricToken) {
          return ctx.badRequest("Biometric token is required");
        }
        // Add biometric validation logic here if needed
      }

      try {
        // Create order record with previous balance
        const newOrder = await strapi
          .service("api::exam-pin-order.exam-pin-order")
          .create({
            data: {
              serviceID,
              request_id,
              amount,
              phone,
              variation_code,
              user: id,
              current_balance: user.AccountBalance,
              previous_balance: user.AccountBalance,
              status: "pending",
            },
          });

        // Deduct balance
        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(amount),
            },
          });

        // Call VTPass API
        const purchaseExamPin = await customNetwork({
          method: "POST",
          path: "pay",
          requestBody: {
            serviceID,
            request_id,
            amount: Number(amount),
            phone: phone.toString(),
            variation_code,
          },
          target: "vtpass",
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });

        console.log("VTPass Exam Pin Response:", purchaseExamPin.data);

        // Handle success
        if (purchaseExamPin.data.code === "000") {
          await strapi.query("api::exam-pin-order.exam-pin-order").update({
            where: { request_id: request_id },
            data: {
              status: "successful",
              purchased_pin: purchaseExamPin.data.purchased_code,
              current_balance: updatedUser.AccountBalance,
            },
          });

          return ctx.send({
            success: true,
            message: "Exam pin purchased successfully",
            data: {
              reference: request_id,
              amount: amount,
              serviceID: serviceID,
              phone: phone,
              variation_code: variation_code,
              pins: purchaseExamPin.data.purchased_code,
              balance: updatedUser.AccountBalance,
            },
          });
        }
        // Handle pending/requery
        else if (purchaseExamPin.data.code === "099") {
          const requeryResult = await requeryTransaction({
            requeryParams: request_id,
          });

          if (requeryResult.code === "000" || requeryResult.code === "099") {
            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: request_id },
              data: {
                status: "successful",
                purchased_pin:
                  requeryResult.purchased_code ||
                  purchaseExamPin.data.purchased_code,
                current_balance: updatedUser.AccountBalance,
              },
            });

            return ctx.send({
              success: true,
              message: "Exam pin purchased successfully",
              data: {
                reference: request_id,
                amount: amount,
                serviceID: serviceID,
                phone: phone,
                variation_code: variation_code,
                pins:
                  requeryResult.purchased_code ||
                  purchaseExamPin.data.purchased_code,
                balance: updatedUser.AccountBalance,
              },
            });
          } else {
            // Refund using previous_balance
            const orderRecord = await strapi
              .query("api::exam-pin-order.exam-pin-order")
              .findOne({ where: { request_id: request_id } });

            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: orderRecord.previous_balance,
              },
            });

            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: request_id },
              data: {
                status: "failed",
                current_balance: orderRecord.previous_balance,
              },
            });

            return ctx.throw(400, "Transaction failed after requery");
          }
        }
        // Handle failure
        else {
          // Refund using previous_balance
          const orderRecord = await strapi
            .query("api::exam-pin-order.exam-pin-order")
            .findOne({ where: { request_id: request_id } });

          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: orderRecord.previous_balance,
            },
          });

          await strapi.query("api::exam-pin-order.exam-pin-order").update({
            where: { request_id: request_id },
            data: {
              status: "failed",
              current_balance: orderRecord.previous_balance,
            },
          });

          return ctx.throw(
            400,
            purchaseExamPin?.data?.response_description || "Transaction failed"
          );
        }
      } catch (error) {
        console.error("Error purchasing exam pin:", error);

        // Refund on error
        try {
          const orderRecord = await strapi
            .query("api::exam-pin-order.exam-pin-order")
            .findOne({ where: { request_id: request_id } });

          if (orderRecord && orderRecord.previous_balance) {
            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: orderRecord.previous_balance,
              },
            });

            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: request_id },
              data: {
                status: "failed",
                current_balance: orderRecord.previous_balance,
              },
            });
          }
        } catch (refundError) {
          console.error("Error during refund:", refundError);
        }

        throw new ApplicationError("Something went wrong, please try again");
      }
    },

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
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }

      try {
        if (data) {
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
            .service("api::exam-pin-order.exam-pin-order")
            .create(newOrder);

          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
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
          console.log(purchaseExamPin.data.purchased_code);

          if (purchaseExamPin.data.code === "000") {
            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "sucessful",
                purchased_pin: purchaseExamPin.data.purchased_code,
                current_balance: updatedUser.AccountBalance,
              },
            });
            return ctx.created({
              message:
                "Successful, copy your pin and serial number below or view history to fetch the purchased pin",
              data: purchaseExamPin.data.purchased_code,
            });
          } else if (purchaseExamPin.data.code === "099") {
            const status = requeryTransaction({
              requeryParams: data.request_id,
            });
            if (status.code === "000" || status.code === "099") {
              await strapi.query("api::exam-pin-order.exam-pin-order").update({
                where: { request_id: data.request_id },
                data: {
                  status: "sucessful",
                  purchased_pin: purchaseExamPin.data.purchased_code,
                  current_balance: updatedUser.AccountBalance,
                },
              });
              return ctx.created({
                message:
                  "Successful, copy your pin and serial number below or view history to fetch the purchased pin",
                data: purchaseExamPin.data.purchased_code,
              });
            } else {
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
              await strapi.query("api::exam-pin-order.exam-pin-order").update({
                where: { request_id: data.request_id },
                data: {
                  status: "failed",
                  current_balance: updatedUser.AccountBalance,
                },
              });
              return ctx.serviceUnavailable("Sorry something came up");
            }
          } else {
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
            await strapi.query("api::exam-pin-order.exam-pin-order").update({
              where: { request_id: data.request_id },
              data: {
                status: "failed",
                current_balance: updatedUser.AccountBalance,
              },
            });
            return ctx.throw(400, purchaseExamPin?.data?.response_description);
          }
        } else {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi.query("api::exam-pin-order.exam-pin-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "failed",
              current_balance: user.AccountBalance,
            },
          });
          return ctx.badRequest(purchaseExamPin.data.content.error);
        }
      } catch (error) {
        console.log(error);
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { id: id } });
        await strapi.query("api::exam-pin-order.exam-pin-order").update({
          where: { request_id: data.request_id },
          data: {
            status: "failed",
            current_balance: user.AccountBalance,
          },
        });
        throw new ApplicationError("something went wrong, try again");
      }
    },
  })
);
