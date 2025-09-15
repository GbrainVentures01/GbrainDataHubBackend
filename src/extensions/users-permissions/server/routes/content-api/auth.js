"use strict";

module.exports = [
  {
    method: "GET",
    path: "/connect/(.*)",
    handler: "auth.connect",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/local",
    handler: "auth.callback",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/local/register",
    handler: "auth.register",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "GET",
    path: "/auth/:provider/callback",
    handler: "auth.callback",
    config: {
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/forgot-password",
    handler: "auth.forgotPassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/forgot-pin",
    handler: "auth.forgotPin",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/reset-password",
    handler: "auth.resetPassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "GET",
    path: "/auth/email-confirmation",
    handler: "auth.emailConfirmation",
    config: {
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/send-email-confirmation",
    handler: "auth.sendEmailConfirmation",
    config: {
      prefix: "",
    },
  },
  // Mobile-specific verification endpoints
  {
    method: "POST",
    path: "/auth/mobile/forgot-password",
    handler: "auth.mobileForgotPassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/verify-reset-code",
    handler: "auth.verifyResetCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/reset-password-with-code",
    handler: "auth.resetPasswordWithCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/forgot-pin",
    handler: "auth.mobileForgotPin",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/verify-pin-reset-code",
    handler: "auth.verifyPinResetCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/reset-pin-with-code",
    handler: "auth.resetPinWithCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/set-transaction-pin",
    handler: "auth.mobileSetTransactionPin",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],

      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/login",
    handler: "auth.mobileLogin",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/register",
    handler: "auth.mobileRegister",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/resend-verification",
    handler: "auth.resendMobileVerification",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/mobile/verify-email",
    handler: "auth.verifyEmailWithCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  // Biometric authentication endpoints
  {
    method: "POST",
    path: "/auth/biometric/enable",
    handler: "auth.enableBiometric",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/biometric/disable",
    handler: "auth.disableBiometric",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/biometric/validate",
    handler: "auth.validateBiometric",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "GET",
    path: "/auth/biometric/status",
    handler: "auth.getBiometricStatus",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  // PIN Change endpoints
  {
    method: "POST",
    path: "/auth/send-pin-change-verification",
    handler: "auth.sendPinChangeVerification",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "POST",
    path: "/auth/verify-pin-change-code",
    handler: "auth.verifyPinChangeCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  {
    method: "PUT",
    path: "/auth/change-transaction-pin",
    handler: "auth.changeTransactionPin",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
  // Password Change endpoint
  {
    method: "PUT",
    path: "/auth/change-password",
    handler: "auth.changePassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  },
];
