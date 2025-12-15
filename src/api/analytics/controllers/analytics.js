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
      const [totalUsers, recentAirtime, recentData, recentCable, recentElectricity] = await Promise.all([
        strapi.db.query('plugin::users-permissions.user').count(),
        strapi.db.query('api::airtime-order.airtime-order').findMany({
          where: whereDate,
          limit: 3,
          orderBy: { createdAt: 'desc' },
          populate: ['user'],
        }).catch(() => []),
        strapi.db.query('api::sme-data-order.sme-data-order').findMany({
          where: whereDate,
          limit: 3,
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
      ]);

      // Combine and sort recent transactions
      const recentTransactions = [
        ...recentAirtime.map(t => ({ ...t, service: 'airtime', amount: t.amount })),
        ...recentData.map(t => ({ ...t, service: 'data', amount: t.amount })),
        ...recentCable.map(t => ({ ...t, service: 'cable', amount: t.amount || t.amount_to_pay })),
        ...recentElectricity.map(t => ({ ...t, service: 'electricity', amount: t.amount || t.amount_to_pay })),
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

      // Calculate success rate
      const successRate = aggregated.total_transactions > 0
        ? ((aggregated.successful_transactions / aggregated.total_transactions) * 100).toFixed(2)
        : 0;

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
};
