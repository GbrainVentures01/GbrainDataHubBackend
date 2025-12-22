'use strict';

/**
 *  gift-card-order controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::gift-card-order.gift-card-order', ({ strapi }) => ({
  /**
   * Create gift card order with authenticated user
   * @route POST /api/gift-card-orders
   */
  async create(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('You must be authenticated to create a gift card order');
      }

      // Get the request data
      const { data } = ctx.request.body;

      // Add user to the data
      const orderData = {
        ...data,
        users_permissions_users_detail: userId,
      };

      // Create the order using Strapi's entity service
      const order = await strapi.entityService.create(
        'api::gift-card-order.gift-card-order',
        {
          data: orderData,
          populate: {
            gift_card_collection: true,
            gift_card_category: true,
            card_images: true,
            users_permissions_users_detail: true,
          },
        }
      );

      return ctx.send({ data: order });
    } catch (error) {
      strapi.log.error('Error creating gift card order:', error);
      return ctx.badRequest('Failed to create gift card order');
    }
  },

  /**
   * Get user's gift card trade history with pagination, search, and filters
   * @route GET /api/gift-card-orders/trade-history
   */
  async getTradeHistory(ctx) {
    try {
      const userId = ctx.state.user.id;

      if (!userId) {
        return ctx.unauthorized('You must be authenticated to view trade history');
      }

      // Extract query parameters
      const {
        page = 1,
        pageSize = 20,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        status = '', // Filter by publishedAt status: 'published', 'draft', or '' for all
        categoryId = '', // Filter by gift_card_category id
        collectionId = '', // Filter by gift_card_collection id
        startDate = '',
        endDate = '',
      } = ctx.query;

      const pageNum = parseInt(page);
      const pageSizeNum = parseInt(pageSize);
      const offset = (pageNum - 1) * pageSizeNum;

      // Build the WHERE clause for filtering
      const filters = {
        users_permissions_users_detail: {
          id: userId,
        },
      };

      // Status filter (draft or published)
      if (status === 'published') {
        filters.publishedAt = { $notNull: true };
      } else if (status === 'draft') {
        filters.publishedAt = { $null: true };
      }

      // Category filter
      if (categoryId) {
        filters.gift_card_category = {
          id: parseInt(categoryId),
        };
      }

      // Collection filter
      if (collectionId) {
        filters.gift_card_collection = {
          id: parseInt(collectionId),
        };
      }

      // Date range filter
      if (startDate) {
        filters.createdAt = filters.createdAt || {};
        filters.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.createdAt = filters.createdAt || {};
        filters.createdAt.$lte = new Date(endDate);
      }

      // Search filter (search in comments or amount)
      if (search) {
        filters.$or = [
          {
            comments: {
              $containsi: search,
            },
          },
          {
            amount: {
              $containsi: search,
            },
          },
        ];
      }

      // Determine sort field and order
      const sortField = sortBy || 'createdAt';
      const sortDirection = sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

      // Fetch gift card orders with pagination
      const [orders, totalCount] = await Promise.all([
        strapi.entityService.findMany('api::gift-card-order.gift-card-order', {
          filters,
          populate: {
            gift_card_collection: {
              fields: ['name', 'description', 'rate'],
              populate: {
                image: {
                  fields: ['url', 'name'],
                },
              },
            },
            gift_card_category: {
              fields: ['name', 'rate'],
              populate: {
                image: {
                  fields: ['url', 'name'],
                },
              },
            },
            card_images: {
              fields: ['url', 'name'],
            },
          },
          sort: { [sortField]: sortDirection },
          start: offset,
          limit: pageSizeNum,
        }),
        strapi.entityService.count('api::gift-card-order.gift-card-order', {
          filters,
        }),
      ]);

      // Format response
      const formattedOrders = orders.map((order) => ({
        id: order.id,
        amount: order.amount?.toString() || '0',
        status: order.publishedAt ? 'completed' : 'pending',
        comments: order.comments || null,
        cardImages: order.card_images?.map((img) => ({
          url: img.url || '',
          name: img.name || '',
        })) || [],
        collection: order.gift_card_collection ? {
          id: order.gift_card_collection.id,
          name: order.gift_card_collection.name || '',
          description: order.gift_card_collection.description || null,
          rate: order.gift_card_collection.rate || null,
          image: order.gift_card_collection.image?.url || null,
        } : null,
        category: order.gift_card_category ? {
          id: order.gift_card_category.id,
          name: order.gift_card_category.name || '',
          rate: order.gift_card_category.rate || null,
          image: order.gift_card_category.image?.[0]?.url || null,
        } : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        publishedAt: order.publishedAt || null,
      }));

      const totalPages = Math.ceil(totalCount / pageSizeNum);
      const hasMore = pageNum < totalPages;

      return ctx.send({
        data: formattedOrders,
        meta: {
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            pageCount: totalPages,
            total: totalCount,
            hasMore,
          },
        },
      });
    } catch (error) {
      strapi.log.error('Error fetching gift card trade history:', error);
      return ctx.internalServerError('An error occurred while fetching trade history');
    }
  },
}));
