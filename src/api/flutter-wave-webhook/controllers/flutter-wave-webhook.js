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

      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: reqBody.customer.email } });

      const payload = {
        data: {
          status: reqBody.status,
          amount: Number(reqBody.amount),
          trx_id: reqBody.id,
          tx_ref: reqBody.txRef,
          flw_ref: reqBody.flwRef,
          currency: reqBody.currency,
          charged_amount: Number(reqBody.charged_amount),
          app_fee: Number(reqBody.appfee),
          //   payment_method: reqBody.data.payment_type,
          date_time:
            reqBody.entity.createdAt || new Date(Date.now()).toISOString(),
          payer_email: reqBody.customer.email,
        },
      };

      try {
        await strapi
          .service("api::flutter-wave-webhook.flutter-wave-webhook")
          .create(payload);
        if (reqBody.status === "successful") {
          console.log("verifying payment...");
          const flw = new Flutterwave(
            process.env.FLUTTER_WAVE_PUBLIC_KEY,
            process.env.FLUTTER_WAVE_TEST_SECRET_KEY
          );

          flw.Transaction.verify({ id: reqBody.id })
            .then(async (response) => {
              console.log(response);
              if (
                response.data.status === "successful" &&
                response.data.amount === reqBody.amount &&
                response.data.currency === reqBody.currency
              ) {
                await strapi.query("plugin::users-permissions.user").update({
                  where: { id: user.id },
                  data: {
                    AccountBalance:
                      user.AccountBalance + Number(response.data.amount),
                  },
                });
                await strapi
                  .query("api::account-funding.account-funding")
                  .update({
                    where: { tx_ref: reqBody.txRef },
                    data: {
                      status: "Success",
                      transaction_id: reqBody.id.toString(),
                    },
                  });
              } else {
                const EmailSent = await strapi
                  .plugin("email")
                  .service("email")
                  .send({
                    to: user.email,

                    subject: "Wallet Funding",

                    html: `<p>Dear ${user.username}, your payment with the trx ref of ${reqBody.tx_ref} was not successful.</p>
                    <p>Contact Support for more details</p>
                    <p>Gbrain Corporate Ventures.</p>
                    `,
                  });
                await strapi
                  .query("api::account-funding.account-funding")
                  .update({
                    where: { tx_ref: reqBody.tx_ref },
                    data: {
                      status: "Failed",
                      transaction_id: reqBody.id,
                    },
                  });
                console.log(EmailSent);
                // Inform the customer their payment was unsuccessful
              }
            })
            .catch(console.log);
        }
      } catch (error) {
        console.log(error);
      }
    },
  })
);
