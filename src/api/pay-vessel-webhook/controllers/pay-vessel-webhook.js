"use strict";

/**
 *  pay-vessel-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::pay-vessel-webhook.pay-vessel-webhook",
  ({ strapi }) => ({
    async create(ctx) {
      console.log({
        body: ctx.req.body,
        headers: ctx.req.headers,
      });
      const payload = ctx.req.body;
      const payvessel_signature = ctx.req.header(
        "HTTP_PAYVESSEL_HTTP_SIGNATURE"
      );
      const ip_address = req.connection.remoteAddress;
      const secret = "PVSECRET-";
      const hash = crypto
        .createHmac("sha512", secret)
        .update(JSON.stringify(payload))
        .digest("hex");
      const ipAddress = ["3.255.23.38", "162.246.254.36"];
      if (payvessel_signature === hash && ipAddress.includes(ip_address)) {
        const data = payload;
        const amount = parseFloat(data.order.amount);
        const settlementAmount = parseFloat(data.order.settlement_amount);
        const fee = parseFloat(data.order.fee);
        const reference = data.transaction.reference;
        const description = data.order.description;

        const existingTrx = await strapi
          .query("api::pay-vessel-webhook.pay-vessel-webhook")
          .findOne({
            where: { tx_ref: reference },
          });
        if (!existingTrx) {
          // Fund user wallet here

          return ctx.send(
            {
              message: "success",
            },
            200
          );
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
