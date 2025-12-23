'use strict';

/**
 * payment-method controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::payment-method.payment-method', ({ strapi }) => ({
  /**
   * Create a payment method for the authenticated user
   */
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Check if user KYC is verified
    if (!user.kycVerified) {
      return ctx.forbidden('You must complete KYC verification before adding a payment method');
    }

    const { accountNumber, accountName, bank, isPrimary } = ctx.request.body.data;

    // Validate required fields
    if (!accountNumber || !accountName || !bank) {
      return ctx.badRequest('Account number, account name, and bank are required');
    }

    try {
      // If this is set as primary, unset other primary payment methods
      if (isPrimary) {
        await strapi.db.query('api::payment-method.payment-method').updateMany({
          where: { user: user.id },
          data: { isPrimary: false },
        });
      }

      // Check if this is the first payment method, make it primary automatically
      const existingMethods = await strapi.db.query('api::payment-method.payment-method').count({
        where: { user: user.id },
      });

      const shouldBePrimary = isPrimary || existingMethods === 0;

      // Create the payment method
      const paymentMethod = await strapi.entityService.create('api::payment-method.payment-method', {
        data: {
          accountNumber,
          accountName,
          bank,
          user: user.id,
          isPrimary: shouldBePrimary,
        },
        populate: ['bank', 'user'],
      });

      return this.transformResponse(paymentMethod);
    } catch (error) {
      strapi.log.error('Error creating payment method:', error);
      return ctx.internalServerError('Failed to create payment method');
    }
  },

  /**
   * Get all payment methods for the authenticated user
   */
  async find(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      const paymentMethods = await strapi.entityService.findMany('api::payment-method.payment-method', {
        filters: { user: user.id },
        populate: ['bank'],
        sort: { isPrimary: 'desc', createdAt: 'desc' },
      });

      return this.transformResponse(paymentMethods);
    } catch (error) {
      strapi.log.error('Error fetching payment methods:', error);
      return ctx.internalServerError('Failed to fetch payment methods');
    }
  },

  /**
   * Update a payment method
   */
  async update(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      // Check if payment method belongs to user
      const paymentMethod = await strapi.entityService.findOne('api::payment-method.payment-method', id, {
        populate: ['user'],
      });

      if (!paymentMethod || paymentMethod.user.id !== user.id) {
        return ctx.notFound('Payment method not found');
      }

      const { accountNumber, accountName, bank, isPrimary } = ctx.request.body.data;

      // If setting as primary, unset other primary payment methods
      if (isPrimary) {
        await strapi.db.query('api::payment-method.payment-method').updateMany({
          where: { 
            user: user.id,
            id: { $ne: id }
          },
          data: { isPrimary: false },
        });
      }

      // Update the payment method
      const updated = await strapi.entityService.update('api::payment-method.payment-method', id, {
        data: {
          ...(accountNumber && { accountNumber }),
          ...(accountName && { accountName }),
          ...(bank && { bank }),
          ...(isPrimary !== undefined && { isPrimary }),
        },
        populate: ['bank'],
      });

      return this.transformResponse(updated);
    } catch (error) {
      strapi.log.error('Error updating payment method:', error);
      return ctx.internalServerError('Failed to update payment method');
    }
  },

  /**
   * Delete a payment method
   */
  async delete(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      // Check if payment method belongs to user
      const paymentMethod = await strapi.entityService.findOne('api::payment-method.payment-method', id, {
        populate: ['user'],
      });

      if (!paymentMethod || paymentMethod.user.id !== user.id) {
        return ctx.notFound('Payment method not found');
      }

      // Delete the payment method
      await strapi.entityService.delete('api::payment-method.payment-method', id);

      // If this was primary, set another method as primary
      if (paymentMethod.isPrimary) {
        const remainingMethods = await strapi.entityService.findMany('api::payment-method.payment-method', {
          filters: { user: user.id },
          sort: { createdAt: 'asc' },
          limit: 1,
        });

        if (remainingMethods.length > 0) {
          await strapi.entityService.update('api::payment-method.payment-method', remainingMethods[0].id, {
            data: { isPrimary: true },
          });
        }
      }

      return { message: 'Payment method deleted successfully' };
    } catch (error) {
      strapi.log.error('Error deleting payment method:', error);
      return ctx.internalServerError('Failed to delete payment method');
    }
  },
}));
