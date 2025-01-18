"use strict";

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
      const { limit, start, search, type } = ctx.query;
      const sort = {
        createdAt: "desc",
      };

      try {
        switch (type) {
          case "airtime":
            const airtimePurchases = await strapi.service.findMany(
              "api::airtime-order.airtime-order",
              {
                filters: {
                  user: id,
                  beneficiary: {
                    $contains: search,
                  },
                },
                populate: ["user"],
                start,
                limit,
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: airtimePurchases,
            });

          case "account-funding":
            const accountFundings = await strapi.service.findMany(
              "api::account-funding.account-funding",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                start,
                limit,
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: accountFundings,
            });
          case "electricity":
            const electricityBills = await strapi.service.findMany(
              "api::electricity-order.electricity-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: electricityBills,
            });
          case "tv-cables":
            const tvCablesOrders = await strapi.service.findMany(
              "api::tvcables-order.tvcables-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: tvCablesOrders,
            });
          case "exam-pins":
            const examPinOrders = await strapi.service.findMany(
              "api::exam-pin-order.exam-pin-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: examPinOrders,
            });
          case "sell-airtime":
            const sellAirtimeOrders = await strapi.service.findMany(
              "api::sell-airtime.sell-airtime",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: sellAirtimeOrders,
            });

          case "sme-1-data":
            const sme1DataOrders = await strapi.service.findMany(
              "api::mtn-sme-1-data-order.mtn-sme-1-data-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: sme1DataOrders,
            });
          case "sme-2-data":
            const sme2DataOrders = await strapi.service.findMany(
              "api::mtn-sme-2-data-order.mtn-sme-2-data-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: sme2DataOrders,
            });
          case "sme-data":
            const smeDataOrders = await strapi.service.findMany(
              "api::sme-data-order.sme-data-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: smeDataOrders,
            });
          case "data-gifting":
            const dataGiftingOrders = await strapi.service.findMany(
              "api::data-gifting-order.data-gifting-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: dataGiftingOrders,
            });
          case "cg-data":
            const cgDataOrders = await strapi.service.findMany(
              "api::cg-data-order.cg-data-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: cgDataOrders,
            });
          case "mtn-coupon-data":
            const mtnCouponDataOrders = await strapi.service.findMany(
              "api::mtn-coupon-data-order.mtn-coupon-data-order",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: mtnCouponDataOrders,
            });

          default:
            accountFundings = await strapi.service.findMany(
              "api::account-funding.account-funding",
              {
                filters: {
                  user: id,
                },
                populate: ["user"],
                pagination: {
                  page,
                  pageSize,
                },
                sort,
              }
            );
            return ctx.send({
              message: "Success",
              data: accountFundings,
            });
        }
        // const user = await strapi
        //   .query("plugin::users-permissions.user")
        //   .findOne({
        //     where: { id: id },
        //     populate: {
        //       airtime_orders: true,
        //       sme_data_orders: true,
        //       exam_pins_purchases: true,
        //       electricity_bills: true,
        //       data_gifting_orders: true,
        //       tv_and_cables_orders: true,
        //       sell_airtimes: true,
        //       account_fundings: true,
        //       cg_data_orders: true,
        //       mtn_sme_1_data_orders: true,
        //       mtn_sme_2_data_orders: true,
        //       mtn_coupon_data_orders: true,
        //     },
        //   });
        // const sortedHistory = [
        //   ...user.airtime_orders,
        //   ...user.sme_data_orders,
        //   ...user.exam_pins_purchases,
        //   ...user.data_gifting_orders,
        //   ...user.electricity_bills,
        //   ...user.tv_and_cables_orders,
        //   ...user.sell_airtimes,
        //   ...user.account_fundings,
        //   ...user.cg_data_orders,
        //   ...user.mtn_sme_1_data_orders,
        //   ...user.mtn_sme_2_data_orders,
        //   ...user.mtn_coupon_data_orders,
        // ]
        //   .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        //   .slice(0, 200);
        // const history = {
        //   histories: sortedHistory,
        // };
        // //  if (history.length === 0){
        // //     ctx.send({

        // //  })
        // //  }
        // ctx.send({
        //   message: "Success",
        //   data: history,
        // });
      } catch (error) {
        console.log(error);
        throw new ApplicationError(error.message);
      }
    },
  })
);
