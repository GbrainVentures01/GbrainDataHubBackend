"use strict";

/**
 * Auth.js controller
 *
 * @description: A set of functions called "actions" for managing `Auth`.
 */

/* eslint-disable no-useless-escape */
const crypto = require("crypto");
const _ = require("lodash");
const utils = require("@strapi/utils");
const { getService } = require("../utils/index");
const {
  validateCallbackBody,
  validateRegisterBody,
  validateSendEmailConfirmationBody,
} = require("@strapi/plugin-users-permissions/server/controllers/validation/auth");
const getToken = require("../../../../utils/monnify/getToken");
const createReservedAccount = require("../../../../utils/monnify/createReservedAccount");

const { sanitize } = utils;
const { ApplicationError, ValidationError } = utils.errors;

const emailRegExp =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");

  return sanitize.contentAPI.output(user, userSchema, { auth });
};

// declare variable to store  access token
let myAccessToken;

module.exports = {
  async callback(ctx) {
    const provider = ctx.params.provider || "local";
    const params = ctx.request.body;

    const store = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    if (provider === "local") {
      if (!_.get(await store.get({ key: "grant" }), "email.enabled")) {
        throw new ApplicationError("This provider is disabled");
      }

      await validateCallbackBody(params);

      const query = { provider };

      // Check if the provided identifier is an email or not.
      const isEmail = emailRegExp.test(params.identifier);

      // Set the identifier to the appropriate query field.
      if (isEmail) {
        query.email = params.identifier.toLowerCase();
      } else {
        query.username = params.identifier;
      }

      // Check if the user exists.
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: query });

      if (!user) {
        return ctx.unauthorized("Invalid identifier or password");
        // throw new ValidationError("Invalid identifier or password");
      }

      if (
        _.get(await store.get({ key: "advanced" }), "email_confirmation") &&
        user.confirmed !== true
      ) {
        throw new ApplicationError("Your account email is not confirmed");
      }

      if (user.blocked === true) {
        throw new ApplicationError(
          "Your account has been blocked by an administrator"
        );
      }

      // The user never authenticated with the `local` provider.
      if (!user.password) {
        throw new ApplicationError(
          "This user never set a local password, please login with the provider used during account creation"
        );
      }

      const validPassword = await getService("user").validatePassword(
        params.password,
        user.password
      );

      if (!validPassword) {
        ctx.unauthorized("Invalid identifier or password");
        throw new ValidationError("Invalid identifier or password");
      } else {
        ctx.send({
          jwt: getService("jwt").issue({
            id: user.id,
          }),
          user: await sanitizeUser(user, ctx),
        });
        // get monnify access token
        // myAccessToken = getToken();
      }
    } else {
      if (!_.get(await store.get({ key: "grant" }), [provider, "enabled"])) {
        throw new ApplicationError("This provider is disabled");
      }

      // Connect the user with the third-party provider.
      let user;
      let error;
      try {
        [user, error] = await getService("providers").connect(
          provider,
          ctx.query
        );
      } catch ([user, error]) {
        throw new ApplicationError(error.message);
      }

      if (!user) {
        throw new ApplicationError(error.message);
      }

      ctx.send({
        jwt: getService("jwt").issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    }
  },

  async resetPassword(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);

    if (
      params.password &&
      params.passwordConfirmation &&
      params.password === params.passwordConfirmation &&
      params.code
    ) {
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { resetPasswordToken: `${params.code}` } });

      if (!user) {
        ctx.badRequest("Incorrect code provided");
        throw new ValidationError("Incorrect code provided");
      }

      const password = await getService("user").hashPassword({
        password: params.password,
      });

      // Update the user.
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { resetPasswordToken: null, password },
      });

      ctx.send({
        message: "Password reset successful",
        jwt: getService("jwt").issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    } else if (
      params.password &&
      params.passwordConfirmation &&
      params.password !== params.passwordConfirmation
    ) {
      ctx.badRequest("Passwords do not match");
      throw new ValidationError("Passwords do not match");
    } else {
      ctx.badRequest("Incorrect params provided");
      throw new ValidationError("Incorrect params provided");
    }
  },

  async connect(ctx, next) {
    const grant = require("grant-koa");

    const providers = await strapi
      .store({ type: "plugin", name: "users-permissions", key: "grant" })
      .get();

    const apiPrefix = strapi.config.get("api.rest.prefix");
    const grantConfig = {
      defaults: {
        prefix: `${apiPrefix}/connect`,
      },
      ...providers,
    };

    const [requestPath] = ctx.request.url.split("?");
    const provider = requestPath.split("/connect/")[1].split("/")[0];

    if (!_.get(grantConfig[provider], "enabled")) {
      throw new ApplicationError("This provider is disabled");
    }

    if (!strapi.config.server.url.startsWith("http")) {
      strapi.log.warn(
        "You are using a third party provider for login. Make sure to set an absolute url in config/server.js. More info here: https://docs.strapi.io/developer-docs/latest/plugins/users-permissions.html#setting-up-the-server-url"
      );
    }

    // Ability to pass OAuth callback dynamically
    grantConfig[provider].callback =
      _.get(ctx, "query.callback") || grantConfig[provider].callback;
    grantConfig[provider].redirect_uri =
      getService("providers").buildRedirectUri(provider);

    return grant(grantConfig)(ctx, next);
  },

  async forgotPassword(ctx) {
    let { email } = ctx.request.body;
    console.log(email);
    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(email);

    if (isEmail) {
      email = email.toLowerCase();
    } else {
      ctx.badRequest("Please provide a valid email address");
      throw new ValidationError("Please provide a valid email address");
    }

    const pluginStore = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    // Find the user by email.
    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email: email.toLowerCase() } });

    // User not found.
    if (!user) {
      ctx.notFound("This email does not exist");
      throw new ApplicationError("This email does not exist");
    }

    // User blocked
    if (user.blocked) {
      ctx.forbidden("This user is disabled");
      throw new ApplicationError("This user is disabled");
    }

    // Generate random token.
    const resetPasswordToken = crypto.randomBytes(64).toString("hex");

    const settings = await pluginStore
      .get({ key: "email" })
      .then((storeEmail) => {
        try {
          return storeEmail["reset_password"].options;
        } catch (error) {
          return {};
        }
      });

    const advanced = await pluginStore.get({
      key: "advanced",
    });

    const userInfo = await sanitizeUser(user, ctx);

    settings.message = await getService("users-permissions").template(
      settings.message,
      {
        URL: advanced.email_reset_password,
        USER: userInfo,
        TOKEN: resetPasswordToken,
      }
    );

    settings.object = await getService("users-permissions").template(
      settings.object,
      {
        USER: userInfo,
      }
    );

    try {
      // Send an email to the user.

      const EmailSent = await strapi.plugin("email").service("email").send({
        to: user.email.toLowerCase(),
        // from:
        //   settings.from.email || settings.from.name
        //     ? `${settings.from.name} <${settings.from.email}>`
        //     : undefined,
        replyTo: settings.response_email,
        subject: settings.object,
        text: settings.message,
        html: settings.message,
      });

      if (EmailSent.response.statusCode === 200) {
        await strapi
          .query("plugin::users-permissions.user")
          .update({ where: { id: user.id }, data: { resetPasswordToken } });

        ctx.send({
          message: "password reset link has been sent to the provided email.",
        });
      }
    } catch (err) {
      if (err.statusCode === 400) {
        throw new ApplicationError(err.message);
      } else {
        throw new Error(`Couldn't send test email: ${err.message}.`);
      }
    }
  },
  // forget pin

  async forgotPin(ctx) {
    let { email } = ctx.request.body;

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(email);

    if (isEmail) {
      email = email.toLowerCase();
    } else {
      ctx.badRequest("Please provide a valid email address");
      throw new ValidationError("Please provide a valid email address");
    }

    const pluginStore = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    // Find the user by email.
    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email: email.toLowerCase() } });

    // User not found.
    if (!user) {
      ctx.notFound("This email does not exist");
      throw new ApplicationError("This email does not exist");
    }

    // User blocked
    if (user.blocked) {
      ctx.forbidden("This user is disabled");
      throw new ApplicationError("This user is disabled");
    }

    // Generate random token.
    const resetPasswordToken = crypto.randomBytes(64).toString("hex");

    const settings = await pluginStore
      .get({ key: "email" })
      .then((storeEmail) => {
        try {
          return storeEmail["reset_password"].options;
        } catch (error) {
          return {};
        }
      });

    // const advanced = await pluginStore.get({
    //   key: "advanced",
    // });

    const userInfo = await sanitizeUser(user, ctx);
    settings.message =
      "<p>We heard that you forgot your pin. Sorry about that!</p><p>But don’t worry! You can use the following link to reset your pin:</p><p><%= URL %>?code=<%= TOKEN %></p><p>Thanks.</p>";

    settings.message = await getService("users-permissions").template(
      settings.message,
      {
        URL: "https://www.gbrainventures.com/reset-pin",
        USER: userInfo,
        TOKEN: resetPasswordToken,
      }
    );

    settings.object = await getService("users-permissions").template(
      settings.object,
      {
        USER: userInfo,
      }
    );

    try {
      // Send an email to the user.
      const EmailSent = await strapi.plugin("email").service("email").send({
        to: user.email,
        // from:
        //   settings.from.email || settings.from.name
        //     ? `${settings.from.name} <${settings.from.email}>`
        //     : undefined,
        replyTo: settings.response_email,
        subject: settings.object,
        text: settings.message,
        html: settings.message,
      });

      // Update the user.
      if (EmailSent.response.statusCode === 200) {
        await strapi
          .query("plugin::users-permissions.user")
          .update({ where: { id: user.id }, data: { resetPasswordToken } });

        ctx.send({
          message: "pin reset link has been sent to the provided email.",
        });
      }
    } catch (err) {
      if (err.statusCode === 400) {
        throw new ApplicationError(err.message);
      } else {
        throw new Error(`Couldn't send test email: ${err.message}.`);
      }
    }
  },

  async register(ctx) {
    const pluginStore = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({
      key: "advanced",
    });

    if (!settings.allow_register) {
      throw new ApplicationError("Register action is currently disabled");
    }
    // get monnify access token
    // myAccessToken = await getToken();

    const params = {
      ..._.omit(ctx.request.body, [
        "confirmed",
        "confirmationToken",
        "resetPasswordToken",
      ]),
      provider: "local",
    };

    await validateRegisterBody(params);

    // Throw an error if the password selected by the user
    // contains more than three times the symbol '$'.
    if (getService("user").isHashed(params.password)) {
      //  ctx.badRequest(
      //   " 'Your password cannot contain more than three times the symbol `$`'"
      // );
      throw new ValidationError(
        "Your password cannot contain more than three times the symbol `$`"
      );
    }

    const role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: settings.default_role } });

    if (!role) {
      throw new ApplicationError("Impossible to find the default role");
    }

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    } else {
      // ctx.badRequest("Please provide a valid email address");
      throw new ValidationError("Please provide a valid email address");
    }

    params.role = role.id;
    params.password = await getService("user").hashPassword(params);
    params.pin = await getService("user").hashPin(params);

    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: { email: params.email },
    });

    if (user && user.provider === params.provider) {
      // ctx.badRequest("Email is already taken");
      throw new ApplicationError("Email is already taken");
    }

    if (user && user.provider !== params.provider && settings.unique_email) {
      // ctx.badRequest("Email is already taken");
      throw new ApplicationError("Email is already taken");
    }

    try {
      if (!settings.email_confirmation) {
        params.confirmed = true;
      }

      // const monnifyDetails = await createReservedAccount({
      //   token: myAccessToken,
      //   userData: params,
      // });

      const user = await strapi.query("plugin::users-permissions.user").create({
        data: {
          ...params,
        },
      });

      const sanitizedUser = await sanitizeUser(user, ctx);

      if (settings.email_confirmation) {
        try {
          await getService("user").sendConfirmationEmail(sanitizedUser);
        } catch (err) {
          ctx.internalServerError(err.message);
          throw new ApplicationError(err.message);
        }

        return ctx.send({ user: sanitizedUser });
      }

      const jwt = getService("jwt").issue(_.pick(user, ["id"]));

      return ctx.send({
        jwt,
        user: sanitizedUser,
      });
    } catch (err) {
      console.log(err);
      if (_.includes(err.message, "username")) {
        throw new ApplicationError("Username already taken");
      } else {
        throw new ApplicationError("Sorry, something went wrong, try again.");
      }
    }
  },

  async emailConfirmation(ctx, next, returnUser) {
    const { confirmation: confirmationToken } = ctx.query;

    const userService = getService("user");
    const jwtService = getService("jwt");

    if (_.isEmpty(confirmationToken)) {
      ctx.unauthorized("invalid token");
      throw new ValidationError("token.invalid");
    }

    const user = await userService.fetch({ confirmationToken }, []);

    if (!user) {
      ctx.unauthorized("invalid token");
      throw new ValidationError("token.invalid");
    }

    await userService.edit(
      { id: user.id },
      { confirmed: true, confirmationToken: null }
    );

    if (returnUser) {
      ctx.send({
        jwt: jwtService.issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    } else {
      const settings = await strapi
        .store({ type: "plugin", name: "users-permissions", key: "advanced" })
        .get();

      ctx.redirect(settings.email_confirmation_redirection || "/");
    }
  },

  async sendEmailConfirmation(ctx) {
    const params = _.assign(ctx.request.body);

    await validateSendEmailConfirmationBody(params);

    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    } else {
      throw new ValidationError("wrong.email");
    }

    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: { email: params.email },
    });

    if (user.confirmed) {
      throw new ApplicationError("already.confirmed");
    }

    if (user.blocked) {
      ctx.forbidden("user blocked");
      throw new ApplicationError("blocked.user");
    }

    try {
      await getService("user").sendConfirmationEmail(user);
      ctx.send({
        email: user.email,
        sent: true,
      });
    } catch (err) {
      ctx.internalServerError(err.message);
      throw new ApplicationError(err.message);
    }
  },

  /**
   * Mobile Login - Enhanced login with better error handling for mobile apps
   */
  async mobileLogin(ctx) {
    const { email, password } = ctx.request.body;

    // Validate required fields
    if (!email || !password) {
      return ctx.badRequest("Email and password are required", {
        errorCode: "MISSING_CREDENTIALS",
      });
    }

    try {
      // Check if email format is valid
      const isValidEmail = emailRegExp.test(email);
      if (!isValidEmail) {
        return ctx.badRequest("Please provide a valid email address", {
          errorCode: "INVALID_EMAIL_FORMAT",
        });
      }

      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.unauthorized("Invalid email or password", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      // Check if user is confirmed (mobile users must verify email)
      if (!user.confirmed) {
        return ctx.forbidden("Please verify your email address before signing in", {
          errorCode: "EMAIL_NOT_VERIFIED",
          email: user.email,
        });
      }

      // Check if user is blocked
      if (user.blocked) {
        return ctx.forbidden("Your account has been suspended. Please contact support.", {
          errorCode: "ACCOUNT_SUSPENDED",
        });
      }

      // Validate password
      const validPassword = await getService("user").validatePassword(
        password,
        user.password
      );

      if (!validPassword) {
        return ctx.unauthorized("Invalid email or password", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      // Generate JWT token
      const jwt = getService("jwt").issue({ id: user.id });
      const sanitizedUser = await sanitizeUser(user, ctx);

      // Log successful login
      const ipAddress = ctx.request.ip || ctx.request.headers["x-forwarded-for"] || "unknown";
      
      strapi.log.info(
        `Mobile login successful for ${user.email} from IP ${ipAddress}`
      );

      ctx.send({
        jwt,
        user: sanitizedUser,
        message: "Login successful",
      });
    } catch (error) {
      strapi.log.error("Mobile login error:", error);
      ctx.internalServerError({
        error: "Unable to process login. Please try again.",
        errorCode: "LOGIN_ERROR",
      });
    }
  },

  /**
   * Mobile Register - Register new user via mobile app with enhanced security
   */
  async mobileRegister(ctx) {
    const { email, password, username, phoneNumber } = ctx.request.body;

    // Validate required fields
    if (!email || !password || !username) {
      return ctx.badRequest("Email, password, and username are required", {
        errorCode: "MISSING_REQUIRED_FIELDS",
      });
    }

    try {
      const pluginStore = await strapi.store({
        type: "plugin",
        name: "users-permissions",
      });

      const settings = await pluginStore.get({ key: "advanced" });

      // Check if registration is allowed
      if (!settings.allow_register) {
        return ctx.forbidden("Registration is currently disabled", {
          errorCode: "REGISTRATION_DISABLED",
        });
      }

      // Validate email format
      const isValidEmail = emailRegExp.test(email);
      if (!isValidEmail) {
        return ctx.badRequest("Please provide a valid email address", {
          errorCode: "INVALID_EMAIL_FORMAT",
        });
      }

      const normalizedEmail = email.toLowerCase();

      // Password validation
      if (getService("user").isHashed(password)) {
        return ctx.badRequest(
          "Password cannot contain more than three times the symbol '$'",
          {
            errorCode: "INVALID_PASSWORD_FORMAT",
          }
        );
      }

      // Password strength validation for mobile (financial app)
      if (password.length < 8) {
        return ctx.badRequest("Password must be at least 8 characters long", {
          errorCode: "WEAK_PASSWORD",
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return ctx.badRequest(
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
          {
            errorCode: "PASSWORD_COMPLEXITY",
          }
        );
      }

      // Get default role
      const role = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: settings.default_role } });

      if (!role) {
        return ctx.internalServerError("Unable to find default user role", {
          errorCode: "ROLE_NOT_FOUND",
        });
      }

      // Check if email already exists
      const existingUser = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (existingUser) {
        if (existingUser.provider === "local") {
          return ctx.badRequest("An account with this email already exists", {
            errorCode: "EMAIL_ALREADY_EXISTS",
          });
        } else if (settings.unique_email) {
          return ctx.badRequest("An account with this email already exists", {
            errorCode: "EMAIL_ALREADY_EXISTS",
          });
        }
      }

      // Check if username is taken
      const existingUsername = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { username } });

      if (existingUsername) {
        return ctx.badRequest("Username is already taken", {
          errorCode: "USERNAME_ALREADY_EXISTS",
        });
      }

      // Prepare user data
      const hashedPassword = await getService("user").hashPassword({
        password,
      });

      const userData = {
        email: normalizedEmail,
        username,
        password: hashedPassword,
        provider: "local",
        role: role.id,
        confirmed: false, // ⚠️ Mobile users must verify email
        phoneNumber: phoneNumber || null,
        // Note: transactionPin will be set separately later by user choice
        hasTransactionPin: false,
      };

      // Create user
      const user = await strapi
        .query("plugin::users-permissions.user")
        .create({ data: userData });

      const sanitizedUser = await sanitizeUser(user, ctx);

      // Generate and send verification code
      try {
        const verificationCode = await strapi
          .service("api::verification-code.verification-code")
          .generateCode(user.email, "email_verification");

        const emailSubject = "Welcome to GBrain Ventures - Verify Your Email";

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
              .header { background: linear-gradient(135deg, #83529f, #a855f7); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; background: #f8f9fa; }
              .code-box { 
                background: #83529f; 
                color: white; 
                font-size: 32px; 
                font-weight: bold; 
                text-align: center; 
                padding: 20px; 
                margin: 20px 0; 
                border-radius: 8px; 
                letter-spacing: 4px;
                font-family: 'Courier New', monospace;
              }
              .info-box { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to GBrain Ventures!</h1>
                <p>Mobile App Registration</p>
              </div>
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Thank you for joining GBrain Ventures mobile app! To complete your registration and secure your account, please verify your email address using the verification code below:</p>
                
                <div class="code-box">
                  ${verificationCode}
                </div>
                
                <div class="info-box">
                  <strong>📱 Mobile App Access:</strong>
                  <p>Once verified, you'll be able to:</p>
                  <ul>
                    <li>Access your secure dashboard</li>
                    <li>Make financial transactions</li>
                    <li>Manage your portfolio</li>
                    <li>Use all premium features</li>
                  </ul>
                </div>
                
                <p><strong>⚠️ Important:</strong> This verification code expires in 10 minutes. Enter this code in your mobile app to complete registration.</p>
                
                <p><strong>Security Note:</strong> Never share this code with anyone. GBrain Ventures will never ask for your verification code via phone or email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} GBrain Ventures | Financial Technology Platform</p>
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await strapi
          .plugin("email")
          .service("email")
          .send({
            to: user.email,
            subject: emailSubject,
            html: emailHtml,
            text: `Welcome to GBrain Ventures! Your email verification code is: ${verificationCode}. This code expires in 10 minutes.`,
          });

        // Log successful registration
        const ipAddress =
          ctx.request.ip || ctx.request.headers["x-forwarded-for"] || "unknown";

        strapi.log.info(
          `Mobile registration successful for ${user.email} from IP ${ipAddress}. Verification email sent.`
        );

        ctx.send({
          user: sanitizedUser,
          message:
            "Registration successful! Please check your email to verify your account before signing in.",
          requiresVerification: true,
          email: user.email,
        });
      } catch (emailError) {
        strapi.log.error("Failed to send verification email:", emailError);

        // Delete the user if we can't send verification email
        await strapi
          .query("plugin::users-permissions.user")
          .delete({ where: { id: user.id } });

        ctx.internalServerError({
          error: "Unable to send verification email. Please try again.",
          errorCode: "EMAIL_SEND_ERROR",
        });
      }
    } catch (error) {
      strapi.log.error("Mobile registration error:", error);

      if (
        error instanceof ApplicationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      ctx.internalServerError({
        error: "Unable to complete registration. Please try again.",
        errorCode: "REGISTRATION_ERROR",
      });
    }
  },

  /**
   * Resend Email Verification - For mobile users who need verification email resent
   */
  async resendMobileVerification(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email address is required", {
        errorCode: "MISSING_EMAIL",
      });
    }

    try {
      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: email.toLowerCase() } });

      if (!user) {
        return ctx.notFound("No account found with this email address", {
          errorCode: "USER_NOT_FOUND",
        });
      }

      if (user.confirmed) {
        return ctx.badRequest("Email address is already verified", {
          errorCode: "ALREADY_VERIFIED",
        });
      }

      if (user.blocked) {
        return ctx.forbidden("Account is suspended", {
          errorCode: "ACCOUNT_SUSPENDED",
        });
      }

      // Generate and send new verification code
      const verificationCode = await strapi
        .service("api::verification-code.verification-code")
        .generateCode(user.email, "email_verification");

      const emailSubject = "GBrain Ventures - New Verification Code";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: linear-gradient(135deg, #83529f, #a855f7); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f8f9fa; }
            .code-box { 
              background: #83529f; 
              color: white; 
              font-size: 32px; 
              font-weight: bold; 
              text-align: center; 
              padding: 20px; 
              margin: 20px 0; 
              border-radius: 8px; 
              letter-spacing: 4px;
              font-family: 'Courier New', monospace;
            }
            .footer { text-align: center; padding: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 New Verification Code</h1>
              <p>GBrain Ventures</p>
            </div>
            <div class="content">
              <h2>Your New Verification Code</h2>
              <p>Here's your new email verification code:</p>
              
              <div class="code-box">
                ${verificationCode}
              </div>
              
              <p><strong>⚠️ Important:</strong> This verification code expires in 10 minutes.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} GBrain Ventures | Financial Technology Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await strapi
        .plugin("email")
        .service("email")
        .send({
          to: user.email,
          subject: emailSubject,
          html: emailHtml,
          text: `Your new GBrain Ventures verification code is: ${verificationCode}. This code expires in 10 minutes.`,
        });

      ctx.send({
        message: "New verification code sent to your email",
        email: user.email,
      });
    } catch (error) {
      strapi.log.error("Resend verification error:", error);
      ctx.internalServerError({
        error: "Unable to send verification code. Please try again.",
        errorCode: "RESEND_ERROR",
      });
    }
  },

  /**
   * Mobile Forgot Password - Send password reset code via email
   */
  async mobileForgotPassword(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email address is required", {
        errorCode: "MISSING_EMAIL",
      });
    }

    try {
      const isValidEmail = emailRegExp.test(email);
      if (!isValidEmail) {
        return ctx.badRequest("Please provide a valid email address", {
          errorCode: "INVALID_EMAIL_FORMAT",
        });
      }

      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.notFound("No account found with this email address", {
          errorCode: "USER_NOT_FOUND",
        });
      }

      if (user.blocked) {
        return ctx.forbidden("Account is suspended", {
          errorCode: "ACCOUNT_SUSPENDED",
        });
      }

      // Generate verification code for password reset
      const resetCode = await strapi
        .service("api::verification-code.verification-code")
        .generateCode(user.email, "password_reset");

      const emailSubject = "GBrain Ventures - Password Reset Code";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: linear-gradient(135deg, #83529f, #a855f7); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f8f9fa; }
            .code-box { 
              background: #dc3545; 
              color: white; 
              font-size: 32px; 
              font-weight: bold; 
              text-align: center; 
              padding: 20px; 
              margin: 20px 0; 
              border-radius: 8px; 
              letter-spacing: 4px;
              font-family: 'Courier New', monospace;
            }
            .warning-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
              <p>GBrain Ventures</p>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>We received a request to reset your password. Use the code below to reset your password:</p>
              
              <div class="code-box">
                ${resetCode}
              </div>
              
              <div class="warning-box">
                <p><strong>🔒 Security Notice:</strong></p>
                <ul>
                  <li>This code expires in 10 minutes</li>
                  <li>Never share this code with anyone</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} GBrain Ventures | Financial Technology Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await strapi
        .plugin("email")
        .service("email")
        .send({
          to: user.email,
          subject: emailSubject,
          html: emailHtml,
          text: `Your GBrain Ventures password reset code is: ${resetCode}. This code expires in 10 minutes.`,
        });

      ctx.send({
        message: "Password reset code sent to your email",
        email: user.email,
      });
    } catch (error) {
      strapi.log.error("Mobile forgot password error:", error);
      ctx.internalServerError({
        error: "Unable to send password reset code. Please try again.",
        errorCode: "FORGOT_PASSWORD_ERROR",
      });
    }
  },

  /**
   * Verify Reset Code - Verify password reset code before allowing password change
   */
  async verifyResetCode(ctx) {
    const { email, code } = ctx.request.body;

    if (!email || !code) {
      return ctx.badRequest("Email and verification code are required", {
        errorCode: "MISSING_FIELDS",
      });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.notFound("Invalid email or code", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      // Verify the code without marking it as used
      const isValid = await strapi
        .service("api::verification-code.verification-code")
        .validateCodeWithoutMarking(normalizedEmail, code, "password_reset");

      if (!isValid) {
        return ctx.badRequest("Invalid or expired verification code", {
          errorCode: "INVALID_CODE",
        });
      }

      ctx.send({
        message: "Verification code is valid",
        canResetPassword: true,
      });
    } catch (error) {
      strapi.log.error("Verify reset code error:", error);
      ctx.internalServerError({
        error: "Unable to verify code. Please try again.",
        errorCode: "VERIFY_CODE_ERROR",
      });
    }
  },

  /**
   * Reset Password with Code - Reset password using verification code
   */
  async resetPasswordWithCode(ctx) {
    const { email, code, newPassword, confirmPassword } = ctx.request.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return ctx.badRequest("All fields are required", {
        errorCode: "MISSING_FIELDS",
      });
    }

    if (newPassword !== confirmPassword) {
      return ctx.badRequest("Passwords do not match", {
        errorCode: "PASSWORD_MISMATCH",
      });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.badRequest("Invalid email or code", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return ctx.badRequest("Password must be at least 8 characters long", {
          errorCode: "WEAK_PASSWORD",
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return ctx.badRequest(
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
          {
            errorCode: "PASSWORD_COMPLEXITY",
          }
        );
      }

      // Verify and mark code as used
      const isValid = await strapi
        .service("api::verification-code.verification-code")
        .validateCode(normalizedEmail, code, "password_reset");

      if (!isValid) {
        return ctx.badRequest("Invalid or expired verification code", {
          errorCode: "INVALID_CODE",
        });
      }

      // Hash new password
      const hashedPassword = await getService("user").hashPassword({
        password: newPassword,
      });

      // Update user password
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      const sanitizedUser = await sanitizeUser(user, ctx);

      ctx.send({
        message: "Password reset successful",
        user: sanitizedUser,
      });
    } catch (error) {
      strapi.log.error("Reset password with code error:", error);
      ctx.internalServerError({
        error: "Unable to reset password. Please try again.",
        errorCode: "RESET_PASSWORD_ERROR",
      });
    }
  },

  /**
   * Mobile Forgot Transaction PIN - Send PIN reset code via email
   */
  async mobileForgotPin(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email address is required", {
        errorCode: "MISSING_EMAIL",
      });
    }

    try {
      const isValidEmail = emailRegExp.test(email);
      if (!isValidEmail) {
        return ctx.badRequest("Please provide a valid email address", {
          errorCode: "INVALID_EMAIL_FORMAT",
        });
      }

      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.notFound("No account found with this email address", {
          errorCode: "USER_NOT_FOUND",
        });
      }

      if (user.blocked) {
        return ctx.forbidden("Account is suspended", {
          errorCode: "ACCOUNT_SUSPENDED",
        });
      }

      if (!user.hasTransactionPin) {
        return ctx.badRequest("No transaction PIN set for this account", {
          errorCode: "NO_PIN_SET",
        });
      }

      // Generate verification code for PIN reset
      const resetCode = await strapi
        .service("api::verification-code.verification-code")
        .generateCode(user.email, "pin_reset");

      const emailSubject = "GBrain Ventures - Transaction PIN Reset Code";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: linear-gradient(135deg, #83529f, #a855f7); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f8f9fa; }
            .code-box { 
              background: #e74c3c; 
              color: white; 
              font-size: 32px; 
              font-weight: bold; 
              text-align: center; 
              padding: 20px; 
              margin: 20px 0; 
              border-radius: 8px; 
              letter-spacing: 4px;
              font-family: 'Courier New', monospace;
            }
            .warning-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔢 Transaction PIN Reset</h1>
              <p>GBrain Ventures</p>
            </div>
            <div class="content">
              <h2>Reset Your Transaction PIN</h2>
              <p>We received a request to reset your transaction PIN. Use the code below to reset your PIN:</p>
              
              <div class="code-box">
                ${resetCode}
              </div>
              
              <div class="warning-box">
                <p><strong>🔒 Security Notice:</strong></p>
                <ul>
                  <li>This code expires in 10 minutes</li>
                  <li>Never share this code with anyone</li>
                  <li>Your transaction PIN is used to authorize financial transactions</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} GBrain Ventures | Financial Technology Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await strapi
        .plugin("email")
        .service("email")
        .send({
          to: user.email,
          subject: emailSubject,
          html: emailHtml,
          text: `Your GBrain Ventures transaction PIN reset code is: ${resetCode}. This code expires in 10 minutes.`,
        });

      ctx.send({
        message: "Transaction PIN reset code sent to your email",
        email: user.email,
      });
    } catch (error) {
      strapi.log.error("Mobile forgot PIN error:", error);
      ctx.internalServerError({
        error: "Unable to send PIN reset code. Please try again.",
        errorCode: "FORGOT_PIN_ERROR",
      });
    }
  },

  /**
   * Verify PIN Reset Code - Verify PIN reset code before allowing PIN change
   */
  async verifyPinResetCode(ctx) {
    const { email, code } = ctx.request.body;

    if (!email || !code) {
      return ctx.badRequest("Email and verification code are required", {
        errorCode: "MISSING_FIELDS",
      });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.notFound("Invalid email or code", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      // Verify the code without marking it as used
      const isValid = await strapi
        .service("api::verification-code.verification-code")
        .validateCodeWithoutMarking(normalizedEmail, code, "pin_reset");

      if (!isValid) {
        return ctx.badRequest("Invalid or expired verification code", {
          errorCode: "INVALID_CODE",
        });
      }

      ctx.send({
        message: "Verification code is valid",
        canResetPin: true,
      });
    } catch (error) {
      strapi.log.error("Verify PIN reset code error:", error);
      ctx.internalServerError({
        error: "Unable to verify code. Please try again.",
        errorCode: "VERIFY_CODE_ERROR",
      });
    }
  },

  /**
   * Reset Transaction PIN with Code - Reset transaction PIN using verification code
   */
  async resetPinWithCode(ctx) {
    const { email, code, newPin, confirmPin } = ctx.request.body;

    if (!email || !code || !newPin || !confirmPin) {
      return ctx.badRequest("All fields are required", {
        errorCode: "MISSING_FIELDS",
      });
    }

    if (newPin !== confirmPin) {
      return ctx.badRequest("PINs do not match", {
        errorCode: "PIN_MISMATCH",
      });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.badRequest("Invalid email or code", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      // Validate PIN format (should be 4-6 digits)
      if (!/^\d{4,6}$/.test(newPin)) {
        return ctx.badRequest("PIN must be 4-6 digits", {
          errorCode: "INVALID_PIN_FORMAT",
        });
      }

      // Verify and mark code as used
      const isValid = await strapi
        .service("api::verification-code.verification-code")
        .validateCode(normalizedEmail, code, "pin_reset");

      if (!isValid) {
        return ctx.badRequest("Invalid or expired verification code", {
          errorCode: "INVALID_CODE",
        });
      }

      // Hash new PIN
      const hashedPin = await getService("user").hashPin({ pin: newPin });

      // Update user transaction PIN
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { 
          transactionPin: hashedPin,
          hasTransactionPin: true 
        },
      });

      ctx.send({
        message: "Transaction PIN reset successful",
        hasTransactionPin: true,
      });
    } catch (error) {
      strapi.log.error("Reset PIN with code error:", error);
      ctx.internalServerError({
        error: "Unable to reset PIN. Please try again.",
        errorCode: "RESET_PIN_ERROR",
      });
    }
  },

  /**
   * Mobile Set Transaction PIN - Set transaction PIN for mobile users
   */
  async mobileSetTransactionPin(ctx) {
    const { transactionPin, confirmPin } = ctx.request.body;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized("Authentication required", {
        errorCode: "AUTH_REQUIRED",
      });
    }

    if (!transactionPin || !confirmPin) {
      return ctx.badRequest("Transaction PIN and confirmation are required", {
        errorCode: "MISSING_FIELDS",
      });
    }

    if (transactionPin !== confirmPin) {
      return ctx.badRequest("PINs do not match", {
        errorCode: "PIN_MISMATCH",
      });
    }

    try {
      // Validate PIN format (should be 4-6 digits)
      if (!/^\d{4,6}$/.test(transactionPin)) {
        return ctx.badRequest("PIN must be 4-6 digits", {
          errorCode: "INVALID_PIN_FORMAT",
        });
      }

      // Find user
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: userId } });

      if (!user) {
        return ctx.notFound("User not found", {
          errorCode: "USER_NOT_FOUND",
        });
      }

      if (user.blocked) {
        return ctx.forbidden("Account is suspended", {
          errorCode: "ACCOUNT_SUSPENDED",
        });
      }

      // Hash the PIN
      const hashedPin = await getService("user").hashPin({ pin: transactionPin });

      // Update user with transaction PIN
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: {
          transactionPin: hashedPin,
          hasTransactionPin: true,
        },
      });

      // Send confirmation email
      const emailSubject = "Transaction PIN Set Successfully";
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: linear-gradient(135deg, #83529f, #a855f7); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f8f9fa; }
            .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0; color: #155724; }
            .footer { text-align: center; padding: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Transaction PIN Set</h1>
              <p>GBrain Ventures</p>
            </div>
            <div class="content">
              <h2>PIN Setup Successful</h2>
              <p>Your transaction PIN has been successfully set up for your GBrain Ventures mobile account.</p>
              
              <div class="success-box">
                <p><strong>🔐 Security Features:</strong></p>
                <ul>
                  <li>Your PIN is encrypted and securely stored</li>
                  <li>Required for all financial transactions</li>
                  <li>Can be changed anytime in app settings</li>
                  <li>Never share your PIN with anyone</li>
                </ul>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>You can now make secure transactions</li>
                <li>Access premium features in the app</li>
                <li>Manage your financial portfolio</li>
              </ul>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} GBrain Ventures | Financial Technology Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await strapi.plugin("email").service("email").send({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
        text: `Your GBrain Ventures transaction PIN has been successfully set up. You can now perform secure financial transactions. Never share your PIN with anyone.`,
      });

      ctx.send({
        message: "Transaction PIN set successfully",
        success: true,
        hasTransactionPin: true,
      });
    } catch (error) {
      strapi.log.error("Set transaction PIN error:", error);
      ctx.internalServerError({
        error: "Unable to set transaction PIN. Please try again.",
        errorCode: "SET_PIN_ERROR",
      });
    }
  },

  /**
   * Verify Email with Code - Verify email using verification code (for mobile registration)
   */
  async verifyEmailWithCode(ctx) {
    const { email, code } = ctx.request.body;

    if (!email || !code) {
      return ctx.badRequest("Email and verification code are required", {
        errorCode: "MISSING_FIELDS",
      });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Find user by email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return ctx.badRequest("Invalid email or code", {
          errorCode: "INVALID_CREDENTIALS",
        });
      }

      if (user.confirmed) {
        return ctx.badRequest("Email address is already verified", {
          errorCode: "ALREADY_VERIFIED",
        });
      }

      if (user.blocked) {
        return ctx.forbidden("Account is suspended", {
          errorCode: "ACCOUNT_SUSPENDED",
        });
      }

      // Verify and mark code as used
      const isValid = await strapi
        .service("api::verification-code.verification-code")
        .validateCode(normalizedEmail, code, "email_verification");

      if (!isValid) {
        return ctx.badRequest("Invalid or expired verification code", {
          errorCode: "INVALID_CODE",
        });
      }

      // Update user as confirmed
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { confirmed: true },
      });

      const sanitizedUser = await sanitizeUser(user, ctx);

      // Generate JWT token for immediate login
      const jwt = getService("jwt").issue({ id: user.id });

      ctx.send({
        message: "Email verified successfully",
        user: sanitizedUser,
        jwt,
        verified: true,
      });
    } catch (error) {
      strapi.log.error("Verify email with code error:", error);
      ctx.internalServerError({
        error: "Unable to verify email. Please try again.",
        errorCode: "VERIFY_EMAIL_ERROR",
      });
    }
  },
};
