"use strict";

/**
 * Data Purchase Router Controller
 * Routes mobile data purchase requests to appropriate controllers based on plan type
 */

module.exports = {
  /**
   * Mobile data purchase endpoint that routes to appropriate controller
   * @param {Object} ctx - Koa context
   */
  async mobileBuyData(ctx) {
    try {
      const requestData = ctx.request.body;

      // Validate request data
      const routerService = strapi.service(
        "api::data-purchase-router.data-purchase-router"
      );
      routerService.validatePurchaseRequest(requestData);

      // Extract plan endpoint from request
      const { planEndpoint } = requestData;

      console.log(`Mobile data purchase request for endpoint: ${planEndpoint}`);
      console.log("Request data:", JSON.stringify(requestData, null, 2));

      // Route to appropriate controller
      const result = await routerService.routeDataPurchase(ctx, planEndpoint);

      return result;
    } catch (error) {
      console.error("Mobile data purchase router error:", error);

      if (
        error.message.includes("Missing required field") ||
        error.message.includes("Cannot determine plan type")
      ) {
        return ctx.badRequest(error.message);
      }

      return ctx.internalServerError(
        "Something went wrong. Please try again later."
      );
    }
  },

  /**
   * Get available plan types and their endpoints
   * @param {Object} ctx - Koa context
   */
  async getPlanTypes(ctx) {
    try {
      const planTypes = {
        CG: {
          description: "Corporate Gifting Plans",
          endpoints: ["/api/airtel-cg-data-plans", "/api/glo-cg-data-plans"],
          controller: "cg-data-order",
        },
        GIFTING: {
          description: "Regular Gifting Plans",
          endpoints: [
            "/api/mtn-data-plans",
            "/api/airtel-data-plans",
            "/api/data-plans",
          ],
          controller: "data-gifting-order",
        },
        SME: {
          description: "SME Plans",
          endpoints: [
            "/api/mtn-sme-1-data-plans",
            "/api/mtn-sme-2-data-plans",
            "/api/mtn-coupon-data-plans",
          ],
          controller: "cg-data-order (temporary)",
        },
      };

      return ctx.send({
        success: true,
        data: planTypes,
      });
    } catch (error) {
      console.error("Get plan types error:", error);
      return ctx.internalServerError("Failed to get plan types");
    }
  },
};
