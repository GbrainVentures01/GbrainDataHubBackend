# PIN Consolidation Guide: Web & Mobile App Integration

## Overview

This guide documents the consolidation of PIN management between the web app and mobile app. Previously, the system used:
- `pin` field for the web app (transaction PIN)
- `transactionPin` field for the mobile app

Now, both apps use the unified `transactionPin` field.

## Changes Made

### 1. **Web App Registration (`register()` method)**
- **Before**: Set `params.pin` during registration
- **After**: Set `params.transactionPin` and `params.hasTransactionPin = true` during registration
- Both web and mobile users now share the same PIN field

### 2. **PIN Reset Methods**
- `forgotPin()`: Now checks `hasTransactionPin` flag before allowing PIN reset
- `mobileForgotPin()`: Works seamlessly with consolidated field
- Added validation to ensure user has a PIN set before initiating reset

### 3. **PIN Change/Update Methods**
- `mobileSetTransactionPin()`: 
  - Now works for both web and mobile users
  - Standardized to 4-digit PINs (matching web app requirement)
  - Can be used by existing web users to update their PIN on mobile
  
- `changeTransactionPin()`:
  - Added backward compatibility for web users migrating to mobile
  - Checks for legacy `pin` field if `transactionPin` is not set
  - Automatically logs when a web user's PIN is being validated

### 4. **Backward Compatibility**
The system includes migration logic in `changeTransactionPin()`:
```javascript
// For existing web users migrating to mobile: check if they have pin instead
if (!transactionPinHash && user.pin) {
  transactionPinHash = user.pin;
  strapi.log.info(`[PIN Migration] User ${userId} has legacy 'pin' field, using for validation`);
}
```

## Migration Strategy for Existing Web Users

### Scenario 1: Web User with PIN, Upgrading to Mobile
1. User installs mobile app
2. User logs in with existing credentials
3. User attempts to use transaction features on mobile
4. System detects they have `pin` but not `transactionPin`
5. User is prompted to verify their existing PIN or set a new one
6. Once verified/set, PIN is migrated to `transactionPin` field
7. `hasTransactionPin` flag is updated to `true`

### Scenario 2: Web User Without PIN, Using Mobile
1. User installs mobile app
2. User logs in
3. Mobile app prompts to set transaction PIN
4. `mobileSetTransactionPin()` creates new PIN in `transactionPin` field
5. `hasTransactionPin` is set to `true`

### Scenario 3: New Web User, Later Using Mobile
1. User registers on web app
2. PIN is set in `transactionPin` field with `hasTransactionPin = true`
3. User installs mobile app
4. PIN works seamlessly on mobile without any changes needed

## Database Field Information

### User Model Fields:
- **`transactionPin`** (String, hashed): Contains the PIN hash for both web and mobile
- **`hasTransactionPin`** (Boolean): Indicates whether user has set a transaction PIN
- **`pin`** (String, deprecated): Legacy web app field - to be removed in future migration

### Migration Path:
```
Web User with pin field
    ↓
Changes PIN or logs into mobile
    ↓
System validates against `pin` field
    ↓
PIN is hashed and stored in `transactionPin`
    ↓
hasTransactionPin = true
    ↓
Legacy `pin` field can be cleaned up later
```

## PIN Format Standardization

- **Format**: 4 digits (0000-9999)
- **Validation**: `/^\d{4}$/`
- **Hashing**: Using `getService("user").hashPin()` method
- **Validation**: Using `validatePassword()` method (works with hashed PINs)

## API Endpoints Affected

### For Setting PIN:
- **Endpoint**: `POST /auth/mobile-set-transaction-pin`
- **Body**: `{ pin: "1234", pinConfirmation: "1234" }`
- **Works for**: Both web and mobile users

### For Changing PIN:
- **Endpoint**: `POST /auth/change-transaction-pin`
- **Body**: `{ currentPin: "1234", newPin: "5678", confirmNewPin: "5678" }`
- **Auto-migration**: If `transactionPin` is empty but `pin` exists, uses legacy field

### For Resetting PIN:
- **Endpoint**: `POST /auth/forgot-pin`
- **Validation**: Checks `hasTransactionPin` before allowing reset

## Testing Checklist

- [ ] New web user registration sets `transactionPin` correctly
- [ ] New web user has `hasTransactionPin = true`
- [ ] Web user can change PIN via `changeTransactionPin`
- [ ] Web user logging into mobile can use their PIN
- [ ] Mobile user can set PIN via `mobileSetTransactionPin`
- [ ] PIN validation works for both web and mobile users
- [ ] Legacy web users with only `pin` field can still authenticate
- [ ] PIN reset email is sent correctly
- [ ] Security notifications are sent on PIN changes

## Future Cleanup (Post-Migration)

Once all web users have migrated to the consolidated `transactionPin` field:
1. Remove the `pin` field from the user model
2. Remove backward compatibility code in `changeTransactionPin()`
3. Drop the `pin` column from the database

## Security Considerations

- All PINs are hashed before storage
- PIN changes trigger security notifications
- Each PIN operation logs user IP, device, and browser info
- PIN reset requires email verification
- Failed PIN validation attempts can be logged for security monitoring

## Rollback Plan

If issues occur:
1. Revert to using separate `pin` and `transactionPin` fields
2. Add routing logic to use `pin` for web app, `transactionPin` for mobile
3. Continue supporting both fields until all users migrate

## Support Documentation

Users should be informed:
- Both web and mobile apps now use the same PIN
- PIN format is always 4 digits
- PIN changes should be done securely
- PIN reset emails are valid for 10 minutes
- Lost PINs can be reset via email verification
