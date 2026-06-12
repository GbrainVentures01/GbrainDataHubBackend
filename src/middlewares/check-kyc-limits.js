/**
 * KYC Tier Limit Middleware
 * Checks and enforces tier-based transaction limits
 */

const { KYC_TIERS, TIER_LIMITS } = require('../utils/kyc-tiers');

/**
 * Middleware to check withdrawal limit
 * Tracks daily withdrawals and prevents exceeding tier limit
 */
const checkWithdrawalLimit = (strapi) => {
  return async (ctx, next) => {
    try {
      const userId = ctx.state.user?.id;
      const { amount } = ctx.request.body;

      // Skip if user not authenticated or no amount specified
      if (!userId || !amount) {
        return next();
      }

      // Get user with their tier information
      const user = await strapi
        .query('plugin::users-permissions.user')
        .findOne({
          where: { id: userId },
          select: ['id', 'kycTier', 'email'],
        });

      if (!user) {
        return ctx.unauthorized('User not found');
      }

      const tierLimits = TIER_LIMITS[user.kycTier] || TIER_LIMITS[KYC_TIERS.TIER_1];
      const dailyLimit = tierLimits.dailyWithdrawalLimitNGN;

      // If tier is unlimited, skip limit check
      if (dailyLimit === null) {
        ctx.state.kycTier = user.kycTier;
        ctx.state.dailyLimit = null;
        return next();
      }

      // Calculate today's date for tracking withdrawals
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Check wallet transactions for today's withdrawals
      const todayWithdrawals = await strapi
        .query('api::wallet-transaction.wallet-transaction')
        .findMany({
          where: {
            user: { id: userId },
            type: 'withdrawal',
            createdAt: {
              $gte: todayStart.toISOString(),
            },
            status: { $in: ['completed', 'pending'] },
          },
          select: ['amount'],
        });

      // Calculate total withdrawn today
      const totalWithdrawnToday = todayWithdrawals.reduce(
        (sum, tx) => sum + (tx.amount || 0),
        0
      );

      const amountAfterWithdrawal = totalWithdrawnToday + amount;

      // Check if withdrawal would exceed limit
      if (amountAfterWithdrawal > dailyLimit) {
        const remaining = Math.max(0, dailyLimit - totalWithdrawnToday);
        return ctx.forbidden('Daily withdrawal limit exceeded', {
          errorCode: 'WITHDRAWAL_LIMIT_EXCEEDED',
          tier: user.kycTier,
          dailyLimit,
          alreadyWithdrawn: totalWithdrawnToday,
          remaining,
          attempted: amount,
        });
      }

      // Attach KYC info to context for use in controller
      ctx.state.kycTier = user.kycTier;
      ctx.state.dailyLimit = dailyLimit;
      ctx.state.totalWithdrawnToday = totalWithdrawnToday;

      return next();
    } catch (error) {
      strapi.log.error('KYC withdrawal limit check error:', error);
      return ctx.internalServerError('Error checking withdrawal limits');
    }
  };
};

/**
 * Middleware to check feature restrictions
 * Prevents restricted features based on tier
 */
const checkFeatureAccess = (restrictedFeature) => {
  return (strapi) => {
    return async (ctx, next) => {
      try {
        const userId = ctx.state.user?.id;

        if (!userId) {
          return ctx.unauthorized('Authentication required');
        }

        // Get user tier
        const user = await strapi
          .query('plugin::users-permissions.user')
          .findOne({
            where: { id: userId },
            select: ['id', 'kycTier'],
          });

        if (!user) {
          return ctx.unauthorized('User not found');
        }

        const tierLimits = TIER_LIMITS[user.kycTier] || TIER_LIMITS[KYC_TIERS.TIER_1];

        // Check if feature is restricted for this tier
        if (tierLimits.restrictedFeatures?.includes(restrictedFeature)) {
          return ctx.forbidden('This feature is not available for your KYC tier', {
            errorCode: 'FEATURE_RESTRICTED',
            feature: restrictedFeature,
            tier: user.kycTier,
            requiredTier: restrictedFeature === 'cryptoPurchase' ? KYC_TIERS.TIER_2 : KYC_TIERS.TIER_3,
          });
        }

        // Attach tier to context
        ctx.state.kycTier = user.kycTier;
        return next();
      } catch (error) {
        strapi.log.error('KYC feature access check error:', error);
        return ctx.internalServerError('Error checking feature access');
      }
    };
  };
};

/**
 * Get user KYC tier
 * Helper function to retrieve user's current KYC tier
 */
const getUserKycTier = async (strapi, userId) => {
  try {
    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({
        where: { id: userId },
        select: ['id', 'kycTier'],
      });

    return user?.kycTier || KYC_TIERS.TIER_1;
  } catch (error) {
    strapi.log.error('Error getting user KYC tier:', error);
    return KYC_TIERS.TIER_1;
  }
};

/**
 * Check if feature is available for tier
 * Helper function
 */
const isFeatureAvailableForTier = (tier, feature) => {
  const tierLimits = TIER_LIMITS[tier] || TIER_LIMITS[KYC_TIERS.TIER_1];
  return !tierLimits.restrictedFeatures?.includes(feature);
};

module.exports = {
  checkWithdrawalLimit,
  checkFeatureAccess,
  getUserKycTier,
  isFeatureAvailableForTier,
};
