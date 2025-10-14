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
  "api::tvcables-order.tvcables-order",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async verifyDetails(ctx) {
      const data = ctx.request.body;
      console.log(data);
      const verifyParams = {
        billersCode: `${data.billersCode}`,
        serviceID: `${data.serviceID}`,
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
      const verifyParams = {
        billersCode: `${data.billersCode}`,
        serviceID: `${data.serviceID}`,
      };

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
          const { pin, ...restofdata } = data;
          const newOrder = { data: { ...restofdata, user: id } };
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
          const makepurchasepayload = { ...restofdata };
          const makeCablePurchase = await customNetwork({
            method: "POST",
            path: "pay",
            requestBody: makepurchasepayload,
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
            if (status.code === "000" || status.code === "099") {
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
              400,
              makeCablePurchase?.data?.response_description
            );
          }
        } else {
          return ctx.badRequest(verifiedDetails.data?.content?.error);
        }
      } catch (error) {
        console.log(error);
        throw new ApplicationError("Sorry, Something went wrong");
      }
    },

    /**
     * Mobile buy cable/TV subscription handler
     * Handles TV/Cable purchases from mobile app with transactionPin authentication
     * @param {Object} ctx - Koa context
     * @returns {Object} - Purchase response
     */
    async mobileBuyCable(ctx) {
      try {
        const {
          serviceID,
          request_id,
          billersCode,
          amount,
          phone,
          variation_code,
          subscription_type,
          authMethod,
          transactionPin,
          biometricToken,
        } = ctx.request.body;

        // Validate required fields
        if (
          !serviceID ||
          !request_id ||
          !billersCode ||
          !amount ||
          !phone ||
          !variation_code ||
          !subscription_type ||
          !authMethod
        ) {
          return ctx.badRequest("Missing required fields");
        }

        // Get current user
        const user = ctx.state.user;
        if (!user) {
          return ctx.badRequest("Authentication required");
        }

        // Get user details
        const userDetails = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { id: user.id } });

        if (!userDetails) {
          return ctx.badRequest("User not found");
        }

        // Check wallet balance
        if (userDetails.AccountBalance < Number(amount)) {
          return ctx.badRequest(
            "Insufficient wallet balance. Please fund your wallet."
          );
        }

        // Validate phone number
        if (phone.trim().length !== 11) {
          return ctx.badRequest(
            "Invalid phone number. Please use this format: 08011111111"
          );
        }

        // Validate authentication method
        if (authMethod === "pin") {
          if (!transactionPin) {
            return ctx.badRequest("PIN is required for PIN authentication");
          }

          // Check if user has a transaction PIN set
          if (!userDetails.transactionPin) {
            return ctx.badRequest(
              "Please set up a transaction PIN in your profile settings"
            );
          }

          const validPin = await getService("user").validatePassword(
            transactionPin,
            userDetails.transactionPin
          );
          if (!validPin) {
            return ctx.badRequest("Incorrect Pin");
          }
        } else if (authMethod === "biometric") {
          if (!biometricToken) {
            return ctx.badRequest(
              "Biometric token is required for biometric authentication"
            );
          }
          // Note: Biometric validation would be implemented here
          // For now, we'll accept any non-empty token
        } else {
          return ctx.badRequest(
            "Invalid authentication method. Use 'pin' or 'biometric'"
          );
        }

        // Verify decoder/card number with VTPass
        const verifyParams = {
          billersCode: `${billersCode}`,
          serviceID: `${serviceID}`,
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

        console.log("Cable verification response:", verifiedDetails);

        if (verifiedDetails.data?.content?.error) {
          return ctx.badRequest(
            verifiedDetails.data.content.error ||
              "Unable to verify decoder/card number"
          );
        }

        // Create order record
        const newOrder = {
          data: {
            serviceID,
            request_id,
            billersCode,
            amount: String(amount),
            phone,
            variation_code,
            subscription_type,
            previous_balance: userDetails.AccountBalance,
            current_balance: userDetails.AccountBalance,
            status: "pending",
            user: user.id,
          },
        };

        await strapi
          .service("api::tvcables-order.tvcables-order")
          .create(newOrder);

        // Update user balance
        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: {
              AccountBalance: userDetails.AccountBalance - Number(amount),
            },
          });

        // Make API call to purchase cable/TV subscription (using VTPass)
        const purchasePayload = {
          serviceID,
          request_id,
          billersCode,
          amount: String(amount),
          phone,
          variation_code,
          subscription_type,
        };

        const makeCablePurchase = await customNetwork({
          method: "POST",
          path: "pay",
          requestBody: purchasePayload,
          target: "vtpass",
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });

        console.log("Cable purchase response:", makeCablePurchase);

        // Handle response codes
        if (makeCablePurchase.data.code === "000") {
          // Success
          await strapi.query("api::tvcables-order.tvcables-order").update({
            where: { request_id: request_id },
            data: {
              status: "delivered",
              current_balance: updatedUser.AccountBalance,
            },
          });

          return ctx.send({
            message:
              makeCablePurchase.data.response_description ||
              `Successfully purchased ${serviceID.toUpperCase()} subscription. Please check your transaction history.`,
            success: true,
            data: {
              reference: request_id,
              amount: amount,
              serviceID: serviceID,
              billersCode: billersCode,
              variation_code: variation_code,
              subscription_type: subscription_type,
              balance: updatedUser.AccountBalance,
              customerName: verifiedDetails.data?.content?.Customer_Name || "",
            },
          });
        } else if (makeCablePurchase.data.code === "099") {
          // Transaction pending - try to requery
          try {
            const status = await requeryTransaction({
              requeryParams: request_id,
            });

            if (status.code === "000" || status.code === "099") {
              await strapi.query("api::tvcables-order.tvcables-order").update({
                where: { request_id: request_id },
                data: {
                  status: "delivered",
                  current_balance: updatedUser.AccountBalance,
                },
              });

              return ctx.send({
                message: "Transaction successful after verification",
                success: true,
                data: {
                  reference: request_id,
                  amount: amount,
                  serviceID: serviceID,
                  billersCode: billersCode,
                  balance: updatedUser.AccountBalance,
                },
              });
            } else {
              // Refund user
              const refundedUser = await strapi
                .query("plugin::users-permissions.user")
                .update({
                  where: { id: user.id },
                  data: {
                    AccountBalance: userDetails.AccountBalance,
                  },
                });

              await strapi.query("api::tvcables-order.tvcables-order").update({
                where: { request_id: request_id },
                data: {
                  status: "failed",
                  current_balance: refundedUser.AccountBalance,
                },
              });

              return ctx.badRequest(
                "Transaction failed after verification. Your account has been refunded."
              );
            }
          } catch (requeryError) {
            console.error("Requery error:", requeryError);
            return ctx.badRequest(
              "Transaction is pending. Please check your transaction history."
            );
          }
        } else {
          // Failed - Refund user
          const refundedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: user.id },
              data: {
                AccountBalance: userDetails.AccountBalance, // Restore original balance
              },
            });

          await strapi.query("api::tvcables-order.tvcables-order").update({
            where: { request_id: request_id },
            data: {
              status: "failed",
              current_balance: refundedUser.AccountBalance,
            },
          });

          const errorMessage =
            makeCablePurchase?.data?.response_description ||
            "Cable/TV subscription purchase failed. Please try again.";
          return ctx.badRequest(errorMessage);
        }
      } catch (error) {
        console.error("Mobile cable purchase error:", error);

        // Try to refund user if order was created
        if (ctx.request.body.request_id) {
          try {
            const user = ctx.state.user;

            // Get the order to retrieve the original balance
            const order = await strapi
              .query("api::tvcables-order.tvcables-order")
              .findOne({ where: { request_id: ctx.request.body.request_id } });

            if (order) {
              // Restore the original balance from the order record
              await strapi.query("plugin::users-permissions.user").update({
                where: { id: user.id },
                data: {
                  AccountBalance: order.previous_balance,
                },
              });

              await strapi.query("api::tvcables-order.tvcables-order").update({
                where: { request_id: ctx.request.body.request_id },
                data: {
                  status: "failed",
                  current_balance: order.previous_balance,
                },
              });
            }
          } catch (refundError) {
            console.error("Cable refund error:", refundError);
          }
        }

        return ctx.internalServerError(
          "Something went wrong. Please try again later."
        );
      }
    },
  })
);
