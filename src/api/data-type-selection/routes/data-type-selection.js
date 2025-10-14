"use strict";

/**
 * data-type-selection router.
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/data-type-selections",
      handler: "api::data-type-selection.data-type-selection.find",
      config: {
        auth: false, // Make this endpoint public
        policies: [],
        middlewares: [],
      },
    },
  ],
};
