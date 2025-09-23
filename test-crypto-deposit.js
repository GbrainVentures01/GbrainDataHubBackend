require("dotenv").config();
const obiexAPI = require("./src/utils/obiex/obiex_utils");

async function testDepositAddressGeneration() {
  try {
    console.log("🔄 Testing Crypto Deposit Address Generation...");

    // Test data - using the format specified in the requirements
    const testData = {
      uniqueUserIdentifier: "user_12345", // Example user identifier
      currency: "ETH",
      network: "ETH",
    };

    console.log("📋 Test payload:", JSON.stringify(testData, null, 2));

    // Test generateDepositAddress endpoint
    console.log("🏦 Generating deposit address...");
    const depositResponse = await obiexAPI.generateDepositAddress(
      testData.uniqueUserIdentifier,
      testData.currency,
      testData.network
    );

    console.log("✅ Deposit address response:");
    console.log(JSON.stringify(depositResponse, null, 2));

    // Verify response structure matches expected format
    if (depositResponse && depositResponse.data) {
      const { data } = depositResponse;
      console.log("\n📊 Response Analysis:");
      console.log("- Address:", data.value || "Not provided");
      console.log("- Reference:", data.reference || "Not provided");
      console.log("- Network:", data.network || "Not provided");
      console.log("- Purpose:", data.purpose || "Not provided");
      console.log("- User ID:", data.userId || "Not provided");
      console.log("- Created At:", data.createdAt || "Not provided");
    }

    console.log(
      "\n🎉 Crypto deposit address generation test completed successfully!"
    );
  } catch (error) {
    console.error(
      "❌ Crypto deposit address generation test failed:",
      error.message
    );
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
      console.error("Headers:", error.response.headers);
    }
  }
}

async function testMultipleCurrencies() {
  try {
    console.log("\n🔄 Testing Multiple Currency/Network Combinations...");

    const testCases = [
      { currency: "ETH", network: "ETH" },
      { currency: "USDT", network: "ETH" },
      { currency: "BTC", network: "BTC" },
      { currency: "USDC", network: "ETH" },
    ];

    for (const testCase of testCases) {
      try {
        console.log(
          `\n💰 Testing ${testCase.currency} on ${testCase.network}...`
        );
        const response = await obiexAPI.generateDepositAddress(
          "user_test_12345",
          testCase.currency,
          testCase.network
        );
        console.log(`✅ ${testCase.currency}/${testCase.network} - Success`);
        console.log("Address:", response.data?.value || "Not provided");
      } catch (error) {
        console.error(
          `❌ ${testCase.currency}/${testCase.network} - Failed:`,
          error.response?.data?.message || error.message
        );
      }
    }
  } catch (error) {
    console.error("❌ Multiple currencies test failed:", error.message);
  }
}

async function runAllTests() {
  await testDepositAddressGeneration();
  await testMultipleCurrencies();
}

runAllTests();
