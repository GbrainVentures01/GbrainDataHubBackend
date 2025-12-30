# Notification Triggers Implementation Guide

## Overview

This guide explains how to integrate push notifications into your transaction handlers throughout the application. Notification triggers are already created and ready to use.

## Available Triggers

### 1. Payment Notifications

#### Payment Success Notification
```javascript
const { sendPaymentSuccessNotification } = require('../utils/notification-triggers');

// In your transaction success handler
if (transaction.status === 'successful') {
  await sendPaymentSuccessNotification(user, {
    amount: transaction.amount,
    reference: transaction.request_id,
    imageUrl: 'https://...' // optional
  }, 'airtime'); // type: airtime, data, electricity, cable, exam_pin, gift_card
}
```

#### Payment Failure Notification
```javascript
const { sendPaymentFailureNotification } = require('../utils/notification-triggers');

// In your transaction failure handler
if (transaction.status === 'failed') {
  await sendPaymentFailureNotification(user, {
    amount: transaction.amount,
    reference: transaction.request_id
  }, 'airtime', 'Insufficient funds. Please try again.');
}
```

### 2. Transaction Confirmations

```javascript
const { sendTransactionConfirmationNotification } = require('../utils/notification-triggers');

// Send immediate confirmation after transaction initiation
await sendTransactionConfirmationNotification(user, {
  amount: transaction.amount,
  reference: transaction.reference,
  description: 'Data bundle purchase',
  id: transaction.id
});
```

### 3. Security Alerts

```javascript
const { sendSecurityAlertNotification } = require('../utils/notification-triggers');

// Suspicious login
await sendSecurityAlertNotification(user, 'suspicious_login', {
  location: 'Lagos, Nigeria',
  time: new Date().toLocaleTimeString()
});

// New device login
await sendSecurityAlertNotification(user, 'new_device', {
  deviceName: 'iPhone 13 Pro'
});

// Large withdrawal alert
await sendSecurityAlertNotification(user, 'large_withdrawal', {
  amount: 50000
});

// Multiple failed login attempts
await sendSecurityAlertNotification(user, 'failed_attempts', {
  attempts: 5
});

// Password changed
await sendSecurityAlertNotification(user, 'password_changed', {});

// PIN changed
await sendSecurityAlertNotification(user, 'pin_changed', {});
```

### 4. Promotions

```javascript
const { sendPromotionNotification } = require('../utils/notification-triggers');

// Send promotion to user
await sendPromotionNotification(user, {
  title: 'Get 20% Bonus on Airtime',
  description: 'Buy airtime today and get 20% extra. Use code: BONUS20',
  discount: '20%',
  validUntil: '2025-12-31',
  code: 'BONUS20',
  actionUrl: '/promotions/airtime-bonus',
  imageUrl: 'https://...'
});
```

### 5. Wallet Notifications

#### Wallet Credit
```javascript
const { sendWalletCreditNotification } = require('../utils/notification-triggers');

await sendWalletCreditNotification(user, 5000, 'Referral bonus credited');
```

#### Low Balance Alert
```javascript
const { sendLowBalanceAlert } = require('../utils/notification-triggers');

if (user.AccountBalance < 1000) {
  await sendLowBalanceAlert(user, user.AccountBalance);
}
```

### 6. Broadcast Notifications

```javascript
const { sendBroadcastNotification } = require('../utils/notification-triggers');

// Send to all users subscribed to 'announcements' topic
await sendBroadcastNotification(
  'Maintenance Notice',
  'System maintenance scheduled for tonight 2-3 AM. Services may be unavailable.',
  {
    type: 'announcement',
    topic: 'announcements',
    actionUrl: '/announcements',
    imageUrl: 'https://...'
  }
);
```

## Integration Points

### Airtime Order Controller
**File:** `src/api/airtime-order/controllers/airtime-order.js`

Add to success handler (around line 475):
```javascript
const { sendPaymentSuccessNotification } = require('../../../utils/notification-triggers');

if (buyAirtime.data.code === "000") {
  // ... existing code ...
  await sendPaymentSuccessNotification(user, {
    amount: data.amount,
    reference: data.request_id
  }, 'airtime');
}
```

Add to failure handler:
```javascript
const { sendPaymentFailureNotification } = require('../../../utils/notification-triggers');

else {
  await sendPaymentFailureNotification(user, {
    amount: data.amount,
    reference: data.request_id
  }, 'airtime', 'Transaction failed. Please try again.');
  ctx.throw(500, "Airtime purchase failed");
}
```

### Electricity Order Controller
**File:** `src/api/electricity-order/controllers/electricity-order.js`

```javascript
const { sendPaymentSuccessNotification } = require('../../../utils/notification-triggers');

if (makeElectricityPurchase.data.code === "000") {
  // ... existing code ...
  await sendPaymentSuccessNotification(user, {
    amount: data.amount,
    reference: data.request_id
  }, 'electricity');
}
```

