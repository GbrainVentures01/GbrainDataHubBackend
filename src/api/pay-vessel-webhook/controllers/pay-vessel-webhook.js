"use strict";
const crypto = require("crypto");

/**
 *  pay-vessel-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::pay-vessel-webhook.pay-vessel-webhook",
  ({ strapi }) => ({
    async create(ctx) {
      const payload = ctx.request.body;
      // const payvessel_signature =
      //   ctx.request.headers["payvessel-http-signature"];

      const ip_address = ctx.request.headers["x-forwarded-for"];

      // const secret = "PVSECRET-";
      // const hash = crypto
      //   .createHmac("sha512", secret)
      //   .update(JSON.stringify(payload))
      //   .digest("hex");
      const ipAddress = [process.env.PAYVESSEL_IP1, process.env.PAYVESSEL_IP2];

      if (ipAddress.includes(ip_address)) {
        const data = payload;
        const amount = parseFloat(data.order.amount);
        const settlementAmount = parseFloat(data.order.settlement_amount);
        const fee = parseFloat(data.order.fee);
        const reference = data.transaction.reference;
        const description = data.order.description;
        const userEmail = data.customer.email;

        const existingTrx = await strapi
          .query("api::pay-vessel-webhook.pay-vessel-webhook")
          .findOne({
            where: { tx_ref: reference },
          });
        if (!existingTrx) {
          try {
            const user = await strapi
              .query("plugin::users-permissions.user")
              .findOne({
                where: { email: userEmail },
              });
            const webhookData = {
              data: {
                status: data.code === "00" ? "successful" : "failed",
                amount: amount,
                tx_ref: reference,
                description: description,
                settlementAmount: settlementAmount,
                fee: fee,
                payer_email: userEmail,
              },
            };
            const newFunding = {
              data: {
                user: user.id,
                tx_ref: reference,
                amount: Number(settlementAmount),
                customer: userEmail,
                TRX_Name: "Wallet Funding",
                previous_balance: user.AccountBalance,
                current_balance: user.AccountBalance + Number(settlementAmount),
                status: "Success",
              },
            };

            // Fund user wallet here
            await strapi
              .service("api::pay-vessel-webhook.pay-vessel-webhook")
              .create(webhookData);
            await strapi
              .service("api::account-funding.account-funding")
              .create(newFunding);

            await strapi.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(settlementAmount),
              },
            });
            return ctx.send(
              {
                message: "success",
              },
              200
            );
          } catch (error) {
            console.log(error);
            return ctx.internalServerError("An error occurred");
          }
        } else {
          ctx.send(
            {
              message: "transaction already exist",
            },
            200
          );
        }
      } else {
        return ctx.badRequest("Permission denied, invalid hash or ip address.");
      }
    },
  })
);
