const ObiexProvider = require("./providers/obiex-provider");
const QuidaxProvider = require("./providers/quidax-provider");

/**
 * Crypto Provider Factory
 * Manages and switches between different crypto providers
 */
class CryptoProviderFactory {
  constructor() {
    this.providers = {
      obiex: null,
      quidax: null,
    };

    this.activeProvider = null;
    this.defaultProvider = process.env.CRYPTO_PROVIDER || "obiex";
  }

  /**
   * Get or create a provider instance
   * @param {string} providerName - Name of the provider (obiex, quidax)
   * @returns {BaseCryptoProvider} - Provider instance
   */
  getProvider(providerName = null) {
    const provider = (providerName || this.defaultProvider).toLowerCase();

    // Return cached instance if exists
    if (this.providers[provider]) {
      return this.providers[provider];
    }

    // Create new provider instance
    switch (provider) {
      case "obiex":
        this.providers.obiex = new ObiexProvider();
        return this.providers.obiex;

      case "quidax":
        this.providers.quidax = new QuidaxProvider();
        return this.providers.quidax;

      default:
        throw new Error(
          `Unknown crypto provider: ${provider}. Available providers: obiex, quidax`
        );
    }
  }

  /**
   * Set the active provider
   * @param {string} providerName - Name of the provider to set as active
   */
  setActiveProvider(providerName) {
    const provider = this.getProvider(providerName);
    this.activeProvider = provider;
    console.log(`✅ Active crypto provider set to: ${provider.getProviderName()}`);
    return provider;
  }

  /**
   * Get the current active provider
   * @returns {BaseCryptoProvider} - Active provider instance
   */
  getActiveProvider() {
    if (!this.activeProvider) {
      this.activeProvider = this.getProvider(this.defaultProvider);
      console.log(
        `ℹ️ Using default crypto provider: ${this.activeProvider.getProviderName()}`
      );
    }
    return this.activeProvider;
  }

  /**
   * Get all available providers
   * @returns {Array<string>} - List of available provider names
   */
  getAvailableProviders() {
    return ["obiex", "quidax"];
  }

  /**
   * Execute a method on the active provider with fallback
   * @param {string} methodName - Name of the method to execute
   * @param  {...any} args - Arguments to pass to the method
   * @returns {Promise<any>} - Method result
   */
  async executeWithFallback(methodName, ...args) {
    const primaryProvider = this.getActiveProvider();

    try {
      console.log(
        `🔄 Executing ${methodName} on ${primaryProvider.getProviderName()}`
      );
      return await primaryProvider[methodName](...args);
    } catch (error) {
      console.error(
        `❌ ${primaryProvider.getProviderName()} failed for ${methodName}:`,
        error.message
      );

      // Try fallback provider if available
      const fallbackProviderName = this.getFallbackProvider();
      if (fallbackProviderName) {
        try {
          const fallbackProvider = this.getProvider(fallbackProviderName);
          console.log(
            `🔄 Trying fallback provider: ${fallbackProvider.getProviderName()}`
          );
          return await fallbackProvider[methodName](...args);
        } catch (fallbackError) {
          console.error(
            `❌ Fallback provider ${fallbackProviderName} also failed:`,
            fallbackError.message
          );
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Get fallback provider name
   * @returns {string|null} - Fallback provider name or null
   */
  getFallbackProvider() {
    const current = this.activeProvider?.getProviderName()?.toLowerCase();
    const available = this.getAvailableProviders();

    // Return the first available provider that's not the current one
    return available.find((p) => p !== current) || null;
  }
}

// Export singleton instance
module.exports = new CryptoProviderFactory();
