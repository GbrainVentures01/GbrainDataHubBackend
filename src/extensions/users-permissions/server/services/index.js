"use strict";

const jwt = require("@strapi/plugin-users-permissions/server/services/jwt");
const providers = require("@strapi/plugin-users-permissions/server/services/providers");
const user = require("./user");
const role = require("@strapi/plugin-users-permissions/server/services/role");
const usersPermissions = require("@strapi/plugin-users-permissions/server/services/users-permissions");

module.exports = {
  jwt,
  providers,
  role,
  user,
  "users-permissions": usersPermissions,
};
