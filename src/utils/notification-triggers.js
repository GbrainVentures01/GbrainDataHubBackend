'use strict';

/**
 * Notification Triggers Service
 * Handles sending push notifications for various transaction events
 */

const firebaseNotificationService = require('./firebase/notification-service');

/**
 * Send payment success notification
 * @param {Object} user - User object
 * @param {Object} payment - Payment details
 * @param {string} type - Payment type (airtime, data, electricity, cable, exam_pin, etc.)
 */
async function sendPaymentSuccessNotification(user, payment, type) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for payment success notification');
      return;
    }

    const typeLabels = {
      airtime: 'Airtime Purchase',
      data: 'Data Bundle',
      electricity: 'Electricity Bill',
      cable: 'Cable/TV Subscription',
      exam_pin: 'Exam PIN',
      gift_card: 'Gift Card',
    };

    const title = `${typeLabels[type] || 'Payment'} Successful ✅`;
    const body = `Your ${typeLabels[type] || 'payment'} of ₦${payment.amount || 0} has been completed successfully.`;

    const payload = {
      title,
      body,
      type: 'payment_success',
      data: {
        paymentType: type,
        amount: payment.amount?.toString() || '0',
        reference: payment.reference || payment.request_id || '',
        timestamp: new Date().toISOString(),
        actionUrl: '/transactions/history',
      },
      imageUrl: payment.imageUrl || undefined,
    };

    console.log(`📤 [Notification] Sending payment success notification to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending payment success notification:', error);
  }
}

/**
 * Send payment failure notification
 * @param {Object} user - User object
 * @param {Object} payment - Payment details
 * @param {string} type - Payment type
 * @param {string} reason - Failure reason
 */
async function sendPaymentFailureNotification(user, payment, type, reason) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for payment failure notification');
      return;
    }

    const typeLabels = {
      airtime: 'Airtime Purchase',
      data: 'Data Bundle',
      electricity: 'Electricity Bill',
      cable: 'Cable/TV Subscription',
      exam_pin: 'Exam PIN',
      gift_card: 'Gift Card',
    };

    const title = `${typeLabels[type] || 'Payment'} Failed ❌`;
    const body = `Your ${typeLabels[type] || 'payment'} of ₦${payment.amount || 0} failed. ${reason || 'Please try again.'}`;

    const payload = {
      title,
      body,
      type: 'payment_failure',
      data: {
        paymentType: type,
        amount: payment.amount?.toString() || '0',
        reference: payment.reference || payment.request_id || '',
        reason: reason || 'Transaction failed',
        timestamp: new Date().toISOString(),
        actionUrl: '/support',
      },
      imageUrl: payment.imageUrl || undefined,
    };

    console.log(`📤 [Notification] Sending payment failure notification to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending payment failure notification:', error);
  }
}

/**
 * Send transaction confirmation notification
 * @param {Object} user - User object
 * @param {Object} transaction - Transaction details
 */
