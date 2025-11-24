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
          select: ["id", "email", "username", "quidax_user_id", "quidax_sn"],
        });

      if (!user) {
        return ctx.badRequest("User not found");
      }

      // Get active crypto provider
      const provider = cryptoProviderFactory.getActiveProvider();
      console.log(
        `🔄 Generating deposit address using ${provider.getProviderName()}`
      );

      // Setup user account on the provider (creates sub-account if needed)
      const accountSetup = await provider.setupUserAccount(user);

      if (!accountSetup.success) {
        throw new ApplicationError("Failed to setup crypto account");
      }

      // Update user record if needed (e.g., save quidax_user_id)
      if (accountSetup.needsUpdate && accountSetup.updateData) {
        await strapi.query("plugin::users-permissions.user").update({
          where: { id: userId },
          data: accountSetup.updateData,
        });

        console.log(
          `✅ User ${userId} updated with provider account details`
        );
      }

      // Generate wallet address using the user identifier from account setup
      const depositAddressResponse = await provider.generateDepositAddress(
        accountSetup.userIdentifier,
        currency,
        network
      );

      // Return the response from provider
      return ctx.send({
        message: "Deposit address generated successfully",
        provider: provider.getProviderName(),
        data: {
          ...depositAddressResponse.data,
          is_new_account: accountSetup.isNewAccount || false,
        },
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
