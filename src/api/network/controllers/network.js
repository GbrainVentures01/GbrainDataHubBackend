"use strict";

/**
 *  network controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::network.network", ({ strapi }) => ({
  /**
   * Get available networks for airtime purchase
   * @param {Object} ctx
   * @returns
   */
  async getAirtimeNetworks(ctx) {
    try {
      const networks = await strapi.query("api::network.network").findMany({
        populate: {
          image: true,
        },
      });

      const formattedNetworks = networks.map((network) => ({
        id: network.id,
        name: network.name,
        image: network.image?.url || null,
        serviceID: this.getServiceIdForNetwork(network.name),
      }));

      return ctx.send({ data: formattedNetworks });
    } catch (error) {
      console.error("Error fetching networks:", error);
      return ctx.internalServerError("Failed to fetch networks");
    }
  },

  /**
   * Helper function to get serviceID for network names
   * @param {string} networkName
   * @returns {string}
   */
  getServiceIdForNetwork(networkName) {
    const networkMap = {
      MTN: "mtn",
      AIRTEL: "airtel",
      GLO: "glo",
      "9MOBILE": "9mobile",
      ETISALAT: "9mobile",
    };
    return networkMap[networkName.toUpperCase()] || networkName.toLowerCase();
  },
}));
