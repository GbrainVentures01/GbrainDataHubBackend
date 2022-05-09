"use strict";

const { sanitizeEntity } = require("strapi-utils/lib");
const converter = require("../../../utils/converter");

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::transaction-completion-atm-card.transaction-completion-atm-card",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async handleCompletion(ctx) {
   
    const data = ctx.request.body.eventData
    console.log(data)
try {
    const newDeposit = await strapi.query("api::transaction-completion-atm-card.transaction-completion-atm-card").create({
        data:{
            TransactionReference:data.transactionReference,
            PaymentReference:data.paymentReference,
            AmountPaid:data.amountPaid,
            SettlementAmount:data.settlementAmount,
            PaidOn:data.paidOn,
            PaymentStatus:data.paymentStatus,
            PaymentDescription:data.paymentDescription,
            PaymentMethod:data.paymentMethod,
            cardLast4Num:data.cardDetails.last4,
            CustomerName:data.customer.name,
            CustomerEmail:data.customer.email

        }
    })
    const user = await strapi
    .query('plugin::users-permissions.user')
    .findOne({ where: { email: data.customer.email.toLowerCase()}
    });
    const updateUserBalance = await strapi.query('plugin::users-permissions.user').update({where:{id:user.id}, data:{
        AccountBalance:user.AccountBalance + Number(data?.amountPaid)
    }})

  
    return ctx.send({data:{message:"successful "}})
    
} catch (error) {
    console.log(error);
}
  
    

   
    },

    


  })
);
