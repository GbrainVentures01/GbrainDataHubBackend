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

        const knex = strapi.db.connection;
        let allTransactions = [];

        // Helper to get transactions from a table
        const getTableTransactions = async (tableName, serviceType, amountCol = 'amount', statusCol = 'status') => {
          try {
            const hasTable = await knex.schema.hasTable(tableName);
            if (!hasTable) return [];

            const hasAmount = await knex.schema.hasColumn(tableName, amountCol);
            const hasStatus = await knex.schema.hasColumn(tableName, statusCol);
            const hasUser = await knex.schema.hasColumn(tableName, 'user_id');

            if (!hasUser) return [];

            let query = knex(tableName)
              .where('user_id', userId)
              .where('created_at', '>=', from)
              .where('created_at', '<=', to);

            // Apply status filter
            if (status && hasStatus) {
              query = query.where(statusCol, status);
            }

            // Apply search filter
            if (search) {
              query = query.where(function() {
                this.where('phone_number', 'like', `%${search}%`)
                  .orWhere('beneficiary_phone', 'like', `%${search}%`)
                  .orWhere('meter_number', 'like', `%${search}%`)
                  .orWhere('smart_card_number', 'like', `%${search}%`)
                  .orWhere('order_id', 'like', `%${search}%`)
                  .orWhere('reference', 'like', `%${search}%`);
              });
            }

            const results = await query.select('*');

            return results.map(row => ({
              id: row.id,
              service: serviceType,
              serviceSubtype: row.data_plan || row.package_name || row.product_name || null,
              transactionType: 'purchase',
              referenceId: row.order_id || row.reference || row.transaction_id || `${tableName}-${row.id}`,
              amount: hasAmount ? parseFloat(row[amountCol] || 0) : 0,
              status: hasStatus ? row[statusCol] : 'unknown',
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
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }));
          } catch (error) {
            console.error(`Error fetching transactions from ${tableName}:`, error.message);
            return [];
          }
        };

        // Determine which tables to query based on service filter
        if (!service || service === 'airtime') {
          const airtimeTransactions = await getTableTransactions('airtime_orders', 'airtime', 'amount', 'status');
          allTransactions = allTransactions.concat(airtimeTransactions);
        }

        if (!service || service === 'data') {
          const [smeData, cgData, dataGifting, mtnCoupon, mtnSme1, mtnSme2] = await Promise.all([
            getTableTransactions('sme_data_orders', 'data', 'amount', 'status'),
            getTableTransactions('cg_data_orders', 'data', 'amount', 'status'),
            getTableTransactions('data_gifting_orders', 'data', 'amount', 'status'),
            getTableTransactions('mtn_coupon_data_orders', 'data', 'amount', 'status'),
            getTableTransactions('mtn_sme_1_data_orders', 'data', 'amount', 'status'),
            getTableTransactions('mtn_sme_2_data_orders', 'data', 'amount', 'status'),
          ]);
          allTransactions = allTransactions.concat(smeData, cgData, dataGifting, mtnCoupon, mtnSme1, mtnSme2);
        }

        if (!service || service === 'cable') {
          const cableTransactions = await getTableTransactions('cable_subscriptions', 'cable', 'amount', 'status');
          allTransactions = allTransactions.concat(cableTransactions);
        }

        if (!service || service === 'electricity') {
          const electricityTransactions = await getTableTransactions('electricity_bills', 'electricity', 'amount', 'status');
          allTransactions = allTransactions.concat(electricityTransactions);
        }

        if (!service || service === 'education') {
          const educationTransactions = await getTableTransactions('education_pins', 'education', 'amount', 'status');
          allTransactions = allTransactions.concat(educationTransactions);
        }

        if (!service || service === 'crypto') {
          const cryptoTransactions = await getTableTransactions('cryptos', 'crypto', 'amount', 'status');
          allTransactions = allTransactions.concat(cryptoTransactions);
        }

        if (!service || service === 'gift_card') {
          const giftCardTransactions = await getTableTransactions('gift_card_orders', 'gift_card', 'price', 'order_status');
          allTransactions = allTransactions.concat(giftCardTransactions);
        }

        if (!service || service === 'account_funding') {
          const fundingTransactions = await getTableTransactions('account_fundings', 'account_funding', 'amount', 'status');
          allTransactions = allTransactions.concat(fundingTransactions);
        }

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
