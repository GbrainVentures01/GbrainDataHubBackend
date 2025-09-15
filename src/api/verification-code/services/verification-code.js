"use strict";

/**
 * verification-code service
 */

const { createCoreService } = require("@strapi/strapi").factories;
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

module.exports = createCoreService(
  "api::verification-code.verification-code",
  ({ strapi }) => ({
    /**
     * Generate a secure 6-digit verification code
     * @returns {string} - Generated code
     */
    generateSecureCode() {
      // Generate cryptographically secure random bytes
      const randomBytes = crypto.randomBytes(4);
      // Convert to number and ensure it's 6 digits
      const randomNumber = randomBytes.readUInt32BE(0);
      const code = (randomNumber % 900000) + 100000;
      return code.toString();
    },

    /**
     * Hash verification code for secure storage
     * @param {string} code - The plain text verification code
     * @returns {string} - Hashed code
     */
    async hashCode(code) {
      const saltRounds = 12; // High salt rounds for financial app security
      return await bcrypt.hash(code, saltRounds);
    },

    /**
     * Verify a submitted code against stored hash
     * @param {string} code - Plain text code to verify
     * @param {string} hashedCode - Stored hash to compare against
     * @returns {boolean} - Whether codes match
     */
    async verifyCode(code, hashedCode) {
      return await bcrypt.compare(code, hashedCode);
    },

    /**
     * Create a new verification code
     * @param {Object} params - Code creation parameters
     * @param {number} params.userId - User ID
     * @param {string} params.type - Code type
     * @param {number} params.expirationMinutes - Expiration time in minutes
     * @param {string} params.ipAddress - Client IP address
     * @param {string} params.userAgent - Client user agent
     * @returns {Object} - Created code data
     */
    async createVerificationCode({
      userId,
      type,
      expirationMinutes = 15,
      ipAddress = null,
      userAgent = null,
    }) {
      try {
        // Check rate limiting - max 3 codes per hour per user per type
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCodes = await strapi.db
          .query("api::verification-code.verification-code")
          .count({
            where: {
              user: { id: userId },
              type: type,
              createdAt: {
                $gte: oneHourAgo,
              },
            },
          });

        if (recentCodes >= 3) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }

        // Clean up existing unused codes for this user and type
        const existingCodes = await strapi.db
          .query("api::verification-code.verification-code")
          .findMany({
            where: {
              user: { id: userId },
              type: type,
              isUsed: false,
            },
            select: ["id"],
          });

        // Delete each code individually
        if (existingCodes.length > 0) {
          for (const existingCode of existingCodes) {
            await strapi.db
              .query("api::verification-code.verification-code")
              .delete({
                where: { id: existingCode.id },
              });
          }
        }

        // Generate secure code and hash it
        const plainCode = this.generateSecureCode();
        const hashedCode = await this.hashCode(plainCode);

        // Calculate expiration
        const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

        // Create verification code record
        const verificationCode = await strapi.db
          .query("api::verification-code.verification-code")
          .create({
            data: {
              user: userId,
              code: plainCode,
              hashedCode: hashedCode,
              type: type,
              expiresAt: expiresAt,
              isUsed: false,
              attempts: 0,
              maxAttempts: 3,
              ipAddress: ipAddress,
              userAgent: userAgent,
            },
          });

        // Return the data needed for email sending
        return {
          id: verificationCode.id,
          code: plainCode, // Only return plain code for immediate use (email sending)
          expiresAt: expiresAt,
          type: type,
        };
      } catch (error) {
        strapi.log.error("Error creating verification code:", error);
        throw error;
      }
    },

    /**
     * Verify a submitted code without marking as used (for validation only)
     * @param {Object} params - Verification parameters
     * @param {number} params.userId - User ID
     * @param {string} params.code - Submitted code
     * @param {string} params.type - Code type
     * @param {string} params.ipAddress - Client IP address
     * @returns {Object} - Verification result
     */
    async verifyCodeWithoutMarking({ userId, code, type, ipAddress = null }) {
      try {
        // Find the most recent unused code for this user and type
        const verificationRecord = await strapi
          .query("api::verification-code.verification-code")
          .findOne({
            where: {
              user: userId,
              type: type,
              isUsed: false,
            },
            orderBy: { createdAt: "desc" },
          });

        if (!verificationRecord) {
          return {
            success: false,
            error: "No valid verification code found",
            errorCode: "CODE_NOT_FOUND",
          };
        }

        // Check if code has expired
        if (new Date() > new Date(verificationRecord.expiresAt)) {
          return {
            success: false,
            error: "Verification code has expired",
            errorCode: "CODE_EXPIRED",
          };
        }

        // Check attempt limits
        if (verificationRecord.attempts >= verificationRecord.maxAttempts) {
          return {
            success: false,
            error: "Too many verification attempts",
            errorCode: "TOO_MANY_ATTEMPTS",
          };
        }

        // Verify the code
        const isValidCode = await this.verifyCode(
          code,
          verificationRecord.hashedCode
        );

        if (!isValidCode) {
          // Increment attempts but DON'T mark as used
          await strapi
            .query("api::verification-code.verification-code")
            .update({
              where: { id: verificationRecord.id },
              data: { attempts: verificationRecord.attempts + 1 },
            });

          return {
            success: false,
            error: "Invalid verification code",
            errorCode: "INVALID_CODE",
            attemptsRemaining:
              verificationRecord.maxAttempts - verificationRecord.attempts - 1,
          };
        }

        // Code is valid but NOT marked as used (for validation purposes only)
        return {
          success: true,
          message: "Code verified successfully (not marked as used)",
        };
      } catch (error) {
        strapi.log.error("Error verifying code without marking:", error);
        return {
          success: false,
          error: "Verification failed",
          errorCode: "VERIFICATION_ERROR",
        };
      }
    },

    /**
     * Verify a submitted code with security checks
     * @param {Object} params - Verification parameters
     * @param {number} params.userId - User ID
     * @param {string} params.code - Submitted code
     * @param {string} params.type - Code type
     * @param {string} params.ipAddress - Client IP address
     * @returns {Object} - Verification result
     */
    async verifySubmittedCode({ userId, code, type, ipAddress = null }) {
      try {
        // Find the most recent unused code for this user and type
        const verificationRecord = await strapi
          .query("api::verification-code.verification-code")
          .findOne({
            where: {
              user: userId,
              type: type,
              isUsed: false,
            },
            orderBy: { createdAt: "desc" },
          });

        if (!verificationRecord) {
          return {
            success: false,
            error: "No valid verification code found",
            errorCode: "CODE_NOT_FOUND",
          };
        }

        // Check if code has expired
        if (new Date() > new Date(verificationRecord.expiresAt)) {
          return {
            success: false,
            error: "Verification code has expired",
            errorCode: "CODE_EXPIRED",
          };
        }

        // Check attempt limits
        if (verificationRecord.attempts >= verificationRecord.maxAttempts) {
          return {
            success: false,
            error: "Too many verification attempts",
            errorCode: "TOO_MANY_ATTEMPTS",
          };
        }

        // Verify the code
        const isValidCode = await this.verifyCode(
          code,
          verificationRecord.hashedCode
        );

        if (!isValidCode) {
          // Increment attempts
          await strapi
            .query("api::verification-code.verification-code")
            .update({
              where: { id: verificationRecord.id },
              data: { attempts: verificationRecord.attempts + 1 },
            });

          return {
            success: false,
            error: "Invalid verification code",
            errorCode: "INVALID_CODE",
            attemptsRemaining:
              verificationRecord.maxAttempts - verificationRecord.attempts - 1,
          };
        }

        // Mark code as used
        await strapi.query("api::verification-code.verification-code").update({
          where: { id: verificationRecord.id },
          data: { isUsed: true },
        });

        return {
          success: true,
          message: "Code verified successfully",
        };
      } catch (error) {
        strapi.log.error("Error verifying submitted code:", error);
        return {
          success: false,
          error: "Verification failed",
          errorCode: "VERIFICATION_ERROR",
        };
      }
    },

    /**
     * Clean up expired verification codes
     * @returns {number} - Number of expired codes cleaned up
     */
    async cleanupExpiredCodes() {
      try {
        const expiredCodes = await strapi.db
          .query("api::verification-code.verification-code")
          .findMany({
            where: {
              expiresAt: {
                $lt: new Date(),
              },
            },
            select: ["id"],
          });

        let deletedCount = 0;
        for (const expiredCode of expiredCodes) {
          await strapi.db
            .query("api::verification-code.verification-code")
            .delete({
              where: { id: expiredCode.id },
            });
          deletedCount++;
        }

        strapi.log.info(
          `Cleaned up ${deletedCount} expired verification codes`
        );
        return deletedCount;
      } catch (error) {
        strapi.log.error("Error cleaning up expired codes:", error);
        return 0;
      }
    },
  })
);
