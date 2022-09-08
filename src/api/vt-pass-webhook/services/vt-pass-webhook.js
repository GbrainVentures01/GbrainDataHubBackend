'use strict';

/**
 * vt-pass-webhook service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::vt-pass-webhook.vt-pass-webhook');
