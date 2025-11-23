/**
 * @deprecated This file is kept for backward compatibility.
 * Please use the new crypto provider factory instead:
 * const cryptoProviderFactory = require('../crypto/crypto-provider-factory');
 * const provider = cryptoProviderFactory.getProvider('obiex');
 */

const ObiexProvider = require("../crypto/providers/obiex-provider");

// Export singleton instance for backward compatibility
module.exports = new ObiexProvider();
