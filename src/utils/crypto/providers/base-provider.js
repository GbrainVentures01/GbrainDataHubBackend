/**
 * Base class for crypto providers
 * All crypto providers must implement these methods
 */
class BaseCryptoProvider {
  constructor() {
    if (new.target === BaseCryptoProvider) {
      throw new Error("Cannot instantiate abstract class BaseCryptoProvider");
    }
  }

  /**
   * Get list of supported tokens and networks
   * @returns {Promise<Object>} - Supported tokens with their networks
   */
  async getSupportedTokens() {
    throw new Error("Method 'getSupportedTokens()' must be implemented");
  }

  /**
   * Get list of tradable/swap currencies
   * @returns {Promise<Object>} - List of tradable currencies
   */
  async getTradableSwapCurrencies() {
    throw new Error(
      "Method 'getTradableSwapCurrencies()' must be implemented"
    );
  }

  /**
   * Get current token rates
   * @returns {Promise<Object>} - Current rates for tokens
   */
  async getTokenRates() {
    throw new Error("Method 'getTokenRates()' must be implemented");
  }

  /**
   * Create an offramp transaction (crypto to fiat)
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} - Transaction details
   */
  async createOfframpTransaction(data) {
    throw new Error("Method 'createOfframpTransaction()' must be implemented");
  }

  /**
   * Get transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} - Transaction status
   */
  async getTransactionStatus(transactionId) {
    throw new Error("Method 'getTransactionStatus()' must be implemented");
  }

  /**
   * Get wallet address for a currency and network
   * @param {string} currency - Currency code
   * @param {string} network - Network name
   * @returns {Promise<Object>} - Wallet address details
   */
  async getWalletAddress(currency, network) {
    throw new Error("Method 'getWalletAddress()' must be implemented");
  }

  /**
   * Validate a wallet address
   * @param {string} address - Wallet address to validate
   * @param {string} currency - Currency code
   * @param {string} network - Network name
   * @returns {Promise<Object>} - Validation result
   */
  async validateWalletAddress(address, currency, network) {
    throw new Error("Method 'validateWalletAddress()' must be implemented");
  }

  /**
   * Setup user account on the provider platform
   * This method handles provider-specific account setup (e.g., sub-accounts for Quidax)
   * @param {Object} userData - User data from Strapi
   * @param {number} userData.id - User ID
   * @param {string} userData.email - User email
   * @param {string} userData.username - Username
   * @param {string} [userData.quidax_user_id] - Existing Quidax user ID (if any)
   * @param {string} [userData.quidax_sn] - Existing Quidax SN (if any)
   * @returns {Promise<Object>} - Account setup result with user identifier and metadata
   */
  async setupUserAccount(userData) {
    throw new Error("Method 'setupUserAccount()' must be implemented");
  }

  /**
   * Generate deposit address for a user
   * @param {string} uniqueUserIdentifier - Unique user identifier (from setupUserAccount)
   * @param {string} currency - Currency code
   * @param {string} network - Network name
   * @returns {Promise<Object>} - Deposit address details
   */
  async generateDepositAddress(uniqueUserIdentifier, currency, network) {
    throw new Error("Method 'generateDepositAddress()' must be implemented");
  }

  /**
   * Get provider name
   * @returns {string} - Provider name
   */
  getProviderName() {
    throw new Error("Method 'getProviderName()' must be implemented");
  }
}

module.exports = BaseCryptoProvider;
