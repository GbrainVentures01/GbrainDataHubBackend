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
    // Seed Nigerian banks
    await seedBanks();

    // Initialize Firebase Admin SDK for push notifications
    try {
      const firebaseNotificationService = require("./utils/firebase/notification-service");
      const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
      
      if (Object.keys(serviceAccountKey).length > 0) {
        await firebaseNotificationService.initializeFirebase(serviceAccountKey);
        console.log("✅ Firebase Admin SDK initialized successfully");
      } else {
        console.warn("⚠️ Firebase service account key not found in environment variables");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Firebase:", error);
      // Don't throw - allow app to start even if Firebase initialization fails
    }
  },
};
