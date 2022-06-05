"use strict";
const randomString = require("randomstring");
const fundWallet = require("../../../utils/monnify/fundWallet");
const getToken = require("../../../utils/monnify/getToken");

/**
 *  monnify-atm-funding controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

let myAccessToken;
module.exports = createCoreController(
  "api::monnify-atm-funding.monnify-atm-funding",
  ({ strapi }) => ({
    async create(ctx) {
      myAccessToken = await getToken();
      const amount = ctx.request.body.data.amount;
      const { id } = ctx.state.user;
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });
      const userData = {
        email: user.email,
        username: user.username,
      };

      const fundMonnifyWallet = await fundWallet({
        token: myAccessToken,
        userData: userData,
        amount: Number(amount),
        ref: `${randomString.generate(4) + amount}`,
      });
      const checkoutUrl = fundMonnifyWallet.checkoutUrl;
      const redirectUrl = fundMonnifyWallet.redirectUrl;
      return ctx.send({
        checkoutUrl,
        redirectUrl,
      });
    },
  })
);
