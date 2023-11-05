"use strict";

/**
 * User.js controller
 *
 * @description: A set of functions called "actions" for managing `User`.
 */

const _ = require("lodash");
const utils = require("@strapi/utils");
const { getService } = require("../utils/index");
const {
  validateCreateUserBody,
  validateUpdateUserBody,
} = require("@strapi/plugin-users-permissions/server/controllers/validation/user");

const { sanitize } = utils;
const { ApplicationError, ValidationError } = utils.errors;

const sanitizeOutput = (user, ctx) => {
  const schema = strapi.getModel("plugin::users-permissions.user");
  const { auth } = ctx.state;

  return sanitize.contentAPI.output(user, schema, { auth });
};

module.exports = {
  /**
   * Create a/an user record.
   * @return {Object}
   */
  async create(ctx) {
    const advanced = await strapi
      .store({ type: "plugin", name: "users-permissions", key: "advanced" })
      .get();

    await validateCreateUserBody(ctx.request.body);

    const { email, username, role } = ctx.request.body;

    const userWithSameUsername = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { username } });

    if (userWithSameUsername) {
      if (!email) throw new ApplicationError("Username already taken");
    }

    if (advanced.unique_email) {
      const userWithSameEmail = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: email.toLowerCase() } });

      if (userWithSameEmail) {
        throw new ApplicationError("Email already taken");
      }
    }

    const user = {
      ...ctx.request.body,
      provider: "local",
    };

    user.email = _.toLower(user.email);

    if (!role) {
      const defaultRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: advanced.default_role } });

      user.role = defaultRole.id;
    }

    try {
      const data = await getService("user").add(user);
      const sanitizedData = await sanitizeOutput(data, ctx);

      ctx.created(sanitizedData);
    } catch (error) {
      throw new ApplicationError(error.message);
    }
  },

  /**
   * Update a/an user record.
   * @return {Object}
   */
  async update(ctx) {
    const advancedConfigs = await strapi
      .store({ type: "plugin", name: "users-permissions", key: "advanced" })
      .get();

    const { id } = ctx.params;
    const { email, username, password, pin } = ctx.request.body;
    let new_pin;

    const user = await getService("user").fetch({ id });
    const validateData = {
      email: ctx.request.body.email,
      username: ctx.request.body.username,
      password: ctx.request.body.password,
    };
    await validateUpdateUserBody(validateData);

    if (
      user.provider === "local" &&
      _.has(ctx.request.body, "password") &&
      !password
    ) {
      throw new ValidationError("password.notNull");
    }

    if (_.has(ctx.request.body, "pin")) {
      new_pin = await getService("user").hashPin(ctx.request.body);
    }

    if (_.has(ctx.request.body, "username")) {
      const userWithSameUsername = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { username } });

      if (userWithSameUsername && userWithSameUsername.id != id) {
        throw new ApplicationError("Username already taken");
      }
    }

    if (_.has(ctx.request.body, "email") && advancedConfigs.unique_email) {
      const userWithSameEmail = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: email.toLowerCase() } });

      if (userWithSameEmail && userWithSameEmail.id != id) {
        throw new ApplicationError("Email already taken");
      }
      ctx.request.body.email = ctx.request.body.email.toLowerCase();
    }

    let updateData;
    if (pin) {
      updateData = {
        pin: new_pin,
      };
    } else {
      const { pin, ...restOfData } = ctx.request.body;
      updateData = {
        ...restOfData,
      };
    }
    console.log(updateData);

    const data = await getService("user").edit({ id }, updateData);
    const sanitizedData = await sanitizeOutput(data, ctx);

    // ctx.send(sanitizedData);
    ctx.send({ data: { message: "Profile updated Successfully !" } });
  },

  /**
   * Retrieve user records.
   * @return {Object|Array}
   */
  async find(ctx, next, { populate } = {}) {
    const users = await getService("user").fetchAll(
      ctx.query.filters,
      populate
    );

    ctx.body = await Promise.all(
      users.map((user) => sanitizeOutput(user, ctx))
    );
  },

  /**
   * Retrieve a user record.
   * @return {Object}
   */
  async findOne(ctx) {
    const { id } = ctx.params;
    let data = await strapi.query("plugin::users-permissions.user").findOne({
      where: { id: id },
      populate: {
        monnify_bank_details: true,
      },
    });

    if (data) {
      data = await sanitizeOutput(data, ctx);
    }

    ctx.body = data;
  },

  /**
   * Retrieve user count.
   * @return {Number}
   */
  async count(ctx) {
    ctx.body = await getService("user").count(ctx.query);
  },

  /**
   * Destroy a/an user record.
   * @return {Object}
   */
  async destroy(ctx) {
    const { id } = ctx.params;

    const data = await getService("user").remove({ id });
    const sanitizedUser = await sanitizeOutput(data, ctx);

    ctx.send(sanitizedUser);
  },

  /**
   * Retrieve authenticated user.
   * @return {Object|Array}
   */
  async me(ctx) {
    const id = ctx.state.params;
  },
};
