'use strict';

/**
 * data-plan service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::data-plan.data-plan');
