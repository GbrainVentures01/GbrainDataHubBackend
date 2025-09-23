'use strict';

/**
 *  network controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::network.network');
