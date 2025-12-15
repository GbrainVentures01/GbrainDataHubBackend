'use strict';

/**
 * service-stat service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::service-stat.service-stat');
