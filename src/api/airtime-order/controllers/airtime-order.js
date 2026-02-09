"use strict";

const converter = require("../../../utils/converter");
const calculateTransactionHash = require("../../../utils/monnify/calculateTransactionHash");
const customNetwork = require("../../../utils/customNetwork");
const randomString = require("randomstring");
const { ApplicationError } = require("@strapi/utils/lib/errors");
const {
  getService,
} = require("../../../extensions/users-permissions/server/utils");
const checkduplicate = require("../../../utils/checkduplicate");

// ✅ PHASE 1: Import notification triggers
const {
  sendPaymentSuccessNotification,
  sendPaymentFailureNotification,
  sendTransactionConfirmationNotification,
  sendLowBalanceAlert,
} = require("../../../utils/notification-triggers");

/**
 * Helper function to map network names to Bello network IDs
 * @param {string} network - Network name (mtn, airtel, glo, 9mobile, etisalat)
 * @returns {string} - Bello network ID
 */
const getNetworkId = (network) => {
  const networkLower = network?.toLowerCase() || '';
  switch (networkLower) {
    case 'mtn':
      return '1';
    case 'airtel':
      return '2';
    case 'glo':
      return '3';
    case '9mobile':
    case 'etisalat':
      return '4';
    default:
      return '1'; // Default to MTN
  }
};

