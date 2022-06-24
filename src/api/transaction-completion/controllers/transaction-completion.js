"use strict";

const { sanitizeEntity } = require("strapi-utils/lib");
const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const { ApplicationError } = require("@strapi/utils/lib/errors");

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::transaction-completion.transaction-completion",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async handleCompletion(ctx) {
      const requestBody = ctx.request.body;
      const data = ctx.request.body.eventData;
      const headers = ctx.request.headers;
      const hash = await calculateTransactionHash(requestBody);

      if (data.paymentMethod === "ACCOUNT_TRANSFER") {
        const amountPaid = data.paymentSourceInformation[0].amountPaid;
        const sourceAccountNum = data.paymentSourceInformation[0].accountNumber;
        const sourceAccountName = data.paymentSourceInformation[0].accountName;

        try {
          const newDeposit = await strapi
            .query("api::transaction-completion.transaction-completion")
            .create({
              data: {
                TransactionReference: data.transactionReference,
                PaymentReference: data.paymentReference,
                AmountPaid: amountPaid,
                SettlementAmount: data.settlementAmount,
                PaidOn: data.paidOn,
                PaymentStatus: data.paymentStatus,
                PaymentDescription: data.paymentDescription,
                PaymentMethod: data.paymentMethod,
                SourceAccountNumber: sourceAccountNum,
                SourceAccountName: sourceAccountName,
                CustomerName: data.customer.name,
                CustomerEmail: data.customer.email,
              },
            });
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { email: data.customer.email.toLowerCase() } });
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance + Number(data?.amountPaid),
            },
          });

          return ctx.send({ data: { message: "successful " } });
        } catch (error) {
          console.log(error);
        }
      }
      try {
        await strapi
          .query("api::transaction-completion.transaction-completion")
          .create({
            data: {
              TransactionReference: data.transactionReference,
              PaymentReference: data.paymentReference,
              AmountPaid: data.amountPaid,
              SettlementAmount: data.settlementAmount,
              PaidOn: data.paidOn,
              PaymentStatus: data.paymentStatus,
              PaymentDescription: data.paymentDescription,
              PaymentMethod: data.paymentMethod,
              cardLast4Num: data.cardDetails.last4,
              CustomerName: data.customer.name,
              CustomerEmail: data.customer.email,
            },
          });
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: data.customer.email.toLowerCase() } });
        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance + Number(data?.amountPaid),
          },
        });

        return ctx.send({ data: { message: "successful " } });
      } catch (error) {
        console.log(error);
        throw new ApplicationError("Sorry, Something went wrong");
      }
    },
  })
);
