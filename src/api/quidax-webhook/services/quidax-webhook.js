'use strict';

/**
 * quidax-webhook service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::quidax-webhook.quidax-webhook');
