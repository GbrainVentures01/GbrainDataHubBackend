/**
 * Database Migration Script: KYC Tier System
 * 
 * This script sets up the KYC tier system for existing databases.
 * It assigns Tier 1 to confirmed users and Tier 0 to unconfirmed users.
 * 
 * Usage:
 * 1. Place this file in your migrations folder
 * 2. Or run directly: node migrations/kyc-tier-setup.js
 * 
 * Database: Strapi (PostgreSQL/MySQL/SQLite)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Migration for Sequelize (Strapi uses this)
    
    try {
      console.log('🔄 Starting KYC Tier System migration...');

      // Update confirmed users to Tier 1
      const confirmedResult = await queryInterface.sequelize.query(`
        UPDATE up_users
        SET 
          kyc_tier = 1,
          kyc_verified = true,
          kyc_verified_at = CASE 
            WHEN confirmed = true THEN created_at
            ELSE NULL
          END
        WHERE confirmed = true AND (kyc_tier IS NULL OR kyc_tier = 0)
      `);

      console.log(`✅ Updated confirmed users to Tier 1: ${confirmedResult[1]?.affectedRows || 'N/A'} rows`);

      // Ensure unconfirmed users are Tier 0
      const unconfirmedResult = await queryInterface.sequelize.query(`
        UPDATE up_users
        SET kyc_tier = 0, kyc_verified = false
        WHERE confirmed = false AND kyc_tier IS NULL
      `);

      console.log(`✅ Set unconfirmed users to Tier 0: ${unconfirmedResult[1]?.affectedRows || 'N/A'} rows`);

      // Set default values for null kyc_tier (safety check)
      const nullResult = await queryInterface.sequelize.query(`
        UPDATE up_users
        SET kyc_tier = CASE WHEN confirmed = true THEN 1 ELSE 0 END
        WHERE kyc_tier IS NULL
      `);

      console.log(`✅ Fixed null kyc_tier values: ${nullResult[1]?.affectedRows || 'N/A'} rows`);

      console.log('✅ KYC Tier System migration completed successfully!');
      
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return Promise.reject(error);
    }
  },

  async down(queryInterface, Sequelize) {
    // Rollback: Reset KYC tier fields
    try {
      console.log('🔄 Rolling back KYC Tier System migration...');

      await queryInterface.sequelize.query(`
        UPDATE up_users
        SET 
          kyc_tier = NULL,
          kyc_verified = false,
          kyc_verified_at = NULL
      `);

      console.log('✅ Rollback completed successfully!');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      return Promise.reject(error);
    }
  }
};

/**
 * Raw SQL Queries for Manual Migration
 * 
 * If running manually without Sequelize, use these queries:
 * 
 * PostgreSQL:
 * ----------
 * -- Update confirmed users to Tier 1
 * UPDATE up_users
 * SET 
 *   kyc_tier = 1,
 *   kyc_verified = true,
 *   kyc_verified_at = CASE 
 *     WHEN confirmed = true THEN created_at
 *     ELSE NULL
 *   END
 * WHERE confirmed = true;
 * 
 * -- Ensure unconfirmed users are Tier 0
 * UPDATE up_users
 * SET kyc_tier = 0, kyc_verified = false
 * WHERE confirmed = false;
 * 
 * MySQL/MariaDB:
 * ---------------
 * -- Update confirmed users to Tier 1
 * UPDATE up_users
 * SET 
 *   kyc_tier = 1,
 *   kyc_verified = true,
 *   kyc_verified_at = IF(confirmed = true, created_at, NULL)
 * WHERE confirmed = true;
 * 
 * -- Ensure unconfirmed users are Tier 0
 * UPDATE up_users
 * SET kyc_tier = 0, kyc_verified = false
 * WHERE confirmed = false;
 * 
 * SQLite:
 * --------
 * -- Update confirmed users to Tier 1
 * UPDATE up_users
 * SET 
 *   kyc_tier = 1,
 *   kyc_verified = 1,
 *   kyc_verified_at = CASE 
 *     WHEN confirmed = 1 THEN created_at
 *     ELSE NULL
 *   END
 * WHERE confirmed = 1;
 * 
 * -- Ensure unconfirmed users are Tier 0
 * UPDATE up_users
 * SET kyc_tier = 0, kyc_verified = 0
 * WHERE confirmed = 0;
 */

/**
 * Strapi Bootstrap Integration
 * 
 * To run this migration automatically on app startup, add to src/bootstrap.js:
 * 
 * module.exports = ({ strapi }) => {
 *   // Run KYC tier migration on startup
 *   strapi.db.lifecycles.subscribe({
 *     models: ['plugin::users-permissions.user'],
 *     afterCreate(event) {
 *       // Migration already ran, this is for new schema verification
 *     },
 *   });
 * 
 *   console.log('KYC Tier System initialized');
 * };
 */
