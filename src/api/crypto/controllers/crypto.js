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

  /**
   * Record crypto deposit transaction
   * POST /api/crypto/record-deposit
   * @param {Object} ctx - Koa context
   * @returns {Object} - Created account funding record
   */
  async recordDeposit(ctx) {
    try {
      const {
        tx_hash,
        amount,
        currency,
        network,
        wallet_address,
        destination_tag,
        provider,
        confirmations = 0,
        required_confirmations = 1,
      } = ctx.request.body;

      // Validate required fields
      if (!tx_hash || !amount || !currency || !network) {
        return ctx.badRequest(
          "tx_hash, amount, currency, and network are required"
        );
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
          select: ["id", "email", "username"],
        });

      if (!user) {
        return ctx.badRequest("User not found");
      }

      // Create account funding record for crypto deposit
      const depositRecord = await strapi
        .query("api::account-funding.account-funding")
        .create({
          data: {
            TRX_Name: `${currency.toUpperCase()} Deposit on ${network}`,
            tx_ref: tx_hash,
            amount: parseFloat(amount),
            customer: user.email,
            status: confirmations >= required_confirmations ? "Success" : "Confirming",
            funding_type: "crypto_deposit",
            provider: provider || process.env.CRYPTO_PROVIDER || "obiex",
            currency: currency.toUpperCase(),
            network: network,
            wallet_address: wallet_address,
            destination_tag: destination_tag,
            tx_hash: tx_hash,
            confirmations: confirmations,
            required_confirmations: required_confirmations,
            received_at: new Date(),
            user: userId,
            notes: `Deposit received from ${wallet_address}`,
          },
        });

      console.log(`✅ Crypto deposit recorded: ${tx_hash}`);

      return ctx.send({
        success: true,
        message: "Crypto deposit recorded successfully",
        data: {
          id: depositRecord.id,
          tx_hash: depositRecord.tx_hash,
          amount: depositRecord.amount,
          currency: depositRecord.currency,
          status: depositRecord.status,
          confirmations: depositRecord.confirmations,
        },
      });
    } catch (error) {
      console.error("Error recording crypto deposit:", error);
      throw new ApplicationError("Failed to record crypto deposit");
    }
  },

  /**
   * Update deposit confirmation status
   * PUT /api/crypto/update-deposit/:id
   * @param {Object} ctx - Koa context
   * @returns {Object} - Updated account funding record
   */
  async updateDepositStatus(ctx) {
    try {
      const { id } = ctx.params;
      const { confirmations, status } = ctx.request.body;

      if (!id) {
        return ctx.badRequest("Deposit ID is required");
      }

      // Verify user owns this deposit record
      const deposit = await strapi
        .query("api::account-funding.account-funding")
        .findOne({
          where: { id: parseInt(id) },
          populate: ["user"],
        });

      if (!deposit) {
        return ctx.notFound("Deposit record not found");
      }

      // Check authorization
      const { id: userId } = ctx.state.user;
      if (deposit.user.id !== userId && !ctx.state.isAdmin) {
        return ctx.forbidden("Not authorized to update this record");
      }

      // Update the record
      const updatedDeposit = await strapi
        .query("api::account-funding.account-funding")
        .update({
          where: { id: parseInt(id) },
          data: {
            confirmations: confirmations !== undefined ? confirmations : deposit.confirmations,
            status: status || deposit.status,
            completed_at: status === "Success" || status === "Completed" ? new Date() : deposit.completed_at,
          },
        });

      console.log(`✅ Deposit ${id} updated: ${updatedDeposit.status}`);

      return ctx.send({
        success: true,
        message: "Deposit status updated",
        data: updatedDeposit,
      });
    } catch (error) {
      console.error("Error updating deposit status:", error);
      throw new ApplicationError("Failed to update deposit status");
    }
  },
}));

