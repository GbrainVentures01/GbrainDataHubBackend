/**
 * PIN Consolidation Migration Script
 * 
 * This script migrates existing web app users' PIN data from 'pin' field
 * to the consolidated 'transactionPin' field for both web and mobile apps.
 * 
 * Usage: node migrate-pin-consolidation.js
 * 
 * What it does:
 * 1. Finds all users with 'pin' field set but no 'transactionPin'
 * 2. Copies 'pin' value to 'transactionPin'
 * 3. Sets 'hasTransactionPin' to true
 * 4. Generates a migration report
 */

const strapiUtils = require('@strapi/utils');

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code paths, the strapi object, etc.
   * Example: perform database migrations, API updates, etc.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data,
   * run jobs, or perform some special logic.
   * Example: Create admin user if it doesn't exist
   */
  async bootstrap({ strapi }) {
    // This will be called during app initialization
    // Uncomment to run during startup, or call manually
    // await migratePinConsolidation(strapi);
  },
};

/**
 * Main migration function
 */
async function migratePinConsolidation(strapi) {
  try {
    console.log('🔄 Starting PIN Consolidation Migration...\n');

    // Find all users with pin field set but no transactionPin
    const usersToMigrate = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: {
        pin: { $notNull: true },
      },
      limit: 1000,
    });

    if (!usersToMigrate || usersToMigrate.length === 0) {
      console.log('✅ No users need PIN migration. All users already have consolidated PIN setup.');
      return {
        status: 'success',
        message: 'No migration needed',
        migratedCount: 0,
        totalChecked: 0,
      };
    }

    console.log(`📊 Found ${usersToMigrate.length} users with legacy 'pin' field\n`);

    let successCount = 0;
    let failureCount = 0;
    const failures = [];

    for (const user of usersToMigrate) {
      try {
        // Check if user already has transactionPin
        if (user.transactionPin && user.hasTransactionPin) {
          console.log(`⏭️  User ${user.id} (${user.email}) already migrated, skipping...`);
          continue;
        }

        // Migrate the PIN
        await strapi.db.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: {
            // Copy pin to transactionPin (both are hashed the same way)
            transactionPin: user.pin,
            hasTransactionPin: true,
            updatedAt: new Date(),
          },
        });

        successCount++;
        console.log(`✅ Migrated user ${user.id} (${user.email})`);
      } catch (error) {
        failureCount++;
        failures.push({
          userId: user.id,
          email: user.email,
          error: error.message,
        });
        console.error(`❌ Failed to migrate user ${user.id} (${user.email}):`, error.message);
      }
    }

    const migrationReport = {
      status: failureCount === 0 ? 'success' : 'partial',
      message: `Migration completed: ${successCount} successful, ${failureCount} failed`,
      successCount,
      failureCount,
      totalProcessed: successCount + failureCount,
      failureDetails: failures.length > 0 ? failures : null,
      timestamp: new Date().toISOString(),
    };

    console.log('\n' + '='.repeat(60));
    console.log('📋 MIGRATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total Processed: ${migrationReport.totalProcessed}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`Status: ${migrationReport.status}`);
    console.log('='.repeat(60) + '\n');

    if (failures.length > 0) {
      console.log('Failed Migrations:');
      failures.forEach((failure) => {
        console.log(`  - User ${failure.userId} (${failure.email}): ${failure.error}`);
      });
      console.log('');
    }

    return migrationReport;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Verification function to check migration status
 */
async function verifyMigration(strapi) {
  try {
    console.log('🔍 Verifying PIN Consolidation Status...\n');

    const stats = await strapi.db.connection.raw(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN "hasTransactionPin" = true THEN 1 ELSE 0 END) as has_transaction_pin,
        SUM(CASE WHEN "pin" IS NOT NULL AND "transactionPin" IS NULL THEN 1 ELSE 0 END) as needs_migration,
        SUM(CASE WHEN "pin" IS NOT NULL AND "transactionPin" IS NOT NULL THEN 1 ELSE 0 END) as migrated
      FROM "up_users"
    `);

    const result = stats.rows[0];

    console.log('📊 PIN Consolidation Status:');
    console.log(`  Total Users: ${result.total_users}`);
    console.log(`  ✅ Users with transactionPin: ${result.has_transaction_pin}`);
    console.log(`  🔄 Users needing migration: ${result.needs_migration}`);
    console.log(`  ✅ Already migrated: ${result.migrated}`);
    console.log('');

    if (result.needs_migration === 0) {
      console.log('✅ All users have been successfully migrated!');
    } else {
      console.log(`⚠️  ${result.needs_migration} users still need migration.`);
      console.log('   Run the migration script to complete the process.');
    }

    return {
      totalUsers: result.total_users,
      hasTransactionPin: result.has_transaction_pin,
      needsMigration: result.needs_migration,
      alreadyMigrated: result.migrated,
      migrationComplete: result.needs_migration === 0,
    };
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

module.exports = {
  migratePinConsolidation,
  verifyMigration,
};
