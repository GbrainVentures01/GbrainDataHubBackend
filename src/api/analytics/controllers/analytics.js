'use strict';

/**
 * analytics controller
 * 
 * Provides unified analytics endpoints for all services:
 * - Crypto deposits: tracked in account-funding (funding_type: 'crypto_deposit')
 * - Card/Bank transfers: tracked in account-funding (funding_type: 'card_payment'|'bank_transfer')
 * - Airtime/Data/Cable/Electricity/Education: tracked in their respective order tables
 * - All transactions aggregated in optimized-transaction-history for faster queries
 * - Daily aggregated stats in service-stat (pre-computed)
 */

const { ApplicationError } = require('@strapi/utils/lib/errors');

module.exports = {
  async index(ctx) {
    ctx.send({ message: 'Analytics API' });
  },
  /**
   * Get unified dashboard statistics
   * Returns stats for all services and overall platform metrics
   */
  async getDashboardStats(ctx) {
    try {
      const { dateFrom, dateTo } = ctx.query;
      const fromDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = dateTo || new Date().toISOString();

      const whereDate = {
        createdAt: {
          $gte: fromDate,
          $lte: toDate,
        },
      };

      // Helper to get stats for a service using raw SQL aggregation
      const getServiceStats = async (tableName, serviceName, amountColumn = 'amount', statusColumn = 'status') => {
        try {
          const knex = strapi.db.connection;
          
          // Check if table exists
          const tableExists = await knex.schema.hasTable(tableName);
          if (!tableExists) {
            return {
              service: serviceName,
              total: 0,
              amount: 0,
              successful: 0,
              failed: 0,
              pending: 0,
            };
          }

          // Check if columns exist
          const hasAmountColumn = await knex.schema.hasColumn(tableName, amountColumn);
          const hasStatusColumn = await knex.schema.hasColumn(tableName, statusColumn);

          // Build query based on available columns
          const query = knex(tableName)
            .where('created_at', '>=', fromDate)
            .where('created_at', '<=', toDate);

          const selectFields = [knex.raw('COUNT(*) as total')];
          
          if (hasAmountColumn) {
            selectFields.push(knex.raw(`SUM(COALESCE(${amountColumn}, 0)) as total_amount`));
          } else {
            selectFields.push(knex.raw('0 as total_amount'));
          }

          if (hasStatusColumn) {
            selectFields.push(
              knex.raw(`COUNT(CASE WHEN ${statusColumn} IN (?, ?, ?) THEN 1 END) as successful`, ['completed', 'successful', 'success']),
              knex.raw(`COUNT(CASE WHEN ${statusColumn} IN (?, ?) THEN 1 END) as failed`, ['failed', 'failure']),
              knex.raw(`COUNT(CASE WHEN ${statusColumn} IN (?, ?) THEN 1 END) as pending`, ['pending', 'processing'])
            );
          } else {
            selectFields.push(
              knex.raw('0 as successful'),
              knex.raw('0 as failed'),
              knex.raw('0 as pending')
            );
          }

          const stats = await query.select(...selectFields).first();

          return {
            service: serviceName,
            total: parseInt(stats.total) || 0,
            amount: parseFloat(stats.total_amount) || 0,
            successful: parseInt(stats.successful) || 0,
            failed: parseInt(stats.failed) || 0,
            pending: parseInt(stats.pending) || 0,
          };
        } catch (error) {
          console.error(`Error fetching stats for ${tableName}:`, error.message);
          return {
            service: serviceName,
            total: 0,
            amount: 0,
            successful: 0,
            failed: 0,
            pending: 0,
          };
        }
      };

      // Get stats from all tables in parallel
      const [
        airtimeStats,
        smeDataStats,
        cgDataStats,
        dataGiftingStats,
        mtnCouponStats,
        mtnSme1Stats,
        mtnSme2Stats,
        accountFundingStats,
        cableStats,
        cryptoStats,
        giftCardStats,
      ] = await Promise.all([
        getServiceStats('airtime_orders', 'airtime', 'amount', 'status'),
        getServiceStats('sme_data_orders', 'data', 'amount', 'status'),
        getServiceStats('cg_data_orders', 'data', 'amount', 'status'),
        getServiceStats('data_gifting_orders', 'data', 'amount', 'status'),
        getServiceStats('mtn_coupon_data_orders', 'data', 'amount', 'status'),
        getServiceStats('mtn_sme_1_data_orders', 'data', 'amount', 'status'),
        getServiceStats('mtn_sme_2_data_orders', 'data', 'amount', 'status'),
        getServiceStats('account_fundings', 'account_funding', 'amount', 'status'),
        getServiceStats('cable_subscriptions', 'cable', 'amount', 'status'),
        getServiceStats('cryptos', 'crypto', 'amount', 'status'),
        getServiceStats('gift_card_orders', 'gift_card', 'price', 'order_status'),
      ]);

      const allStats = [
        airtimeStats,
        smeDataStats,
        cgDataStats,
        dataGiftingStats,
        mtnCouponStats,
        mtnSme1Stats,
        mtnSme2Stats,
        accountFundingStats,
        cableStats,
        cryptoStats,
        giftCardStats,
      ];

      // Aggregate totals
      const aggregated = {
        total_transactions: 0,
        total_amount: 0,
        successful_transactions: 0,
        failed_transactions: 0,
        pending_transactions: 0,
        unique_users: new Set(),
        by_service: {},
      };

      allStats.forEach(stat => {
        aggregated.total_transactions += stat.total;
        aggregated.total_amount += stat.amount;
        aggregated.successful_transactions += stat.successful;
        aggregated.failed_transactions += stat.failed;
        aggregated.pending_transactions += stat.pending;

        // Aggregate by service (combine data orders)
        if (!aggregated.by_service[stat.service]) {
          aggregated.by_service[stat.service] = {
            transactions: 0,
            amount: 0,
            successful: 0,
            failed: 0,
          };
        }

        aggregated.by_service[stat.service].transactions += stat.total;
        aggregated.by_service[stat.service].amount += stat.amount;
        aggregated.by_service[stat.service].successful += stat.successful;
        aggregated.by_service[stat.service].failed += stat.failed;
      });

      // Get total active users and recent transactions in parallel
      const [totalUsers, recentAirtime, recentData, recentCable, recentElectricity, recentCrypto, recentGiftCard, recentAccountFunding] = await Promise.all([
        strapi.db.query('plugin::users-permissions.user').count(),
        strapi.db.query('api::airtime-order.airtime-order').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::sme-data-order.sme-data-order').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::cable-subscription.cable-subscription').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::electricity-order.electricity-order').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::crypto.crypto').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::gift-card-order.gift-card-order').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::account-funding.account-funding').findMany({
          where: whereDate,
          limit: 2,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
      ]);

      // Combine and sort recent transactions
      const recentTransactions = [
        ...recentAirtime.map(t => ({ ...t, service: 'airtime', amount: t.amount })),
        ...recentData.map(t => ({ ...t, service: 'data', amount: t.amount })),
        ...recentCable.map(t => ({ ...t, service: 'cable', amount: t.amount || t.sub_amount })),
        ...recentElectricity.map(t => ({ ...t, service: 'electricity', amount: t.amount || t.amount_to_pay })),
        ...recentCrypto.map(t => ({ ...t, service: 'crypto', amount: t.amount || t.usd_amount })),
        ...recentGiftCard.map(t => ({ ...t, service: 'gift_card', amount: t.price || t.total_amount })),
        ...recentAccountFunding.map(t => ({ ...t, service: 'account_funding', amount: t.amount })),
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

      // Calculate success rate
      const successRate = aggregated.total_transactions > 0
        ? ((aggregated.successful_transactions / aggregated.total_transactions) * 100).toFixed(2)
        : 0;

      // Get chart data for time series
      // const knex = strapi.db.connection;
      // const chartData = await knex.raw(`
      //   SELECT 
      //     DATE(created_at) as date,
      //     COUNT(*) as transactions,
      //     SUM(COALESCE(amount, 0)) as revenue
      //   FROM (
      //     SELECT created_at, amount FROM airtime_orders WHERE created_at >= ? AND created_at <= ?
      //     UNION ALL
      //     SELECT created_at, amount FROM sme_data_orders WHERE created_at >= ? AND created_at <= ?
      //     UNION ALL
      //     SELECT created_at, amount FROM cg_data_orders WHERE created_at >= ? AND created_at <= ?
      //     UNION ALL
      //     SELECT created_at, amount FROM cable_subscriptions WHERE created_at >= ? AND created_at <= ?
      //     UNION ALL
      //     SELECT created_at, amount FROM account_fundings WHERE created_at >= ? AND created_at <= ?
      //   ) as all_transactions
      //   GROUP BY DATE(created_at)
      //   ORDER BY date ASC
      // `, [fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate]);

      // const formattedChartData = (chartData.rows || []).map(row => ({
      //   date: row.date,
      //   transactions: parseInt(row.transactions) || 0,
      //   revenue: parseFloat(row.revenue) || 0,
      // }));

      ctx.send({
        success: true,
        data: {
          dateRange: { from: fromDate, to: toDate },
          totalTransactions: aggregated.total_transactions,
          totalAmount: aggregated.total_amount.toFixed(2),
          successfulTransactions: aggregated.successful_transactions,
          failedTransactions: aggregated.failed_transactions,
          pendingTransactions: aggregated.pending_transactions,
          successRate: parseFloat(successRate),
          totalUsers,
          byService: aggregated.by_service,
          // chartData: formattedChartData,
          recentTransactions: recentTransactions.map(t => ({
            id: t.id,
            service: t.service,
            user: t.user?.email || t.user?.username,
            amount: parseFloat(t.amount || 0),
            status: t.status,
            beneficiary: t.beneficiary || t.phone_number || t.meter_number,
            createdAt: t.createdAt,
          })),
        },
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      ctx.send({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  /**
   * Get chart data for analytics dashboard
   * Supports filters: today, this_week, this_month, custom
   */
  async getChartData(ctx) {
    try {
      const { filter = 'this_month', dateFrom, dateTo, groupBy = 'day' } = ctx.query;
      
      let fromDate, toDate;
      const now = new Date();
      
      switch(filter) {
        case 'today':
          fromDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          toDate = new Date(now.setHours(23, 59, 59, 999)).toISOString();
          break;
        case 'this_week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          fromDate = startOfWeek.toISOString();
          toDate = new Date().toISOString();
          break;
        case 'this_month':
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          toDate = new Date().toISOString();
          break;
        case 'custom':
          if (!dateFrom || !dateTo) {
            return ctx.badRequest('dateFrom and dateTo are required for custom filter');
          }
          fromDate = new Date(dateFrom).toISOString();
          toDate = new Date(dateTo).toISOString();
          break;
        default:
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          toDate = new Date().toISOString();
      }

      const knex = strapi.db.connection;
      
      // Helper to get time series data for a table
      const getTableTimeSeries = async (tableName, amountCol, statusCol) => {
        try {
          const hasTable = await knex.schema.hasTable(tableName);
          if (!hasTable) return [];

          const hasAmount = await knex.schema.hasColumn(tableName, amountCol);
          const hasStatus = await knex.schema.hasColumn(tableName, statusCol);

          if (!hasAmount && !hasStatus) return [];

          const result = await knex(tableName)
            .select(knex.raw('DATE(created_at) as date'))
            .count('* as count')
            .modify(qb => {
              if (hasAmount) {
                qb.sum(knex.raw(`COALESCE(${amountCol}, 0)) as amount`));
              }
              if (hasStatus) {
                qb.sum(knex.raw(`CASE WHEN ${statusCol} IN ('completed', 'successful', 'success') THEN 1 ELSE 0 END as successful`));
                qb.sum(knex.raw(`CASE WHEN ${statusCol} IN ('failed', 'failure') THEN 1 ELSE 0 END as failed`));
              }
            })
            .where('created_at', '>=', fromDate)
            .where('created_at', '<=', toDate)
            .groupByRaw('DATE(created_at)')
            .orderBy('date', 'asc');

          return result.map(row => ({
            date: row.date,
            count: parseInt(row.count) || 0,
            amount: parseFloat(row.amount) || 0,
            successful: parseInt(row.successful) || 0,
            failed: parseInt(row.failed) || 0,
          }));
        } catch (error) {
          console.error(`Error fetching time series for ${tableName}:`, error.message);
          return [];
        }
      };

      // Get time series data from all tables
      const [
        airtimeTS,
        smeDataTS,
        cgDataTS,
        dataGiftingTS,
        mtnCouponTS,
        mtnSme1TS,
        mtnSme2TS,
        cableTS,
        accountFundingTS,
        cryptoTS,
        giftCardTS,
      ] = await Promise.all([
        getTableTimeSeries('airtime_orders', 'amount', 'status'),
        getTableTimeSeries('sme_data_orders', 'amount', 'status'),
        getTableTimeSeries('cg_data_orders', 'amount', 'status'),
        getTableTimeSeries('data_gifting_orders', 'amount', 'status'),
        getTableTimeSeries('mtn_coupon_data_orders', 'amount', 'status'),
        getTableTimeSeries('mtn_sme_1_data_orders', 'amount', 'status'),
        getTableTimeSeries('mtn_sme_2_data_orders', 'amount', 'status'),
        getTableTimeSeries('cable_subscriptions', 'amount', 'status'),
        getTableTimeSeries('account_fundings', 'amount', 'status'),
        getTableTimeSeries('cryptos', 'amount', 'status'),
        getTableTimeSeries('gift_card_orders', 'price', 'order_status'),
      ]);

      // Merge all time series data by date
      const timeSeriesMap = {};
      const allTimeSeries = [
        ...airtimeTS, ...smeDataTS, ...cgDataTS, ...dataGiftingTS,
        ...mtnCouponTS, ...mtnSme1TS, ...mtnSme2TS,
        ...cableTS, ...accountFundingTS, ...cryptoTS, ...giftCardTS
      ];

      allTimeSeries.forEach(item => {
        const dateKey = item.date.toISOString ? item.date.toISOString().split('T')[0] : item.date;
        if (!timeSeriesMap[dateKey]) {
          timeSeriesMap[dateKey] = {
            date: dateKey,
            transactions: 0,
            revenue: 0,
            successful: 0,
            failed: 0,
          };
        }
        timeSeriesMap[dateKey].transactions += item.count;
        timeSeriesMap[dateKey].revenue += item.amount;
        timeSeriesMap[dateKey].successful += item.successful;
        timeSeriesMap[dateKey].failed += item.failed;
      });

      const timeSeries = Object.values(timeSeriesMap).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      // Helper to get service breakdown
      const getServiceBreakdown = async (tableName, serviceName, amountCol) => {
        try {
          const hasTable = await knex.schema.hasTable(tableName);
          if (!hasTable) return { service: serviceName, count: 0, revenue: 0 };

          const hasAmount = await knex.schema.hasColumn(tableName, amountCol);

          const result = await knex(tableName)
            .count('* as count')
            .modify(qb => {
              if (hasAmount) {
                qb.sum(knex.raw(`COALESCE(${amountCol}, 0)) as revenue`));
              } else {
                qb.select(knex.raw('0 as revenue'));
              }
            })
            .where('created_at', '>=', fromDate)
            .where('created_at', '<=', toDate)
            .first();

          return {
            service: serviceName,
            count: parseInt(result.count) || 0,
            revenue: parseFloat(result.revenue) || 0,
          };
        } catch (error) {
          console.error(`Error fetching breakdown for ${tableName}:`, error.message);
          return { service: serviceName, count: 0, revenue: 0 };
        }
      };

      // Get service breakdown from all tables
      const [
        airtimeBD,
        smeDataBD,
        cgDataBD,
        dataGiftingBD,
        mtnCouponBD,
        mtnSme1BD,
        mtnSme2BD,
        cableBD,
        accountFundingBD,
        cryptoBD,
        giftCardBD,
      ] = await Promise.all([
        getServiceBreakdown('airtime_orders', 'airtime', 'amount'),
        getServiceBreakdown('sme_data_orders', 'data', 'amount'),
        getServiceBreakdown('cg_data_orders', 'data', 'amount'),
        getServiceBreakdown('data_gifting_orders', 'data', 'amount'),
        getServiceBreakdown('mtn_coupon_data_orders', 'data', 'amount'),
        getServiceBreakdown('mtn_sme_1_data_orders', 'data', 'amount'),
        getServiceBreakdown('mtn_sme_2_data_orders', 'data', 'amount'),
        getServiceBreakdown('cable_subscriptions', 'cable', 'amount'),
        getServiceBreakdown('account_fundings', 'account_funding', 'amount'),
        getServiceBreakdown('cryptos', 'crypto', 'amount'),
        getServiceBreakdown('gift_card_orders', 'gift_card', 'price'),
      ]);

      // Aggregate by service
      const serviceMap = {};
      const allBreakdowns = [
        airtimeBD, smeDataBD, cgDataBD, dataGiftingBD,
        mtnCouponBD, mtnSme1BD, mtnSme2BD,
        cableBD, accountFundingBD, cryptoBD, giftCardBD
      ];

      allBreakdowns.forEach(item => {
        if (!serviceMap[item.service]) {
          serviceMap[item.service] = { service: item.service, count: 0, revenue: 0 };
        }
        serviceMap[item.service].count += item.count;
        serviceMap[item.service].revenue += item.revenue;
      });

      const serviceBreakdown = Object.values(serviceMap);

      ctx.send({
        success: true,
        filter,
        dateRange: { from: fromDate, to: toDate },
        data: {
          timeSeries,
          serviceBreakdown,
        },
      });
    } catch (error) {
      console.error('Chart data error:', error);
      ctx.send({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  /**
   * Get statistics for specific services
   */
  async getServiceStats(ctx) {
    try {
      const { service, dateFrom, dateTo, network, page = 1, pageSize = 25 } = ctx.query;

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const to = dateTo || new Date().toISOString().split('T')[0];

      const where = {
        stat_date: {
          $gte: from,
          $lte: to,
        },
      };

      if (service) where.service = service;
      if (network) where.network = network;

      const stats = await strapi.db.query('api::service-stat.service-stat').findMany({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: { stat_date: 'desc' },
      });

      const total = await strapi.db.query('api::service-stat.service-stat').count({ where });

      ctx.send({
        success: true,
        data: stats,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('Service stats error:', error);
      throw new ApplicationError('Failed to fetch service statistics');
    }
  },

  /**
   * Get revenue statistics and breakdown
   */
  async getRevenueStats(ctx) {
    try {
      const { dateFrom, dateTo, groupBy = 'service' } = ctx.query;

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const to = dateTo || new Date().toISOString().split('T')[0];

      const stats = await strapi.db.query('api::service-stat.service-stat').findMany({
        where: {
          stat_date: {
            $gte: from,
            $lte: to,
          },
        },
        orderBy: groupBy === 'date' ? { stat_date: 'asc' } : { service: 'asc' },
      });

      let revenue = {};

      if (groupBy === 'service') {
        stats.forEach(stat => {
          if (!revenue[stat.service]) {
            revenue[stat.service] = {
              total: 0,
              successful: 0,
              failed: 0,
              pending: 0,
              count: 0,
            };
          }
          revenue[stat.service].total += parseFloat(stat.total_amount);
          revenue[stat.service].successful += parseFloat(stat.successful_amount);
          revenue[stat.service].failed += parseFloat(stat.failed_amount);
          revenue[stat.service].pending += parseFloat(stat.pending_amount);
          revenue[stat.service].count += stat.total_transactions;
        });
      } else {
        stats.forEach(stat => {
          const date = stat.stat_date;
          if (!revenue[date]) {
            revenue[date] = {
              total: 0,
              count: 0,
              services: {},
            };
          }
          revenue[date].total += parseFloat(stat.total_amount);
          revenue[date].count += stat.total_transactions;
          revenue[date].services[stat.service] = parseFloat(stat.total_amount);
        });
      }

      ctx.send({
        success: true,
        groupBy,
        dateRange: { from, to },
        data: revenue,
      });
    } catch (error) {
      console.error('Revenue stats error:', error);
      throw new ApplicationError('Failed to fetch revenue statistics');
    }
  },

  /**
   * Get filtered transactions across all services
   */
  async getTransactions(ctx) {
    try {
      const { service, status, network, userId, dateFrom, dateTo, page = 1, pageSize = 25, search } = ctx.query;

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = dateTo || new Date().toISOString();

      const where = {
        createdAt: {
          $gte: from,
          $lte: to,
        },
      };

      if (service) where.service = service;
      if (status) where.status = status;
      if (network) where.network = network;
      if (userId) where.user = { id: parseInt(userId) };

      if (search) {
        where.$or = [
          { beneficiary: { $contains: search } },
          { description: { $contains: search } },
          { reference_id: { $contains: search } },
          { provider_reference: { $contains: search } },
        ];
      }

      const transactions = await strapi.db.query('api::optimized-transaction-history.optimized-transaction-history').findMany({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
        populate: ['user'],
      });

      const total = await strapi.db.query('api::optimized-transaction-history.optimized-transaction-history').count({ where });

      ctx.send({
        success: true,
        data: transactions.map(t => ({
          id: t.id,
          service: t.service,
          serviceSubtype: t.service_subtype,
          referenceId: t.reference_id,
          amount: t.amount,
          status: t.status,
          network: t.network,
          beneficiary: t.beneficiary,
          user: {
            id: t.user?.id,
            email: t.user?.email,
            username: t.user?.username,
          },
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      throw new ApplicationError('Failed to fetch transactions');
    }
  },

  /**
   * Get webhook logs for debugging
   */
  async getWebhookLogs(ctx) {
    try {
      const { provider, status, transactionId, page = 1, pageSize = 25 } = ctx.query;

      const where = {};
      if (provider) where.provider = provider;
      if (status) where.status = status;
      if (transactionId) where.transaction_id = transactionId;

      const logs = await strapi.db.query('api::webhook-log.webhook-log').findMany({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: { createdAt: 'desc' },
      });

      const total = await strapi.db.query('api::webhook-log.webhook-log').count({ where });

      ctx.send({
        success: true,
        data: logs.map(log => ({
          id: log.id,
          provider: log.provider,
          eventType: log.event_type,
          status: log.status,
          transactionId: log.transaction_id,
          errorMessage: log.error_message,
          createdAt: log.createdAt,
          processedAt: log.processed_at,
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('Get webhook logs error:', error);
      throw new ApplicationError('Failed to fetch webhook logs');
    }
  },

  /**
   * Get airtime analytics
   * Returns comprehensive statistics for airtime transactions
   */
  async getAirtimeAnalytics(ctx) {
    try {
      const { filter = 'month', dateFrom, dateTo } = ctx.query;
      
      // Calculate date range based on filter
      let fromDate, toDate;
      const now = new Date();
      
      switch(filter) {
        case 'today':
          fromDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          toDate = new Date(now.setHours(23, 59, 59, 999)).toISOString();
          break;
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          fromDate = startOfWeek.toISOString();
          toDate = new Date().toISOString();
          break;
        case 'month':
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          toDate = new Date().toISOString();
          break;
        case 'year':
          fromDate = new Date(now.getFullYear(), 0, 1).toISOString();
          toDate = new Date().toISOString();
          break;
        case 'custom':
          if (!dateFrom || !dateTo) {
            return ctx.badRequest('dateFrom and dateTo are required for custom filter');
          }
          fromDate = new Date(dateFrom).toISOString();
          toDate = new Date(dateTo).toISOString();
          break;
        default:
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          toDate = new Date().toISOString();
      }

      const knex = strapi.db.connection;

      // Check if table exists
      const tableExists = await knex.schema.hasTable('airtime_orders');
      if (!tableExists) {
        return ctx.send({
          success: true,
          filter,
          dateRange: { from: fromDate, to: toDate },
          data: {
            stats: {
              totalTransactions: 0,
              totalRevenue: 0,
              successRate: 0,
              pendingTransactions: 0,
              failedTransactions: 0,
              averageAmount: 0,
              topNetwork: null,
            },
            networkBreakdown: [],
            dailyTrend: [],
            recentTransactions: [],
          },
        });
      }

      // Get overall stats
      const overallStats = await knex('airtime_orders')
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('COUNT(*) as total_transactions'),
          knex.raw('SUM(COALESCE(amount, 0)) as total_revenue'),
          knex.raw('AVG(COALESCE(amount, 0)) as average_amount'),
          knex.raw('COUNT(CASE WHEN status IN (?, ?, ?, ?) THEN 1 END) as successful', ['delivered', 'completed', 'successful', 'success']),
          knex.raw('COUNT(CASE WHEN status IN (?, ?) THEN 1 END) as failed', ['failed', 'failure']),
          knex.raw('COUNT(CASE WHEN status IN (?, ?) THEN 1 END) as pending', ['pending', 'processing'])
        )
        .first();

      const totalTransactions = parseInt(overallStats.total_transactions) || 0;
      const successfulTransactions = parseInt(overallStats.successful) || 0;
      
      // Log for debugging
      console.log('Airtime Stats Debug:', {
        totalTransactions,
        successfulTransactions,
        overallStats
      });
      
      const successRate = totalTransactions > 0 
        ? parseFloat(((successfulTransactions / totalTransactions) * 100).toFixed(1))
        : 0;

      // Get network breakdown
      const networkBreakdown = await knex('airtime_orders')
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          'network',
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(COALESCE(amount, 0)) as revenue')
        )
        .groupBy('network')
        .orderBy('transactions', 'desc');

      const formattedNetworkBreakdown = networkBreakdown.map(row => ({
        network: row.network || 'Unknown',
        transactions: parseInt(row.transactions) || 0,
        revenue: parseFloat(row.revenue) || 0,
      }));

      // Get top network
      const topNetwork = formattedNetworkBreakdown.length > 0 
        ? formattedNetworkBreakdown[0].network 
        : null;

      // Get daily trend data
      const dailyTrend = await knex('airtime_orders')
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('DATE(created_at) as date'),
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(COALESCE(amount, 0)) as revenue')
        )
        .groupBy(knex.raw('DATE(created_at)'))
        .orderBy('date', 'asc');

      const formattedDailyTrend = dailyTrend.map(row => ({
        date: row.date,
        transactions: parseInt(row.transactions) || 0,
        revenue: parseFloat(row.revenue) || 0,
      }));

      // Get recent transactions
      const recentTransactions = await knex('airtime_orders')
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          'id',
          'beneficiary',
          'network',
          'amount',
          'status',
          'created_at'
        )
        .orderBy('created_at', 'desc')
        .limit(10);

      const formattedRecentTransactions = recentTransactions.map(tx => {
        // Mask phone number for privacy
        let maskedPhone = tx.beneficiary || 'N/A';
        if (maskedPhone.length > 4) {
          maskedPhone = maskedPhone.slice(0, 4) + '****' + maskedPhone.slice(-2);
        }

        return {
          id: tx.id,
          phone: maskedPhone,
          network: tx.network || 'Unknown',
          amount: parseFloat(tx.amount) || 0,
          status: tx.status || 'pending',
          time: tx.created_at,
        };
      });

      ctx.send({
        success: true,
        filter,
        dateRange: { from: fromDate, to: toDate },
        data: {
          stats: {
            totalTransactions,
            totalRevenue: parseFloat(overallStats.total_revenue) || 0,
            successRate: parseFloat(successRate),
            pendingTransactions: parseInt(overallStats.pending) || 0,
            failedTransactions: parseInt(overallStats.failed) || 0,
            averageAmount: parseFloat(overallStats.average_amount) || 0,
            topNetwork,
          },
          networkBreakdown: formattedNetworkBreakdown,
          dailyTrend: formattedDailyTrend,
          recentTransactions: formattedRecentTransactions,
        },
      });
    } catch (error) {
      console.error('Airtime analytics error:', error);
      ctx.send({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  /**
   * Get data analytics with network breakdown and trends
   * Aggregates all data order types (SME, Data Gifting, MTN SME 1, MTN Coupon, CG)
   */
  async getDataAnalytics(ctx) {
    try {
      const { filter = 'month', dateFrom, dateTo } = ctx.query;
      const knex = strapi.db.connection;

      // Calculate date range
      const now = new Date();
      let fromDate, toDate;

      if (filter === 'custom' && dateFrom && dateTo) {
        fromDate = new Date(dateFrom);
        toDate = new Date(dateTo);
      } else {
        toDate = new Date(); // Create a new date object for toDate
        switch (filter) {
          case 'today':
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 7);
            break;
          case 'year':
            fromDate = new Date();
            fromDate.setFullYear(fromDate.getFullYear() - 1);
            break;
          case 'month':
          default:
            fromDate = new Date();
            fromDate.setMonth(fromDate.getMonth() - 1);
        }
      }

      // Data order tables to aggregate
      const dataTables = [
        'sme_data_orders',
        'data_gifting_orders',
        'mtn_sme_1_data_orders',
        'mtn_coupon_data_orders',
        'cg_data_orders'
      ];

      // Check if tables have any data
      let hasData = false;
      for (const table of dataTables) {
        const count = await knex(table)
          .where('created_at', '>=', fromDate)
          .where('created_at', '<=', toDate)
          .count('* as count')
          .first();
        if (parseInt(count.count) > 0) {
          hasData = true;
          break;
        }
      }

      if (!hasData) {
        return ctx.send({
          success: true,
          filter,
          dateRange: { from: fromDate, to: toDate },
          data: {
            stats: {
              totalTransactions: 0,
              totalRevenue: 0,
              successRate: 0,
              pendingTransactions: 0,
              failedTransactions: 0,
              averageAmount: 0,
              topNetwork: null,
            },
            networkBreakdown: [],
            dailyTrend: [],
            recentTransactions: [],
          },
        });
      }

      // Build UNION query for all stats
      const unionQueries = dataTables.map(table => 
        knex(table)
          .where('created_at', '>=', fromDate)
          .where('created_at', '<=', toDate)
          .select(
            knex.raw('COUNT(*) as total_transactions'),
            knex.raw('SUM(COALESCE(amount, 0)) as total_revenue'),
            knex.raw('AVG(COALESCE(amount, 0)) as average_amount'),
            knex.raw('COUNT(CASE WHEN status IN (?, ?, ?, ?) THEN 1 END) as successful', ['delivered', 'completed', 'successful', 'success']),
            knex.raw('COUNT(CASE WHEN status IN (?, ?) THEN 1 END) as failed', ['failed', 'failure']),
            knex.raw('COUNT(CASE WHEN status IN (?, ?) THEN 1 END) as pending', ['pending', 'processing'])
          )
      );

      const allStats = await Promise.all(unionQueries);
      
      // Aggregate all stats (each query returns an array with one row)
      const overallStats = allStats.reduce((acc, statArray) => {
        const stat = statArray[0]; // Get the first (and only) row
        return {
          total_transactions: (parseInt(acc.total_transactions) || 0) + (parseInt(stat.total_transactions) || 0),
          total_revenue: (parseFloat(acc.total_revenue) || 0) + (parseFloat(stat.total_revenue) || 0),
          average_amount: (parseFloat(acc.average_amount) || 0) + (parseFloat(stat.average_amount) || 0),
          successful: (parseInt(acc.successful) || 0) + (parseInt(stat.successful) || 0),
          failed: (parseInt(acc.failed) || 0) + (parseInt(stat.failed) || 0),
          pending: (parseInt(acc.pending) || 0) + (parseInt(stat.pending) || 0),
        };
      }, {});

      const totalTransactions = parseInt(overallStats.total_transactions) || 0;
      const successfulTransactions = parseInt(overallStats.successful) || 0;
      const averageAmount = allStats.length > 0 
        ? overallStats.average_amount / allStats.length 
        : 0;

   

      const successRate = totalTransactions > 0 
        ? parseFloat(((successfulTransactions / totalTransactions) * 100).toFixed(1))
        : 0;

      // Get network breakdown from all tables
      const networkBreakdownQueries = dataTables.map(table =>
        knex(table)
          .where('created_at', '>=', fromDate)
          .where('created_at', '<=', toDate)
          .select(
            'network',
            knex.raw('COUNT(*) as transactions'),
            knex.raw('SUM(COALESCE(amount, 0)) as revenue')
          )
          .groupBy('network')
      );

      const allNetworkBreakdowns = await Promise.all(networkBreakdownQueries);
      const networkMap = {};

      allNetworkBreakdowns.flat().forEach(row => {
        const network = row.network || 'Unknown';
        if (!networkMap[network]) {
          networkMap[network] = { network, transactions: 0, revenue: 0 };
        }
        networkMap[network].transactions += parseInt(row.transactions) || 0;
        networkMap[network].revenue += parseFloat(row.revenue) || 0;
      });

      const networkBreakdown = Object.values(networkMap)
        .sort((a, b) => b.transactions - a.transactions);

      const topNetwork = networkBreakdown[0]?.network || null;

      // Get daily trend from all tables
      const dailyTrendQueries = dataTables.map(table =>
        knex(table)
          .where('created_at', '>=', fromDate)
          .where('created_at', '<=', toDate)
          .select(
            knex.raw('DATE(created_at) as date'),
            knex.raw('COUNT(*) as transactions'),
            knex.raw('SUM(COALESCE(amount, 0)) as revenue')
          )
          .groupBy(knex.raw('DATE(created_at)'))
          .orderBy('date', 'asc')
      );

      const allDailyTrends = await Promise.all(dailyTrendQueries);
      const dailyMap = {};

      allDailyTrends.flat().forEach(row => {
        const date = row.date;
        if (!dailyMap[date]) {
          dailyMap[date] = { date, transactions: 0, revenue: 0 };
        }
        dailyMap[date].transactions += parseInt(row.transactions) || 0;
        dailyMap[date].revenue += parseFloat(row.revenue) || 0;
      });

      const dailyTrend = Object.values(dailyMap)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Get recent transactions from all tables
      const recentTransactionsQueries = dataTables.map(table =>
        knex(table)
          .where('created_at', '>=', fromDate)
          .where('created_at', '<=', toDate)
          .select(
            'id',
            'beneficiary',
            'network',
            'amount',
            'status',
            'created_at',
            knex.raw(`'${table}' as source_table`)
          )
          .orderBy('created_at', 'desc')
          .limit(3) // Get top 3 from each table
      );

      const allRecentTransactions = await Promise.all(recentTransactionsQueries);
      const recentTransactions = allRecentTransactions
        .flat()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10); // Get top 10 overall

      const formattedRecentTransactions = recentTransactions.map(tx => {
        let maskedPhone = tx.beneficiary || 'N/A';
        if (maskedPhone.length > 4) {
          maskedPhone = maskedPhone.slice(0, 4) + '****' + maskedPhone.slice(-2);
        }

        return {
          id: tx.id,
          phone: maskedPhone,
          network: tx.network || 'Unknown',
          amount: parseFloat(tx.amount) || 0,
          status: tx.status || 'pending',
          time: tx.created_at,
        };
      });

      ctx.send({
        success: true,
        filter,
        dateRange: { from: fromDate, to: toDate },
        data: {
          stats: {
            totalTransactions,
            totalRevenue: parseFloat(overallStats.total_revenue) || 0,
            successRate: parseFloat(successRate),
            pendingTransactions: parseInt(overallStats.pending) || 0,
            failedTransactions: parseInt(overallStats.failed) || 0,
            averageAmount: parseFloat(averageAmount) || 0,
            topNetwork,
          },
          networkBreakdown,
          dailyTrend,
          recentTransactions: formattedRecentTransactions,
        },
      });
    } catch (error) {
      console.error('Data analytics error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get all data transactions from all data order tables with search, filter, and sort
   * Aggregates: SME Data, Data Gifting, MTN SME 1, MTN Coupon, CG Data
   */
  async getDataTransactions(ctx) {
    try {
      const { 
        search = '', 
        status, 
        network, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1,
        pageSize = 20
      } = ctx.query;

      const knex = strapi.db.connection;
      
      // Data order tables to aggregate with their request_id column names
      const dataTables = [
        { table: 'sme_data_orders', type: 'SME Data', refColumn: 'ref' },
        { table: 'data_gifting_orders', type: 'Data Gifting', refColumn: 'request_id' },
        { table: 'mtn_sme_1_data_orders', type: 'MTN SME 1', refColumn: 'ref' },
        { table: 'mtn_coupon_data_orders', type: 'MTN Coupon', refColumn: 'ref' },
        { table: 'cg_data_orders', type: 'CG Data', refColumn: 'request_id' }
      ];

      // Build union query for all tables
      const queries = dataTables.map(({ table, type, refColumn }) => {
        let query = knex(table).select(
          'id',
          'beneficiary',
          'network',
          'amount',
          'status',
          knex.raw(`?? as request_id`, [refColumn]),
          knex.raw('? as service_type', [type]),
          knex.raw('? as source_table', [table]),
          'created_at as createdAt',
          'updated_at as updatedAt'
        );

        // Apply search filter (case-insensitive)
        if (search) {
          query = query.where((builder) => {
            builder
              .whereRaw('LOWER(beneficiary) LIKE ?', [`%${search.toLowerCase()}%`])
              .orWhere('id', '=', search)
              .orWhereRaw(`LOWER(??) LIKE ?`, [refColumn, `%${search.toLowerCase()}%`]);
          });
        }

        // Apply status filter
        if (status && status !== 'all') {
          query = query.where('status', status);
        }

        // Apply network filter (case-insensitive)
        if (network && network !== 'all') {
          query = query.whereRaw('LOWER(network) = ?', [network.toLowerCase()]);
        }

        return query;
      });

      // Union all queries
      let unionQuery = queries[0];
      for (let i = 1; i < queries.length; i++) {
        unionQuery = unionQuery.union(queries[i]);
      }

      // Wrap union in subquery for counting
      const countResult = await knex.from(knex.raw(`(${unionQuery.toString()}) as combined`))
        .count('* as count')
        .first();
      const totalCount = parseInt(countResult.count);

      // Apply sorting to union
      const sortField = sortBy === 'createdAt' ? 'createdAt' : sortBy;
      const sortedQuery = knex.from(knex.raw(`(${unionQuery.toString()}) as combined`))
        .select('*')
        .orderBy(sortField, sortOrder);

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const transactions = await sortedQuery
        .limit(parseInt(pageSize))
        .offset(offset);

      ctx.send({
        success: true,
        data: transactions,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(totalCount / parseInt(pageSize)),
          total: totalCount,
        },
      });
    } catch (error) {
      console.error('Data transactions fetch error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get TV & Cables analytics with subscription type breakdown and trends
   */
  async getTvCablesAnalytics(ctx) {
    try {
      const { filter = 'month', dateFrom, dateTo } = ctx.query;
      const knex = strapi.db.connection;

      // Calculate date range
      const now = new Date();
      let fromDate, toDate;

      if (filter === 'custom' && dateFrom && dateTo) {
        fromDate = new Date(dateFrom);
        toDate = new Date(dateTo);
      } else {
        toDate = new Date();
        switch (filter) {
          case 'today':
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 7);
            break;
          case 'year':
            fromDate = new Date();
            fromDate.setFullYear(fromDate.getFullYear() - 1);
            break;
          case 'month':
          default:
            fromDate = new Date();
            fromDate.setMonth(fromDate.getMonth() - 1);
        }
      }

      const table = 'tvcables-orders';

      // Get overall stats
      const statsResult = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('COUNT(*) as total_transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as total_revenue'),
          knex.raw('AVG(CAST(amount AS DECIMAL)) as average_amount'),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as successful', ['delivered']),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as failed', ['failed']),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending', ['pending'])
        )
        .first();

      const totalTransactions = parseInt(statsResult.total_transactions) || 0;
      const successfulTransactions = parseInt(statsResult.successful) || 0;
      const successRate = totalTransactions > 0 
        ? parseFloat(((successfulTransactions / totalTransactions) * 100).toFixed(1))
        : 0;

      // Get subscription type breakdown
      const subscriptionBreakdown = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          'subscription_type',
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as revenue')
        )
        .groupBy('subscription_type')
        .orderBy('transactions', 'desc');

      const topSubscription = subscriptionBreakdown[0]?.subscription_type || null;

      // Get daily trend
      const dailyTrend = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('DATE(created_at) as date'),
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as revenue')
        )
        .groupBy(knex.raw('DATE(created_at)'))
        .orderBy('date', 'asc');

      // Get recent transactions
      const recentTransactions = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select('id', 'phone', 'subscription_type', 'amount', 'status', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(10);

      const formattedRecentTransactions = recentTransactions.map(tx => {
        let maskedPhone = tx.phone || 'N/A';
        if (maskedPhone.length > 4) {
          maskedPhone = maskedPhone.slice(0, 4) + '****' + maskedPhone.slice(-2);
        }

        return {
          id: tx.id,
          phone: maskedPhone,
          subscription: tx.subscription_type || 'Unknown',
          amount: parseFloat(tx.amount) || 0,
          status: tx.status || 'pending',
          time: tx.created_at,
        };
      });

      ctx.send({
        success: true,
        filter,
        dateRange: { from: fromDate, to: toDate },
        data: {
          stats: {
            totalTransactions,
            totalRevenue: parseFloat(statsResult.total_revenue) || 0,
            successRate: parseFloat(successRate),
            pendingTransactions: parseInt(statsResult.pending) || 0,
            failedTransactions: parseInt(statsResult.failed) || 0,
            averageAmount: parseFloat(statsResult.average_amount) || 0,
            topSubscription,
          },
          subscriptionBreakdown,
          dailyTrend,
          recentTransactions: formattedRecentTransactions,
        },
      });
    } catch (error) {
      console.error('TV & Cables analytics error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get all TV & Cables transactions with search, filter, and sort
   */
  async getTvCablesTransactions(ctx) {
    try {
      const { 
        search = '', 
        status, 
        subscription, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1,
        pageSize = 20
      } = ctx.query;

      const knex = strapi.db.connection;
      const table = 'tvcables-orders';

      // Build query
      let query = knex(table).select(
        'id',
        'phone',
        'billers_code as billersCode',
        'subscription_type',
        'amount',
        'status',
        'request_id',
        'service_id as serviceID',
        'variation_code',
        'created_at as createdAt',
        'updated_at as updatedAt'
      );

      // Apply search filter (case-insensitive)
      if (search) {
        query = query.where((builder) => {
          builder
            .whereRaw('LOWER(phone) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhere('id', '=', search)
            .orWhereRaw('LOWER(request_id) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhereRaw('LOWER(billers_code) LIKE ?', [`%${search.toLowerCase()}%`]);
        });
      }

      // Apply status filter
      if (status && status !== 'all') {
        query = query.where('status', status);
      }

      // Apply subscription type filter (case-insensitive partial match)
      if (subscription && subscription !== 'all') {
        query = query.whereRaw('LOWER(subscription_type) LIKE ?', [`%${subscription.toLowerCase()}%`]);
      }

      // Get total count
      const countQuery = knex(table);
      if (search) {
        countQuery.where((builder) => {
          builder
            .whereRaw('LOWER(phone) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhere('id', '=', search)
            .orWhereRaw('LOWER(request_id) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhereRaw('LOWER(billers_code) LIKE ?', [`%${search.toLowerCase()}%`]);
        });
      }
      if (status && status !== 'all') {
        countQuery.where('status', status);
      }
      if (subscription && subscription !== 'all') {
        countQuery.whereRaw('LOWER(subscription_type) LIKE ?', [`%${subscription.toLowerCase()}%`]);
      }

      const countResult = await countQuery.count('* as count').first();
      const totalCount = parseInt(countResult.count);

      // Apply sorting
      const sortField = sortBy === 'createdAt' ? 'created_at' : sortBy;
      query = query.orderBy(sortField, sortOrder);

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const transactions = await query
        .limit(parseInt(pageSize))
        .offset(offset);

      ctx.send({
        success: true,
        data: transactions,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(totalCount / parseInt(pageSize)),
          total: totalCount,
        },
      });
    } catch (error) {
      console.error('TV & Cables transactions fetch error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get Electricity analytics with provider breakdown and trends
   */
  async getElectricityAnalytics(ctx) {
    try {
      const { filter = 'month', dateFrom, dateTo } = ctx.query;
      const knex = strapi.db.connection;

      // Calculate date range
      const now = new Date();
      let fromDate, toDate;

      if (filter === 'custom' && dateFrom && dateTo) {
        fromDate = new Date(dateFrom);
        toDate = new Date(dateTo);
      } else {
        toDate = new Date();
        switch (filter) {
          case 'today':
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 7);
            break;
          case 'year':
            fromDate = new Date();
            fromDate.setFullYear(fromDate.getFullYear() - 1);
            break;
          case 'month':
          default:
            fromDate = new Date();
            fromDate.setMonth(fromDate.getMonth() - 1);
        }
      }

      const table = 'electricity-orders';

      // Get overall stats
      const statsResult = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('COUNT(*) as total_transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as total_revenue'),
          knex.raw('AVG(CAST(amount AS DECIMAL)) as average_amount'),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as successful', ['Successful']),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as failed', ['Failed']),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending', ['Pending'])
        )
        .first();

      const totalTransactions = parseInt(statsResult.total_transactions) || 0;
      const successfulTransactions = parseInt(statsResult.successful) || 0;
      const successRate = totalTransactions > 0 
        ? parseFloat(((successfulTransactions / totalTransactions) * 100).toFixed(1))
        : 0;

      // Get provider breakdown (by service_id which contains actual provider code like AEDC, EKEDC)
      const providerBreakdown = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          'service_id as variation_code',
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as revenue')
        )
        .groupBy('service_id')
        .orderBy('transactions', 'desc');

      const topProvider = providerBreakdown[0]?.variation_code || null;

      // Get daily trend
      const dailyTrend = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('DATE(created_at) as date'),
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as revenue')
        )
        .groupBy(knex.raw('DATE(created_at)'))
        .orderBy('date', 'asc');

      // Get recent transactions
      const recentTransactions = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select('id', 'phone', 'service_id', 'amount', 'status', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(10);

      const formattedRecentTransactions = recentTransactions.map(tx => {
        let maskedPhone = tx.phone || 'N/A';
        if (maskedPhone.length > 4) {
          maskedPhone = maskedPhone.slice(0, 4) + '****' + maskedPhone.slice(-2);
        }

        return {
          id: tx.id,
          phone: maskedPhone,
          provider: tx.service_id || 'Unknown',
          amount: parseFloat(tx.amount) || 0,
          status: tx.status || 'Pending',
          time: tx.created_at,
        };
      });

      ctx.send({
        success: true,
        filter,
        dateRange: { from: fromDate, to: toDate },
        data: {
          stats: {
            totalTransactions,
            totalRevenue: parseFloat(statsResult.total_revenue) || 0,
            successRate: parseFloat(successRate),
            pendingTransactions: parseInt(statsResult.pending) || 0,
            failedTransactions: parseInt(statsResult.failed) || 0,
            averageAmount: parseFloat(statsResult.average_amount) || 0,
            topProvider,
          },
          providerBreakdown,
          dailyTrend,
          recentTransactions: formattedRecentTransactions,
        },
      });
    } catch (error) {
      console.error('Electricity analytics error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get all Electricity transactions with search, filter, and sort
   */
  async getElectricityTransactions(ctx) {
    try {
      const { 
        search = '', 
        status, 
        provider, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1,
        pageSize = 20
      } = ctx.query;

      const knex = strapi.db.connection;
      const table = 'electricity-orders';

      // Build query
      let query = knex(table).select(
        'id',
        'phone',
        'billers_code as billersCode',
        'service_id as variation_code',
        'amount',
        'status',
        'request_id',
        'service_id as serviceID',
        'purchased_token',
        'created_at as createdAt',
        'updated_at as updatedAt'
      );

      // Apply search filter (case-insensitive)
      if (search) {
        query = query.where((builder) => {
          builder
            .whereRaw('LOWER(phone) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhere('id', '=', search)
            .orWhereRaw('LOWER(request_id) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhereRaw('LOWER(billers_code) LIKE ?', [`%${search.toLowerCase()}%`]);
        });
      }

      // Apply status filter
      if (status && status !== 'all') {
        query = query.where('status', status);
      }

      // Apply provider filter (case-insensitive partial match) - use service_id for actual provider
      if (provider && provider !== 'all') {
        query = query.whereRaw('LOWER(service_id) LIKE ?', [`%${provider.toLowerCase()}%`]);
      }

      // Get total count
      const countQuery = knex(table);
      if (search) {
        countQuery.where((builder) => {
          builder
            .whereRaw('LOWER(phone) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhere('id', '=', search)
            .orWhereRaw('LOWER(request_id) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhereRaw('LOWER(billers_code) LIKE ?', [`%${search.toLowerCase()}%`]);
        });
      }
      if (status && status !== 'all') {
        countQuery.where('status', status);
      }
      if (provider && provider !== 'all') {
        countQuery.whereRaw('LOWER(service_id) LIKE ?', [`%${provider.toLowerCase()}%`]);
      }

      const countResult = await countQuery.count('* as count').first();
      const totalCount = parseInt(countResult.count);

      // Apply sorting
      const sortField = sortBy === 'createdAt' ? 'created_at' : sortBy;
      query = query.orderBy(sortField, sortOrder);

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const transactions = await query
        .limit(parseInt(pageSize))
        .offset(offset);

      ctx.send({
        success: true,
        data: transactions,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(totalCount / parseInt(pageSize)),
          total: totalCount,
        },
      });
    } catch (error) {
      console.error('Electricity transactions fetch error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get Education (Exam Pins) analytics with exam type breakdown and trends
   */
  async getEducationAnalytics(ctx) {
    try {
      const { filter = 'month', dateFrom, dateTo } = ctx.query;
      const knex = strapi.db.connection;

      // Calculate date range
      const now = new Date();
      let fromDate, toDate;

      if (filter === 'custom' && dateFrom && dateTo) {
        fromDate = new Date(dateFrom);
        toDate = new Date(dateTo);
      } else {
        toDate = new Date();
        switch (filter) {
          case 'today':
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 7);
            break;
          case 'year':
            fromDate = new Date();
            fromDate.setFullYear(fromDate.getFullYear() - 1);
            break;
          case 'month':
          default:
            fromDate = new Date();
            fromDate.setMonth(fromDate.getMonth() - 1);
        }
      }

      const table = 'exam-pin-orders';

      // Get overall stats
      const statsResult = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('COUNT(*) as total_transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as total_revenue'),
          knex.raw('AVG(CAST(amount AS DECIMAL)) as average_amount'),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as successful', ['sucessful']),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as failed', ['failed']),
          knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending', ['pending'])
        )
        .first();

      const totalTransactions = parseInt(statsResult.total_transactions) || 0;
      const successfulTransactions = parseInt(statsResult.successful) || 0;
      const successRate = totalTransactions > 0 
        ? parseFloat(((successfulTransactions / totalTransactions) * 100).toFixed(1))
        : 0;

      // Get exam type breakdown (by service_id which contains exam types like WAEC, JAMB, NECO)
      const examTypeBreakdown = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          'service_id as variation_code',
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as revenue')
        )
        .groupBy('service_id')
        .orderBy('transactions', 'desc');

      const topExamType = examTypeBreakdown[0]?.variation_code || null;

      // Get daily trend
      const dailyTrend = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select(
          knex.raw('DATE(created_at) as date'),
          knex.raw('COUNT(*) as transactions'),
          knex.raw('SUM(CAST(amount AS DECIMAL)) as revenue')
        )
        .groupBy(knex.raw('DATE(created_at)'))
        .orderBy('date', 'asc');

      // Get recent transactions
      const recentTransactions = await knex(table)
        .where('created_at', '>=', fromDate)
        .where('created_at', '<=', toDate)
        .select('id', 'phone', 'service_id', 'amount', 'status', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(10);

      const formattedRecentTransactions = recentTransactions.map(tx => {
        let maskedPhone = tx.phone || 'N/A';
        if (maskedPhone.length > 4) {
          maskedPhone = maskedPhone.slice(0, 4) + '****' + maskedPhone.slice(-2);
        }

        return {
          id: tx.id,
          phone: maskedPhone,
          examType: tx.service_id || 'Unknown',
          amount: parseFloat(tx.amount) || 0,
          status: tx.status || 'pending',
          time: tx.created_at,
        };
      });

      ctx.send({
        success: true,
        filter,
        dateRange: { from: fromDate, to: toDate },
        data: {
          stats: {
            totalTransactions,
            totalRevenue: parseFloat(statsResult.total_revenue) || 0,
            successRate: parseFloat(successRate),
            pendingTransactions: parseInt(statsResult.pending) || 0,
            failedTransactions: parseInt(statsResult.failed) || 0,
            averageAmount: parseFloat(statsResult.average_amount) || 0,
            topExamType,
          },
          examTypeBreakdown,
          dailyTrend,
          recentTransactions: formattedRecentTransactions,
        },
      });
    } catch (error) {
      console.error('Education analytics error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  /**
   * Get all Education (Exam Pins) transactions with search, filter, and sort
   */
  async getEducationTransactions(ctx) {
    try {
      const { 
        search = '', 
        status, 
        examType, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1,
        pageSize = 20
      } = ctx.query;

      const knex = strapi.db.connection;
      const table = 'exam-pin-orders';

      // Build query
      let query = knex(table).select(
        'id',
        'phone',
        'service_id as variation_code',
        'amount',
        'status',
        'request_id',
        'service_id as serviceID',
        'purchased_pin',
        'created_at as createdAt',
        'updated_at as updatedAt'
      );

      // Apply search filter (case-insensitive)
      if (search) {
        query = query.where((builder) => {
          builder
            .whereRaw('LOWER(phone) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhere('id', '=', search)
            .orWhereRaw('LOWER(request_id) LIKE ?', [`%${search.toLowerCase()}%`]);
        });
      }

      // Apply status filter
      if (status && status !== 'all') {
        query = query.where('status', status);
      }

      // Apply exam type filter (case-insensitive partial match) - use service_id for exam type
      if (examType && examType !== 'all') {
        query = query.whereRaw('LOWER(service_id) LIKE ?', [`%${examType.toLowerCase()}%`]);
      }

      // Get total count
      const countQuery = knex(table);
      if (search) {
        countQuery.where((builder) => {
          builder
            .whereRaw('LOWER(phone) LIKE ?', [`%${search.toLowerCase()}%`])
            .orWhere('id', '=', search)
            .orWhereRaw('LOWER(request_id) LIKE ?', [`%${search.toLowerCase()}%`]);
        });
      }
      if (status && status !== 'all') {
        countQuery.where('status', status);
      }
      if (examType && examType !== 'all') {
        countQuery.whereRaw('LOWER(service_id) LIKE ?', [`%${examType.toLowerCase()}%`]);
      }

      const countResult = await countQuery.count('* as count').first();
      const totalCount = parseInt(countResult.count);

      // Apply sorting
      const sortField = sortBy === 'createdAt' ? 'created_at' : sortBy;
      query = query.orderBy(sortField, sortOrder);

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const transactions = await query
        .limit(parseInt(pageSize))
        .offset(offset);

      ctx.send({
        success: true,
        data: transactions,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(totalCount / parseInt(pageSize)),
          total: totalCount,
        },
      });
    } catch (error) {
      console.error('Education transactions fetch error:', error);
      ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  // User Analytics
  async getUserAnalytics(ctx) {
    try {
      const { dateFrom, dateTo } = ctx.query;

      // Build date filter
      let dateFilter = '';
      const params = [];
      if (dateFrom && dateTo) {
        dateFilter = 'WHERE u.created_at BETWEEN $1 AND $2';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        dateFilter = 'WHERE u.created_at >= $1';
        params.push(dateFrom);
      } else if (dateTo) {
        dateFilter = 'WHERE u.created_at <= $1';
        params.push(dateTo);
      }

      // Total users count
      const totalResult = await strapi.db.connection.raw(`
        SELECT COUNT(*)::integer as total
        FROM up_users u
        ${dateFilter}
      `, params);
      const totalUsers = totalResult.rows[0]?.total || 0;

      // Active users (users with transactions in the last 30 days based on phone numbers)
      // Note: Different tables use different column names for phone
      const activeResult = await strapi.db.connection.raw(`
        SELECT COUNT(DISTINCT phone)::integer as active
        FROM (
          SELECT beneficiary as phone FROM airtime_orders WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION
          SELECT beneficiary as phone FROM data_gifting_orders WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION
          SELECT phone FROM "tvcables-orders" WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION
          SELECT phone FROM "electricity-orders" WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION
          SELECT phone FROM "exam-pin-orders" WHERE created_at >= NOW() - INTERVAL '30 days'
        ) as active_users
      `);
      const activeUsers = activeResult.rows[0]?.active || 0;

      // Blocked users
      const blockedResult = await strapi.db.connection.raw(`
        SELECT COUNT(*)::integer as blocked
        FROM up_users u
        WHERE u.blocked = true
        ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}
      `, params);
      const blockedUsers = blockedResult.rows[0]?.blocked || 0;

      // Users with transaction pin
      const pinResult = await strapi.db.connection.raw(`
        SELECT COUNT(*)::integer as with_pin
        FROM up_users u
        WHERE u.transaction_pin IS NOT NULL
        ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}
      `, params);
      const usersWithPin = pinResult.rows[0]?.with_pin || 0;

      // Users with biometric enabled
      const biometricResult = await strapi.db.connection.raw(`
        SELECT COUNT(*)::integer as with_biometric
        FROM up_users u
        WHERE u.biometric_enabled = true
        ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}
      `, params);
      const usersWithBiometric = biometricResult.rows[0]?.with_biometric || 0;

      // New users today
      const todayResult = await strapi.db.connection.raw(`
        SELECT COUNT(*)::integer as today
        FROM up_users u
        WHERE DATE(u.created_at) = CURRENT_DATE
      `);
      const newUsersToday = todayResult.rows[0]?.today || 0;

      // User growth over time (daily for last 30 days)
      const growthResult = await strapi.db.connection.raw(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::integer as count
        FROM up_users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      // Total account balance across all users
      const balanceResult = await strapi.db.connection.raw(`
        SELECT 
          COALESCE(SUM(CAST(account_balance AS DECIMAL)), 0) as total_balance
        FROM up_users
        ${dateFilter}
      `, params);
      const totalBalance = parseFloat(balanceResult.rows[0]?.total_balance || 0);

      // Recent user registrations
      const recentResult = await strapi.db.connection.raw(`
        SELECT 
          id,
          username,
          email,
          phone_number,
          first_name,
          last_name,
          created_at,
          blocked,
          confirmed,
          transaction_pin,
          account_balance
        FROM up_users
        ${dateFilter}
        ORDER BY created_at DESC
        LIMIT 10
      `, params);

      return ctx.send({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          blockedUsers,
          usersWithPin,
          usersWithBiometric,
          newUsersToday,
          totalBalance,
          userGrowth: growthResult.rows,
          recentUsers: recentResult.rows.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone_number,
            firstName: user.first_name,
            lastName: user.last_name,
            balance: parseFloat(user.account_balance || 0),
            hasPin: user.transaction_pin !== null,
            blocked: user.blocked,
            confirmed: user.confirmed,
            createdAt: user.created_at,
          })),
        },
      }, 200);
    } catch (error) {
      strapi.log.error('Error in getUserAnalytics:', error);
      return ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },

  // Get Users List with filters
  async getUsersList(ctx) {
    try {
      const { 
        search = '', 
        status = 'all', 
        hasPin = 'all',
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1, 
        pageSize = 20 
      } = ctx.query;

      const offset = (page - 1) * pageSize;
      const params = [];
      let paramIndex = 1;

      // Build WHERE clause
      let whereConditions = [];
      
      // Search filter
      if (search) {
        whereConditions.push(`(
          u.username ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          u.phone_number ILIKE $${paramIndex} OR
          u.first_name ILIKE $${paramIndex} OR
          u.last_name ILIKE $${paramIndex} OR
          CAST(u.id AS TEXT) ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Status filter
      if (status === 'active') {
        whereConditions.push('u.blocked = false AND u.confirmed = true');
      } else if (status === 'blocked') {
        whereConditions.push('u.blocked = true');
      } else if (status === 'unconfirmed') {
        whereConditions.push('u.confirmed = false');
      }

      // Transaction pin filter
      if (hasPin === 'true') {
        whereConditions.push('u.transaction_pin IS NOT NULL');
      } else if (hasPin === 'false') {
        whereConditions.push('u.transaction_pin IS NULL');
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Sort mapping
      const sortColumns = {
        createdAt: 'u.created_at',
        username: 'u.username',
        email: 'u.email',
        balance: 'u."AccountBalance"',
      };
      const sortColumn = sortColumns[sortBy] || 'u.created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countResult = await strapi.db.connection.raw(`
        SELECT COUNT(*)::integer as total
        FROM up_users u
        ${whereClause}
      `, params);
      const total = countResult.rows[0]?.total || 0;

      // Get users
      const limitParams = [...params, parseInt(pageSize), offset];
      const limitIndex = params.length + 1;
      const offsetIndex = params.length + 2;
      const usersResult = await strapi.db.connection.raw(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.phone_number,
          u.first_name,
          u.last_name,
          u.account_balance,
          u.blocked,
          u.confirmed,
          u.transaction_pin,
          u.biometric_enabled,
          u.created_at,
          u.updated_at
        FROM up_users u
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `, limitParams);

      return ctx.send({
        success: true,
        data: usersResult.rows.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone_number,
          firstName: user.first_name,
          lastName: user.last_name,
          balance: parseFloat(user.account_balance || 0),
          blocked: user.blocked,
          confirmed: user.confirmed,
          hasPin: user.transaction_pin !== null,
          biometricEnabled: user.biometric_enabled,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      }, 200);
    } catch (error) {
      strapi.log.error('Error in getUsersList:', error);
      return ctx.send({
        success: false,
        error: error.message,
      }, 500);
    }
  },
};
