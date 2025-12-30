'use strict';

/**
 * Example: Authentication Controller with Security Notifications
 * 
 * This file shows how to integrate security alert notifications into your auth controller.
 * Copy the notification-related code into your actual controllers.
 * 
 * Location: src/extensions/users-permissions/server/controllers/auth.js
 */

// ✅ ADD THIS IMPORT
const {
  sendSecurityAlertNotification,
  sendBroadcastNotification,
} = require("../../../utils/notification-triggers");

/**
 * Example security triggers in authentication flow
 */

// ==========================================
// 1. SUSPICIOUS LOGIN DETECTION
// ==========================================
async function handleLogin(ctx) {
  try {
    const user = ctx.state.user;

    // Check if this is a new/suspicious device
    const userAgent = ctx.request.headers["user-agent"];
    const clientIP = ctx.request.ip;
    const loginLocation = getLocationFromIP(clientIP); // Implement based on your IP location service

    const isNewDevice = await checkIfNewDevice(user.id, userAgent, clientIP);

    if (isNewDevice) {
      // ✅ Send new device alert
      await sendSecurityAlertNotification(user, "new_device", {
        deviceName: userAgent?.substring(0, 50) || "Unknown Device",
        ipAddress: clientIP,
        location: loginLocation,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for suspicious patterns
    const recentLogins = await getRecentLoginAttempts(user.id, 10); // Last 10 attempts
    const hasAnomalousActivity = detectAnomalousActivity(recentLogins);

    if (hasAnomalousActivity) {
      // ✅ Send suspicious activity alert
      await sendSecurityAlertNotification(user, "suspicious_login", {
        location: loginLocation,
        time: new Date().toLocaleTimeString(),
        details: "Unusual login pattern detected",
      });
    }

    return ctx.send({ jwt: token, user });
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

// ==========================================
// 2. FAILED LOGIN ATTEMPTS
// ==========================================
async function handleFailedLogin(ctx) {
  try {
    const email = ctx.request.body.identifier;
    const user = await getUserByEmail(email);

    if (user) {
      // Increment failed attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;

      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { failedLoginAttempts },
      });

      // ✅ Alert after multiple failed attempts
      if (failedAttempts > 3) {
        await sendSecurityAlertNotification(user, "failed_attempts", {
          attempts: failedAttempts,
          timestamp: new Date().toISOString(),
        });
      }

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: { isAccountLocked: true },
        });

        // ✅ Send account locked alert
        await sendSecurityAlertNotification(user, "account_locked", {
          reason: "Multiple failed login attempts",
          timestamp: new Date().toISOString(),
        });
      }
    }

    return ctx.badRequest("Invalid credentials");
  } catch (error) {
    console.error("Failed login handling error:", error);
    throw error;
  }
}

// ==========================================
// 3. PASSWORD CHANGE
// ==========================================
async function handlePasswordChange(ctx) {
  try {
    const userId = ctx.state.user.id;
    const { oldPassword, newPassword } = ctx.request.body;

    // ... validate old password ...

    // Update password
    await strapi.query("plugin::users-permissions.user").update({
      where: { id: userId },
      data: { password: newPassword },
    });

    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId } });

    // ✅ Send password change notification
    await sendSecurityAlertNotification(user, "password_changed", {
      timestamp: new Date().toISOString(),
    });

    return ctx.send({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    throw error;
  }
}

// ==========================================
// 4. PIN CHANGE
// ==========================================
async function handlePinChange(ctx) {
  try {
    const userId = ctx.state.user.id;
    const { oldPin, newPin } = ctx.request.body;

    // ... validate old pin ...

    // Update PIN
    const hashedPin = await hashPin(newPin);
    await strapi.query("plugin::users-permissions.user").update({
      where: { id: userId },
      data: { pin: hashedPin },
    });

    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId } });

    // ✅ Send PIN change notification
    await sendSecurityAlertNotification(user, "pin_changed", {
      timestamp: new Date().toISOString(),
    });

    return ctx.send({ message: "PIN updated successfully" });
  } catch (error) {
    console.error("PIN change error:", error);
    throw error;
  }
}

