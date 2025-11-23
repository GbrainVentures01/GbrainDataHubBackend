"use strict";

const { ApplicationError } = require("@strapi/utils/lib/errors");
const cryptoProviderFactory = require("../../../utils/crypto/crypto-provider-factory");

/**
 * crypto controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::crypto.crypto", ({ strapi }) => ({
  /**
   * Generate deposit address for crypto
   * POST /api/crypto/deposit
   * @param {Object} ctx - Koa context
   * @returns {Object} - Deposit address details from active crypto provider
   */
  async generateDepositAddress(ctx) {
    try {
      const { currency, network } = ctx.request.body;

      // Validate required fields
      if (!currency) {
        return ctx.badRequest("Currency is required");
      }

      if (!network) {
        return ctx.badRequest("Network is required");
      }

      // Get authenticated user
      const { id: userId } = ctx.state.user;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      // Get user details
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ 
          where: { id: userId },
          select: ['id', 'email', 'username', 'quidax_user_id', 'quidax_sn']
        });

      if (!user) {
        return ctx.badRequest("User not found");
      }

      // Get active crypto provider
      const provider = cryptoProviderFactory.getActiveProvider();
      console.log(
        `🔄 Generating deposit address using ${provider.getProviderName()}`
      );

      let depositAddressResponse;

      // Handle Quidax-specific flow
      if (provider.getProviderName() === "Quidax") {
        // Check if user has Quidax sub-account
        if (!user.quidax_user_id) {
          console.log(
            `📝 User ${userId} doesn't have Quidax sub-account. Creating one...`
          );

          // Extract first and last name from username or email
          const nameParts = (user.username || user.email.split('@')[0]).split(' ');
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts[1] || nameParts[0];

          // Create Quidax sub-account
          try {
            const subAccountResult = await provider.createSubAccount({
              email: user.email,
              first_name: firstName,
              last_name: lastName,
            });

            // Update user with Quidax details
            await strapi.query("plugin::users-permissions.user").update({
              where: { id: userId },
              data: {
                quidax_user_id: subAccountResult.data.quidax_user_id,
                quidax_sn: subAccountResult.data.quidax_sn,
              },
            });

            console.log(
              `✅ Quidax sub-account created and saved for user ${userId}`
            );

            // Generate wallet address for the new sub-account
            const walletResult = await provider.getOrCreateWalletAddress(
              subAccountResult.data.quidax_user_id,
              currency
            );

            depositAddressResponse = {
              data: {
                ...walletResult.data,
                is_new_account: true,
              },
            };
          } catch (error) {
            console.error("Failed to create Quidax sub-account:", error);
            throw new ApplicationError(
              "Failed to create crypto account. Please try again."
            );
          }
        } else {
          // User already has Quidax sub-account, just get/create wallet address
          console.log(
            `✅ User ${userId} already has Quidax sub-account: ${user.quidax_user_id}`
          );

          const walletResult = await provider.getOrCreateWalletAddress(
            user.quidax_user_id,
            currency
          );

          depositAddressResponse = {
            data: {
              ...walletResult.data,
              is_new_account: false,
            },
          };
        }
      } else {
        // For Obiex and other providers, use standard flow
        const uniqueUserIdentifier = `user_${userId}`;
        depositAddressResponse = await provider.generateDepositAddress(
          uniqueUserIdentifier,
          currency,
          network
        );
      }

      // Return the response from provider
      return ctx.send({
        message: "Deposit address generated successfully",
        provider: provider.getProviderName(),
        data: depositAddressResponse.data,
      });
    } catch (error) {
      console.error("Crypto deposit address generation error:", error);

      // Handle specific provider API errors
      if (error.response?.data) {
        return ctx.badRequest(
          error.response.data.message || "Failed to generate deposit address"
        );
      }

      throw new ApplicationError("Failed to generate deposit address");
    }
  },
}));
