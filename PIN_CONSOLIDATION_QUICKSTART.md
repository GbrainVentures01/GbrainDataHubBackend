# PIN Consolidation - Quick Start Guide

## What Was Changed

The backend now consolidates PIN management so both web and mobile apps use the same `transactionPin` field instead of separate `pin` (web) and `transactionPin` (mobile) fields. Existing web users can seamlessly use their PIN on the mobile app.

## For Developers - Quick Reference

### Key Files Modified

1. **`src/extensions/users-permissions/server/controllers/auth.js`**
   - Updated `register()` to use `transactionPin`
   - Updated `forgotPin()` to check `hasTransactionPin` flag
   - Updated `changeTransactionPin()` with backward compatibility for web users
   - Updated `mobileSetTransactionPin()` to work for both web and mobile
   - Added 3 new admin-only migration endpoints

2. **`src/utils/pin-migration-helper.js`** (NEW)
   - `migrateUserPin(strapi, userId)` - Migrate single user
   - `migrateAllUserPins(strapi, batchSize)` - Migrate all users
   - `getMigrationStatus(strapi)` - Get migration statistics

3. **`PIN_CONSOLIDATION_GUIDE.md`** (NEW)
   - Detailed technical overview
   - Migration strategies for different user scenarios
   - Database schema information

4. **`PIN_CONSOLIDATION_IMPLEMENTATION.md`** (NEW)
   - Comprehensive implementation details
   - Admin endpoint documentation
   - Testing checklist
   - Monitoring and logging info

5. **`scripts/migrate-pin-consolidation.js`** (NEW)
   - Standalone migration script
   - Can be run manually or during bootstrap

### Quick Code Examples

#### New Web Registration (Already Updated)
```javascript
// In register() method
params.transactionPin = await getService("user").hashPin(params);
params.hasTransactionPin = true;
```

#### Web User Checking PIN on Mobile
```javascript
// Backward compatibility in changeTransactionPin()
let transactionPinHash = user.transactionPin;

// Check legacy pin field if transactionPin is empty
if (!transactionPinHash && user.pin) {
  transactionPinHash = user.pin; // Use legacy pin
}
```

#### Standardized PIN Format
```javascript
// Now 4 digits for both web and mobile
if (!/^\d{4}$/.test(pin)) {
  return error("PIN must be exactly 4 digits");
}
```

## For Admins - Migration Steps

### Step 1: Check Migration Status
```bash
curl -X GET http://your-api/auth/admin/pin-migration-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 2: Execute Migration (if needed)
```bash
# Option A: Migrate all users at once
curl -X POST http://your-api/auth/admin/migrate-all-pins \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Option B: Migrate with custom batch size
curl -X POST "http://your-api/auth/admin/migrate-all-pins?batchSize=200" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 3: Verify Completion
```bash
curl -X GET http://your-api/auth/admin/pin-migration-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected response when complete:
# {
#   "totalUsers": 1000,
#   "usersWithTransactionPin": 1000,
#   "usersNeedingMigration": 0,
#   "migrationPercentage": 100,
#   "migrationComplete": true
# }
```

## For Users - What Changed

### Web App Users
- ✅ No action needed
- ✅ Your PIN remains the same
- ✅ PIN is automatically available on mobile app
- ✅ PIN format: 4 digits

### Mobile App Users
- ✅ Can use web app user's existing PIN
- ✅ PIN format standardized to 4 digits
- ✅ All PIN operations work seamlessly

### PIN Operations (Unchanged)
- PIN Format: `1234` (exactly 4 digits)
- PIN Reset: Email verification required
- PIN Change: Requires current PIN validation
- PIN Setup: Available on first login for mobile users

## Backward Compatibility

The system maintains full backward compatibility:

```
Web User with legacy 'pin' field
    ↓
Logs into mobile app
    ↓
System detects no 'transactionPin' but finds 'pin'
    ↓
Uses 'pin' value for validation
    ↓
Once PIN is updated/changed
    ↓
PIN is moved to 'transactionPin'
    ↓
Full consolidation complete
```

