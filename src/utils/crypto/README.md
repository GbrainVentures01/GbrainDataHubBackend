# Crypto Provider System

## Overview

The crypto provider system allows easy switching between different cryptocurrency service providers (Obiex, Quidax, etc.) without changing application code.

## Architecture

```
src/utils/crypto/
├── crypto-provider-factory.js  # Main factory for managing providers
├── providers/
│   ├── base-provider.js        # Abstract base class
│   ├── obiex-provider.js       # Obiex implementation
│   └── quidax-provider.js      # Quidax implementation
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Active Crypto Provider (obiex or quidax)
CRYPTO_PROVIDER=obiex

# Obiex Configuration
OBIEX_BASE_URL=https://staging.api.obiex.finance
OBIEX_API_KEY=your_obiex_api_key
OBIEX_SECRET_KEY=your_obiex_secret_key

# Quidax Configuration
QUIDAX_BASE_URL=https://app.quidax.io/api/v1
QUIDAX_API_KEY=your_quidax_api_key
QUIDAX_SECRET_KEY=your_quidax_secret_key
```

## Usage

### Basic Usage

```javascript
const cryptoProviderFactory = require('./utils/crypto/crypto-provider-factory');

// Get the active provider (based on CRYPTO_PROVIDER env variable)
const provider = cryptoProviderFactory.getActiveProvider();

// Use provider methods
const tokens = await provider.getSupportedTokens();
const depositAddress = await provider.generateDepositAddress(userId, 'BTC', 'Bitcoin');
```

### Switching Providers

```javascript
// Switch to Quidax
cryptoProviderFactory.setActiveProvider('quidax');

// Switch to Obiex
cryptoProviderFactory.setActiveProvider('obiex');
```

### Get Specific Provider

```javascript
// Get Obiex provider directly
const obiexProvider = cryptoProviderFactory.getProvider('obiex');

// Get Quidax provider directly
const quidaxProvider = cryptoProviderFactory.getProvider('quidax');
```

### Execute with Automatic Fallback

```javascript
// Automatically tries fallback provider if primary fails
const result = await cryptoProviderFactory.executeWithFallback(
  'generateDepositAddress',
  userId,
  'BTC',
  'Bitcoin'
);
```

## Provider Methods

All providers implement these methods:

- `getSupportedTokens()` - Get list of supported cryptocurrencies and networks
- `getTradableSwapCurrencies()` - Get list of tradable currency pairs
- `getTokenRates()` - Get current exchange rates
- `createOfframpTransaction(data)` - Create withdrawal transaction
- `getTransactionStatus(transactionId)` - Check transaction status
- `getWalletAddress(currency, network)` - Get wallet address
- `validateWalletAddress(address, currency, network)` - Validate an address
- `generateDepositAddress(userId, currency, network)` - Generate deposit address
- `getProviderName()` - Get provider name

## Adding a New Provider

1. Create a new file in `src/utils/crypto/providers/`:

```javascript
const BaseCryptoProvider = require('./base-provider');

class NewProvider extends BaseCryptoProvider {
  constructor() {
    super();
    // Initialize your provider
  }

  async getSupportedTokens() {
    // Implement method
  }

  // Implement all required methods...

  getProviderName() {
    return 'NewProvider';
  }
}

module.exports = NewProvider;
```

2. Register in `crypto-provider-factory.js`:

```javascript
const NewProvider = require('./providers/new-provider');

// In getProvider method, add:
case 'newprovider':
  this.providers.newprovider = new NewProvider();
  return this.providers.newprovider;
```

3. Update `.env`:

```bash
CRYPTO_PROVIDER=newprovider
NEWPROVIDER_API_KEY=your_api_key
```

## Migration from Old System

### Before (Direct Obiex Usage)
```javascript
const obiexAPI = require('./utils/obiex/obiex_utils');
const result = await obiexAPI.generateDepositAddress(userId, currency, network);
```

### After (Provider Factory)
```javascript
const cryptoProviderFactory = require('./utils/crypto/crypto-provider-factory');
const provider = cryptoProviderFactory.getActiveProvider();
const result = await provider.generateDepositAddress(userId, currency, network);
```

**Note:** The old `obiex_utils.js` is kept for backward compatibility but is deprecated.

## Testing

### Test Obiex Provider
```bash
node test-obiex.js
```

### Test Provider Switching
```javascript
const factory = require('./src/utils/crypto/crypto-provider-factory');

// Test Obiex
factory.setActiveProvider('obiex');
const obiexTokens = await factory.getActiveProvider().getSupportedTokens();
console.log('Obiex tokens:', obiexTokens);

// Test Quidax
factory.setActiveProvider('quidax');
const quidaxTokens = await factory.getActiveProvider().getSupportedTokens();
console.log('Quidax tokens:', quidaxTokens);
```

## Error Handling

Providers throw errors that should be caught and handled:

```javascript
try {
  const provider = cryptoProviderFactory.getActiveProvider();
  const result = await provider.generateDepositAddress(userId, currency, network);
} catch (error) {
  console.error('Provider error:', error.message);
  // Handle error
}
```

## Best Practices

1. **Use Environment Variables**: Always configure provider via `CRYPTO_PROVIDER` env variable
2. **Fallback Strategy**: Use `executeWithFallback()` for critical operations
3. **Error Logging**: All providers log errors with provider name prefix
4. **Singleton Pattern**: Factory maintains single instances of each provider
5. **Abstract Interface**: All providers implement the same methods from `BaseCryptoProvider`

## Provider-Specific Notes

### Obiex
- Uses HMAC-SHA256 signature authentication
- Requires timestamp in requests
- Base URL: `https://staging.api.obiex.finance` (staging) or production URL

### Quidax
- Uses Bearer token authentication
- Base URL: `https://app.quidax.io/api/v1`
- Some endpoints may differ from Obiex - check Quidax API docs

## Troubleshooting

### Provider Not Found
```
Error: Unknown crypto provider: xyz
```
**Solution**: Check `CRYPTO_PROVIDER` value in `.env`, must be 'obiex' or 'quidax'

### Authentication Errors
**Solution**: Verify API keys in `.env` file are correct for the active provider

### Method Not Implemented
**Solution**: Ensure all required methods from `BaseCryptoProvider` are implemented in your provider class
