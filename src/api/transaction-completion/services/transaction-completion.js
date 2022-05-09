'use strict';

/**
 * transaction-completion service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::transaction-completion.transaction-completion');
