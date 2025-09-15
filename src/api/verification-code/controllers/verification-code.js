"use strict";

/**
 * verification-code controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::verification-code.verification-code",
  ({ strapi }) => ({
    // Custom controller methods can be added here if needed
    // The default CRUD operations are automatically available
  })
);