// ==========================================
// 5. LARGE WITHDRAWAL ALERT
// ==========================================
async function handleLargeWithdrawal(ctx) {
  try {
    const userId = ctx.state.user.id;
    const { amount } = ctx.request.body;
    const LARGE_WITHDRAWAL_THRESHOLD = 100000; // ₦100,000

    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId } });

    if (amount > LARGE_WITHDRAWAL_THRESHOLD) {
      // ✅ Send large withdrawal alert
      await sendSecurityAlertNotification(user, "large_withdrawal", {
        amount: amount,
        threshold: LARGE_WITHDRAWAL_THRESHOLD,
        timestamp: new Date().toISOString(),
      });

      // Optionally require additional confirmation
      // Store pending withdrawal for verification
      // ...
    }

    // Process withdrawal
    // ...

    return ctx.send({ message: "Withdrawal processed" });
  } catch (error) {
    console.error("Withdrawal error:", error);
    throw error;
  }
}

// ==========================================
// 6. BROADCAST SYSTEM ALERTS
// ==========================================
async function sendSystemMaintenanceAlert(maintenanceDetails) {
  try {
    // ✅ Send to all users via topic
    await sendBroadcastNotification(
      "🔧 Scheduled Maintenance",
      `System maintenance scheduled from ${maintenanceDetails.startTime} to ${maintenanceDetails.endTime}. Services may be unavailable.`,
      {
        type: "maintenance",
        topic: "announcements",
        actionUrl: "/announcements",
        data: {
          startTime: maintenanceDetails.startTime,
          endTime: maintenanceDetails.endTime,
          affectedServices: maintenanceDetails.affectedServices.join(", "),
        },
      }
    );

    console.log("✅ Maintenance alert broadcast sent");
  } catch (error) {
    console.error("Error sending maintenance alert:", error);
  }
}

async function sendSecurityPatchAlert() {
  try {
    // ✅ Send to all users for security updates
    await sendBroadcastNotification(
      "🔒 Security Update Available",
      "A critical security update has been released. Please update your app from the store.",
      {
        type: "security_update",
        topic: "announcements",
        actionUrl: "/app-update",
      }
    );

    console.log("✅ Security update alert broadcast sent");
  } catch (error) {
    console.error("Error sending security alert:", error);
  }
}

// ==========================================
// HELPER FUNCTIONS (implement based on your needs)
// ==========================================

async function checkIfNewDevice(userId, userAgent, clientIP) {
  // Implement logic to check if this device/IP combination is new
  const previousLogins = await getLoginHistory(userId);
  return !previousLogins.some(
    (login) => login.userAgent === userAgent && login.ip === clientIP
  );
}

async function getLoginHistory(userId, limit = 10) {
  // Fetch from your login history table/collection
  return await strapi
    .query("api::login-history.login-history")
    .findMany({ where: { user: userId }, orderBy: { createdAt: "desc" }, limit });
}

async function getRecentLoginAttempts(userId, limit) {
  // Fetch recent login attempts
  return await getLoginHistory(userId, limit);
}

function detectAnomalousActivity(loginHistory) {
  // Implement anomaly detection logic
  // E.g., login from different countries in short time, unusual hours, etc.
  return false; // Placeholder
}

function getLocationFromIP(ipAddress) {
  // Use a geolocation service (MaxMind, IP2Location, etc.)
  return "Unknown Location"; // Placeholder
}

async function getUserByEmail(email) {
  return await strapi.query("plugin::users-permissions.user").findOne({
    where: { email },
  });
}

module.exports = {
  handleLogin,
  handleFailedLogin,
  handlePasswordChange,
  handlePinChange,
  handleLargeWithdrawal,
  sendSystemMaintenanceAlert,
  sendSecurityPatchAlert,
};
