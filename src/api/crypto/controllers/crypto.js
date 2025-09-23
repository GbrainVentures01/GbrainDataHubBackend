"use strict";

const { ApplicationError } = require("@strapi/utils/lib/errors");
const obiexAPI = require("../../../utils/obiex/obiex_utils");

/**
 * crypto controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::crypto.crypto", ({ strapi }) => ({
  /**
   * Generate deposit address for crypto
   * POST /api/crypto/deposit
   * @param {Object} ctx - Koa context
   * @returns {Object} - Deposit address details from Obiex
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

      // Get user details to create unique identifier
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: userId } });

      if (!user) {
        return ctx.badRequest("User not found");
      }

      // Create a consistent unique user identifier
      // Using user ID as the unique identifier to ensure consistency
      const uniqueUserIdentifier = `user_${userId}`;

      // Call Obiex API to generate deposit address
      const obiexResponse = await obiexAPI.generateDepositAddress(
        uniqueUserIdentifier,
        currency,
        network
      );

      // Return the response from Obiex
      return ctx.send({
        message: "Deposit address generated successfully",
        data: obiexResponse.data,
      });
    } catch (error) {
      console.error("Crypto deposit address generation error:", error);

      // Handle specific Obiex API errors
      if (error.response?.data) {
        return ctx.badRequest(
          error.response.data.message || "Failed to generate deposit address"
        );
      }

      throw new ApplicationError("Failed to generate deposit address");
    }
  },
}));
