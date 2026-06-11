/**
 * PIN Consolidation Migration Helper
 * 
 * This module provides utilities for migrating PIN data from the legacy 'pin' field
 * to the consolidated 'transactionPin' field used by both web and mobile apps.
 * 
 * Can be used as:
 * - Direct function call during bootstrap
 * - API endpoint for admin migration
 * - Manual script execution
 */

/**
 * Migrate a single user's PIN from legacy 'pin' field to 'transactionPin'
 * @param {Object} strapi - Strapi instance
 * @param {number} userId - User ID to migrate
 * @returns {Promise<Object>} Migration result
 */
async function migrateUserPin(strapi, userId) {
  try {
    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: userId } });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // If already migrated, return success
    if (user.transactionPin && user.hasTransactionPin) {
      return {
        success: true,
        alreadyMigrated: true,
        message: 'User already has consolidated PIN setup',
        userId,
      };
    }

    // If no PIN to migrate, return info
    if (!user.pin) {
      return {
        success: true,
        nothingToMigrate: true,
        message: 'User has no PIN to migrate',
        userId,
      };
    }

    // Perform migration
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: userId },
      data: {
        transactionPin: user.pin,
        hasTransactionPin: true,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      migrated: true,
      message: 'User PIN successfully migrated',
      userId,
      email: user.email,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      userId,
    };
  }
}

/**
 * Migrate all users' PINs in batches
 * @param {Object} strapi - Strapi instance
 * @param {number} batchSize - Number of users to process per batch
 * @returns {Promise<Object>} Complete migration report
 */
async function migrateAllUserPins(strapi, batchSize = 100) {
  const startTime = new Date();
  const results = {
    startTime,
    endTime: null,
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    alreadyMigratedCount: 0,
    nothingToMigrateCount: 0,
    failures: [],
  };

  try {
    console.log('[PIN Migration] Starting batch migration of all users...');

    // Get total count of users needing migration
    const usersNeedingMigration = await strapi.db.connection('up_users')
      .where({ pin: { $notNull: true } })
      .andWhere((query) => {
        query.where('transactionPin', 'IS', null)
          .orWhere('hasTransactionPin', false);
      })
      .count('* as count')
      .first();

    const totalToMigrate = usersNeedingMigration?.count || 0;
    console.log(`[PIN Migration] Found ${totalToMigrate} users needing migration`);

    if (totalToMigrate === 0) {
      results.endTime = new Date();
      results.message = 'No users need PIN migration';
      return results;
    }

    // Process in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: {
          pin: { $notNull: true },
        },
        limit: batchSize,
        offset,
      });

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[PIN Migration] Processing batch ${Math.floor(offset / batchSize) + 1}: ${batch.length} users`);

      for (const user of batch) {
        const result = await migrateUserPin(strapi, user.id);
        results.totalProcessed++;

        if (result.success) {
          if (result.alreadyMigrated) {
            results.alreadyMigratedCount++;
          } else if (result.nothingToMigrate) {
            results.nothingToMigrateCount++;
          } else if (result.migrated) {
            results.successCount++;
            console.log(`  ✅ Migrated ${user.email}`);
          }
        } else {
          results.failureCount++;
          results.failures.push({
            userId: user.id,
            email: user.email,
            error: result.error,
          });
          console.error(`  ❌ Failed to migrate ${user.email}: ${result.error}`);
        }
      }

      offset += batchSize;
    }

    results.endTime = new Date();
    results.durationSeconds = (results.endTime - startTime) / 1000;

    return results;
  } catch (error) {
    results.endTime = new Date();
    results.error = error.message;
    return results;
  }
}

/**
 * Get current migration status
 * @param {Object} strapi - Strapi instance
 * @returns {Promise<Object>} Status report
 */
async function getMigrationStatus(strapi) {
  try {
    const totalUsers = await strapi.db.connection('up_users').count('* as count').first();
    const withTransactionPin = await strapi.db.connection('up_users')
      .where('hasTransactionPin', true)
      .count('* as count')
      .first();
    const needsMigration = await strapi.db.connection('up_users')
      .where('pin', '!=', null)
      .andWhere((query) => {
        query.where('transactionPin', null)
          .orWhere('hasTransactionPin', false);
      })
      .count('* as count')
      .first();

    const migrationPercentage = totalUsers.count > 0 
      ? Math.round((withTransactionPin.count / totalUsers.count) * 100)
      : 0;

    return {
      totalUsers: totalUsers.count,
      usersWithTransactionPin: withTransactionPin.count,
      usersNeedingMigration: needsMigration.count,
      migrationPercentage,
      migrationComplete: needsMigration.count === 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = {
  migrateUserPin,
  migrateAllUserPins,
  getMigrationStatus,
};
