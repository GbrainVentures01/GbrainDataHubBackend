const axios = require("axios");

/**
 * Service to route data purchase requests to appropriate controllers
 * based on plan type (CG, Gifting, or SME)
 */
module.exports = {
  /**
   * Determine the plan type and route to appropriate controller
   * @param {Object} ctx - Koa context
   * @param {string} planEndpoint - The endpoint from which the plan was fetched
   * @returns {Object} - Response from the appropriate controller
   */
  async routeDataPurchase(ctx, planEndpoint) {
    try {
      // Determine plan type based on endpoint
      const planType = this.determinePlanType(planEndpoint);

      console.log(
        `Routing data purchase for plan type: ${planType}, endpoint: ${planEndpoint}`
      );

      switch (planType) {
        case "CG":
          return await this.handleCGDataPurchase(ctx);
        case "GIFTING":
          return await this.handleGiftingDataPurchase(ctx);
        case "SME":
          return await this.handleSMEDataPurchase(ctx);
        default:
          throw new Error(`Unknown plan type for endpoint: ${planEndpoint}`);
      }
    } catch (error) {
      console.error("Data purchase routing error:", error);
      throw error;
    }
  },

  /**
   * Determine plan type based on endpoint
   * @param {string} endpoint - The plan endpoint
   * @returns {string} - Plan type (CG, GIFTING, SME)
   */
  determinePlanType(endpoint) {
    if (!endpoint) {
      throw new Error("Plan endpoint is required");
    }

    // CG Data Plans
    if (endpoint.includes("cg-data-plans")) {
      return "CG";
    }

    // SME Data Plans
    if (endpoint.includes("sme-") || endpoint.includes("coupon-data-plans")) {
      return "SME";
    }

    // Gifting Data Plans (default for regular data plans)
    if (
      endpoint.includes("data-plans") ||
      endpoint.includes("mtn-data-plans") ||
      endpoint.includes("airtel-data-plans")
    ) {
      return "GIFTING";
    }

    throw new Error(`Cannot determine plan type for endpoint: ${endpoint}`);
  },

  /**
   * Handle CG data purchase via cg-data-order controller
   * @param {Object} ctx - Koa context
   * @returns {Object} - Purchase response
   */
  async handleCGDataPurchase(ctx) {
    const cgController = strapi.controller("api::cg-data-order.cg-data-order");
    return await cgController.mobileBuyData(ctx);
  },

  /**
   * Handle gifting data purchase via data-gifting-order controller
   * @param {Object} ctx - Koa context
   * @returns {Object} - Purchase response
   */
  async handleGiftingDataPurchase(ctx) {
    const giftingController = strapi.controller(
      "api::data-gifting-order.data-gifting-order"
    );
    return await giftingController.mobileBuyData(ctx);
  },

  /**
   * Handle SME data purchase via sme-data-order controller
   * @param {Object} ctx - Koa context
   * @returns {Object} - Purchase response
   */
  async handleSMEDataPurchase(ctx) {
    const smeController = strapi.controller(
      "api::sme-data-order.sme-data-order"
    );
    return await smeController.mobileBuyData(ctx);
  },

  /**
   * Validate purchase request data
   * @param {Object} requestData - Request body data
   * @returns {boolean} - True if valid
   */
  validatePurchaseRequest(requestData) {
    const requiredFields = [
      "request_id",
      "network_id",
      "plan_id",
      "beneficiary",
      "amount",
      "plan",
      "network",
      "authMethod",
      "planEndpoint", // This is key for routing
    ];

    for (const field of requiredFields) {
      if (!requestData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return true;
  },
};
