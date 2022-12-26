'use strict';

/**
 * data-house-webhook service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::data-house-webhook.data-house-webhook');
