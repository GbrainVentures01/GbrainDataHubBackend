'use strict';

/**
 * pay-vessel-webhook service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::pay-vessel-webhook.pay-vessel-webhook');
