"use strict";

const { ApplicationError } = require("@strapi/utils/lib/errors");
const { HttpError } = require("koa");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const customNetwork = require("../../../utils/customNetwork");
const checkduplicate = require("../../../utils/checkduplicate");

/**
 *  data-gifting-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::data-gifting-order.data-gifting-order",
  ({ strapi }) => ({
    /**
     * return create data gfiting order and associating with current logged in user
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const { data } = ctx.request.body;
      console.log(data);
      const { id } = ctx.state.user;

      if (
        await checkduplicate(
          id,
          data,
          "api::data-gifting-order.data-gifting-order"
        )
      ) {
        return ctx.badRequest(
          "Possible Duplicate Transaction, Kindly check the history before retrying or try again after 90 seconds."
        );
      }
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (user.AccountBalance < Number(data.amount)) {
        return ctx.badRequest("Low Wallet Balance, Please fund wallet");
      }
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }
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
        const Order = await strapi
          .service("api::data-gifting-order.data-gifting-order")
          .create(newOrder);

        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(data.amount),
            },
          });

        const payload = JSON.stringify({
          network_id: `${data.network_id}`,
          plan_id: `${data.plan_id}`,
          phone: `${data.beneficiary}`,
          // Ported_number: true,
          pin: process.env.BELLO_PIN,
        });
        console.log(payload);
        const res = await customNetwork({
          method: "POST",
          target: "bello",
          path: "data",
          requestBody: payload,
          headers: {
            Authorization: `Bearer ${process.env.BELLO_SECRET}`,
            "Content-Type": "application/json",
          },
        });

        console.log(res);

        if (res.status === 200 && res.data.status) {
          await strapi
            .query("api::data-gifting-order.data-gifting-order")
            .update({
              where: { request_id: data.request_id },
              data: {
                status: "delivered",
                ident: res.data.ident,
                current_balance: updatedUser.AccountBalance,
              },
            });
          return ctx.send({
            data: {
              message:
                // res.data.api_response  ||
                `Successful gifted ${data.plan} to ${data.beneficiary}`,
            },
          });
        } else if (!res.data.status) {
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
          await strapi
            .query("api::data-gifting-order.data-gifting-order")
            .update({
              where: { request_id: data.request_id },
              data: {
                status: "failed",
                ident: res.data.ident,
                current_balance: updatedUser.AccountBalance,
              },
            });
          console.log(res.data);
          ctx.throw(400, res.data.api_response);
        }
        // else if (
        //   res.data &&
        //   res.data.status !== "failed" &&
        //   res.data.status !== "successful"
        // ) {
        //   await strapi.query("api::data-gifting-order.data-gifting-order").update({
        //     where: { request_Id: data.request_Id },
        //     data: {
        //       status: "qeued",
        //       ident: res.data.ident,
        //     },
        //   });

        //   console.log(res.data);
        //   return ctx.send({
        //     data: { message: "pending" },
        //   });
        // }
        else {
          console.log(res.data);
          ctx.throw(500, "Transaction was not successful");
        }

        // await strapi.plugins["email"].services.email.send({
        //   to: [
        //     { email: "gbraincorpbizvent@gmail.com" },
        //     { email: "adebisidamilola6@gmail.com" },
        //   ],
        //   subject: "New Airtime Order",
        //   html: `<p>Hello, you have a new data gifting order !, kindly visit the admin pannel to see  order details </p>

        //          <h3> Regards</h3>
        //          <h3>Gbrain Coporate Ventures</h3>`,
        // });

        // return ctx.send({
        //   data: { message: "data gifting order successfully created", Order },
        // });
      } catch (error) {
        console.log(error);
        console.log("from error");
        if (error.response?.status === 400) {
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
          await strapi
            .query("api::data-gifting-order.data-gifting-order")
            .update({
              where: { request_id: data.request_id },
              data: {
                status: "failed",
                current_balance: updatedUser.AccountBalance,
              },
            });
          ctx.throw(
            400,
            "Transaction was not successful, please try again later."
          );
        } else {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi
            .query("api::data-gifting-order.data-gifting-order")
            .update({
              where: { request_id: data.request_id },
              data: {
                status: "failed",
                current_balance: user.AccountBalance,
              },
            });
          ctx.throw(500, "Something went wrong, please try again later.");
        }
      }
    },

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
          "api::data-gifting-order.data-gifting-order"
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

        // Create order record
        const newOrder = {
          data: {
            network,
            network_id: Number(network_id),
            plan,
            plan_id: Number(plan_id),
            amount: Number(amount),
            request_id: request_id,
            beneficiary,
            previous_balance: userDetails.AccountBalance,
            current_balance: userDetails.AccountBalance,
            status: "pending",
            user: user.id,
          },
        };

        await strapi
          .service("api::data-gifting-order.data-gifting-order")
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

        // Make API call to purchase data (using Bello for gifting)
        const payload = JSON.stringify({
          network_id: `${network_id}`,
          plan_id: `${plan_id}`,
          phone: `${beneficiary}`,
          pin: process.env.BELLO_PIN,
        });

        const res = await customNetwork({
          method: "POST",
          target: "bello",
          path: "data",
          requestBody: payload,
          headers: {
            Authorization: `Bearer ${process.env.BELLO_SECRET}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Gifting data purchase response:", res);

        if (res.status === 200 && res.data.status) {
          // Update order as successful
          await strapi
            .query("api::data-gifting-order.data-gifting-order")
            .update({
              where: { request_id: request_id },
              data: {
                status: "delivered",
                ident: res.data.ident,
                current_balance: updatedUser.AccountBalance,
              },
            });

          return ctx.send({
            message:
              res.data.api_response ||
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
        } else {
          // Refund user and mark order as failed
          const refundedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: user.id },
              data: {
                AccountBalance: userDetails.AccountBalance, // Restore original balance
              },
            });

          await strapi
            .query("api::data-gifting-order.data-gifting-order")
            .update({
              where: { request_id: request_id },
              data: {
                status: "failed",
                ident: res?.data?.ident || "-",
                current_balance: refundedUser.AccountBalance,
              },
            });

          const errorMessage =
            res.data?.api_response || "Data purchase failed. Please try again.";
          return ctx.badRequest(errorMessage);
        }
      } catch (error) {
        console.error("Mobile gifting data purchase error:", error);

        // Try to refund user if order was created
        if (ctx.request.body.request_id) {
          try {
            const user = ctx.state.user;

            // Get the order to retrieve the original balance
            const order = await strapi
              .query("api::data-gifting-order.data-gifting-order")
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
                .query("api::data-gifting-order.data-gifting-order")
                .update({
                  where: { request_id: ctx.request.body.request_id },
                  data: {
                    status: "failed",
                    current_balance: order.previous_balance,
                  },
                });
            }
          } catch (refundError) {
            console.error("Gifting refund error:", refundError);
          }
        }

        return ctx.internalServerError(
          "Something went wrong. Please try again later."
        );
      }
    },
  })
);
