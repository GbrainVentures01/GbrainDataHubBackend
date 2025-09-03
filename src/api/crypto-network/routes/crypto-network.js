'use strict';

/**
 * crypto-network router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::crypto-network.crypto-network');
