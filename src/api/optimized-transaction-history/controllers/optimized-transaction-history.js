'use strict';

/**
 * optimized-transaction-history controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::optimized-transaction-history.optimized-transaction-history',
  ({ strapi }) => ({
    /**
     * Get transactions for the logged-in user only
     */
    async myTransactions(ctx) {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('You must be logged in to view transactions');
      }

      try {
        // Build query with user filter
        const query = {
          ...ctx.query,
          filters: {
            ...ctx.query.filters,
            user: {
              id: userId,
            },
          },
        };

        // Fetch transactions
        const entities = await strapi.entityService.findMany(
          'api::optimized-transaction-history.optimized-transaction-history',
          query
        );

        // Get total count for pagination
        const total = await strapi.entityService.count(
          'api::optimized-transaction-history.optimized-transaction-history',
          {
            filters: query.filters,
          }
        );

        return {
          data: entities,
          meta: {
            pagination: {
              page: query.pagination?.page || 1,
              pageSize: query.pagination?.pageSize || 25,
              pageCount: Math.ceil(total / (query.pagination?.pageSize || 25)),
              total,
            },
          },
        };
      } catch (error) {
        ctx.throw(500, `Failed to fetch transactions: ${error.message}`);
      }
    },
  })
);
