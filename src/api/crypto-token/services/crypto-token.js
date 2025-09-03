'use strict';

/**
 * crypto-token service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::crypto-token.crypto-token');