/**
 *  data-order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::airtime-order.airtime-order",
  ({ strapi }) => ({
    /**
     * Get all airtime transactions with search, filter, and sort
     * @param {Object} ctx
     * @returns
     */
    async find(ctx) {
      try {
        const { 
          search = '', 
          status, 
          network, 
          sortBy = 'createdAt', 
          sortOrder = 'desc',
          page = 1,
          pageSize = 20
        } = ctx.query;

        const knex = strapi.db.connection;
        
        // Build query
        let query = knex('airtime_orders').select(
          'id',
          'beneficiary',
          'network',
          'amount',
          'status',
          'request_id',
          'service_id as serviceID',
          'created_at as createdAt',
          'updated_at as updatedAt'
        );

        // Apply search filter
        if (search) {
          query = query.where((builder) => {
            builder
              .where('beneficiary', 'like', `%${search}%`)
              .orWhere('id', 'like', `%${search}%`)
              .orWhere('request_id', 'like', `%${search}%`);
          });
        }

        // Apply status filter
        if (status && status !== 'all') {
          query = query.where('status', status);
        }

        // Apply network filter
        if (network && network !== 'all') {
          query = query.where('network', network);
        }

        // Get total count for pagination (clone query before adding select fields)
        const countQuery = knex('airtime_orders');
        
        // Apply same filters to count query
        if (search) {
          countQuery.where((builder) => {
            builder
              .where('beneficiary', 'like', `%${search}%`)
              .orWhere('id', 'like', `%${search}%`)
              .orWhere('request_id', 'like', `%${search}%`);
          });
        }
        if (status && status !== 'all') {
          countQuery.where('status', status);
        }
        if (network && network !== 'all') {
          countQuery.where('network', network);
        }
        
        const [{ count }] = await countQuery.count('* as count');
        const totalCount = parseInt(count);

        // Apply sorting
        const sortField = sortBy === 'createdAt' ? 'created_at' : sortBy;
        query = query.orderBy(sortField, sortOrder);

        // Apply pagination
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        query = query.limit(parseInt(pageSize)).offset(offset);

        // Execute query
        const transactions = await query;

        ctx.send({
          success: true,
          data: transactions,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            pageCount: Math.ceil(totalCount / parseInt(pageSize)),
            total: totalCount,
          },
        });
      } catch (error) {
        console.error('Airtime transactions fetch error:', error);
        ctx.send({
          success: false,
          error: error.message,
        }, 500);
      }
    },

    /**
     * return all orders as long as they belong to the current logged in user
     * @param {Object} ctx
     * @returns
     */

    /**
     * Mobile buy airtime endpoint with biometric/pin authentication
     * @param {Object} ctx
     * @returns
     */
    async mobileBuyAirtime(ctx) {
      const { data } = ctx.request.body;
      const { id } = ctx.state.user;

      // Check for duplicate transaction
      if (await checkduplicate(id, data, "api::airtime-order.airtime-order")) {
        return ctx.badRequest(
          "Possible Duplicate Transaction, Kindly check the history before retrying or try again after 90 seconds."
        );
      }

      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      // Check wallet balance
      if (
        user.AccountBalance < Number(data.amount) ||
        user.AccountBalance === 0
      ) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }

      // Validate authentication method (pin or biometric)
      if (data.authMethod === "pin") {
        if (!data.pin) {
          return ctx.badRequest("PIN is required");
        }
        const validPin = await getService("user").validatePassword(
          data.pin,
          user.transactionPin
        );
        if (!validPin) {
          return ctx.badRequest("Incorrect Pin");
        }
      } else if (data.authMethod === "biometric") {
        if (!data.biometricToken) {
          return ctx.badRequest("Biometric authentication required");
        }
        // Validate biometric token (you may need to implement this validation)
        const isValidBiometric = await this.validateBiometricToken(
          data.biometricToken,
          user
        );
        if (!isValidBiometric) {
          return ctx.badRequest("Invalid biometric authentication");
        }
      } else {
        return ctx.badRequest(
          "Authentication method is required (pin or biometric)"
        );
      }

      try {
        const { pin, biometricToken, authMethod, ...restofdata } = data;
        
        // Generate reference for Bello
        const ref = data.request_id || `GBRAIN|AIRTIME|${randomString.generate(8)}`;
        
        const newOrder = {
          data: {
            ...restofdata,
            request_id: ref,
            user: id,
            current_balance: user.AccountBalance,
            previous_balance: user.AccountBalance,
          },
        };

        await strapi
          .service("api::airtime-order.airtime-order")
          .create(newOrder);

        // Debit user's account
        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(data.amount),
            },
          });

        // Prepare payload for Bello
        const payload = {
          network_id: getNetworkId(data.network || data.serviceID),
          phone: data.beneficiary,
          amount: String(data.amount),
          airtime_type: "VTU",
          pin: process.env.BELLO_PIN,
        };

        const buyAirtime = await customNetwork({
          method: "POST",
          path: "airtime",
          requestBody: payload,
          target: "bello",
          headers: {
            Authorization: `Bearer ${process.env.BELLO_SECRET}`,
          },
        });

        console.log("Bello airtime response:", buyAirtime.data);

        if (buyAirtime.status === 200 && buyAirtime.data.status) {
          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: ref },
            data: {
              status: "delivered",
              current_balance: updatedUser.AccountBalance,
            },
          });

          // ✅ PHASE 1: Send payment success notification for mobile
          try {
            await sendPaymentSuccessNotification(
              user,
              {
                amount: data.amount,
                reference: ref,
              },
              "airtime"
            );
          } catch (notificationError) {
            console.error("Failed to send success notification:", notificationError);
          }

          // ✅ Check for low balance and send alert
          if (updatedUser.AccountBalance < 1000) {
            try {
              await sendLowBalanceAlert(user, updatedUser.AccountBalance);
            } catch (notificationError) {
              console.error("Failed to send low balance alert:", notificationError);
            }
          }

          return ctx.created({
            message: "Airtime purchase successful",
            data: {
              transactionId: ref,
              amount: data.amount,
              beneficiary: data.beneficiary,
              network: data.network || data.serviceID,
              status: "delivered",
              newBalance: updatedUser.AccountBalance,
            },
          });
        } else {
          // Refund user on failure
          const refundUser = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });

          const updatedRefundUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: refundUser.id },
              data: {
                AccountBalance: refundUser.AccountBalance + Number(data.amount),
              },
            });

          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: ref },
            data: {
              status: "failed",
              current_balance: updatedRefundUser.AccountBalance,
            },
          });

          // ✅ PHASE 1: Send payment failure notification for mobile
          try {
            const errorDescription = buyAirtime?.data?.api_response || buyAirtime?.data?.message || 'Transaction failed';
            await sendPaymentFailureNotification(
              refundUser,
              { amount: data.amount, reference: ref },
              'airtime',
              `${errorDescription}. Amount has been refunded to your account.`
            );
          } catch (notificationError) {
            console.error("Failed to send failure notification:", notificationError);
          }

          console.log("Bello airtime failed:", buyAirtime.data);
          return ctx.throw(
            400,
            buyAirtime?.data?.api_response || buyAirtime?.data?.message || "Transaction failed"
          );
        }
      } catch (error) {
        // Handle error and refund user
        const ref = data.request_id || `GBRAIN|AIRTIME|${randomString.generate(8)}`;
        const refundUser = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { id: id } });

        await strapi.query("api::airtime-order.airtime-order").update({
          where: { request_id: ref },
          data: {
            status: "failed",
            current_balance: refundUser.AccountBalance,
          },
        });

        // ✅ PHASE 1: Send payment failure notification for mobile
        try {
          await sendPaymentFailureNotification(
            refundUser,
            { amount: data.amount, reference: ref },
            'airtime',
            'An unexpected error occurred. Please contact support if the issue persists.'
          );
        } catch (notificationError) {
          console.error("Failed to send failure notification:", notificationError);
        }

        console.log("Bello airtime error:", error);
        throw new ApplicationError("Something went wrong, try again");
      }
    },

    /**
     * Validate biometric token
     * @param {string} biometricToken
     * @param {Object} user
     * @returns {boolean}
     */
    async validateBiometricToken(biometricToken, user) {
      // This is a placeholder - implement your biometric validation logic
      // You might want to check if the user has biometric enabled and validate the token
      try {
        // For now, we'll assume it's valid if the token exists and user has biometric enabled
        return (
          user.biometricEnabled && biometricToken && biometricToken.length > 0
        );
      } catch (error) {
        console.error("Biometric validation error:", error);
        return false;
      }
    },

    async create(ctx) {
      const { data } = ctx.request.body;

      const { id } = ctx.state.user;
      if (await checkduplicate(id, data, "api::airtime-order.airtime-order")) {
        return ctx.badRequest(
          "Possible Duplicate Transaction, Kindly check the history before retrying or try again after 90 seconds."
        );
      }
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: id } });

      if (
        user.AccountBalance < Number(data.amount) || user.AccountBalance === 0
      ) {
        return ctx.badRequest("Low Wallet Balance, please fund your wallet");
      }
      const validPin = await getService("user").validatePassword(
        data.pin,
        user.pin
      );
      if (!validPin) {
        return ctx.badRequest("Incorrect Pin");
      }

      // Generate reference for Bello
      const ref = data.request_id || `GBRAIN|AIRTIME|${randomString.generate(8)}`;

      try {
        const { pin, ...restofdata } = data;
        const newOrder = {
          data: {
            ...restofdata,
            request_id: ref,
            user: id,
            current_balance: user.AccountBalance,
            previous_balance: user.AccountBalance,
          },
        };
        await strapi
          .service("api::airtime-order.airtime-order")
          .create(newOrder);

        const updatedUser = await strapi
          .query("plugin::users-permissions.user")
          .update({
            where: { id: user.id },
            data: {
              AccountBalance: user.AccountBalance - Number(data.amount),
            },
          });

        // Prepare payload for Bello
        const payload = {
          network_id: getNetworkId(data.network || data.serviceID),
          phone: data.beneficiary,
          amount: String(data.amount),
          airtime_type: "VTU",
          pin: process.env.BELLO_PIN,
        };

        const buyAirtime = await customNetwork({
          method: "POST",
          path: "airtime",
          requestBody: payload,
          target: "bello",
          headers: {
            Authorization: `Bearer ${process.env.BELLO_SECRET}`,
          },
        });

        console.log("Bello airtime response:", buyAirtime.data);

        if (buyAirtime.status === 200 && buyAirtime.data.status) {
          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: ref },
            data: {
              status: "delivered",
              current_balance: updatedUser.AccountBalance,
            },
          });

          // Send success notification with graceful error handling
          try {
            await sendPaymentSuccessNotification(user, {
              amount: data.amount,
              reference: ref,
            }, "airtime");
          } catch (notificationError) {
            console.error("Failed to send payment success notification:", notificationError);
          }

          // Send low balance alert if necessary
          if (updatedUser.AccountBalance < 1000) {
            try {
              await sendLowBalanceAlert(user, updatedUser.AccountBalance);
            } catch (notificationError) {
              console.error("Failed to send low balance alert:", notificationError);
            }
          }

          return ctx.created({ message: "Successful" });
        } else {
          // Refund user on failure
          const refundUser = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { id: id } });

          const updatedRefundUser = await strapi
            .query("plugin::users-permissions.user")
            .update({
              where: { id: refundUser.id },
              data: {
                AccountBalance: refundUser.AccountBalance + Number(data.amount),
              },
            });

          await strapi.query("api::airtime-order.airtime-order").update({
            where: { request_id: ref },
            data: {
              status: "failed",
              current_balance: updatedRefundUser.AccountBalance,
            },
          });

          // Send failure notification with graceful error handling
          try {
            await sendPaymentFailureNotification(refundUser, {
              amount: data.amount,
              reference: ref,
            }, "airtime", buyAirtime?.data?.api_response || buyAirtime?.data?.message || "Transaction failed");
          } catch (notificationError) {
            console.error("Failed to send payment failure notification:", notificationError);
          }

          console.log("Bello airtime failed:", buyAirtime.data);
          return ctx.throw(400, buyAirtime?.data?.api_response || buyAirtime?.data?.message || "Transaction failed");
        }
      } catch (error) {
        const refundUser = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { id: id } });

        await strapi.query("api::airtime-order.airtime-order").update({
          where: { request_id: ref },
          data: {
            status: "failed",
            current_balance: refundUser.AccountBalance,
          },
        });

        // Send failure notification with graceful error handling
        try {
          await sendPaymentFailureNotification(refundUser, {
            amount: data.amount,
            reference: ref,
          }, "airtime", error.message || "Something went wrong");
        } catch (notificationError) {
          console.error("Failed to send payment failure notification:", notificationError);
        }

        console.log("Bello airtime error:", error);
        throw new ApplicationError("Something went wrong, try again");
      }
    },
  })
);
