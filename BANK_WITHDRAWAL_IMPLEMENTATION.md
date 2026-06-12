# Bank Withdrawal Implementation Guide

This guide explains how to implement bank withdrawal functionality with KYC tier-based limits.

## Overview

The KYC tier system enforces the following withdrawal limits:
- **Tier 1 (Basic)**: ₦3,000,000 NGN per day
- **Tier 2 (Intermediate)**: ₦25,000,000 NGN per day  
- **Tier 3 (Advanced)**: Unlimited

## Architecture

### 1. Middleware: `check-kyc-limits.js`

Located in: `src/middlewares/check-kyc-limits.js`

**Functions:**
- `checkWithdrawalLimit(strapi)` - Main middleware for withdrawal limit enforcement
- `checkFeatureAccess(restrictedFeature)(strapi)` - Middleware for feature restrictions (e.g., crypto)
- `getUserKycTier(strapi, userId)` - Helper to get user's current tier
- `isFeatureAvailableForTier(tier, feature)` - Helper to check feature availability

### 2. Utilities: `kyc-tiers.js`

Located in: `src/utils/kyc-tiers.js`

Defines:
- KYC tier levels (TIER_1, TIER_2, TIER_3)
- Tier limits (daily withdrawal, transaction amounts)
- Restricted features per tier
- Helper functions for tier management

## Implementing Bank Withdrawal

### Example Implementation

Here's how to implement a bank withdrawal endpoint:

```javascript
// src/api/bank-withdrawal/controllers/bank-withdrawal.js

const { checkWithdrawalLimit } = require('../../../middlewares/check-kyc-limits');
const { KYC_TIERS } = require('../../../utils/kyc-tiers');

module.exports = createCoreController('api::bank-withdrawal.bank-withdrawal', ({ strapi }) => ({
  async initiate(ctx) {
    const userId = ctx.state.user?.id;
    const { accountNumber, amount, paymentMethodId } = ctx.request.body;

    try {
      // Verify user and get payment method
      const user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        userId
      );

      const paymentMethod = await strapi.entityService.findOne(
        'api::payment-method.payment-method',
        paymentMethodId,
        {
          populate: ['user'],
        }
      );

      // Verify ownership
      if (paymentMethod.user.id !== userId) {
        return ctx.forbidden('Payment method does not belong to this user');
      }

      // KYC Limit check (from middleware - if you add middleware to route)
      const kycTier = ctx.state.kycTier;
      const dailyLimit = ctx.state.dailyLimit;
      const totalWithdrawnToday = ctx.state.totalWithdrawnToday || 0;

      // If limit exceeded, middleware returns 403
      // If we reach here, we're safe to proceed

      // Create withdrawal record
      const withdrawal = await strapi.entityService.create(
        'api::bank-withdrawal.bank-withdrawal',
        {
          data: {
            user: userId,
            paymentMethod: paymentMethodId,
            amount,
            accountNumber,
            status: 'pending',
            tier: kycTier,
            dailyWithdrawnSoFar: totalWithdrawnToday,
            reference: `WTH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          },
        }
      );

      // Deduct from account balance
      const newBalance = user.AccountBalance - amount;
      await strapi.entityService.update(
        'plugin::users-permissions.user',
        userId,
        {
          data: { AccountBalance: newBalance },
        }
      );

      return ctx.send({
        success: true,
        message: 'Withdrawal initiated successfully',
        data: {
          withdrawalId: withdrawal.id,
          reference: withdrawal.reference,
          amount,
          dailyLimit,
          dailyRemaining: dailyLimit - (totalWithdrawnToday + amount),
        },
      });
    } catch (error) {
      strapi.log.error('Bank withdrawal error:', error);
      return ctx.internalServerError('Failed to initiate withdrawal');
    }
  },
}));
```

### Route Configuration

Add the middleware to your withdrawal route:

```javascript
// src/api/bank-withdrawal/routes/bank-withdrawal.js

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/bank-withdrawal/initiate',
      handler: 'bank-withdrawal.initiate',
      config: {
        middlewares: [
          'plugin::users-permissions.isAuthenticatedUser',
          // Add the KYC limit check middleware here
          // Note: The middleware function needs to be registered in strapi
        ],
      },
    },
  ],
};
```

### Middleware Registration

To use custom middleware, you may need to register it in your Strapi bootstrap:

```javascript
// src/bootstrap.js

