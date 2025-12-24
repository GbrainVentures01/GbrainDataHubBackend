'use strict';

/**
 * optimized-transaction-history controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::optimized-transaction-history.optimized-transaction-history',
  ({ strapi }) => ({
    /**
     * Get transactions for the logged-in user from actual transaction tables
     */
    async myTransactions(ctx) {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('You must be logged in to view transactions');
      }

      try {
        const { service, status, dateFrom, dateTo, page = 1, pageSize = 25, search, sortBy = 'createdAt', sortOrder = 'desc' } = ctx.query;

        const from = dateFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const to = dateTo || new Date().toISOString();

        console.log(`[myTransactions] Query params:`, { userId, service, status, dateFrom, dateTo, page, pageSize, search, sortBy, sortOrder });

        let allTransactions = [];

        // Helper to get transactions from a table using Strapi query API
        const getTableTransactions = async (apiName, serviceType, amountField = 'amount', statusField = 'status', userField = 'user') => {
          try {
            const where = {
              createdAt: {
                $gte: from,
                $lte: to,
              },
            };

            // Handle different user relation field names
            if (userField === 'users') {
              where.users = { id: userId };
            } else {
              where.user = { id: userId };
            }

            // Apply status filter (case-insensitive)
            if (status) {
              where[statusField] = { $eqi: status };
            }

            // Apply search filter
            if (search) {
              where.$or = [
                { phone_number: { $containsi: search } },
                { beneficiary_phone: { $containsi: search } },
                { meter_number: { $containsi: search } },
                { smart_card_number: { $containsi: search } },
                { order_id: { $containsi: search } },
                { reference: { $containsi: search } },
                { transaction_id: { $containsi: search } },
              ];
            }

            const results = await strapi.db.query(apiName).findMany({
              where,
              orderBy: { createdAt: 'desc' },
              limit: 1000, // Get more records before pagination
            });

            console.log(`[myTransactions] ${apiName}: Found ${results.length} records for user ${userId}`);

            return results.map(row => ({
              id: row.id,
              service: serviceType,
              serviceSubtype: row.data_plan || row.package_name || row.product_name || null,
              transactionType: 'purchase',
              referenceId: row.order_id || row.reference || row.transaction_id || `${serviceType}-${row.id}`,
              amount: row[amountField] ? parseFloat(row[amountField]) : 0,
              status: row[statusField] || 'unknown',
              description: row.description || `${serviceType} transaction`,
              network: row.network || row.provider || null,
              beneficiary: row.phone_number || row.beneficiary_phone || row.meter_number || row.smart_card_number || null,
              previousBalance: null,
              currentBalance: null,
              metadata: {
                plan: row.data_plan,
                package: row.package_name,
                product: row.product_name,
              },
              provider: row.provider || row.api_provider || null,
              providerReference: row.provider_reference || row.api_reference || null,
              notes: null,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            }));
          } catch (error) {
            console.error(`Error fetching transactions from ${apiName}:`, error.message);
            return [];
          }
        };

        // Fetch transactions based on service filter
        const serviceQueries = [];

        if (!service || service === 'airtime') {
          serviceQueries.push(getTableTransactions('api::airtime-order.airtime-order', 'airtime', 'amount', 'status'));
        }

        if (!service || service === 'data') {
          serviceQueries.push(
            getTableTransactions('api::sme-data-order.sme-data-order', 'data', 'amount', 'status'),
            getTableTransactions('api::cg-data-order.cg-data-order', 'data', 'amount', 'status'),
            getTableTransactions('api::data-gifting-order.data-gifting-order', 'data', 'amount', 'status'),
            getTableTransactions('api::mtn-coupon-data-order.mtn-coupon-data-order', 'data', 'amount', 'status'),
            getTableTransactions('api::mtn-sme-1-data-order.mtn-sme-1-data-order', 'data', 'amount', 'status'),
            getTableTransactions('api::mtn-sme-2-data-order.mtn-sme-2-data-order', 'data', 'amount', 'status')
          );
        }

        if (!service || service === 'cable') {
          serviceQueries.push(getTableTransactions('api::cable-subscription.cable-subscription', 'cable', 'amount', 'status', 'users'));
        }

        if (!service || service === 'electricity') {
          serviceQueries.push(getTableTransactions('api::electricity-order.electricity-order', 'electricity', 'amount', 'status', 'user'));
        }

        // Skip education for now - no API exists
        // if (!service || service === 'education') {
        //   serviceQueries.push(getTableTransactions('api::education-pin.education-pin', 'education', 'amount', 'status', 'user'));
        // }

        if (!service || service === 'crypto') {
          serviceQueries.push(getTableTransactions('api::crypto.crypto', 'crypto', 'amount', 'status', 'users'));
        }

        if (!service || service === 'gift_card') {
          serviceQueries.push(getTableTransactions('api::gift-card-order.gift-card-order', 'gift_card', 'price', 'order_status', 'users'));
        }

        if (!service || service === 'account_funding') {
          serviceQueries.push(getTableTransactions('api::account-funding.account-funding', 'account_funding', 'amount', 'status'));
        }

        // Execute all queries in parallel
        const results = await Promise.all(serviceQueries);
        allTransactions = results.flat();

        console.log(`[myTransactions] Total transactions found: ${allTransactions.length}`);
        console.log(`[myTransactions] Service breakdown:`, allTransactions.reduce((acc, t) => {
          acc[t.service] = (acc[t.service] || 0) + 1;
          return acc;
        }, {}));

        // Sort transactions
        const validSortFields = ['createdAt', 'amount', 'status', 'service'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const order = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

        allTransactions.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          
          if (sortField === 'createdAt') {
            return order * (new Date(aVal) - new Date(bVal));
          }
          
          if (sortField === 'amount') {
            return order * (parseFloat(aVal) - parseFloat(bVal));
          }
          
          return order * String(aVal).localeCompare(String(bVal));
        });

        // Apply pagination
        const total = allTransactions.length;
        const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
        const endIndex = startIndex + parseInt(pageSize);
        const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

        return {
          data: paginatedTransactions,
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
        console.error('Error fetching user transactions:', error);
        ctx.throw(500, `Failed to fetch transactions: ${error.message}`);
      }
    },
  })
);
