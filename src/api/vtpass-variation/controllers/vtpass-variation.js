"use strict";

const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const customNetwork = require("../../../utils/customNetwork");
const { base64encode } = require("nodejs-base64");

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::vtpass-variation.vtpass-variation",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async connect(ctx) {
      const { provider } = ctx.params;
      try {
        const payload = await customNetwork({
          method: "GET",
          path: `service-variations?serviceID=${provider}`,
          target: "vtpass",
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });

        return payload?.data;
      } catch (error) {
        console.log(error);
        throw new ApplicationError("Sorry, Something went wrong");
      }

      // try {
      //     const newDeposit = await strapi.query("api::vtpass-variation.vtpass-variation").create({
      //         data:{
      //             TransactionReference:data.transactionReference,
      //             PaymentReference:data.paymentReference,
      //             AmountPaid:data.amountPaid,
      //             SettlementAmount:data.settlementAmount,
      //             PaidOn:data.paidOn,
      //             PaymentStatus:data.paymentStatus,
      //             PaymentDescription:data.paymentDescription,
      //             PaymentMethod:data.paymentMethod,
      //             cardLast4Num:data.cardDetails.last4,
      //             CustomerName:data.customer.name,
      //             CustomerEmail:data.customer.email

      //         }
      //     })
      //     const user = await strapi
      //     .query('plugin::users-permissions.user')
      //     .findOne({ where: { email: data.customer.email.toLowerCase()}
      //     });
      //     const updateUserBalance = await strapi.query('plugin::users-permissions.user').update({where:{id:user.id}, data:{
      //         AccountBalance:user.AccountBalance + Number(data?.amountPaid)
      //     }})

      //     return ctx.send({data:{message:"successful "}})

      // } catch (error) {
      //     console.log(error);
      //     throw new ApplicationError("Sorry, Something went wrong")

      // }
    },
  })
);
