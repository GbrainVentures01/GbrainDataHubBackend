# Quidax Integration Guide

## Overview

This document describes the Quidax sub-account creation flow and crypto deposit process.

## User Flow

### First-Time Deposit Flow

1. **User clicks "Deposit Crypto" button**
2. **Backend checks if user has Quidax sub-account**
   - Checks `user.quidax_user_id` field
3. **If no sub-account exists:**
   - Automatically creates Quidax sub-account using user's email, first name, and last name
   - Stores `quidax_user_id` and `quidax_sn` in user record
   - Generates wallet address for requested currency/network
   - Returns wallet address to user
4. **User sees wallet address** and proceeds with deposit
   - User is unaware that account was created behind the scenes

### Returning User Deposit Flow

1. **User clicks "Deposit Crypto" button**
2. **Backend finds existing `quidax_user_id`**
3. **Generates/retrieves wallet address** for requested currency
4. **Returns wallet address** to user immediately

## API Endpoints

### Generate Deposit Address
**POST** `/api/crypto/deposit`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
```

**Request Body:**
```json
{
  "currency": "btc",
  "network": "bitcoin"
}
```

**Response (New User):**
```json
{
  "message": "Deposit address generated successfully",
  "provider": "Quidax",
  "data": {
    "address": "18mgR4rQ2TPi3KzAkNhTNYB2RmQaD5qZES",
    "currency": "btc",
    "network": "bitcoin",
    "destination_tag": null,
    "is_new_account": true,
    "created_at": "2021-10-30T14:30:33.000+01:00"
  }
}
```

**Response (Existing User):**
```json
{
  "message": "Deposit address generated successfully",
  "provider": "Quidax",
  "data": {
    "address": "18mgR4rQ2TPi3KzAkNhTNYB2RmQaD5qZES",
    "currency": "btc",
    "network": "bitcoin",
    "destination_tag": null,
    "is_new_account": false,
    "created_at": "2021-10-30T14:30:33.000+01:00"
  }
}
```

### Webhook Endpoint
**POST** `/api/quidax-webhooks`

This endpoint receives webhooks from Quidax for various events.

**No authentication required** (webhooks come from Quidax servers)

## Quidax API Integration

### Sub-Account Creation

**Endpoint:** `POST https://app.quidax.io/api/v1/users`

**Request:**
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Successful",
  "data": {
    "id": "fxxwu3kc",
    "sn": "QDXR3E7XPRQ",
    "email": "user@example.com",
    "reference": null,
    "first_name": "John",
    "last_name": "Doe",
    "display_name": null,
    "created_at": "2021-11-15T19:33:03.725+01:00",
    "updated_at": "2021-11-15T19:33:05.753+01:00"
  }
}
```

### Generate Wallet Address

**Endpoint:** `POST https://app.quidax.io/api/v1/users/{user_id}/wallets/{currency}/address`

**Request:**
```
POST /api/v1/users/fxxwu3kc/wallets/btc/address
```

**Response:**
```json
{
  "status": "success",
  "message": "Successful",
  "data": {
    "id": "4ogybn3w",
    "reference": null,
    "currency": "btc",
    "address": "18mgR4rQ2TPi3KzAkNhTNYB2RmQaD5qZES",
    "destination_tag": null,
    "total_payments": "0.0",
    "created_at": "2021-10-30T14:30:33.000+01:00",
    "updated_at": "2021-10-30T14:31:24.000+01:00"
  }
}
```

## Webhook Events

### wallet.address.generated

Sent when a wallet address is successfully generated for a sub-account.

**Payload:**
```json
{
  "event": "wallet.address.generated",
  "data": {
    "id": "v2txrv7q",
    "reference": null,
    "currency": "usdt",
    "address": "TMUER8WKoDt2VVzM7Ntt6PKTJNKgQzQgXv",
    "network": "trc20",
    "user": {
      "id": "nho3neuf",
      "sn": "QDXKA7XIYAE",
      "email": "test@testuser.com",
      "reference": null,
      "first_name": "test",
      "last_name": "user",
      "display_name": null,
      "created_at": "2024-03-22T11:08:26.000Z",
      "updated_at": "2024-03-22T11:08:27.000Z"
    },
    "destination_tag": null,
    "total_payments": null,
    "created_at": "2024-03-22T11:12:24.000Z",
    "updated_at": "2024-03-22T11:12:25.000Z"
  }
}
```

### deposit.successful

Sent when a crypto deposit is successfully credited to a sub-account.

### withdrawal.successful

Sent when a crypto withdrawal is successfully completed.

## Database Schema Changes

### User Model

Added fields to `users-permissions` user:

