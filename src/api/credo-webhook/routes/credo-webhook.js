'use strict';

/**
 * credo-webhook router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::credo-webhook.credo-webhook');
