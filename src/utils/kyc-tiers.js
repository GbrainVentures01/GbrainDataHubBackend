/**
 * KYC Tier System Utilities
 * Defines tier levels, requirements, and limits
 */

// Tier Definitions
const KYC_TIERS = {
  TIER_1: 1,
  TIER_2: 2,
  TIER_3: 3,
};

// Tier Names for Display
const TIER_NAMES = {
  1: 'Basic',
  2: 'Intermediate',
  3: 'Advanced',
};

// Tier Requirements
const TIER_REQUIREMENTS = {
  [KYC_TIERS.TIER_1]: {
    name: 'Basic',
    description: 'Email verified',
    requirements: ['emailVerified'],
    features: ['transfers', 'airtime', 'electricity', 'data'],
  },
  [KYC_TIERS.TIER_2]: {
    name: 'Intermediate',
    description: 'ID document and selfie verification',
    requirements: ['emailVerified', 'idDocumentVerified', 'selfieVerified'],
    features: ['transfers', 'airtime', 'electricity', 'data', 'cryptoPurchase'],
  },
  [KYC_TIERS.TIER_3]: {
    name: 'Advanced',
    description: 'Full KYC verification',
    requirements: ['emailVerified', 'idDocumentVerified', 'selfieVerified', 'addressProof', 'bvnVerified'],
    features: ['transfers', 'airtime', 'electricity', 'data', 'cryptoPurchase', 'unlimitedAccess'],
  },
};

// Tier Limits (Daily limits in NGN)
const TIER_LIMITS = {
  [KYC_TIERS.TIER_1]: {
    dailyWithdrawalLimitNGN: 3000000, // 3M NGN
    dailyTransactionLimitNGN: 10000000, // 10M NGN
    restrictedFeatures: ['cryptoPurchase'], // Features not available for this tier
  },
  [KYC_TIERS.TIER_2]: {
    dailyWithdrawalLimitNGN: 25000000, // 25M NGN
    dailyTransactionLimitNGN: 50000000, // 50M NGN
    restrictedFeatures: [],
  },
  [KYC_TIERS.TIER_3]: {
    dailyWithdrawalLimitNGN: null, // Unlimited
    dailyTransactionLimitNGN: null, // Unlimited
    restrictedFeatures: [],
  },
};

/**
 * Check if a user meets the requirements for a specific tier
 * @param {object} user - User object from database
 * @param {number} tier - Tier number to check
 * @returns {boolean} - Whether user meets requirements
 */
function checkTierRequirements(user, tier) {
  const requirements = TIER_REQUIREMENTS[tier];
  if (!requirements) return false;

  return requirements.requirements.every(req => {
    switch (req) {
      case 'emailVerified':
        return user.confirmed === true;
      case 'phoneVerified':
        return user.phoneVerified === true;
      case 'idDocumentVerified':
        // TODO: Implement when Tier 2 is added
        return user.idDocumentVerified === true;
      case 'selfieVerified':
        // TODO: Implement when Tier 2 is added
        return user.selfieVerified === true;
      case 'addressProof':
        // TODO: Implement when Tier 3 is added
        return user.addressProof === true;
      case 'bvnVerified':
        // TODO: Implement when Tier 3 is added
        return user.bvnVerified === true;
      default:
        return false;
    }
  });
}

/**
 * Get tier limits for a specific tier
 * @param {number} tier - Tier number
 * @returns {object} - Tier limits
 */
function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS[KYC_TIERS.TIER_1];
}

/**
 * Get the next tier available for a user
 * @param {number} currentTier - Current tier
 * @returns {number|null} - Next tier or null if at max tier
 */
function getNextTier(currentTier) {
  if (currentTier === KYC_TIERS.TIER_3) return null;
  return currentTier + 1;
}

/**
 * Check if a feature is restricted for a tier
 * @param {number} tier - Tier number
 * @param {string} feature - Feature name
 * @returns {boolean} - Whether feature is restricted
 */
function isFeatureRestricted(tier, feature) {
  const limits = getTierLimits(tier);
  return limits.restrictedFeatures.includes(feature);
}

/**
 * Get available features for a tier
 * @param {number} tier - Tier number
 * @returns {array} - Array of available features
 */
function getAvailableFeatures(tier) {
  return TIER_REQUIREMENTS[tier]?.features || [];
}

/**
 * Assign Tier 1 to new user on registration
 * Called when email is verified during registration
 * @returns {object} - KYC fields to set on user
 */
function assignTier1OnRegistration() {
  return {
    kycTier: KYC_TIERS.TIER_1,
    kycVerified: true,
    kycVerifiedAt: new Date().toISOString(),
  };
}

module.exports = {
  KYC_TIERS,
  TIER_NAMES,
  TIER_REQUIREMENTS,
  TIER_LIMITS,
  checkTierRequirements,
  getTierLimits,
  getNextTier,
  isFeatureRestricted,
  getAvailableFeatures,
  assignTier1OnRegistration,
};
