'use strict';

/**
 * transaction-history router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::transaction-history.transaction-history');
