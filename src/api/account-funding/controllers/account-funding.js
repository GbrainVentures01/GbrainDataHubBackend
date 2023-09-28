"use strict";

const { default: axios } = require("axios");
const fundWallet = require("../../../utils/monnify/fundWallet");
const generateRef = require("../../../utils/monnify/generateRef");

/**
 *  account-funding controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::account-funding.account-funding",
  ({ strapi }) => ({
    /**
     * initiate account funding with flutter wave
     * @param {Object} ctx
     * @returns
     */

    async create(ctx) {
      const amount = ctx.request.body.data.amount;
      const gateway = ctx.request.body.data.gateway;
      const { user } = ctx.state;

      const Fref = `FLW||${generateRef()}`;
      const Cref = `CREDO||${generateRef()}`;
      const newFunding = {
        data: {
          user: user.id,
          tx_ref: gateway === "fwave" ? Fref : Cref,
          amount: Number(amount),
          customer: user.email,
          TRX_Name: "Wallet Funding",
          previous_balance: user.AccountBalance,
          current_balance: user.AccountBalance,
        },
      };
      try {
        await strapi
          .service("api::account-funding.account-funding")
          .create(newFunding);

        if (gateway === "fwave") {
          const res = await fundWallet({
            gateway,
            userData: user,
            amount: amount,
            ref: Fref,
          });
          console.log(res);
          if (res.status === "success") {
            ctx.send({
              message: "success",
              response: res,
            });
          } else {
            ctx.send(503, "service temporarily not available");
          }
        } else {
          const res = await fundWallet({
            gateway,
            userData: user,
            amount: amount * 100,
            ref: Cref,
          });
          console.log(res);
          if (res.status === 200) {
            ctx.send({
              message: "success",
              response: res,
            });
          } else {
            ctx.send(503, "service temporarily not available");
          }
        }
      } catch (err) {
        ctx.send(500, "internal server error");
        console.log(err);
      }
    },
  })
);
