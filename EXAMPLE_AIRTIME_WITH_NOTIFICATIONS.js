'use strict';

/**
 * Example: Airtime Order Controller with Notification Triggers
 * 
 * This file shows how to integrate notification triggers into your existing controllers.
 * Copy the notification-related code into your actual controllers.
 * 
 * Location: src/api/airtime-order/controllers/airtime-order.js
 */

const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const customNetwork = require("../../../utils/customNetwork");
const { base64encode } = require("nodejs-base64");
const requeryTransaction = require("../../../utils/vtpass/requeryTransaction");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const checkduplicate = require("../../../utils/checkduplicate");

// ✅ ADD THIS IMPORT
const {
  sendPaymentSuccessNotification,
  sendPaymentFailureNotification,
  sendTransactionConfirmationNotification,
  sendLowBalanceAlert,
} = require("../../../utils/notification-triggers");

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::airtime-order.airtime-order",
  ({ strapi }) => ({
    /**
     * Example: Purchase airtime with notifications
     */
    async create(ctx) {
      try {
        const { data } = ctx.request.body;
        const { id } = ctx.state.user;

        // ... existing validation code ...

        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { id: id } });

        // ✅ Send transaction confirmation notification
        await sendTransactionConfirmationNotification(user, {
          amount: data.amount,
          reference: data.request_id,
          description: `Airtime purchase for ${data.beneficiary}`,
          id: data.request_id,
        });

        // ... existing order creation code ...

        const buyAirtime = await customNetwork({
          method: "POST",
          path: "pay",
          requestBody: payload,
          target: "vtpass",
          headers: {
            Authorization: `Basic ${base64encode(
              `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
            )}`,
          },
        });

        // ✅ HANDLE SUCCESS - Send success notification
        if (buyAirtime.data.code === "000") {
          // Update order status
          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "successful",
              // ... other fields ...
            },
          });

          // ✅ Send success notification
          await sendPaymentSuccessNotification(
            user,
            {
              amount: data.amount,
              reference: data.request_id,
            },
            "airtime"
          );

          // ✅ Check for low balance and alert
          const updatedUser = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });

          if (updatedUser.AccountBalance < 1000) {
            await sendLowBalanceAlert(updatedUser, updatedUser.AccountBalance);
          }

          return ctx.send({
            data: { message: "Airtime purchase successful", order },
          });
        }
        // ✅ HANDLE FAILURE - Send failure notification
        else {
          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: data.request_id },
            data: {
              status: "failed",
            },
          });

          // ✅ Send failure notification
          await sendPaymentFailureNotification(
            user,
            {
              amount: data.amount,
              reference: data.request_id,
            },
            "airtime",
            buyAirtime.data.response_description || "Transaction failed"
          );

          ctx.throw(500, "Airtime purchase failed");
        }
      } catch (error) {
        console.error("Error:", error);

        // ✅ Send failure notification on error
        if (ctx.state.user) {
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: ctx.state.user.id } });

          await sendPaymentFailureNotification(
            user,
            {
              amount: ctx.request.body.data?.amount || 0,
              reference: ctx.request.body.data?.request_id || "",
            },
            "airtime",
            "An error occurred. Please try again."
          );
        }

        throw error;
      }
    },
  })
);
