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
  "api::transaction-history.transaction-history",
  ({ strapi }) => ({
    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    async find(ctx) {
      const { id } = ctx.state.user;

      try {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: id },
            populate: {
              airtime_orders: true,
              sme_data_orders: true,
              exam_pins_purchases: true,
              electricity_bills: true,
              data_gifting_orders: true,
              tv_and_cables_orders: true,
              sell_airtimes: true,
              account_fundings: true,
            },
          });
        const history = {
          histories: [
            ...user.airtime_orders,
            ...user.sme_data_orders,
            ...user.exam_pins_purchases,
            ...user.data_gifting_orders,
            ...user.electricity_bills,
            ...user.tv_and_cables_orders,
            ...user.sell_airtimes,
            ...user.account_fundings,
          ],
        };
        //  if (history.length === 0){
        //     ctx.send({

        //  })
        //  }
        ctx.send({
          message: "Success",
          data: history,
        });
      } catch (error) {
        console.log(error);
        throw new ApplicationError(error.message);
      }
    },
  })
);
