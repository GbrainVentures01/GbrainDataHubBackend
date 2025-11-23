const axios = require("axios");
const BaseCryptoProvider = require("./base-provider");

class QuidaxProvider extends BaseCryptoProvider {
  constructor() {
    super();
    this.baseURL =
      process.env.QUIDAX_BASE_URL || "https://app.quidax.io/api/v1";
    this.apiKey = process.env.QUIDAX_API_KEY;
    this.apiSecret = process.env.QUIDAX_SECRET_KEY;

    // Create axios instance
    this.axiosClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for authentication
    this.axiosClient.interceptors.request.use((config) =>
      this.onRequest(config)
    );
  }

  onRequest(requestConfig) {
    // Quidax uses Bearer token authentication
    if (this.apiKey) {
      requestConfig.headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    return requestConfig;
  }

  async makeRequest(endpoint, method = "GET", data = null, params = null) {
    try {
      const config = {
        method,
        url: endpoint,
        data,
        params,
      };

      const response = await this.axiosClient(config);
      return response.data;
    } catch (error) {
      console.error(
        `${this.getProviderName()} API Error:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async getSupportedTokens() {
    // Quidax endpoint for supported currencies
    // This may need adjustment based on actual Quidax API documentation
    const markets = await this.makeRequest("markets");
    
    // Transform Quidax response to match expected format
    // You'll need to adjust this based on actual Quidax response structure
    return {
      data: this.transformMarketsToTokens(markets),
    };
  }

  transformMarketsToTokens(markets) {
    // Transform Quidax markets data to match the expected token format
    // This is a placeholder - adjust based on actual Quidax API response
    const tokens = {};
    
    if (markets?.data) {
      markets.data.forEach((market) => {
        const currency = market.base_unit?.toUpperCase();
        if (currency && !tokens[currency]) {
          tokens[currency] = {
            currencyName: market.name || currency,
            currencyCode: currency,
            networks: [], // Quidax may have different network structure
          };
        }
      });
    }
    
    return tokens;
  }

  async getTradableSwapCurrencies() {
    // Get all available markets/trading pairs
    return await this.makeRequest("markets");
  }

  async getTokenRates() {
    // Get current market tickers/rates
    return await this.makeRequest("markets/tickers");
  }

  async createOfframpTransaction(data) {
    // Quidax withdrawal endpoint
    // Adjust based on actual API documentation
    return await this.makeRequest("withdrawals", "POST", {
      currency: data.currency,
      amount: data.amount,
      address: data.address,
      // Add other required fields based on Quidax API
    });
  }

  async getTransactionStatus(transactionId) {
    // Get withdrawal/deposit status
    // Adjust endpoint based on transaction type
    return await this.makeRequest(`withdrawals/${transactionId}`);
  }

  async getWalletAddress(currency, network) {
    // Get deposit address for a currency
    return await this.makeRequest("deposit_address", "GET", null, {
      currency: currency.toLowerCase(),
    });
  }

  async validateWalletAddress(address, currency, network) {
    // Quidax may not have address validation endpoint
    // Implement client-side validation or return success
    return {
      data: {
        isValid: true,
        address,
        currency,
        network,
      },
    };
  }

  async generateDepositAddress(uniqueUserIdentifier, currency, network) {
    // For Quidax, we need to ensure sub-account exists first
    // This method is called from the controller which will handle the user flow
    // Here we just generate the address for an existing user_id
    
    // Extract user_id if it was stored (format: quidax_user_id)
    // Otherwise, this should be called after createSubAccount
    const userId = uniqueUserIdentifier.replace('quidax_', '');
    
    const response = await this.makeRequest(
      `users/${userId}/wallets/${currency.toLowerCase()}/address`,
      "POST"
    );

    // Transform response to match expected format
    return {
      data: {
        address: response.data?.address,
        currency,
        network: response.data?.network || network,
        uniqueUserIdentifier,
        destination_tag: response.data?.destination_tag,
      },
    };
  }

  /**
   * Create a sub-account for a user on Quidax
   * @param {Object} userData - User data (email, first_name, last_name)
   * @returns {Promise<Object>} - Created sub-account details
   */
  async createSubAccount(userData) {
    const { email, first_name, last_name } = userData;

    if (!email || !first_name || !last_name) {
      throw new Error(
        "Email, first_name, and last_name are required to create Quidax sub-account"
      );
    }

    try {
      const response = await this.makeRequest("users", "POST", {
        email,
        first_name,
        last_name,
      });

      console.log(
        `✅ Quidax sub-account created for ${email}: ${response.data?.id}`
      );

      return {
        success: true,
        data: {
          quidax_user_id: response.data?.id,
          quidax_sn: response.data?.sn,
          email: response.data?.email,
          first_name: response.data?.first_name,
          last_name: response.data?.last_name,
          created_at: response.data?.created_at,
          updated_at: response.data?.updated_at,
        },
      };
    } catch (error) {
      console.error(
        `❌ Failed to create Quidax sub-account for ${email}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Get or create deposit address for a Quidax sub-account
   * @param {string} userId - Quidax user ID
   * @param {string} currency - Currency code (e.g., btc, usdt)
   * @returns {Promise<Object>} - Wallet address details
   */
  async getOrCreateWalletAddress(userId, currency) {
    try {
      const response = await this.makeRequest(
        `users/${userId}/wallets/${currency.toLowerCase()}/address`,
        "POST"
      );

      return {
        success: true,
        data: {
          address: response.data?.address,
          currency: response.data?.currency,
          network: response.data?.network,
          destination_tag: response.data?.destination_tag,
          created_at: response.data?.created_at,
        },
      };
    } catch (error) {
      console.error(
        `❌ Failed to generate wallet address for user ${userId}, currency ${currency}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  getProviderName() {
    return "Quidax";
  }
}

module.exports = QuidaxProvider;
