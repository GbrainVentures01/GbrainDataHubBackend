require("dotenv").config();
const cryptoProviderFactory = require("./src/utils/crypto/crypto-provider-factory");

async function testCryptoProviders() {
  try {
    console.log("🔄 Testing Crypto Provider System...\n");

    // Test 1: Get available providers
    console.log("📋 Available providers:", cryptoProviderFactory.getAvailableProviders());
    console.log("");

    // Test 2: Test Obiex Provider
    console.log("=" .repeat(50));
    console.log("Testing Obiex Provider");
    console.log("=".repeat(50));
    
    const obiexProvider = cryptoProviderFactory.getProvider('obiex');
    console.log(`✅ Provider: ${obiexProvider.getProviderName()}`);
    
    try {
      const obiexTokens = await obiexProvider.getSupportedTokens();
      console.log(`✅ Supported tokens count: ${Object.keys(obiexTokens.data || {}).length}`);
      console.log(`✅ Sample tokens: ${Object.keys(obiexTokens.data || {}).slice(0, 5).join(', ')}`);
    } catch (error) {
      console.error(`❌ Obiex error: ${error.message}`);
    }
    
    console.log("");

    // Test 3: Test Quidax Provider
    console.log("=".repeat(50));
    console.log("Testing Quidax Provider");
    console.log("=".repeat(50));
    
    try {
      const quidaxProvider = cryptoProviderFactory.getProvider('quidax');
      console.log(`✅ Provider: ${quidaxProvider.getProviderName()}`);
      
      const quidaxMarkets = await quidaxProvider.getTradableSwapCurrencies();
      console.log(`✅ Markets response:`, quidaxMarkets ? 'Success' : 'No data');
    } catch (error) {
      console.error(`❌ Quidax error: ${error.message}`);
    }
    
    console.log("");

    // Test 4: Test Active Provider (from env)
    console.log("=".repeat(50));
    console.log("Testing Active Provider (from env)");
    console.log("=".repeat(50));
    
    const activeProvider = cryptoProviderFactory.getActiveProvider();
    console.log(`✅ Active provider: ${activeProvider.getProviderName()}`);
    console.log(`✅ From env variable: ${process.env.CRYPTO_PROVIDER || 'obiex (default)'}`);
    
    console.log("");

    // Test 5: Test Provider Switching
    console.log("=".repeat(50));
    console.log("Testing Provider Switching");
    console.log("=".repeat(50));
    
    console.log("Switching to Quidax...");
    cryptoProviderFactory.setActiveProvider('quidax');
    console.log(`✅ Current active: ${cryptoProviderFactory.getActiveProvider().getProviderName()}`);
    
    console.log("Switching to Obiex...");
    cryptoProviderFactory.setActiveProvider('obiex');
    console.log(`✅ Current active: ${cryptoProviderFactory.getActiveProvider().getProviderName()}`);
    
    console.log("");

    // Test 6: Test Deposit Address Generation (if credentials available)
    if (process.env.OBIEX_API_KEY) {
      console.log("=".repeat(50));
      console.log("Testing Deposit Address Generation");
      console.log("=".repeat(50));
      
      try {
        const testUserId = "test_user_12345";
        const currency = "USDT";
        const network = "Tron";
        
        const depositAddress = await obiexProvider.generateDepositAddress(
          testUserId,
          currency,
          network
        );
        
        console.log(`✅ Deposit address generated for ${currency} on ${network}`);
        console.log(`   Address: ${depositAddress.data?.address || 'N/A'}`);
      } catch (error) {
        console.error(`❌ Deposit address generation failed: ${error.message}`);
      }
      
      console.log("");
    }

    // Test 7: Test Fallback Mechanism
    console.log("=".repeat(50));
    console.log("Testing Fallback Mechanism");
    console.log("=".repeat(50));
    
    try {
      // This will try the active provider first, then fallback if it fails
      cryptoProviderFactory.setActiveProvider('obiex');
      const result = await cryptoProviderFactory.executeWithFallback('getSupportedTokens');
      console.log(`✅ Fallback test successful`);
      console.log(`   Tokens retrieved: ${Object.keys(result.data || {}).length}`);
    } catch (error) {
      console.error(`❌ Fallback test failed: ${error.message}`);
    }

    console.log("");
    console.log("🎉 Crypto Provider System test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run tests
testCryptoProviders();
