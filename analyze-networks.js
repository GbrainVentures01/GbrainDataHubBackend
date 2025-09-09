require("dotenv").config();
const strapi = require("@strapi/strapi");

async function analyzeNetworks() {
  try {
    console.log("🚀 Starting Strapi and analyzing networks...");

    // Initialize Strapi
    const app = await strapi().load();

    console.log("✅ Strapi loaded successfully");

    // Get all networks with their tokens
    const allNetworks = await app.entityService.findMany(
      "api::crypto-network.crypto-network",
      {
        populate: ["crypto_tokens"],
        sort: "id:asc",
      }
    );

    console.log(`📊 Total networks found: ${allNetworks.length}`);

    // Group by token + network code to find potential duplicates
    const networkGroups = {};
    const networkStats = {};

    for (const network of allNetworks) {
      if (!network.crypto_tokens) {
        console.log(`⚠️  Network ${network.id} has no associated token`);
        continue;
      }

      const tokenCode = network.crypto_tokens.currencyCode;
      const key = `${tokenCode}_${network.networkCode}`;

      if (!networkGroups[key]) {
        networkGroups[key] = [];
      }
      networkGroups[key].push(network);

      // Count networks per token
      if (!networkStats[tokenCode]) {
        networkStats[tokenCode] = 0;
      }
      networkStats[tokenCode]++;
    }

    console.log("\n📈 Networks per token:");
    for (const [token, count] of Object.entries(networkStats)) {
      console.log(`  ${token}: ${count} networks`);
    }

    console.log("\n🔍 Looking for duplicates...");
    let duplicatesFound = 0;

    for (const [key, networks] of Object.entries(networkGroups)) {
      if (networks.length > 1) {
        duplicatesFound++;
        console.log(`\n❌ DUPLICATE: ${key} (${networks.length} entries)`);
        for (const network of networks) {
          console.log(
            `   ID: ${network.id}, Name: ${network.networkName}, Code: ${network.networkCode}`
          );
        }
      }
    }

    if (duplicatesFound === 0) {
      console.log("✅ No duplicates found!");
    } else {
      console.log(`\n⚠️  Found ${duplicatesFound} sets of duplicates`);
    }

    // Close Strapi
    await app.destroy();
  } catch (error) {
    console.error("❌ Analysis failed:", error.message);
    console.error("Error details:", error);
    process.exit(1);
  }
}

analyzeNetworks();
