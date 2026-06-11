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