### Data Order Controllers (MTN, GLO, etc.)
**Files:** `src/api/mtn-sme-*-data-order/controllers/`

```javascript
const { sendPaymentSuccessNotification } = require('../../../utils/notification-triggers');

if (makeDataPurchase.data.code === "000") {
  // ... existing code ...
  await sendPaymentSuccessNotification(user, {
    amount: data.amount,
    reference: data.request_id
  }, 'data');
}
```

### TV Cable Order Controller
**File:** `src/api/tvcables-order/controllers/tvcables-order.js`

```javascript
const { sendPaymentSuccessNotification } = require('../../../utils/notification-triggers');

if (makeCablePurchase.data.code === "000") {
  // ... existing code ...
  await sendPaymentSuccessNotification(user, {
    amount: data.amount,
    reference: data.request_id
  }, 'cable');
}
```

### Exam PIN Order Controller
**File:** `src/api/exam-pin-order/controllers/exam-pin-order.js`

```javascript
const { sendPaymentSuccessNotification } = require('../../../utils/notification-triggers');

if (purchaseExamPin.data.code === "000") {
  // ... existing code ...
  await sendPaymentSuccessNotification(user, {
    amount: data.amount,
    reference: data.request_id,
    pin: purchaseExamPin.data.purchased_code
  }, 'exam_pin');
}
```

### Authentication Controller - Security Alerts
**File:** `src/extensions/users-permissions/server/controllers/auth.js`

```javascript
const { sendSecurityAlertNotification } = require('../../../utils/notification-triggers');

// After login
const user = await getService("user").fetchAuthenticatedUser(ctx.state.user.id);
const isNewDevice = checkIfNewDevice(ctx, user);

if (isNewDevice) {
  await sendSecurityAlertNotification(user, 'new_device', {
    deviceName: ctx.request.headers['user-agent'] || 'Unknown Device'
  });
}

// After failed login attempts
if (failedAttempts > 3) {
  await sendSecurityAlertNotification(user, 'failed_attempts', {
    attempts: failedAttempts
  });
}
```

### Wallet Management
```javascript
const { sendWalletCreditNotification, sendLowBalanceAlert } = require('../../../utils/notification-triggers');

// After wallet credit
await strapi.query("plugin::users-permissions.user").update({
  where: { id: user.id },
  data: { AccountBalance: user.AccountBalance + amount }
});

const updatedUser = await strapi.query("plugin::users-permissions.user").findOne({
  where: { id: user.id }
});

await sendWalletCreditNotification(updatedUser, amount, 'Referral bonus');

// Check for low balance after debit
if (updatedUser.AccountBalance < 1000) {
  await sendLowBalanceAlert(updatedUser, updatedUser.AccountBalance);
}
```

## Testing Notifications

### Test endpoint (for development)
```bash
curl -X POST http://localhost:1337/api/notifications/send-to-user \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "payload": {
      "title": "Test Notification",
      "body": "This is a test notification"
    }
  }'
```

### Manual trigger test
```javascript
// In any controller
const triggers = require('../../../utils/notification-triggers');

const testUser = await strapi.query("plugin::users-permissions.user").findOne({
  where: { id: 1 }
});

await triggers.sendPaymentSuccessNotification(testUser, {
  amount: 1000,
  reference: 'TEST-001'
}, 'airtime');
```

## Notification Types Summary

| Type | Trigger | When to Send |
|------|---------|--------------|
| `payment_success` | Transaction completes successfully | Immediately after provider confirms |
| `payment_failure` | Transaction fails | When provider returns error code |
| `transaction_confirmed` | Transaction initiated | Immediately after API call |
| `security_alert` | Security events | Login, withdrawal, failed attempts |
| `promotion` | Marketing campaigns | Scheduled or event-based |
| `wallet_credit` | Account funded | Immediately after credit |
| `low_balance_alert` | Balance below threshold | After debit if balance < 1000 |
| `announcement` | Admin broadcast | Scheduled maintenance or urgent updates |

## Notification Data Structure

All notifications include:
```javascript
{
  title: "String - Main heading",
  body: "String - Main message",
  type: "String - Notification category",
  data: {
    timestamp: "ISO string",
    actionUrl: "String - Deep link",
    // Additional contextual data...
  },
  imageUrl: "Optional image URL"
}
```

## Error Handling

All notification triggers include try-catch blocks and log errors:
```javascript
❌ [Notification] Error sending payment success notification: {...}
```

Monitor logs for notification failures and review Firebase console for delivery status.

## Next Steps

1. **Integrate triggers** into each transaction handler (airtime, electricity, etc.)
2. **Test thoroughly** with Firebase credentials properly configured
3. **Monitor notifications** in Firebase Console
4. **Adjust messaging** based on user feedback
5. **Add promotional logic** to send targeted offers based on user behavior

## Support

For issues:
- Check Firebase Console for credential errors
- Verify user tokens are registered
- Review logs for error details
- Check Deep Link configuration in Flutter app
