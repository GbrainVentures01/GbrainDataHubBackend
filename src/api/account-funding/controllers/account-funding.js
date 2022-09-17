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
      const { user } = ctx.state;
      const ref = `FLW||${generateRef()}`;
      const newFunding = {
        data: {
          user: user.id,
          tx_ref: ref,
          amount: Number(amount),
          customer: user.email,
          TRX_Name: "Wallet Funding",
        },
      };
      try {
        await strapi
          .service("api::account-funding.account-funding")
          .create(newFunding);

        const res = await fundWallet({
          userData: {
            email: user.email,
          },
          amount: amount,
          ref: ref,
        });
        console.log(res);
        if (res.status === "success") {
          ctx.send({
            message: "success",
            response: res,
          });
        }
      } catch (err) {
        console.log(err);
        // console.log(err.code);
        // console.log(err.response.body);
      }
    },
  })
);
