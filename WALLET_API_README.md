# Wallet Management Backend Implementation

## Overview
Backend API implementation for integrated wallet management with support for inter-wallet transfers and transaction history.

## Created Files

### 1. Content Type Schema
**Location:** `src/api/wallet-transaction/content-types/wallet-transaction/schema.json`

Defines the wallet transaction model with:
- `type`: transfer, credit, debit
- `amount`: Transaction amount
- `fromWallet`: Source wallet (AccountBalance, cryptoWalletBalance, giftCardBalance)
- `toWallet`: Destination wallet
- `status`: pending, completed, failed
- `description`: Transaction description
- `reference`: Unique transaction reference
- `user`: Relation to user who made the transaction

### 2. Controller
**Location:** `src/api/wallet-transaction/controllers/wallet-transaction.js`

#### `transfer()` - POST /api/wallet-transfers
Handles inter-wallet transfers with:
- ✅ Input validation (amount, wallet fields)
- ✅ Business rules enforcement:
  - Data & Bills cannot transfer to other wallets
  - Only Crypto and Gift Card can transfer to Data & Bills
  - Minimum transfer: ₦100
- ✅ Balance checking
- ✅ Atomic balance updates
- ✅ Transaction record creation
- ✅ Unique reference generation

**Request Body:**
```json
{
  "fromWallet": "cryptoWalletBalance",
  "toWallet": "AccountBalance",
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer completed successfully",
  "data": {
    "fromBalance": 4500,
    "toBalance": 1500,
    "transactionId": "TXN-1234567890-ABC123"
  }
}
```

#### `find()` - GET /api/wallet-transactions
Retrieves transaction history with:
- ✅ User-specific filtering
- ✅ Wallet-based filtering (fromWallet, toWallet)
- ✅ Pagination support
- ✅ Sorting by date (newest first)

**Query Parameters:**
```
?pagination[page]=1
&pagination[pageSize]=20
&sort[0]=createdAt:desc
&filters[fromWallet][$eq]=cryptoWalletBalance
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "attributes": {
        "type": "transfer",
        "amount": 500,
        "fromWallet": "cryptoWalletBalance",
        "toWallet": "AccountBalance",
        "status": "completed",
        "description": "Transfer from Crypto Wallet to Data & Bills",
        "reference": "TXN-1234567890-ABC123",
        "createdAt": "2025-12-24T10:30:00.000Z"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "pageCount": 1,
      "total": 5
    }
  }
}
```

### 3. Routes
**Location:** `src/api/wallet-transaction/routes/wallet-transaction.js`

- `POST /api/wallet-transfers` → `transfer()`
- `GET /api/wallet-transactions` → `find()`

Both routes require authentication (JWT token).

### 4. Service
**Location:** `src/api/wallet-transaction/services/wallet-transaction.js`

Standard Strapi service for the wallet-transaction content type.

### 5. User Schema Update
**Location:** `src/extensions/users-permissions/content-types/user/schema.json`

Added relation:
```json
"wallet_transactions": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::wallet-transaction.wallet-transaction",
  "mappedBy": "user"
}
```

## Transfer Rules

### Allowed Transfers
✅ **Crypto Wallet → Data & Bills**
- Users can convert crypto balance to data/bills balance

✅ **Gift Card → Data & Bills**
- Users can convert gift card balance to data/bills balance

### Restricted Transfers
❌ **Data & Bills → Any Wallet**
- Data & Bills balance cannot be transferred to other wallets
- This is a one-way funding mechanism

❌ **Crypto → Gift Card** (or vice versa)
- Direct transfers between Crypto and Gift Card are not supported

## Validation Rules

1. **Amount Validation:**
   - Must be greater than 0
   - Minimum: ₦100
   - Cannot exceed available balance

2. **Wallet Validation:**
   - fromWallet and toWallet must be valid enum values
   - Transfer direction must follow business rules

