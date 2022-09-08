'use strict';

/**
 * transaction-history service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::transaction-history.transaction-history');
