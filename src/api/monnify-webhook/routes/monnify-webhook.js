'use strict';

/**
 * monnify-webhook router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::monnify-webhook.monnify-webhook');
