'use strict';

/**
 *  gift-card-collection controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::gift-card-collection.gift-card-collection', ({ strapi }) => ({
  /**
   * Get gift card rates with search and sorting
   * GET /api/gift-card-collections/rates
   */
  async getRates(ctx) {
    try {
      const { 
        search = '', 
        sortBy = 'name', 
        sortOrder = 'asc',
        page = 1,
        pageSize = 100 
      } = ctx.query;

      // Build the query
      const query = {
        where: {},
        populate: ['image'],
        sort: { [sortBy]: sortOrder },
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };

      // Add search filter if provided
      if (search) {
        query.where = {
          $or: [
            { name: { $containsi: search } },
            { description: { $containsi: search } },
          ],
        };
      }

      // Fetch collections with rates
      const collections = await strapi.entityService.findMany(
        'api::gift-card-collection.gift-card-collection',
        query
      );

      // Get total count for pagination
      const total = await strapi.db.query('api::gift-card-collection.gift-card-collection').count({
        where: query.where,
      });

      // Format the response
      const formattedData = collections.map(collection => ({
        id: collection.id,
        name: collection.name,
        description: collection.description || '',
        rate: collection.rate || null,
        imageUrl: collection.image?.url || null,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      }));

      return {
        data: formattedData,
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            pageCount: Math.ceil(total / parseInt(pageSize)),
            total,
          },
        },
      };
    } catch (error) {
      ctx.throw(500, `Failed to fetch gift card rates: ${error.message}`);
    }
  },
}));
