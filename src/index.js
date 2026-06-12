"use strict";

const { default: axios } = require("axios");
const { base64encode, base64decode } = require("nodejs-base64");
const { seedBanks } = require("./utils/seed-banks");

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // ── KYC Tier backfill migration ──────────────────────────────────────────
    // Runs once on every startup; safe to re-run (idempotent WHERE clauses).
    // Ensures production rows added before the KYC tier columns existed get
    // correct default values without needing a manual SQL migration.
    try {
      const knex = strapi.db.connection;

      // Assign Tier 1 to every confirmed user that still has NULL kycTier
      const confirmed = await knex("up_users")
        .whereNull("kyc_tier")
        .where("confirmed", true)
        .update({
          kyc_tier: 1,
          kyc_verified: true,
          kyc_verified_at: knex.fn.now(),
        });

      // Assign Tier 0 (unverified) to unconfirmed users with NULL kycTier
      const unconfirmed = await knex("up_users")
        .whereNull("kyc_tier")
        .where("confirmed", false)
        .update({
          kyc_tier: 0,
          kyc_verified: false,
        });

      if (confirmed > 0 || unconfirmed > 0) {
        console.log(
          `✅ [KYC Migration] Backfilled ${confirmed} confirmed (Tier 1) and ${unconfirmed} unconfirmed (Tier 0) users`
        );
      }
    } catch (err) {
      // Non-blocking: log but don't crash Strapi if columns don't exist yet
      console.error("⚠️ [KYC Migration] Backfill skipped (non-blocking):", err.message);
    }
    // ────────────────────────────────────────────────────────────────────────

    // Seed Nigerian banks asynchronously without blocking startup
    seedBanks(strapi).catch((error) => {
      console.error("❌ Error seeding banks (non-blocking):", error);
    });

    // Initialize Firebase Admin SDK asynchronously without blocking startup
    try {
      const firebaseNotificationService = require("./utils/firebase/notification-service");
      const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
      
      if (Object.keys(serviceAccountKey).length > 0) {
        // Initialize Firebase without awaiting - don't block startup
        firebaseNotificationService.initializeFirebase(serviceAccountKey)
          .then(() => {
            console.log("✅ Firebase Admin SDK initialized successfully");
          })
          .catch((error) => {
            console.error("⚠️ Failed to initialize Firebase (non-blocking):", error);
          });
      } else {
        console.warn("⚠️ Firebase service account key not found in environment variables");
      }
    } catch (error) {
      console.error("⚠️ Firebase initialization error (non-blocking):", error);
    }
  },
};
