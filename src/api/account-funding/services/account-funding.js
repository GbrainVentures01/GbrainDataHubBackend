'use strict';

/**
 * account-funding service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::account-funding.account-funding');
