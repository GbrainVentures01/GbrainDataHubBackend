require('dotenv').config();
const strapi = require('@strapi/strapi');

async function runCleanup() {
  try {
    console.log('🚀 Starting Strapi and running network cleanup...');
    
    // Initialize Strapi
    const app = await strapi().load();
    
    console.log('✅ Strapi loaded successfully');
    
    // Run the cleanup service
    const result = await app.service('api::crypto-token.crypto-token').cleanupDuplicateNetworks();
    
    console.log('🎉 Cleanup completed successfully!');
    console.log('📊 Results:', JSON.stringify(result, null, 2));
    
    // Close Strapi
    await app.destroy();
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

runCleanup();
