module.exports = {
  /**
   * Test OBIEX API authentication every minute
   * This cron job tests the getSupportedTokens and getTradableSwapCurrencies endpoints
   * to ensure authentication is working properly
   */
  testObiexAuthentication: {
    task: async ({ strapi }) => {
      try {
        const obiexAPI = require("../src/utils/obiex/obiex_utils");

        console.log("🔄 Testing OBIEX API authentication...");

        // Test getSupportedTokens endpoint
        console.log("📋 Fetching supported tokens...");
        const supportedTokens = await obiexAPI.getSupportedTokens();
        console.log(
          "✅ Supported tokens fetched successfully:",
          supportedTokens,
          "tokens"
        );

        // Test getTradableSwapCurrencies endpoint
        console.log("💱 Fetching tradable swap currencies...");
        const tradableCurrencies = await obiexAPI.getTradableSwapCurrencies();
        console.log(
          "✅ Tradable currencies fetched successfully:",
          tradableCurrencies,
          "currencies"
        );

        console.log("🎉 OBIEX API authentication test completed successfully!");
      } catch (error) {
        console.error(
          "❌ OBIEX API authentication test failed:",
          error.message
        );
        console.error("Error details:", error.response?.data || error);
      }
    },
    options: {
      rule: "* * * * *", // Every minute (minute hour day month day-of-week)
      tz: "Africa/Lagos", // Nigeria timezone
    },
  },
};