module.exports = ({ strapi }) => {
  const { checkWithdrawalLimit } = require('./middlewares/check-kyc-limits');

  // Register the middleware
  strapi.use(checkWithdrawalLimit);

  // or use it in specific routes via route configuration
};
```

## Current Implementation Status

### ✅ Implemented
- KYC tier system in user schema
- Auto-assignment of Tier 1 on email verification
- KYC limits defined in `kyc-tiers.js`
- Middleware for checking withdrawal limits and feature restrictions
- Tier checks in wallet transfers
- Tier restriction for crypto purchases (Flutter app)
- Payment method controller updated to check Tier 1

### ⚠️ Needs Implementation
- Bank withdrawal endpoint (`/bank-withdrawal/initiate`)
- Webhook handlers for payment provider (Monnify/PayVessel) to update withdrawal status
- Withdrawal history tracking in optimized-transaction-history
- UI in Flutter app for initiating bank withdrawals
- Refund/reversal logic if withdrawal fails
- Email notifications for withdrawal status changes

## Testing the Implementation

### 1. Test Withdrawal Limit Check

```bash
# User at Tier 1 attempting to withdraw 4M NGN (exceeds 3M limit)
POST /bank-withdrawal/initiate
{
  "accountNumber": "1234567890",
  "amount": 4000000,
  "paymentMethodId": 123
}

# Response: 403 Forbidden
{
  "error": "Daily withdrawal limit exceeded",
  "errorCode": "WITHDRAWAL_LIMIT_EXCEEDED",
  "tier": 1,
  "dailyLimit": 3000000,
  "alreadyWithdrawn": 0,
  "remaining": 3000000,
  "attempted": 4000000
}
```

### 2. Test Feature Restriction

```bash
# Tier 1 user attempting crypto purchase
POST /crypto/initiate-purchase
{
  "amount": 100000,
  "currency": "BTC"
}

# Response: 403 Forbidden (if middleware is applied)
{
  "error": "This feature is not available for your KYC tier",
  "errorCode": "FEATURE_RESTRICTED",
  "feature": "cryptoPurchase",
  "tier": 1,
  "requiredTier": 2
}
```

### 3. Verify Tier Assignment on Registration

```bash
# After email verification
POST /auth/mobile/verify-email
{
  "email": "user@example.com",
  "code": "123456"
}

# Response should include:
{
  "jwt": "eyJhbGc...",
  "user": {
    "id": 123,
    "kycTier": 1,           # Should be 1 after email verification
    "kycVerified": true,    # Should be true
    "kycVerifiedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Database Schema

### User Fields (Already Added)
```json
{
  "kycTier": {
    "type": "integer",
    "default": 1,
    "required": true
  },
  "kycVerified": {
    "type": "boolean",
    "default": false,
    "required": true
  },
  "kycVerifiedAt": {
    "type": "datetime",
    "required": false
  },
  "phoneVerified": {
    "type": "boolean",
    "default": false
  },
  "phoneVerifiedAt": {
    "type": "datetime",
    "required": false
  }
}
```

## Error Codes

- `KYC_TIER_REQUIRED` - User doesn't meet minimum KYC tier
- `WITHDRAWAL_LIMIT_EXCEEDED` - Daily withdrawal limit exceeded
- `FEATURE_RESTRICTED` - Feature not available for user's tier
- `INVALID_PAYMENT_METHOD` - Payment method doesn't belong to user
- `INSUFFICIENT_BALANCE` - Account balance insufficient for withdrawal

## Next Steps

1. Create bank withdrawal content type schema
2. Implement withdrawal initiation endpoint
3. Set up payment provider webhooks (Monnify/PayVessel)
4. Add withdrawal status tracking
5. Implement Flutter UI for withdrawals
6. Add withdrawal history to transaction timeline
7. Implement Tier 2 and Tier 3 document verification flows

## Migration Notes

### For Existing Users
- Set `kycTier = 1` for all confirmed users (already verified email)
- Set `kycTier = 0` for unconfirmed users
- Set `kycVerified = true` if `kycTier > 0`

### SQL Migration Example
```sql
-- Migrate existing confirmed users to Tier 1
UPDATE up_users
SET 
  kyc_tier = 1,
  kyc_verified = true,
  kyc_verified_at = CASE 
    WHEN confirmed = true THEN created_at
    ELSE NULL
  END
WHERE confirmed = true;

-- Unconfirmed users stay at Tier 0
UPDATE up_users
SET kyc_tier = 0, kyc_verified = false
WHERE confirmed = false;
```
