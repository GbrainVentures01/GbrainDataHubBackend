"use strict";

const { ApplicationError } = require("@strapi/utils/lib/errors");
const { HttpError } = require("koa");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");

/**
 *  data-gifting-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::data-gifting-order.data-gifting-order",
  ({ strapi }) => ({
    /**
     * return create data gfiting order and associating with current logged in user
     * @param {Object} ctx
     * @returns
     */
    async create(ctx) {
      const { data } = ctx.request.body;
      console.log(data)
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (user.AccountBalance < Number(data.amount)) {
        return ctx.badRequest("Low Wallet Balance, Please fund wallet");
      }
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }
      try {
        const { pin, ...restofdata } = data;
        const newOrder = { data: { ...restofdata, user: id } };
        const Order = await strapi
          .service("api::data-gifting-order.data-gifting-order")
          .create(newOrder);

        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            AccountBalance: user.AccountBalance - Number(data.amount),
          },
        });

   

        const payload = JSON.stringify({
          network_id: `${data.network_id}`,
          plan_id: `${data.plan_id}`,
          phone: `${data.beneficiary}`,
          // Ported_number: true,
        });
console.log(payload);
        const res = await customNetwork({
          method: "POST",
          target: "bello",
          path: "data",
          requestBody: payload,
          headers: {
            Authorization: `Bearer ${process.env.BELLO_SECRET}`,
            "Content-Type": "application/json",
          },
        });

        console.log(res);

        if (res.status === 200 && res.data.status ) {
          await strapi.query("api::data-gifting-order.data-gifting-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "delivered",
              ident: res.data.ident,
            },
          });
          return ctx.send({
            data: {
              message:
                res.data.api_response ||
                `Successful gifted ${data.plan} to ${data.beneficiary}`,
            },
          });
        } else if (!res.data.status ) {
          await strapi.query("api::data-gifting-order.data-gifting-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
              ident: res.data.ident,
            },
          });
          const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });
          await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance + Number(data.amount),
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
        //   await strapi.query("api::data-gifting-order.data-gifting-order").update({
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
          ctx.throw(500, "Transaction was not successful");
        }

        // await strapi.plugins["email"].services.email.send({
        //   to: [
        //     { email: "gbraincorpbizvent@gmail.com" },
        //     { email: "adebisidamilola6@gmail.com" },
        //   ],
        //   subject: "New Airtime Order",
        //   html: `<p>Hello, you have a new data gifting order !, kindly visit the admin pannel to see  order details </p>
                 
        //          <h3> Regards</h3>
        //          <h3>Gbrain Coporate Ventures</h3>`,
        // });

        // return ctx.send({
        //   data: { message: "data gifting order successfully created", Order },
        // });
      } catch (error) {
        console.log(error);
        console.log("from error");
        if (error.response.status === 400) {
          await strapi.query("api::data-gifting-order.data-gifting-order").update({
            where: { request_Id: data.request_Id },
            data: {
              status: "failed",
            },
          });
          ctx.throw(
            500,
            "Transaction was not successful, please try again later."
          );
        } else {
          ctx.throw(500, "Something went wrong, please try again later.");
        }
      }
    },
  })
);
