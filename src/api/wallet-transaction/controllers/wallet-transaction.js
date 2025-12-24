"use strict";

/**
 * wallet-transfer controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::wallet-transaction.wallet-transaction",
  ({ strapi }) => ({
    /**
     * Transfer funds between wallets
     */
    async transfer(ctx) {
      const { fromWallet, toWallet, amount } = ctx.request.body;
      const userId = ctx.state.user.id;

      try {
        // Validate input
        if (!fromWallet || !toWallet || !amount) {
          return ctx.badRequest("Missing required fields");
        }

        if (amount <= 0) {
          return ctx.badRequest("Amount must be greater than zero");
        }

        if (amount < 100) {
          return ctx.badRequest("Minimum transfer amount is ₦100");
        }

        // Validate transfer rules
        // Data & Bills (AccountBalance) cannot transfer to other wallets
        if (fromWallet === "AccountBalance") {
          return ctx.badRequest(
            "Cannot transfer from Data & Bills wallet to other wallets"
          );
        }

        // Only crypto and gift card can transfer to AccountBalance
        if (
          (fromWallet !== "cryptoWalletBalance" &&
            fromWallet !== "giftCardBalance") ||
          toWallet !== "AccountBalance"
        ) {
          return ctx.badRequest("Invalid transfer direction");
        }

        // Get user with current balances
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          {
            fields: [
              "id",
              "AccountBalance",
              "cryptoWalletBalance",
              "giftCardBalance",
            ],
          }
        );

        // Check sufficient balance
        const fromBalance = user[fromWallet] || 0;
        if (fromBalance < amount) {
          return ctx.badRequest("Insufficient balance");
        }

        // Generate transaction reference
        const reference = `TXN-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`;

        // Calculate new balances
        const newFromBalance = parseFloat(fromBalance) - parseFloat(amount);
        const newToBalance =
          parseFloat(user[toWallet] || 0) + parseFloat(amount);

        // Update user balances
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: {
              [fromWallet]: newFromBalance,
              [toWallet]: newToBalance,
            },
          }
        );

        // Create transaction record
        const transaction = await strapi.entityService.create(
          "api::wallet-transaction.wallet-transaction",
          {
            data: {
              type: "transfer",
              amount: parseFloat(amount),
              fromWallet,
              toWallet,
              status: "completed",
              description: `Transfer from ${getWalletDisplayName(
                fromWallet
              )} to ${getWalletDisplayName(toWallet)}`,
              reference,
              user: userId,
              publishedAt: new Date(),
            },
          }
        );

        console.log(
          `✅ [WALLET_TRANSFER] User ${userId} transferred ₦${amount} from ${fromWallet} to ${toWallet}`
        );

        return ctx.send({
          success: true,
          message: "Transfer completed successfully",
          data: {
            fromBalance: newFromBalance,
            toBalance: newToBalance,
            transactionId: reference,
          },
        });
      } catch (error) {
        console.error("❌ [WALLET_TRANSFER] Error:", error);
        return ctx.internalServerError("Failed to process transfer");
      }
    },

    /**
     * Get wallet transaction history
     */
    async find(ctx) {
      const userId = ctx.state.user.id;

      try {
        // Build query filters
        const filters = {
          user: { id: userId },
        };

        // Apply wallet filter if specified
        const { fromWallet, toWallet } = ctx.query.filters || {};
        if (fromWallet || toWallet) {
          filters.$or = [];
          if (fromWallet) {
            filters.$or.push({ fromWallet: { $eq: fromWallet } });
          }
          if (toWallet) {
            filters.$or.push({ toWallet: { $eq: toWallet } });
          }
        }

        // Get transactions with pagination
        const { results, pagination } = await strapi.entityService.findPage(
          "api::wallet-transaction.wallet-transaction",
          {
            filters,
            sort: { createdAt: "desc" },
            pagination: ctx.query.pagination || {
              page: 1,
              pageSize: 20,
            },
            fields: [
              "type",
              "amount",
              "fromWallet",
              "toWallet",
              "status",
              "description",
              "reference",
              "createdAt",
            ],
          }
        );

        return ctx.send({
          data: results.map((transaction) => ({
            id: transaction.id,
            attributes: {
              type: transaction.type,
              amount: transaction.amount,
              fromWallet: transaction.fromWallet,
              toWallet: transaction.toWallet,
              status: transaction.status,
              description: transaction.description,
              reference: transaction.reference,
              createdAt: transaction.createdAt,
            },
          })),
          meta: {
            pagination,
          },
        });
      } catch (error) {
        console.error("❌ [WALLET_TRANSACTIONS] Error:", error);
        return ctx.internalServerError("Failed to fetch transactions");
      }
    },
  })
);

/**
 * Get display name for wallet field
 */
function getWalletDisplayName(fieldName) {
  const displayNames = {
    AccountBalance: "Data & Bills",
    cryptoWalletBalance: "Crypto Wallet",
    giftCardBalance: "Gift Card",
  };
  return displayNames[fieldName] || fieldName;
}
