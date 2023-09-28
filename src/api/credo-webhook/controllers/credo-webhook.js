"use strict";

const { sha512 } = require("js-sha512");

/**
 *  credo-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::credo-webhook.credo-webhook",
  ({ strapi }) => ({
    /**
     * accept webhook from flutter wave about payment statuds
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const reqBody = ctx.request.body;
      console.log(reqBody);
      const businessCode = reqBody.data.businessCode;
      const success = "TRANSACTION.SUCCESSFUL".toLowerCase();
      console.log(success);
      const reqHeaders = ctx.request.headers;
      console.log(reqHeaders);
      const signedContent = `${process.env.CREDO_TOKEN}${businessCode}`;
      const shaVal = sha512(signedContent);
      const headerSignature = reqHeaders["x-credo-signature"];
      if (shaVal === headerSignature) {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: reqBody.data.customer.customerEmail } });

        const payload = {
          data: {
            status:
              reqBody.event.toLowerCase() === success ? "successful" : "failed",
            amount: Number(reqBody.data.debitedAmount),
            // trx_id: reqBody.data.transRef,
            tx_ref: reqBody.data.businessRef,
            credo_ref: reqBody.data.transRef,
            // currency: reqBody.data.currency,

            charged_amount: Number(reqBody.data.transFeeAmount),
            payment_method: reqBody.data.paymentMethod,
            date_time: reqBody.data.transactionDate,
            payer_email: reqBody.data.customer.customerEmail,
          },
        };

        try {
          await strapi
            .service("api::credo-webhook.credo-webhook")
            .create(payload);
          if (reqBody.event.toLowerCase() === success) {
            console.log("verifying payment...");
            const updatedUser = await strapi
              .query("plugin::users-permissions.user")
              .update({
                where: { id: user.id },
                data: {
                  AccountBalance:
                    user.AccountBalance + Number(reqBody.data.debitedAmount),
                },
              });
            await strapi.query("api::account-funding.account-funding").update({
              where: { tx_ref: reqBody.data.businessRef },
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
          ctx.send(
            {
              message: "success",
            },
            200
          );
        }
      } else {
        ctx.send(
          {
            message: "bad request",
          },
          400
        );
      }
    },
  })
);
