'use strict';

/**
 * credo-webhook service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::credo-webhook.credo-webhook');
