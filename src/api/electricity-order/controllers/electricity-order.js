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
          const newOrder = {
            data: {
              ...restofdata,
              user: id,
              current_balance: user.AccountBalance,
              previous_balance: user.AccountBalance,
            },
          };

          await strapi
            .service("api::electricity-order.electricity-order")
            .create(newOrder);

          // update latest user's details (debit user's account)
          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
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
                  current_balance: updatedUser.AccountBalance,
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
                    current_balance: updatedUser.AccountBalance,
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

              const updatedUser = await strapi
                .query("plugin::users-permissions.user")
                .update({
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

            await strapi
              .query("api::electricity-order.electricity-order")
              .update({
                where: { request_id: data.request_id },
                data: {
                  status: "Failed",
                  current_balance: updatedUser.AccountBalance,
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
                current_balance: user.AccountBalance,
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
        await strapi.query("api::electricity-order.electricity-order").update({
          where: { request_id: data.request_id },
          data: {
            status: "Failed",
            current_balance: user.AccountBalance,
          },
        });
        throw new ApplicationError("something went wrong, try again");
      }
    },

    /**
     * Mobile buy electricity handler
     * Handles electricity purchases from mobile app with transactionPin authentication
     * @param {Object} ctx - Koa context
     * @returns {Object} - Purchase response with token
     */
    async mobileBuyElectricity(ctx) {
      try {
        const {
          serviceID,
          request_id,
          billersCode,
          amount,
          phone,
          variation_code,
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

        // Verify meter number with VTPass
        const verifyParams = {
          billersCode: `${billersCode}`,
          serviceID: `${serviceID}`,
          type: `${variation_code}`,
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

        console.log("Meter verification response:", verifiedDetails);

        if (verifiedDetails.data?.content?.error) {
          return ctx.badRequest(
            verifiedDetails.data.content.error ||
              "Unable to verify meter number"
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
            previous_balance: userDetails.AccountBalance,
            current_balance: userDetails.AccountBalance,
            status: "pending",
            user: user.id,
          },
        };

        await strapi
          .service("api::electricity-order.electricity-order")
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

        // Make API call to purchase electricity (using VTPass)
        const makePurchaseParams = {
          serviceID,
          request_id,
          billersCode,
          amount: Number(amount),
          phone: Number(phone),
          variation_code,
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

        console.log("Electricity purchase response:", makeElectricityPurchase);

        // Handle response codes
        if (makeElectricityPurchase.data.code === "000") {
          // Success
          await strapi
            .query("api::electricity-order.electricity-order")
            .update({
              where: { request_id: request_id },
              data: {
                status: "delivered",
                purchased_token: makeElectricityPurchase.data.purchased_code,
                current_balance: updatedUser.AccountBalance,
              },
            });

          return ctx.send({
            message:
              makeElectricityPurchase.data.response_description ||
              "Successful! Copy your token below and enter it into your meter.",
            success: true,
            data: {
              reference: request_id,
              amount: amount,
              serviceID: serviceID,
              billersCode: billersCode,
              variation_code: variation_code,
              token: makeElectricityPurchase.data.purchased_code,
              balance: updatedUser.AccountBalance,
              customerName: verifiedDetails.data?.content?.Customer_Name || "",
            },
          });
        } else if (makeElectricityPurchase.data.code === "099") {
          // Transaction pending - try to requery
          try {
            const status = await requeryTransaction({
              requeryParams: request_id,
            });

            if (status.code === "000" || status.code === "099") {
              await strapi
                .query("api::electricity-order.electricity-order")
                .update({
                  where: { request_id: request_id },
                  data: {
                    status: "delivered",
                    purchased_token:
                      makeElectricityPurchase.data.purchased_code,
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
                  token: makeElectricityPurchase.data.purchased_code,
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

              await strapi
                .query("api::electricity-order.electricity-order")
                .update({
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

          await strapi
            .query("api::electricity-order.electricity-order")
            .update({
              where: { request_id: request_id },
              data: {
                status: "failed",
                current_balance: refundedUser.AccountBalance,
              },
            });

          const errorMessage =
            makeElectricityPurchase?.data?.response_description ||
            "Electricity purchase failed. Please try again.";
          return ctx.badRequest(errorMessage);
        }
      } catch (error) {
        console.error("Mobile electricity purchase error:", error);

        // Try to refund user if order was created
        if (ctx.request.body.request_id) {
          try {
            const user = ctx.state.user;

            // Get the order to retrieve the original balance
            const order = await strapi
              .query("api::electricity-order.electricity-order")
              .findOne({ where: { request_id: ctx.request.body.request_id } });

            if (order) {
              // Restore the original balance from the order record
              await strapi.query("plugin::users-permissions.user").update({
                where: { id: user.id },
                data: {
                  AccountBalance: order.previous_balance,
                },
              });

              await strapi
                .query("api::electricity-order.electricity-order")
                .update({
                  where: { request_id: ctx.request.body.request_id },
                  data: {
                    status: "failed",
                    current_balance: order.previous_balance,
                  },
                });
            }
          } catch (refundError) {
            console.error("Electricity refund error:", refundError);
          }
        }

        return ctx.internalServerError(
          "Something went wrong. Please try again later."
        );
      }
    },
  })
);
