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
      if (gateway === "credo")
        return ctx.serviceUnavailable("Service temporarily unavailable");

      const Fref = `FLW||${generateRef()}`;
      const Cref = `CREDO||${generateRef()}`;
      const Mnfy = `MFY||${generateRef()}`;
      const amounWithcharges = Number(amount + (amount / 100) * 1.65);

      const newFunding = {
        data: {
          user: user.id,
          tx_ref:
            gateway === "fwave" ? Fref : gateway === "monify" ? Mnfy : Cref,
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
            return ctx.serviceUnavailable("Service temporarily unavailable");
          }
        } else if (gateway === "monify") {
          const res = await fundWallet({
            gateway,
            userData: user,
            amount: amounWithcharges,
            ref: Mnfy,
          });
          console.log(res);
          if (res.requestSuccessful) {
            ctx.send({
              message: "success",
              response: res,
            });
          } else {
            return ctx.serviceUnavailable("Service temporarily unavailable");
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
            return ctx.serviceUnavailable("Service temporarily unavailable");
          }
        }
      } catch (err) {
        console.log(err);
        return ctx.internalServerError("Internal server error");
      }
    },
  })
);
