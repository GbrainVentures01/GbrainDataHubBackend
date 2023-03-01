"use strict";

/**
 *  flutter-wave-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const Flutterwave = require("flutterwave-node-v3");
const Transactions = require("flutterwave-node-v3/lib/rave.transactions");

module.exports = createCoreController(
  "api::flutter-wave-webhook.flutter-wave-webhook",
  ({ strapi }) => ({
    /**
     * accept webhook from flutter wave about payment statuds
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const reqBody = ctx.request.body;
      console.log(reqBody);

      if (reqBody) {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: reqBody.data.customer.email } });

        const payload = {
          data: {
            status: reqBody.data.status,
            amount: Number(reqBody.data.amount),
            trx_id: Number(reqBody.data.id).toString(),
            tx_ref: reqBody.data.tx_ref,
            flw_ref: reqBody.data.flw_ref,
            currency: reqBody.data.currency,
            payment_type: reqBody.data.payment_type,
            charged_amount: Number(reqBody.data.charged_amount),
            app_fee: Number(reqBody.data.app_fee),
            //   payment_method: reqBody.data.payment_type,
            date_time:
              reqBody.data.created_at || new Date(Date.now()).toISOString(),
            payer_email: reqBody.data.customer.email,
          },
        };

        try {
          await strapi
            .service("api::flutter-wave-webhook.flutter-wave-webhook")
            .create(payload);
          if (reqBody.data.status === "successful") {
            console.log("verifying payment...");
            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance:
                  user.AccountBalance + Number(reqBody.data.amount),
              },
            });
            await strapi.query("api::account-funding.account-funding").update({
              where: { tx_ref: reqBody.data.tx_ref },
              data: {
                status: "Success",
                transaction_id: reqBody.data.id.toString(),
              },
            });

            // const flw = new Flutterwave(
            //   process.env.FLUTTER_WAVE_PUBLIC_KEY,
            //   process.env.FLUTTER_WAVE_LIVE_SECRET_KEY
            // );

            // flw.Transaction.verify({ id: reqBody.data.id })
            //   .then(async (response) => {
            //     console.log(response);
            //     if (
            //       response.data.status === "successful" &&
            //       response.data.amount === reqBody.data.amount &&
            //       response.data.currency === reqBody.data.currency
            //     ) {
            //       await strapi.query("plugin::users-permissions.user").update({
            //         where: { id: user.id },
            //         data: {
            //           AccountBalance:
            //             user.AccountBalance + Number(response.data.amount),
            //         },
            //       });
            //       await strapi
            //         .query("api::account-funding.account-funding")
            //         .update({
            //           where: { tx_ref: reqBody.data.tx_ref },
            //           data: {
            //             status: "Success",
            //             transaction_id: reqBody.data.id.toString(),
            //           },
            //         });
            //     } else {
            //       const EmailSent = await strapi
            //         .plugin("email")
            //         .service("email")
            //         .send({
            //           to: user.email,

            //           subject: "Wallet Funding",

            //           html: `<p>Dear ${user.username}, your payment with the trx ref of ${reqBody.data.tx_ref} was not successful.</p>
            //         <p>Contact Support for more details</p>
            //         <p>Gbrain Corporate Ventures.</p>
            //         `,
            //         });
            //       await strapi
            //         .query("api::account-funding.account-funding")
            //         .update({
            //           where: { tx_ref: reqBody.data.tx_ref },
            //           data: {
            //             status: "Failed",
            //             transaction_id: reqBody.data.id,
            //           },
            //         });
            //       console.log(EmailSent);

            //       // Inform the customer their payment was unsuccessful
            //     }
            //   })
            //   .catch((e) => console.log(e));
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
