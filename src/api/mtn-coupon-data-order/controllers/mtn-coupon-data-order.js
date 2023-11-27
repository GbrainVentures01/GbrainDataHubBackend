"use strict";

/**
 *  mtn-coupon-data-order controller
 */

const randomString = require("randomstring");
const customNetwork = require("../../../utils/customNetwork");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::mtn-coupon-data-order.mtn-coupon-data-order",
  ({ strapi }) => ({
    async create(ctx) {
      const { data } = ctx.request.body;

      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (user.AccountBalance < Number(data.amount)) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }
      const ref = `BELLO|COUP|${randomString.generate(8)}`;
      const dataBasePayload = {
        user: id,
        ref: ref,
        beneficiary: data.beneficiary,
        network: data.network,
        plan: data.plan.Plan,
        amount: data.amount,
        previous_balance: user.AccountBalance,
        current_balance: user.AccountBalance,
      };
      const newOrder = {
        data: { ...dataBasePayload },
      };
      await strapi
        .service("api::mtn-coupon-data-order.mtn-coupon-data-order")
        .create(newOrder);

      const updatedUser = await strapi
        .query("plugin::users-permissions.user")
        .update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(data.amount),
          },
        });

      //   const returnNetId = (network) => {
      //     switch (network) {
      //       case "Mtn":
      //         return 1;
      //       case "Airtel":
      //         return 2;
      //       case "Glo":
      //         return 3;

      //       default:
      //         break;
      //     }
      //   };
      const payload = {
        network_id: "1",
        plan_id: `${data.plan.plan_id}`,
        phone: data.beneficiary,
      };
      try {
        const res = await customNetwork({
          method: "POST",
          target: "bello",
          path: "data",
          requestBody: payload,
          headers: { Authorization: `Bearer ${process.env.BELLO_SECRET}` },
        });
        console.log(res);

        if (res.status === 200 && res.data.status) {
          await strapi
            .query("api::mtn-coupon-data-order.mtn-coupon-data-order")
            .update({
              where: { ref: ref },
              data: {
                status: "delivered",
                current_balance: updatedUser.AccountBalance,
              },
            });
          return ctx.send({
            data: {
              message:
                res.data.api_response ||
                `Successful gifted ${data.plan} to ${data.beneficiary}`,
            },
          });
        } else if (!res.data.status) {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: user.id },
              data: {
                AccountBalance: user.AccountBalance + Number(data.amount),
              },
            });
          await strapi
            .query("api::mtn-coupon-data-order.mtn-coupon-data-order")
            .update({
              where: { request_Id: data.request_Id },
              data: {
                status: "failed",
                current_balance: updatedUser.AccountBalance,
              },
            });
          console.log(res.data);
          ctx.throw(400, res.data.api_response);
        }
        // else if (
        //   res.data &&
        //   res.data.status !== "failed" &&
        //   res.data.status !== "successful"
        // ) {
        //   await strapi.query("api::mtn-coupon-data-order.mtn-coupon-data-order").update({
        //     where: { request_Id: data.request_Id },
        //     data: {
        //       status: "qeued",
        //       ident: res.data.ident,
        //     },
        //   });

        //   console.log(res.data);
        //   return ctx.send({
        //     data: { message: "pending" },
        //   });
        // }
        else {
          console.log(res.data);
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi
            .query("api::mtn-coupon-data-order.mtn-coupon-data-order")
            .update({
              where: { ref: ref },
              data: {
                status: "failed",
                current_balance: user.AccountBalance,
              },
            });
          ctx.throw(500, "Transaction was not successful");
        }
      } catch (error) {
        console.log("from error");
        console.log(error);
        if (error.response?.status === 400) {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi
            .query("api::mtn-coupon-data-order.mtn-coupon-data-order")
            .update({
              where: { request_Id: data.request_Id },
              data: {
                status: "failed",
                current_balance: user.AccountBalance,
              },
            });
          ctx.throw(
            400,
            "Transaction was not successful, please try again later."
          );
        } else {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi
            .query("api::mtn-coupon-data-order.mtn-coupon-data-order")
            .update({
              where: { ref: ref },
              data: {
                status: "failed",
                current_balance: user.AccountBalance,
              },
            });
          ctx.throw(500, "Something went wrong, please try again later.");
        }
      }
    },
  })
);
