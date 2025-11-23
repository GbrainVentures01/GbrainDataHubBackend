"use strict";

/**
 * crypto-token service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::crypto-token.crypto-token",
  ({ strapi }) => ({
    /**
     * Clean up duplicate networks in the database
     */
    async cleanupDuplicateNetworks() {
      try {
        console.log("🧹 Starting cleanup of duplicate networks...");

        // Get all networks grouped by token and network code
        const allNetworks = await strapi.entityService.findMany(
          "api::crypto-network.crypto-network",
          {
            populate: ["crypto_tokens"],
            sort: "id:asc",
          }
        );

        const networkGroups = {};
        let duplicatesRemoved = 0;

        // Group networks by token + networkCode combination
        for (const network of allNetworks) {
          if (!network.crypto_tokens) continue;

          const key = `${network.crypto_tokens.id}_${network.networkCode}`;

          if (!networkGroups[key]) {
            networkGroups[key] = [];
          }
          networkGroups[key].push(network);
        }

        // Remove duplicates (keep the first one, delete others)
        for (const [key, networks] of Object.entries(networkGroups)) {
          if (networks.length > 1) {
            console.log(
              `🔍 Found ${networks.length} duplicates for ${networks[0].crypto_tokens.currencyCode} - ${networks[0].networkCode}`
            );

            // Keep the first one, delete the rest
            for (let i = 1; i < networks.length; i++) {
              await strapi.entityService.delete(
                "api::crypto-network.crypto-network",
                networks[i].id
              );
              duplicatesRemoved++;
              console.log(
                `  ❌ Removed duplicate network ID: ${networks[i].id}`
              );
            }
          }
        }

        console.log(
          `🎉 Cleanup completed! Removed ${duplicatesRemoved} duplicate networks.`
        );

        return {
          success: true,
          duplicatesRemoved,
          message: `Successfully removed ${duplicatesRemoved} duplicate networks`,
        };
      } catch (error) {
        console.error("❌ Error cleaning up duplicate networks:", error);
        throw error;
      }
    },

    /**
     * Sync crypto tokens and networks from active crypto provider API
     * This service fetches supported tokens from the active provider and updates the local database
     */
    async syncTokensFromProvider() {
      try {
        const cryptoProviderFactory = require("../../../utils/crypto/crypto-provider-factory");
        const provider = cryptoProviderFactory.getActiveProvider();

        console.log(
          `🔄 Starting ${provider.getProviderName()} token synchronization...`
        );

        // Fetch supported tokens from active provider
        const providerResponse = await provider.getSupportedTokens();
        const providerTokens = providerResponse?.data || {};

        if (!providerTokens || Object.keys(providerTokens).length === 0) {
          throw new Error(
            `No tokens received from ${provider.getProviderName()} API`
          );
        }

        console.log(
          `📋 Found ${Object.keys(providerTokens).length} tokens from ${provider.getProviderName()}`
        );

        let syncStats = {
          tokensProcessed: 0,
          tokensCreated: 0,
          tokensUpdated: 0,
          networksCreated: 0,
          networksUpdated: 0,
          errors: [],
        };

        // Process each token from provider
        for (const [currencyCode, tokenData] of Object.entries(
          providerTokens
        )) {
          try {
            syncStats.tokensProcessed++;

            // Find existing crypto token
            const existingTokens = await strapi.entityService.findMany(
              "api::crypto-token.crypto-token",
              {
                filters: { currencyCode },
                populate: ["crypto_networks"],
              }
            );

            let cryptoToken;

            if (existingTokens.length === 0) {
              // Create new crypto token
              cryptoToken = await strapi.entityService.create(
                "api::crypto-token.crypto-token",
                {
                  data: {
                    currencyCode,
                    currencyName: tokenData.currencyName,
                    isActive: true,
                    publishedAt: new Date(),
                  },
                }
              );
              syncStats.tokensCreated++;
              console.log(
                `✅ Created token: ${currencyCode} (${tokenData.currencyName})`
              );
            } else {
              // Update existing token
              cryptoToken = existingTokens[0];
              await strapi.entityService.update(
                "api::crypto-token.crypto-token",
                cryptoToken.id,
                {
                  data: {
                    currencyName: tokenData.currencyName,
                    isActive: true,
                  },
                }
              );
              syncStats.tokensUpdated++;
              console.log(
                `🔄 Updated token: ${currencyCode} (${tokenData.currencyName})`
              );
            }

            // Process networks for this token
            if (tokenData.networks && Array.isArray(tokenData.networks)) {
              for (const networkData of tokenData.networks) {
                try {
                  // Find existing network with more specific filtering
                  const existingNetworks = await strapi.entityService.findMany(
                    "api::crypto-network.crypto-network",
                    {
                      filters: {
                        $and: [
                          { networkCode: networkData.networkCode },
                          { networkName: networkData.networkName },
                          { crypto_tokens: cryptoToken.id },
                        ],
                      },
                    }
                  );

                  const networkPayload = {
                    networkName: networkData.networkName,
                    networkCode: networkData.networkCode,
                    minimumDeposit: networkData.minimumDeposit || 0,
                    depositFee: networkData.depositFee || 0,
                    minimumWithdrawal: networkData.minimumWithdrawal || 0,
                    withdrawalFee: networkData.withdrawalFee || 0,
                    maximumDecimalPlaces: networkData.maximumDecimalPlaces || 8,
                    receiveFeeType: networkData.receiveFeeType || "PERCENTAGE",
                    withdrawalFeeType:
                      networkData.withdrawalFeeType || "PERCENTAGE",
                    isActive: true,
                    crypto_tokens: cryptoToken.id,
                    publishedAt: new Date(),
                  };

                  if (existingNetworks.length === 0) {
                    // Create new network only if it doesn't exist
                    await strapi.entityService.create(
                      "api::crypto-network.crypto-network",
                      {
                        data: networkPayload,
                      }
                    );
                    syncStats.networksCreated++;
                    console.log(
                      `  ➕ Created network: ${networkData.networkName} (${networkData.networkCode})`
                    );
                  } else if (existingNetworks.length === 1) {
                    // Update existing network
                    await strapi.entityService.update(
                      "api::crypto-network.crypto-network",
                      existingNetworks[0].id,
                      {
                        data: networkPayload,
                      }
                    );
                    syncStats.networksUpdated++;
                    console.log(
                      `  🔄 Updated network: ${networkData.networkName} (${networkData.networkCode})`
                    );
                  } else {
                    // Multiple networks found - handle duplicates
                    console.log(
                      `  ⚠️  Found ${existingNetworks.length} duplicate networks for ${networkData.networkName} (${networkData.networkCode}). Cleaning up.`
                    );

                    // Update the first one
                    await strapi.entityService.update(
                      "api::crypto-network.crypto-network",
                      existingNetworks[0].id,
                      {
                        data: networkPayload,
                      }
                    );

                    // Delete the duplicates
                    for (let i = 1; i < existingNetworks.length; i++) {
                      await strapi.entityService.delete(
                        "api::crypto-network.crypto-network",
                        existingNetworks[i].id
                      );
                      console.log(
                        `    ❌ Removed duplicate network ID: ${existingNetworks[i].id}`
                      );
                    }

                    syncStats.networksUpdated++;
                  }
                } catch (networkError) {
                  console.error(
                    `❌ Error processing network ${networkData.networkCode} for token ${currencyCode}:`,
                    networkError.message
                  );
                  syncStats.errors.push(
                    `Network ${networkData.networkCode}: ${networkError.message}`
                  );
                }
              }
            }
          } catch (tokenError) {
            console.error(
              `❌ Error processing token ${currencyCode}:`,
              tokenError.message
            );
            syncStats.errors.push(
              `Token ${currencyCode}: ${tokenError.message}`
            );
          }
        }

        console.log("🎉 OBIEX token synchronization completed successfully!");
        console.log("📊 Sync Statistics:", syncStats);

        return {
          success: true,
          message: "Tokens synchronized successfully from OBIEX",
          stats: syncStats,
        };
      } catch (error) {
        console.error("❌ OBIEX token synchronization failed:", error.message);
        console.error("Error details:", error);
        throw error;
      }
    },

    /**
     * Get all active crypto tokens with their networks
     */
    async getActiveTokensWithNetworks() {
      try {
        return await strapi.entityService.findMany(
          "api::crypto-token.crypto-token",
          {
            filters: { isActive: true },
            populate: {
              crypto_networks: {
                filters: { isActive: true },
              },
            },
            sort: "currencyCode:asc",
          }
        );
      } catch (error) {
        console.error("Error fetching active tokens:", error);
        throw error;
      }
    },

    /**
     * Get supported networks for a specific token
     */
    async getTokenNetworks(currencyCode) {
      try {
        const tokens = await strapi.entityService.findMany(
          "api::crypto-token.crypto-token",
          {
            filters: {
              currencyCode,
              isActive: true,
            },
            populate: {
              crypto_networks: {
                filters: { isActive: true },
              },
            },
          }
        );

        return tokens.length > 0 ? tokens[0].crypto_networks : [];
      } catch (error) {
        console.error(
          `Error fetching networks for token ${currencyCode}:`,
          error
        );
        throw error;
      }
    },
  })
);
