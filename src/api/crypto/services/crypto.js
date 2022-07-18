'use strict';

/**
 * crypto service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::crypto.crypto');