## New Admin Endpoints

### 1. GET /auth/admin/pin-migration-status
Check current migration progress
```json
{
  "totalUsers": 1000,
  "usersWithTransactionPin": 980,
  "usersNeedingMigration": 20,
  "migrationPercentage": 98,
  "migrationComplete": false,
  "timestamp": "2026-06-11T10:30:00.000Z"
}
```

### 2. POST /auth/admin/migrate-user-pin
Migrate a specific user's PIN
```json
Body: { "userId": 123 }

Response: {
  "success": true,
  "migrated": true,
  "message": "User PIN successfully migrated",
  "userId": 123,
  "email": "user@example.com"
}
```

### 3. POST /auth/admin/migrate-all-pins
Batch migrate all users
```
Query: ?batchSize=100 (optional)

Response: {
  "message": "PIN consolidation migration completed",
  "totalProcessed": 20,
  "successCount": 18,
  "failureCount": 2,
  "durationSeconds": 300
}
```

## Common Scenarios

### Scenario 1: Web User Logging Into Mobile
```
1. User logs in with email/password (works as before)
2. User tries to make a transaction
3. Mobile app asks for PIN
4. System checks if PIN exists:
   - If transactionPin exists → Use it ✓
   - If only pin exists → Use it (backward compatible) ✓
   - If neither exists → Prompt to set PIN
5. First time setting PIN on mobile → moves to transactionPin field
```

### Scenario 2: Bulk Migration
```
1. Admin checks status: 500 users need migration
2. Admin runs migration: POST /auth/admin/migrate-all-pins
3. System processes in batches of 100
4. Migration completes in ~30-50 seconds
5. Admin verifies: All 500 users now have transactionPin
```

### Scenario 3: New User Registration
```
1. User registers on web app
2. PIN field automatically set to transactionPin
3. hasTransactionPin flag set to true
4. User can use PIN on both web and mobile immediately ✓
```

## Troubleshooting

### User Can't Log In
- Check if user account is blocked
- Verify email is confirmed
- Check user password (not PIN) is correct

### User PIN Not Working on Mobile
- Web user may have legacy `pin` only
- Run migration: `POST /auth/admin/migrate-all-pins`
- Or update PIN via mobile app
- PIN will then be in consolidated field

### Migration Endpoints Return 403 Forbidden
- Only admins can access migration endpoints
- Ensure user has admin role
- Check authorization token is valid

### Migration Shows Failures
- Check backend logs for detailed error messages
- Retry failed users individually
- Contact support if issues persist

## Files to Review

1. **PIN_CONSOLIDATION_GUIDE.md**
   - For understanding the full consolidation strategy

2. **PIN_CONSOLIDATION_IMPLEMENTATION.md**
   - For detailed technical implementation

3. **auth.js** (lines with PIN operations)
   - For code changes and new endpoints

4. **pin-migration-helper.js**
   - For utility functions and helper logic

## Success Indicators

✅ Web users can register and PIN is in transactionPin field
✅ Mobile users can set PIN via mobileSetTransactionPin
✅ Web users logging into mobile can use their existing PIN
✅ PIN validation works across both apps
✅ Migration endpoints return expected statistics
✅ No PIN appears in logs or errors
✅ Security notifications sent on PIN changes

## Next Actions

1. Deploy code changes
2. Run migrations: `POST /auth/admin/migrate-all-pins`
3. Verify completion: `GET /auth/admin/pin-migration-status`
4. Communicate changes to users
5. Monitor for issues in production

---

**Questions?** Refer to the comprehensive guides:
- Technical: See `PIN_CONSOLIDATION_IMPLEMENTATION.md`
- Strategy: See `PIN_CONSOLIDATION_GUIDE.md`
- Code: See `auth.js` and `pin-migration-helper.js`