async function sendTransactionConfirmationNotification(user, transaction) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for transaction confirmation');
      return;
    }

    const title = '📌 Transaction Confirmed';
    const body = `Transaction of ₦${transaction.amount || 0} confirmed. Reference: ${transaction.reference || 'N/A'}`;

    const payload = {
      title,
      body,
      type: 'transaction_confirmed',
      data: {
        amount: transaction.amount?.toString() || '0',
        reference: transaction.reference || transaction.request_id || '',
        description: transaction.description || '',
        timestamp: new Date().toISOString(),
        actionUrl: `/transactions/${transaction.id || ''}`,
      },
    };

    console.log(`📤 [Notification] Sending transaction confirmation to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending transaction confirmation:', error);
  }
}

/**
 * Send security alert notification
 * @param {Object} user - User object
 * @param {string} alertType - Type of security alert (login, withdrawal, etc.)
 * @param {Object} details - Alert details
 */
async function sendSecurityAlertNotification(user, alertType, details) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for security alert');
      return;
    }

    const alertTitles = {
      suspicious_login: '⚠️ Suspicious Login Attempt',
      new_device: '🔔 New Device Login',
      large_withdrawal: '💰 Large Withdrawal Alert',
      failed_attempts: '🔐 Multiple Failed Login Attempts',
      password_changed: '🔑 Password Changed',
      pin_changed: '🔑 PIN Changed',
    };

    const title = alertTitles[alertType] || '⚠️ Security Alert';
    let body = 'An unusual activity was detected on your account.';

    if (alertType === 'suspicious_login') {
      body = `Login attempt from ${details.location || 'unknown location'} at ${details.time || new Date().toLocaleTimeString()}. If this wasn't you, secure your account.`;
    } else if (alertType === 'new_device') {
      body = `Your account was accessed from a new device: ${details.deviceName || 'Unknown Device'}. Review this activity.`;
    } else if (alertType === 'large_withdrawal') {
      body = `A large withdrawal of ₦${details.amount || 0} was initiated. Confirm if this was you.`;
    } else if (alertType === 'failed_attempts') {
      body = `${details.attempts || 3} failed login attempts detected. Secure your account if necessary.`;
    }

    const payload = {
      title,
      body,
      type: 'security_alert',
      data: {
        alertType,
        timestamp: new Date().toISOString(),
        actionUrl: '/account/security',
        ...details,
      },
    };

    console.log(`📤 [Notification] Sending security alert to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending security alert:', error);
  }
}

/**
 * Send promotion announcement notification
 * @param {Object} user - User object
 * @param {Object} promotion - Promotion details
 */
async function sendPromotionNotification(user, promotion) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for promotion notification');
      return;
    }

    const title = promotion.title || '🎉 Special Offer for You!';
    const body = promotion.description || 'Check out our latest promotions and save more.';

    const payload = {
      title,
      body,
      type: 'promotion',
      data: {
        promotionId: promotion.id?.toString() || '',
        discount: promotion.discount?.toString() || '',
        validUntil: promotion.validUntil || '',
        code: promotion.code || '',
        timestamp: new Date().toISOString(),
        actionUrl: promotion.actionUrl || '/promotions',
      },
      imageUrl: promotion.imageUrl || undefined,
    };

    console.log(`📤 [Notification] Sending promotion to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending promotion notification:', error);
  }
}

/**
 * Send wallet credit notification
 * @param {Object} user - User object
 * @param {number} amount - Amount credited
 * @param {string} reason - Reason for credit
 */
async function sendWalletCreditNotification(user, amount, reason) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for wallet credit');
      return;
    }

    const title = '💳 Wallet Credited';
    const body = `Your wallet has been credited with ₦${amount || 0}. ${reason || ''}`;

    const payload = {
      title,
      body,
      type: 'wallet_credit',
      data: {
        amount: amount?.toString() || '0',
        reason: reason || 'Wallet credit',
        timestamp: new Date().toISOString(),
        newBalance: user.AccountBalance?.toString() || '0',
        actionUrl: '/wallet',
      },
    };

    console.log(`📤 [Notification] Sending wallet credit to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending wallet credit notification:', error);
  }
}

/**
 * Send low balance alert
 * @param {Object} user - User object
 * @param {number} balance - Current balance
 */
async function sendLowBalanceAlert(user, balance) {
  try {
    if (!user || !user.id) {
      console.error('❌ [Notification] No user provided for low balance alert');
      return;
    }

    const title = '💰 Low Wallet Balance';
    const body = `Your wallet balance is low at ₦${balance || 0}. Fund your wallet to continue transactions.`;

    const payload = {
      title,
      body,
      type: 'low_balance_alert',
      data: {
        currentBalance: balance?.toString() || '0',
        timestamp: new Date().toISOString(),
        actionUrl: '/wallet/fund',
      },
    };

    console.log(`📤 [Notification] Sending low balance alert to user ${user.id}`);
    await firebaseNotificationService.sendNotificationToUser(user.id, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending low balance alert:', error);
  }
}

/**
 * Send broadcast notification to all users (admin announcements)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 */
async function sendBroadcastNotification(title, body, options = {}) {
  try {
    const payload = {
      title,
      body,
      type: options.type || 'announcement',
      data: {
        timestamp: new Date().toISOString(),
        actionUrl: options.actionUrl || '/',
        ...options.data,
      },
      imageUrl: options.imageUrl || undefined,
    };

    const topic = options.topic || 'announcements';
    console.log(`📤 [Notification] Broadcasting to topic: ${topic}`);
    await firebaseNotificationService.sendNotificationToTopic(topic, payload);
  } catch (error) {
    console.error('❌ [Notification] Error sending broadcast notification:', error);
  }
}

module.exports = {
  sendPaymentSuccessNotification,
  sendPaymentFailureNotification,
  sendTransactionConfirmationNotification,
  sendSecurityAlertNotification,
  sendPromotionNotification,
  sendWalletCreditNotification,
  sendLowBalanceAlert,
  sendBroadcastNotification,
};
