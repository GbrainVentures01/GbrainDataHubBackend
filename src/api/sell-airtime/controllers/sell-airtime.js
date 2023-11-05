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

        if (res.status === 200) {
          return ctx.send({
            data: {
              message: res.data.message,
              // Order,
            },
          });
        } else {
          return ctx.serviceUnavailable("Service unavailable, please retry");
        }
      } catch (error) {
        console.log("ERROR: ", error);
        throw new ApplicationError(error.message);
      }
    },
    async verifyOtp(ctx) {
      const { data } = ctx.request.body;
      console.log(data);
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
          request_id: data.reference,
          previous_balance: user.accountBalance,
          current_balance: user.accountBalance,
          user: id,
          amount: Number(data.amount),
        },
      };
      try {
        const Order = await strapi
          .service("api::sell-airtime.sell-airtime")
          .create(newOrder);
      } catch (error) {}
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
          amount: data.amount,
          sessionId: data.sessionId,
          reference: data.reference,
        },
      });
      console.log("RES: ", res);
    },
  })
);
