"use strict";

/**
 * quidax-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::quidax-webhook.quidax-webhook",
  ({ strapi }) => ({
    /**
     * Handle webhook from Quidax
     * POST /api/quidax-webhooks
     */
    async handleWebhook(ctx) {
      try {
        const webhookData = ctx.request.body;
        console.log("📥 Received Quidax webhook:", JSON.stringify(webhookData, null, 2));

        // Log the webhook event
        await strapi.entityService.create(
          "api::quidax-webhook.quidax-webhook",
          {
            data: {
              event: webhookData.event,
              payload: webhookData,
              processed: false,
              publishedAt: new Date(),
            },
          }
        );

        // Handle different webhook events
        switch (webhookData.event) {
          case "wallet.address.generated":
            await this.handleAddressGenerated(webhookData.data);
            break;

          case "deposit.successful":
            await this.handleDepositSuccessful(webhookData.data);
            break;

          case "withdrawal.successful":
            await this.handleWithdrawalSuccessful(webhookData.data);
            break;

          default:
            console.log(`ℹ️ Unhandled Quidax webhook event: ${webhookData.event}`);
        }

        return ctx.send({
          status: "success",
          message: "Webhook received",
        });
      } catch (error) {
        console.error("❌ Quidax webhook error:", error);
        return ctx.send({
          status: "error",
          message: "Webhook processing failed",
        });
      }
    },

    /**
     * Handle wallet.address.generated event
     */
    async handleAddressGenerated(data) {
      try {
        console.log(
          `✅ Wallet address generated for ${data.currency} on ${data.network}`
        );

        // Find user by quidax_user_id
        const user = await strapi.query("plugin::users-permissions.user").findOne({
          where: { quidax_user_id: data.user.id },
        });

        if (!user) {
          console.error(`❌ User not found for Quidax ID: ${data.user.id}`);
          return;
        }

        console.log(
          `📝 Wallet address ${data.address} generated for user ${user.email}`
        );

        // You can store this in a crypto_wallets table if needed
        // For now, just log it as the address is returned synchronously in the API call

        // Mark webhook as processed
        const webhooks = await strapi.entityService.findMany(
          "api::quidax-webhook.quidax-webhook",
          {
            filters: {
              event: "wallet.address.generated",
              "payload.data.id": data.id,
            },
            limit: 1,
          }
        );

        if (webhooks.length > 0) {
          await strapi.entityService.update(
            "api::quidax-webhook.quidax-webhook",
            webhooks[0].id,
            {
              data: {
                processed: true,
              },
            }
          );
        }
      } catch (error) {
        console.error("Error handling address generated webhook:", error);
      }
    },

    /**
     * Handle deposit.successful event
     */
    async handleDepositSuccessful(data) {
      try {
        console.log(`💰 Deposit successful: ${data.amount} ${data.currency}`);
        
        // Find user by quidax_user_id
        const user = await strapi.query("plugin::users-permissions.user").findOne({
          where: { quidax_user_id: data.user?.id },
        });

        if (!user) {
          console.error(`❌ User not found for Quidax ID: ${data.user?.id}`);
          return;
        }

        // Update user's crypto balance
        // You would implement this based on your schema
        console.log(`✅ Processing deposit for user ${user.email}`);
        
        // TODO: Update user balance, create transaction record, etc.
      } catch (error) {
        console.error("Error handling deposit successful webhook:", error);
      }
    },

    /**
     * Handle withdrawal.successful event
     */
    async handleWithdrawalSuccessful(data) {
      try {
        console.log(`💸 Withdrawal successful: ${data.amount} ${data.currency}`);
        
        // Find user by quidax_user_id
        const user = await strapi.query("plugin::users-permissions.user").findOne({
          where: { quidax_user_id: data.user?.id },
        });

        if (!user) {
          console.error(`❌ User not found for Quidax ID: ${data.user?.id}`);
          return;
        }

        console.log(`✅ Processing withdrawal for user ${user.email}`);
        
        // TODO: Update transaction status, etc.
      } catch (error) {
        console.error("Error handling withdrawal successful webhook:", error);
      }
    },
  })
);
