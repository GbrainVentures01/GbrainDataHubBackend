"use strict";

const { default: axios } = require("axios");
const fundWallet = require("../../../utils/monnify/fundWallet");
const generateRef = require("../../../utils/monnify/generateRef");
const getToken = require("../../../utils/monnify/getToken");
const createReservedAccount = require("../../../utils/monnify/createReservedAccount");
const customNetwork = require("../../../utils/customNetwork");
const generatePalmpayAccount = require("../../../utils/monnify/generatePayVesselAccount");
const generatePayVesselAccount = require("../../../utils/monnify/generatePayVesselAccount");

/**
 *  account-funding controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::account-funding.account-funding",
  ({ strapi }) => ({
    async generateMonnifyAccount(ctx) {
      const user = ctx.state.user;
      const monifyToken = await getToken();
      const res = await createReservedAccount({
        token: monifyToken,
        userData: user,
      });
      console.log(res);

      if (res?.requestSuccessful) {
        const newData = res?.responseBody?.accounts.map((account) => {
          return {
            bank_name: account.bankName,
            account_number: account.accountNumber,
            account_name: account.accountName,
          };
        });

        await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: {
              monnify_bank_details: [...newData],
              hasAccountNum: true,
            },
          }
        );
        return ctx.created("account created successfully");
      } else {
        return ctx.badRequest("account creation failed");
      }
    },

    async generatePayVesselAccount(ctx) {
      const { bvn } = ctx.request.body.data;
      if (!bvn) {
        return ctx.badRequest("bvn is required");
      }
      const user = ctx.state.user;
      try {
        const UserFromDb = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: user.id },
          });
        if (!UserFromDb) {
          return ctx.badRequest("user not found");
        }
        const phone_number =
          user.phone_number.length < 11
            ? `0${user?.phone_number}`
            : user.phone_number;
        const res = await generatePayVesselAccount({
          userData: user,
          requestBody: {
            email: user.email,
            name: user.first_name + " " + user.last_name,
            phoneNumber: phone_number,
            bankcode: ["120001"],
            account_type: "STATIC",
            businessid: process.env.PAYVESSEL_BUSINESS_ID,
            bvn: bvn,
            // nin: nin,
          },
        });
        console.log(res);

        if (res?.status) {
          const newData = res?.responseBody?.banks.map((account) => {
            return {
              bankName: account.bankName,
              accountNumber: account.accountNumber,
              accountName: account.accountName,
              account_type: account.account_type,
              expire_date: account.expire_date,
              trackingReference: account.trackingReference,
            };
          });

          await strapi.entityService.update(
            "plugin::users-permissions.user",
            user.id,
            {
              data: {
                payvessel_accounts: [
                  ...UserFromDb.payvessel_accounts,
                  ...newData,
                ],
                updateBvn: true,
                hasAccountNum: true,
              },
            }
          );
          return ctx.created("account generated successfully");
        } else {
          return ctx.badRequest("account generation failed");
        }
      } catch (error) {
        console.log(error);
        return ctx.internalServerError("something went wrong");
      }
    },
    async updateUserBvn(ctx) {
      const { bvn } = ctx.request.body.data;
      if (!bvn) {
        return ctx.badRequest("bvn  is required");
      }
      const user = ctx.state.user;
      const monifyToken = await getToken();
      const UserFromDb = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: user.id },
          populate: {
            monnify_bank_details: true,
            payvessel_accounts: true,
          },
        });
      console.log({ UserFromDb });
      if (
        !UserFromDb.updateBvn &&
        UserFromDb.monnify_bank_details.length === 0
      ) {
        try {
          const acc = await createReservedAccount({
            token: monifyToken,
            userData: user,
            bvn: bvn,
          });
          if (!acc?.requestSuccessful)
            return ctx.badRequest(
              acc?.errorMessage ?? "unable to generate virtual account"
            );
          if (acc?.requestSuccessful) {
            const newData = acc?.responseBody?.accounts.map((account) => {
              return {
                bank_name: account.bankName,
                account_number: account.accountNumber,
                account_name: account.accountName,
              };
            });
            console.log("MONNIFY: ", newData);

            await strapi.entityService.update(
              "plugin::users-permissions.user",
              user.id,
              {
                data: {
                  monnify_bank_details: [
                    ...UserFromDb.monnify_bank_details,
                    ...newData,
                  ],
                  updateBvn: true,
                  hasAccountNum: true,
                },
              }
            );
            // update({
            //   where: { id: user.id },
            //   data: {
            //     monnify_account_details: [...UserFromDb.monnify_account_details, ...newData],
            //     updateBvn: true,
            //   },
            // });
            return ctx.created("account created successfully");
          }
        } catch (error) {
          console.log(error);
          return ctx.internalServerError("something went wrong");
        }
      }

      if (!UserFromDb.updateBvn && UserFromDb.payvessel_accounts.length === 0) {
        try {
          const phone_number =
            user.phone_number.length < 11
              ? `0${user?.phone_number}`
              : user.phone_number;
          const res = await generatePayVesselAccount({
            userData: user,
            requestBody: {
              email: user.email,
              name: user.first_name + " " + user.last_name,
              phoneNumber: phone_number, //user.phone_number,
              bankcode: ["120001"],
              account_type: "STATIC",
              businessid: process.env.PAYVESSEL_BUSINESS_ID,
              bvn: bvn,
              // nin: nin,
            },
          });
          console.log(res);

          if (res?.status) {
            const newData = res?.responseBody?.banks.map((account) => {
              return {
                bankName: account.bankName,
                accountNumber: account.accountNumber,
                accountName: account.accountName,
                account_type: account.account_type,
                expire_date: account.expire_date,
                trackingReference: account.trackingReference,
              };
            });

            await strapi.entityService.update(
              "plugin::users-permissions.user",
              user.id,
              {
                data: {
                  payvessel_accounts: [
                    ...UserFromDb.payvessel_accounts,
                    ...newData,
                  ],
                  updateBvn: true,
                  hasAccountNum: true,
                },
              }
            );
            return ctx.created(" successful operation");
          } else {
            return ctx.badRequest("operation failed");
          }
        } catch (error) {
          console.log(error);
          return ctx.internalServerError("something went wrong");
        }
      }

      const { data } = await customNetwork({
        method: "PUT",
        path: `api/v1/bank-transfer/reserved-accounts/update-customer-bvn/${user.email}`,
        target: "monify",
        headers: { Authorization: `Bearer ${monifyToken}` },
        requestBody: {
          bvn: bvn,
        },
      });

      if (data?.requestSuccessful) {
        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            updateBvn: true,
          },
        });
        return ctx.created("bvn updated successfully");
      } else {
        return ctx.internalServerError("bvn update failed");
      }
    },

    /**
     * initiate account funding with flutter wave
     * @param {Object} ctx
     * @returns
     */

    async create(ctx) {
      console.log("ROUTE HIT");
      const amount = ctx.request.body.data.amount;
      const gateway = ctx.request.body.data.gateway;
      const { user } = ctx.state;
      if (gateway === "credo")
        return ctx.serviceUnavailable("Service temporarily unavailable");

      const Fref = `FLW||${generateRef()}`;
      const Cref = `CREDO||${generateRef()}`;
      const Mnfy = `MFY||${generateRef()}`;
      const amountToNumber = Number(amount);
      const amounWithcharges = amountToNumber + (amountToNumber / 100) * 1.65;

      console.log("amounWithcharges", amounWithcharges.toFixed(2));
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
            amount: amounWithcharges.toFixed(2),
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
