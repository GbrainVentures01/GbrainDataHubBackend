require("dotenv").config();
const strapi = require("@strapi/strapi");

async function runInitialSync() {
  try {
    console.log("🚀 Starting Strapi and running initial OBIEX token sync...");

    // Initialize Strapi
    const app = await strapi().load();

    console.log("✅ Strapi loaded successfully");

    // Run the sync service
    const result = await app
      .service("api::crypto-token.crypto-token")
      .syncTokensFromObiex();

    console.log("🎉 Initial sync completed successfully!");
    console.log("📊 Results:", JSON.stringify(result, null, 2));

    // Close Strapi
    await app.destroy();
  } catch (error) {
    console.error("❌ Initial sync failed:", error.message);
    console.error("Error details:", error);
    process.exit(1);
  }
}

runInitialSync();
