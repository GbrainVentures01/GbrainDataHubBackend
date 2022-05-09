'use strict';

const permission = require('@strapi/plugin-users-permissions/server/content-types/permission');
const role = require('@strapi/plugin-users-permissions/server/content-types/role');
const user = require('./user/schema.json');

module.exports = {
  permission: { schema: permission },
  role: { schema: role },
  user: { schema: user },
};
