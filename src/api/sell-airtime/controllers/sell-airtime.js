"use strict";

/**
 *  sell-airtime controller
 */
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const customNetwork = require("../../../utils/customNetwork");
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::sell-airtime.sell-airtime",
  ({ strapi }) => ({
    /**
     * create sell airtime order
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const { data } = ctx.request.body;
      console.log("AIRTIME DATA", data);
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }

      try {
        const res = await customNetwork({
          method: "POST",
          target: "ogdams_airtime",
          path: "generate/otp",
          headers: {
            Authorization: `Bearer ${process.env.OGDAMS_AIRTIME_SECRET}`,
          },
          requestBody: {
            networkName: data.network,
            sender: data.phone_number,
          },
        });

        console.log("RES: ", res);

        // const { pin, ...restofdata } = data;
        // const newOrder = {
        //   data: { ...restofdata, user: id, amount: Number(amount), },
        // };

        // const Order = await strapi
        //   .service("api::sell-airtime.sell-airtime")
        //   .create(newOrder);

        // await strapi.plugins["email"].services.email.send({
        //   to: [
        //     { email: "gbraincorpbizvent@gmail.com" },
        //     { email: "adebisidamilola6@gmail.com" },
        //   ],
        //   subject: "Sell Airtime Order",
        //   html: `<p>Hello, you have a new Sell Airtime Order !, kindly visit the admin pannel to see  order details </p>

        //          <h3> Regards</h3>
        //          <h3>Gbrain Coporate Ventures</h3>`,
        // });

        if (res && res.status === 200 && res.data.code === 2000) {
          return ctx.send({
            data: {
              message: res.data.message,
              // Order,
            },
          });
        } else {
          return ctx.serviceUnavailable(
            res?.data?.message || "service unavailable, please retry"
          );
        }
      } catch (error) {
        console.log("ERROR: ", error);
        throw new ApplicationError(
          error?.response?.data?.message ||
            error.message ||
            "service unavailable, please retry"
        );
      }
    },
    async verifyOtp(ctx) {
      const { data } = ctx.request.body;
      console.log(data);
      try {
        const res = await customNetwork({
          method: "POST",
          target: "ogdams_airtime",
          path: "verify/otp",
          headers: {
            Authorization: `Bearer ${process.env.OGDAMS_AIRTIME_SECRET}`,
          },
          requestBody: {
            networkName: data.network,
            sender: data.phone_number,
            otp: data.otp,
          },
        });
        console.log("RES: ", res);
        if (res && res.status === 200 && res.data.code === 2000) {
          return ctx.send({
            data: {
              message: res.data.message,
              sessionId: res.data.data.sessionId,
            },
          });
        } else {
          return ctx.serviceUnavailable(
            res?.data?.message || "service unavailable, please retry"
          );
        }
      } catch (error) {
        console.log("Verification ERROR: ", error);
        throw new ApplicationError(
          error?.response?.data?.message ||
            error.message ||
            "service unavailable, please retry"
        );
      }
    },
    async sellAirtime(ctx) {
      const { data } = ctx.request.body;
      console.log(data);
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });
      const newOrder = {
        data: {
          network: data.network,
          phone_number: data.phone_number,
          request_id: data.request_id,
          previous_balance: user.AccountBalance,
          current_balance: user.AccountBalance,
          session_id: data.session_id,
          user: id,
          amount: Number(data.amount),
        },
      };
      try {
        const Order = await strapi
          .service("api::sell-airtime.sell-airtime")
          .create(newOrder);
        const res = await customNetwork({
          method: "POST",
          target: "ogdams_airtime",
          path: "transfer/airtime",
          headers: {
            Authorization: `Bearer ${process.env.OGDAMS_AIRTIME_SECRET}`,
          },
          requestBody: {
            networkName: data.network,
            sender: data.phone_number,
            pin: data.sim_pin,
            count: 1,
            amount: data.amount,
            sessionId: data.session_id,
            reference: data.request_id,
          },
        });
        console.log("RES: ", res);
        if (res && res.status === 200 && res.data.code === 2000) {
          const amountToNumber = Number(data.amount);
          const amounWithcharges = (amountToNumber / 100) * 90;
          await strapi.query("api::sell-airtime.sell-airtime").update({
            where: { session_id: res.data.data.sessionId },
            data: {
              status: "Sucessful",

              current_balance: user.AccountBalance + Number(amounWithcharges),
            },
          });
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance + Number(amounWithcharges),
            },
          });
          return ctx.send({
            data: {
              message: res.data.message,
              // Order,
            },
          });
        } else {
          return ctx.serviceUnavailable(
            res?.data?.message || "service unavailable, please retry"
          );
        }
      } catch (error) {
        console.log(error);
        ctx.serviceUnavailable(
          error?.response?.data?.message ||
            error.message ||
            "service unavailable, please retry"
        );
      }
    },
  })
);
