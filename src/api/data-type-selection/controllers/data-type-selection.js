"use strict";

/**
 *  data-type-selection controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::data-type-selection.data-type-selection",
  ({ strapi }) => ({
    // Override the default find method to return data plan types
    async find(ctx) {
      try {
        // For now, return hardcoded data plan types until we populate the database
        const dataTypes = [
          {
            id: 1,
            name: "MTN SME 1",
            url: "mtn-sme-1-data-plans",
            image: {
              url: "https://example.com/mtn-logo.png",
              name: "MTN Logo",
            },
          },
          {
            id: 2,
            name: "MTN SME 2",
            url: "mtn-sme-2-data-plans",
            image: {
              url: "https://example.com/mtn-logo.png",
              name: "MTN Logo",
            },
          },
          {
            id: 3,
            name: "MTN Coupon",
            url: "mtn-coupon-data-plans",
            image: {
              url: "https://example.com/mtn-logo.png",
              name: "MTN Logo",
            },
          },
          {
            id: 4,
            name: "MTN Data",
            url: "mtn-data-plans",
            image: {
              url: "https://example.com/mtn-logo.png",
              name: "MTN Logo",
            },
          },
          {
            id: 5,
            name: "Airtel Data",
            url: "airtel-data-plans",
            image: {
              url: "https://example.com/airtel-logo.png",
              name: "Airtel Logo",
            },
          },
          {
            id: 6,
            name: "Airtel CG",
            url: "airtel-cg-data-plans",
            image: {
              url: "https://example.com/airtel-logo.png",
              name: "Airtel Logo",
            },
          },
          {
            id: 7,
            name: "Glo CG",
            url: "glo-cg-data-plans",
            image: {
              url: "https://example.com/glo-logo.png",
              name: "Glo Logo",
            },
          },
        ];

        return ctx.send({
          data: dataTypes,
          meta: {
            pagination: {
              page: 1,
              pageSize: 25,
              pageCount: 1,
              total: dataTypes.length,
            },
          },
        });
      } catch (error) {
        console.error("Error fetching data type selections:", error);
        return ctx.internalServerError("Unable to fetch data type selections");
      }
    },
  })
);
