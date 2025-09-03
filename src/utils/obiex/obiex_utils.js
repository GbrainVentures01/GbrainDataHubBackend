const axios = require("axios");
const crypto = require("crypto");
const queryString = require("querystring");

class ObiexAPI {
  constructor() {
    this.baseURL =
      process.env.OBIEX_BASE_URL || "https://staging.api.obiex.finance";
    this.apiKey = process.env.OBIEX_API_KEY; // Public Key
    this.apiSecret = process.env.OBIEX_SECRET_KEY; // Secret Key

    // Create axios instance with interceptors
    this.axiosClient = axios.create({
      baseURL: this.baseURL,
    });

    // Add request interceptor for authentication
    this.axiosClient.interceptors.request.use((config) =>
      this.onRequest(config)
    );
  }

  onRequest(requestConfig) {
    const url = requestConfig.url;

    // Handle query parameters
    if (requestConfig.params) {
      requestConfig.url =
        url + "?" + queryString.stringify(requestConfig.params);
      requestConfig.params = null;
    }

    // Generate signature
    const { timestamp, signature } = this.sign(
      requestConfig.method,
      requestConfig.url
    );

    // Set required headers
    requestConfig.headers["X-API-TIMESTAMP"] = timestamp;
    requestConfig.headers["X-API-SIGNATURE"] = signature;
    requestConfig.headers["X-API-KEY"] = this.apiKey;
    requestConfig.headers["Content-Type"] = "application/json";

    // Debug logging
    console.log("🔧 Request Debug Info:");
    console.log("URL:", `${this.baseURL}${requestConfig.url}`);
    console.log("Method:", requestConfig.method);
    console.log("Headers:", requestConfig.headers);

    return requestConfig;
  }

  sign(method, url) {
    const timestamp = Date.now();
    // For signature, we need the full path with /v1
    const fullPath = `/v1/${url}`;
    const content = `${method.toUpperCase()}${fullPath}${timestamp}`;

    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(content)
      .digest("hex");

    console.log("🔧 Signature Debug Info:");
    console.log("Content:", content);
    console.log("Signature:", signature);

    return {
      timestamp,
      signature,
    };
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
      console.error("OBIEX API Error:", error.response?.data || error.message);
      throw error;
    }
  }

  async getSupportedTokens() {
    return await this.makeRequest("currencies/networks/active");
  }
  async getTradableSwapCurrencies() {
    return await this.makeRequest("currencies");
  }

  async getTokenRates() {
    return await this.makeRequest("rates");
  }

  async createOfframpTransaction(data) {
    return await this.makeRequest("offramp", "POST", data);
  }

  async getTransactionStatus(transactionId) {
    return await this.makeRequest(`transactions/${transactionId}`);
  }

  async getWalletAddress(currency, network) {
    return await this.makeRequest("wallet/address", "GET", null, {
      currency,
      network,
    });
  }

  async validateWalletAddress(address, currency, network) {
    return await this.makeRequest("wallet/validate", "POST", {
      address,
      currency,
      network,
    });
  }
}

module.exports = new ObiexAPI();
