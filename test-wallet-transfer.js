/**
 * Test script for wallet transfer endpoints
 * Run with: node test-wallet-transfer.js
 */

const axios = require("axios");

// Configuration
const API_URL = "http://localhost:1337/api";
let JWT_TOKEN = ""; // Add your JWT token here for testing

// Test data
const testData = {
  // Test transfer from crypto to data bills
  transferFromCrypto: {
    fromWallet: "cryptoWalletBalance",
    toWallet: "AccountBalance",
    amount: 500,
  },
  // Test transfer from gift card to data bills
  transferFromGiftCard: {
    fromWallet: "giftCardBalance",
    toWallet: "AccountBalance",
    amount: 300,
  },
  // Test invalid transfer (should fail)
  invalidTransfer: {
    fromWallet: "AccountBalance",
    toWallet: "cryptoWalletBalance",
    amount: 100,
  },
};

/**
 * Test wallet transfer
 */
async function testTransfer(transferData, testName) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log("Request data:", transferData);

  try {
    const response = await axios.post(
      `${API_URL}/wallet-transfers`,
      transferData,
      {
        headers: {
          Authorization: `Bearer ${JWT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ SUCCESS");
    console.log("Response:", response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log("❌ FAILED");
      console.log("Status:", error.response.status);
      console.log("Error:", error.response.data);
    } else {
      console.log("❌ ERROR:", error.message);
    }
    return null;
  }
}

/**
 * Test get transaction history
 */
async function testGetTransactions() {
  console.log("\n🧪 Testing: Get Transaction History");

  try {
    const response = await axios.get(`${API_URL}/wallet-transactions`, {
      headers: {
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
      params: {
        "pagination[page]": 1,
        "pagination[pageSize]": 10,
        "sort[0]": "createdAt:desc",
      },
    });

    console.log("✅ SUCCESS");
    console.log(
      `Found ${response.data.data.length} transactions (Total: ${response.data.meta.pagination.total})`
    );
    console.log("\nRecent transactions:");
    response.data.data.slice(0, 3).forEach((txn) => {
      console.log(`- ${txn.attributes.description}: ₦${txn.attributes.amount}`);
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log("❌ FAILED");
      console.log("Status:", error.response.status);
      console.log("Error:", error.response.data);
    } else {
      console.log("❌ ERROR:", error.message);
    }
    return null;
  }
}

/**
 * Test get user profile to verify balances
 */
async function testGetProfile() {
  console.log("\n🧪 Testing: Get User Profile (Check Balances)");

  try {
    const response = await axios.get(`${API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
    });

    console.log("✅ SUCCESS");
    console.log("Wallet Balances:");
    console.log(
      `- Data & Bills: ₦${response.data.AccountBalance?.toFixed(2) || "0.00"}`
    );
    console.log(
      `- Crypto: ₦${response.data.cryptoWalletBalance?.toFixed(2) || "0.00"}`
    );
    console.log(
      `- Gift Card: ₦${response.data.giftCardBalance?.toFixed(2) || "0.00"}`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log("❌ FAILED");
      console.log("Status:", error.response.status);
      console.log("Error:", error.response.data);
    } else {
      console.log("❌ ERROR:", error.message);
    }
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("=".repeat(60));
  console.log("🚀 Wallet Transfer API Tests");
  console.log("=".repeat(60));

  if (!JWT_TOKEN) {
    console.log("\n⚠️  Please set JWT_TOKEN in the script before running tests");
    console.log(
      "You can get it by logging in and copying the token from the response"
    );
    return;
  }

  // Test 1: Get initial balances
  await testGetProfile();

  // Test 2: Valid transfer from crypto to data bills
  await testTransfer(testData.transferFromCrypto, "Transfer from Crypto Wallet");

  // Test 3: Valid transfer from gift card to data bills
  await testTransfer(
    testData.transferFromGiftCard,
    "Transfer from Gift Card Wallet"
  );

  // Test 4: Invalid transfer (should fail)
  await testTransfer(
    testData.invalidTransfer,
    "Invalid Transfer (Data & Bills to Crypto) - Should Fail"
  );

  // Test 5: Get transaction history
  await testGetTransactions();

  // Test 6: Get final balances
  await testGetProfile();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Tests completed");
  console.log("=".repeat(60));
}

// Run tests
runTests();