3. **Balance Check:**
   - Source wallet must have sufficient funds
   - Atomic update ensures consistency

## Testing

### Setup
1. Start Strapi server: `npm run develop`
2. Login to get JWT token
3. Update `JWT_TOKEN` in `test-wallet-transfer.js`

### Run Tests
```bash
node test-wallet-transfer.js
```

### Test Cases Covered
1. ✅ Get initial wallet balances
2. ✅ Transfer from Crypto to Data & Bills (valid)
3. ✅ Transfer from Gift Card to Data & Bills (valid)
4. ✅ Transfer from Data & Bills to Crypto (invalid - should fail)
5. ✅ Get transaction history
6. ✅ Verify final balances

## API Examples

### Transfer Funds
```bash
curl -X POST http://localhost:1337/api/wallet-transfers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWallet": "cryptoWalletBalance",
    "toWallet": "AccountBalance",
    "amount": 500
  }'
```

### Get Transaction History
```bash
curl -X GET "http://localhost:1337/api/wallet-transactions?pagination[page]=1&pagination[pageSize]=10&sort[0]=createdAt:desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Filter by Wallet
```bash
curl -X GET "http://localhost:1337/api/wallet-transactions?filters[\$or][0][fromWallet][\$eq]=cryptoWalletBalance" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Schema

### wallet_transactions Table
```sql
CREATE TABLE wallet_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type ENUM('transfer', 'credit', 'debit') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  from_wallet ENUM('AccountBalance', 'cryptoWalletBalance', 'giftCardBalance'),
  to_wallet ENUM('AccountBalance', 'cryptoWalletBalance', 'giftCardBalance'),
  status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'completed',
  description VARCHAR(255) NOT NULL,
  reference VARCHAR(255) UNIQUE,
  user_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES up_users(id)
);
```

## Error Handling

### Common Errors

**400 Bad Request:**
- Missing required fields
- Invalid transfer direction
- Amount below minimum (₦100)
- Insufficient balance

**401 Unauthorized:**
- Missing or invalid JWT token

**500 Internal Server Error:**
- Database connection issues
- Unexpected errors during transfer

### Error Response Format
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Insufficient balance"
  }
}
```

## Security Considerations

1. **Authentication Required:**
   - All endpoints require valid JWT token
   - User can only access their own transactions

2. **Atomic Operations:**
   - Balance updates use database transactions
   - Prevents race conditions

3. **Validation:**
   - Server-side validation of all inputs
   - Business rules enforced at API level

4. **Audit Trail:**
   - All transfers logged with unique reference
   - Timestamps tracked automatically

## Integration with Frontend

The Flutter app is already configured to use these endpoints:

1. **Service:** `lib/features/wallet/services/wallet_service.dart`
   - `transferBetweenWallets()` → POST /api/wallet-transfers
   - `getTransactionHistory()` → GET /api/wallet-transactions

2. **State Management:** `lib/features/wallet/providers/wallet_providers.dart`
   - Handles API calls and state updates

3. **UI:** `lib/features/wallet/screens/wallet_screen.dart`
   - Displays balances and transaction history

## Next Steps

1. ✅ Restart Strapi to register new content type
2. ✅ Test endpoints with provided test script
3. ✅ Verify database schema created correctly
4. ✅ Test from Flutter app
5. 🔄 Monitor transaction logs
6. 🔄 Add transaction receipts (optional)
7. 🔄 Implement webhooks for notifications (optional)

## Monitoring

Watch for these log messages:
- `✅ [WALLET_TRANSFER] User X transferred ₦Y from A to B` - Successful transfer
- `❌ [WALLET_TRANSFER] Error:` - Transfer failures
- `❌ [WALLET_TRANSACTIONS] Error:` - Query failures

## Support

For issues or questions:
1. Check Strapi server logs
2. Verify database schema is created
3. Test with curl/Postman before app integration
4. Review validation errors in response