```json
{
  "quidax_user_id": {
    "type": "string",
    "unique": true
  },
  "quidax_sn": {
    "type": "string"
  }
}
```

### Quidax Webhook Model

New collection to store webhook events:

```json
{
  "event": "string (required)",
  "payload": "json (required)",
  "processed": "boolean (default: false)"
}
```

## Code Structure

```
src/
├── api/
│   ├── crypto/
│   │   └── controllers/
│   │       └── crypto.js              # Updated with Quidax flow
│   └── quidax-webhook/
│       ├── controllers/
│       │   └── quidax-webhook.js     # Webhook handler
│       ├── routes/
│       │   ├── quidax-webhook.js     # Default routes
│       │   └── custom-webhook.js     # Custom webhook route
│       ├── services/
│       │   └── quidax-webhook.js
│       └── content-types/
│           └── quidax-webhook/
│               └── schema.json
└── utils/
    └── crypto/
        ├── providers/
        │   ├── quidax-provider.js    # Quidax implementation
        │   └── obiex-provider.js     # Obiex implementation
        └── crypto-provider-factory.js
```

## Implementation Details

### Controller Logic (crypto.js)

```javascript
// Check if Quidax provider
if (provider.getProviderName() === "Quidax") {
  // Check if user has Quidax sub-account
  if (!user.quidax_user_id) {
    // Create sub-account
    const subAccountResult = await provider.createSubAccount({
      email: user.email,
      first_name: firstName,
      last_name: lastName,
    });
    
    // Save Quidax details to user
    await strapi.query("plugin::users-permissions.user").update({
      where: { id: userId },
      data: {
        quidax_user_id: subAccountResult.data.quidax_user_id,
        quidax_sn: subAccountResult.data.quidax_sn,
      },
    });
    
    // Generate wallet address
    const walletResult = await provider.getOrCreateWalletAddress(
      subAccountResult.data.quidax_user_id,
      currency
    );
  } else {
    // User has sub-account, just generate address
    const walletResult = await provider.getOrCreateWalletAddress(
      user.quidax_user_id,
      currency
    );
  }
}
```

## Configuration

Add to `.env`:

```bash
# Active provider
CRYPTO_PROVIDER=quidax

# Quidax credentials
QUIDAX_BASE_URL=https://app.quidax.io/api/v1
QUIDAX_API_KEY=your_quidax_api_key
QUIDAX_SECRET_KEY=your_quidax_secret_key
```

## Webhook Setup

### Configure in Quidax Dashboard

1. Login to Quidax dashboard
2. Navigate to API settings
3. Add webhook URL: `https://yourdomain.com/api/quidax-webhooks`
4. Select events to receive:
   - `wallet.address.generated`
   - `deposit.successful`
   - `withdrawal.successful`

## Testing

### Test Sub-Account Creation

```javascript
const cryptoProviderFactory = require('./src/utils/crypto/crypto-provider-factory');

const quidaxProvider = cryptoProviderFactory.getProvider('quidax');

// Create sub-account
const result = await quidaxProvider.createSubAccount({
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User'
});

console.log('Sub-account created:', result.data.quidax_user_id);

// Generate wallet address
const wallet = await quidaxProvider.getOrCreateWalletAddress(
  result.data.quidax_user_id,
  'btc'
);

console.log('Wallet address:', wallet.data.address);
```

### Test Webhook Locally

Use tools like ngrok to expose local server:

```bash
ngrok http 1337
```

Then use the ngrok URL in Quidax webhook configuration.

## Error Handling

### Sub-Account Creation Failures

- **Duplicate email**: Quidax returns error if email already exists
  - Handle by attempting to fetch existing sub-account
  - Store mapping in database

- **Invalid credentials**: Check `QUIDAX_API_KEY` in `.env`

- **Network errors**: Implement retry logic with exponential backoff

### Wallet Address Generation Failures

- **Unsupported currency**: Check Quidax supported currencies
- **Rate limiting**: Implement request queuing
- **User not found**: Verify `quidax_user_id` is correct

## Best Practices

1. **Always check if sub-account exists** before creating
2. **Store quidax_user_id immediately** after creation
3. **Log all webhook events** for audit trail
4. **Validate webhook signatures** (if Quidax provides)
5. **Handle webhooks asynchronously** to avoid timeouts
6. **Implement idempotency** for webhook processing

## Future Enhancements

- [ ] Add crypto wallet table to store all addresses per user
- [ ] Implement deposit notification system
- [ ] Add withdrawal functionality
- [ ] Implement webhook signature verification
- [ ] Add retry mechanism for failed webhook processing
- [ ] Create admin dashboard for viewing Quidax accounts
