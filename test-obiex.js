require("dotenv").config();
const obiexAPI = require("./src/utils/obiex/obiex_utils");

async function testObiexAuth() {
  try {
    console.log("🔄 Testing OBIEX API authentication...");

    // Test getSupportedTokens endpoint
    console.log("📋 Fetching supported tokens...");
    const supportedTokens = await obiexAPI.getSupportedTokens();
    console.log(
      "✅ Supported tokens response:",
      JSON.stringify(supportedTokens, null, 2)
    );

    // Test getTradableSwapCurrencies endpoint
    console.log("💱 Fetching tradable swap currencies...");
    const tradableCurrencies = await obiexAPI.getTradableSwapCurrencies();
    console.log(
      "✅ Tradable currencies response:",
      JSON.stringify(tradableCurrencies, null, 2)
    );

    console.log("🎉 OBIEX API authentication test completed successfully!");
  } catch (error) {
    console.error("❌ OBIEX API authentication test failed:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
      console.error("Headers:", error.response.headers);
    }
  }
}

testObiexAuth();
