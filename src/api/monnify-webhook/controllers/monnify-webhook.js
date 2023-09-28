"use strict";

const { sha512 } = require("js-sha512");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");

/**
 *  monnify-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::monnify-webhook.monnify-webhook",
  ({ strapi }) => ({
    /**
     * accept webhook from Credo about payment status
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const reqBody = ctx.request.body;

      const reqHeaders = ctx.request.headers;
      console.log(reqHeaders);

      const headerSignature = reqHeaders["monnify-signature"];
      //   const shaVal = sha512(
      //     `${process.env.MONNIFY_SECRET_KEY}'${JSON.stringify(reqBody)}'`
      //   );
      //   console.log(calculateTransactionHash(`${JSON.stringify(reqBody)}`));
      // TODO: calculate transaction hash
      const hashRes = await calculateTransactionHash(
        `${JSON.stringify(reqBody)}`
      );
      if (hashRes === headerSignature) {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { email: reqBody.eventData.customer.email },
          });

        const payload = {
          data: {
            status:
              reqBody.eventData.paymentStatus.toLowerCase() === "paid"
                ? "successful"
                : "failed",
            amount: Number(reqBody.eventData.amountPaid),
            // trx_id: reqBody.data.transRef,
            tx_ref: reqBody.eventData.paymentReference,

            currency: reqBody.eventData.currency,

            payment_method: reqBody.eventData.paymentMethod,
            date_time: reqBody.eventData.paidOn,
            payer_email: reqBody.eventData.customer.email,
          },
        };

        try {
          await strapi
            .service("api::monnify-webhook.monnify-webhook")
            .create(payload);
          if (reqBody.eventData.paymentStatus.toLowerCase() === "paid") {
            console.log("verifying payment...");
            const res = await strapi
              .query("api::account-funding.account-funding")
              .findOne({
                where: { tx_ref: reqBody.eventData.paymentReference },
              });
            console.log("res: ", res);
            const updatedUser = await strapi
              .query("plugin::users-permissions.user")
              .update({
                where: { id: user.id },
                data: {
                  AccountBalance: user.AccountBalance + Number(res.amount),
                },
              });
            await strapi.query("api::account-funding.account-funding").update({
              where: { tx_ref: reqBody.eventData.paymentReference },
              data: {
                status: "Success",
                // transaction_id: reqBody.data.id.toString(),
                current_balance: updatedUser.AccountBalance,
              },
            });
          }
        } catch (error) {
          console.log(error);
        } finally {
          return ctx.send(
            {
              message: "success",
            },
            200
          );
        }
      } else {
        return ctx.send(
          {
            message: "bad request",
          },
          400
        );
      }
    },
  })
);
