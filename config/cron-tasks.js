module.exports = {
  /**
   * Sync crypto tokens and networks from OBIEX daily at midnight
   * This cron job fetches supported tokens from OBIEX and updates the local database
   */
  syncCryptoTokensFromObiex: {
    task: async ({ strapi }) => {
      try {
        console.log("� Starting daily OBIEX token synchronization...");

        const result = await strapi
          .service("api::crypto-token.crypto-token")
          .syncTokensFromObiex();

        console.log(
          "🎉 Daily OBIEX token synchronization completed successfully!"
        );
        console.log("📊 Sync Results:", result.stats);
      } catch (error) {
        console.error(
          "❌ Daily OBIEX token synchronization failed:",
          error.message
        );
        console.error("Error details:", error);
      }
    },
    options: {
      rule: "0 0 * * *", // Every day at midnight (minute hour day month day-of-week)
      tz: "Africa/Lagos", // Nigeria timezone
    },
  },
};
