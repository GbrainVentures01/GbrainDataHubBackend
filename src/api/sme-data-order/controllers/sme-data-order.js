"use strict";

/**
 *  data-order controller
 */
const randomString = require("randomstring");
const customNetwork = require("../../../utils/customNetwork");
const { createCoreController } = require("@strapi/strapi").factories;
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const checkduplicate = require("../../../utils/checkduplicate");

// ✅ PHASE 3: Import notification triggers for mobile data transactions
const {
  sendPaymentSuccessNotification,
  sendPaymentFailureNotification,
  sendTransactionConfirmationNotification,
  sendLowBalanceAlert,
} = require("../../../utils/notification-triggers");

module.exports = createCoreController(
  "api::sme-data-order.sme-data-order",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async findMe(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.badRequest(null, [
          { messages: [{ id: "No authorization header was found" }] },
        ]);
      }

      const data = await strapi
        .service("api::sme-data-order.sme-data-order")
        .find({ user: user.id });

      if (!data) {
        return ctx.notFound();
      }

      ctx.send(data);
      // return this.transformResponse(sanitizedEntity);
    },
    // find all data orders
    async find(ctx) {
      let entities;

      entities = await strapi
        .service("api::sme-data-order.sme-data-order")
        .find();

      const sanitizedEntity = await this.sanitizeOutput(entities, ctx);
      return ctx.send(this.transformResponse(sanitizedEntity));

      // return this.transformResponse(sanitizedEntity);
    },

    //find a data order
    async findOne(ctx) {
      const { id } = ctx.params;

      const entity = await strapi
        .service("api::sme-data-order.sme-data-order")
        .findOne({
          where: {
            id: id,
          },
        });
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return ctx.send(this.transformResponse(sanitizedEntity));
    },

    async create(ctx) {
      const { data } = ctx.request.body;

      const { id } = ctx.state.user;
      if (
        await checkduplicate(id, data, "api::sme-data-order.sme-data-order")
      ) {
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
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }
      const ref = `OGD|88|${randomString.generate(8)}`;
      const dataBasePayload = {
        user: id,
        ref: ref,
        beneficiary: data.beneficiary,
        network: data.network,
        plan: data.plan.Plan,
        amount: data.amount,
        previous_balance: user.AccountBalance,
        current_balance: user.AccountBalance,
      };
      const newOrder = {
        data: { ...dataBasePayload },
      };
      await strapi
        .service("api::sme-data-order.sme-data-order")
        .create(newOrder);

      const updatedUser = await strapi
        .query("plugin::users-permissions.user")
        .update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(data.amount),
          },
        });

      const returnNetId = (network) => {
        switch (network) {
          case "Mtn":
            return 1;
          case "Airtel":
            return 2;
          case "Glo":
            return 3;

          default:
            break;
        }
      };
      const payload = {
        networkId: returnNetId(data.network),
        planId: data.plan.plan_id,
        phoneNumber: data.beneficiary,
        reference: ref,
      };
      try {
        const res = await customNetwork({
          method: "POST",
          target: "ogdams",
          path: "vend/data",
          requestBody: payload,
          headers: { Authorization: `Bearer ${process.env.OGDAMS_API_KEY}` },
        });
        console.log(res);
        if (res.data.code === 200) {
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "delivered",
              current_balance: updatedUser.AccountBalance,
            },
          });
          return ctx.send({
            data: {
              message: `Transaction Successful, kindly check your balance.`,
            },
          });
        } else if (res.data.code === 202) {
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "processing",
              current_balance: updatedUser.AccountBalance,
            },
          });
          return ctx.send({ data: { message: `${res.data.data.msg}` } });
        } else if (res.data.code === 201) {
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "processing ",
              current_balance: updatedUser.AccountBalance,
            },
          });
          return ctx.send({ data: { message: `${res.data.data.msg}` } });
        } else if (res.data.code === 424) {
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
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "failed",
              current_balance: updatedUser.AccountBalance,
            },
          });

          ctx.throw(503, "Sorry transaction was not succesful");
        } else {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({
              where: { id: id },
            });
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: ref },
            data: {
              status: "failed",
              current_balance: user.AccountBalance,
            },
          });
          ctx.throw(500, "Something went wrong");
        }
      } catch (error) {
        console.log(error);
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: id },
          });
        await strapi.query("api::sme-data-order.sme-data-order").update({
          where: { ref: ref },
          data: {
            status: "failed",
            current_balance: user.AccountBalance,
          },
        });
        throw new ApplicationError("something went wrong, try again");
      }
    },

    /**
     * Mobile buy SME data handler
     * Handles SME data purchases from mobile app with transactionPin authentication
     * @param {Object} ctx - Koa context
     * @returns {Object} - Purchase response
     */
    async mobileBuyData(ctx) {
      try {
        const {
          request_id,
          network_id,
          plan_id,
          beneficiary,
          amount,
          plan,
          network,
          authMethod,
          pin,
          biometricToken,
        } = ctx.request.body;

        // Validate required fields
        if (
          !request_id ||
          !network_id ||
          !plan_id ||
          !beneficiary ||
          !amount ||
          !plan ||
          !network ||
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

        // Check for duplicate transactions
        const isDuplicate = await checkduplicate(
          user.id,
          { request_id: request_id, beneficiary, amount, plan_id },
          "api::sme-data-order.sme-data-order"
        );

        if (isDuplicate) {
          return ctx.badRequest(
            "Possible duplicate transaction. Please check your history or try again after 90 seconds."
          );
        }

        // Check wallet balance
        if (userDetails.AccountBalance < Number(amount)) {
          return ctx.badRequest(
            "Insufficient wallet balance. Please fund your wallet."
          );
        }

        // Validate beneficiary phone number
        if (beneficiary.trim().length !== 11) {
          return ctx.badRequest(
            "Invalid phone number. Please use this format: 08011111111"
          );
        }

        // Validate authentication method
        if (authMethod === "pin") {
          if (!pin) {
            return ctx.badRequest("PIN is required for PIN authentication");
          }

          // Check if user has a transaction PIN set
          if (!userDetails.transactionPin) {
            return ctx.badRequest(
              "Please set up a transaction PIN in your profile settings"
            );
          }

          const validPin = await getService("user").validatePassword(
            pin,
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

        // Helper function to convert network name to network ID
        const returnNetId = (networkName) => {
          switch (networkName.toLowerCase()) {
            case "mtn":
              return 1;
            case "airtel":
              return 2;
            case "glo":
              return 3;
            case "9mobile":
              return 4;
            default:
              return null;
          }
        };

        // Create order record
        const newOrder = {
          data: {
            network,
            beneficiary,
            plan,
            amount: Number(amount),
            ref: request_id,
            previous_balance: userDetails.AccountBalance,
            current_balance: userDetails.AccountBalance,
            status: "pending",
            user: user.id,
          },
        };

        await strapi
          .service("api::sme-data-order.sme-data-order")
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

        // Make API call to purchase SME data (using OGDAMS)
        const payload = {
          networkId: returnNetId(network),
          planId: plan_id,
          phoneNumber: beneficiary,
          reference: request_id,
        };

        const res = await customNetwork({
          method: "POST",
          target: "ogdams",
          path: "vend/data",
          requestBody: payload,
          headers: { Authorization: `Bearer ${process.env.OGDAMS_API_KEY}` },
        });

        console.log("SME data purchase response:", res);

        // Handle different response codes from OGDAMS
        if (res.data.code === 200) {
          // Success
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: request_id },
            data: {
              status: "delivered",
              current_balance: updatedUser.AccountBalance,
            },
          });

          // ✅ PHASE 3: Send payment success notification for mobile
          try {
            await sendPaymentSuccessNotification(
              userDetails,
              {
                amount: amount,
                reference: request_id,
              },
              "data"
            );
          } catch (notificationError) {
            console.error("Failed to send success notification:", notificationError);
          }

          // ✅ Check for low balance and send alert
          if (updatedUser.AccountBalance < 1000) {
            try {
              await sendLowBalanceAlert(userDetails, updatedUser.AccountBalance);
            } catch (notificationError) {
              console.error("Failed to send low balance alert:", notificationError);
            }
          }

          return ctx.send({
            message:
              res.data?.data?.msg ||
              `Successfully purchased ${plan} for ${beneficiary}. Please check your transaction history.`,
            success: true,
            data: {
              reference: request_id,
              amount: amount,
              beneficiary: beneficiary,
              plan: plan,
              network: network,
              balance: updatedUser.AccountBalance,
            },
          });
        } else if (res.data.code === 202 || res.data.code === 201) {
          // Processing
          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: request_id },
            data: {
              status: "processing",
              current_balance: updatedUser.AccountBalance,
            },
          });

          // ✅ PHASE 3: Send transaction confirmation for mobile
          try {
            await sendTransactionConfirmationNotification(userDetails, {
              amount: amount,
              reference: request_id,
              description: `Data purchase for ${beneficiary} on ${network}`,
              id: request_id,
            });
          } catch (notificationError) {
            console.error("Failed to send confirmation notification:", notificationError);
          }

          return ctx.send({
            message:
              res.data?.data?.msg ||
              "Transaction is being processed. Please check your transaction history.",
            success: true,
            data: {
              reference: request_id,
              amount: amount,
              beneficiary: beneficiary,
              plan: plan,
              network: network,
              balance: updatedUser.AccountBalance,
              status: "processing",
            },
          });
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

          await strapi.query("api::sme-data-order.sme-data-order").update({
            where: { ref: request_id },
            data: {
              status: "failed",
              current_balance: refundedUser.AccountBalance,
            },
          });

          // ✅ PHASE 3: Send payment failure notification for mobile
          try {
            const errorDescription = res.data?.data?.msg || res.data?.message || 'Data purchase failed';
            await sendPaymentFailureNotification(
              userDetails,
              { amount: amount, reference: request_id },
              'data',
              `${errorDescription}. Amount has been refunded to your account.`
            );
          } catch (notificationError) {
            console.error("Failed to send failure notification:", notificationError);
          }

          const errorMessage =
            res.data?.data?.msg ||
            res.data?.message ||
            "Data purchase failed. Please try again.";
          return ctx.badRequest(errorMessage);
        }
      } catch (error) {
        console.error("Mobile SME data purchase error:", error);

        // Try to refund user if order was created
        if (ctx.request.body.request_id) {
          try {
            const user = ctx.state.user;

            // Get the order to retrieve the original balance
            const order = await strapi
              .query("api::sme-data-order.sme-data-order")
              .findOne({ where: { ref: ctx.request.body.request_id } });

            if (order) {
              // Restore the original balance from the order record
              const refundedUser = await strapi.query("plugin::users-permissions.user").update({
                where: { id: user.id },
                data: {
                  AccountBalance: order.previous_balance,
                },
              });

              await strapi.query("api::sme-data-order.sme-data-order").update({
                where: { ref: ctx.request.body.request_id },
                data: {
                  status: "failed",
                  current_balance: order.previous_balance,
                },
              });

              // ✅ PHASE 3: Send payment failure notification for mobile
              try {
                await sendPaymentFailureNotification(
                  refundedUser,
                  { amount: ctx.request.body.amount, reference: ctx.request.body.request_id },
                  'data',
                  'An unexpected error occurred. Please contact support if the issue persists.'
                );
              } catch (notificationError) {
                console.error("Failed to send failure notification:", notificationError);
              }
            }
          } catch (refundError) {
            console.error("SME refund error:", refundError);
          }
        }

        return ctx.internalServerError(
          "Something went wrong. Please try again later."
        );
      }
    },
  })
);
