'use strict';

/**
 * ogdams-webhook service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ogdams-webhook.ogdams-webhook');
