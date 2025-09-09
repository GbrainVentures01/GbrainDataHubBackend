"use strict";

/**
 * crypto-token controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::crypto-token.crypto-token",
  ({ strapi }) => ({
    /**
     * Clean up duplicate networks
     * GET /api/crypto-tokens/cleanup-duplicates
     */
    async cleanupDuplicates(ctx) {
      try {
        const result = await strapi
          .service("api::crypto-token.crypto-token")
          .cleanupDuplicateNetworks();

        ctx.body = {
          success: true,
          message: result.message,
          data: {
            duplicatesRemoved: result.duplicatesRemoved,
          },
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: "Failed to cleanup duplicate networks",
          error: error.message,
        };
      }
    },

    /**
     * Manually sync tokens from OBIEX
     * GET /api/crypto-tokens/sync-from-obiex
     */
    async syncFromObiex(ctx) {
      try {
        const result = await strapi
          .service("api::crypto-token.crypto-token")
          .syncTokensFromObiex();

        ctx.body = {
          success: true,
          message: result.message,
          data: result.stats,
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: "Failed to sync tokens from OBIEX",
          error: error.message,
        };
      }
    },

    /**
     * Get all active tokens with networks
     * GET /api/crypto-tokens/active
     */
    async getActiveTokens(ctx) {
      try {
        const tokens = await strapi
          .service("api::crypto-token.crypto-token")
          .getActiveTokensWithNetworks();

        ctx.body = {
          success: true,
          data: tokens,
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: "Failed to fetch active tokens",
          error: error.message,
        };
      }
    },

    /**
     * Get networks for a specific token
     * GET /api/crypto-tokens/:currencyCode/networks
     */
    async getTokenNetworks(ctx) {
      try {
        const { currencyCode } = ctx.params;
        const networks = await strapi
          .service("api::crypto-token.crypto-token")
          .getTokenNetworks(currencyCode);

        ctx.body = {
          success: true,
          data: networks,
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: "Failed to fetch token networks",
          error: error.message,
        };
      }
    },
  })
);
