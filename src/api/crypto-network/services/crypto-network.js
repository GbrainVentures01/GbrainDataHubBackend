'use strict';

/**
 * crypto-network service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::crypto-network.crypto-network');
