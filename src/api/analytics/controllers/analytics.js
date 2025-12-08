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
      const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = dateTo ? new Date(dateTo) : new Date();

      // Get stats for all services
      const serviceStats = await strapi.db.query('api::service-stat.service-stat').findMany({
        where: {
          stat_date: {
            $gte: from,
            $lte: to,
          },
        },
      });

      // Aggregate by service
      const aggregated = {
        total_transactions: 0,
        total_amount: 0,
        successful_transactions: 0,
        failed_transactions: 0,
        pending_transactions: 0,
        unique_users: new Set(),
        by_service: {},
      };

      serviceStats.forEach(stat => {
        aggregated.total_transactions += stat.total_transactions;
        aggregated.total_amount += parseFloat(stat.total_amount);
        aggregated.successful_transactions += stat.successful_transactions;
        aggregated.failed_transactions += stat.failed_transactions;
        aggregated.pending_transactions += stat.pending_transactions;

        if (!aggregated.by_service[stat.service]) {
          aggregated.by_service[stat.service] = {
            transactions: 0,
            amount: 0,
            successful: 0,
            failed: 0,
          };
        }

        aggregated.by_service[stat.service].transactions += stat.total_transactions;
        aggregated.by_service[stat.service].amount += parseFloat(stat.total_amount);
        aggregated.by_service[stat.service].successful += stat.successful_transactions;
        aggregated.by_service[stat.service].failed += stat.failed_transactions;
      });

      // Get total active users
      const totalUsers = await strapi.db.query('plugin::users-permissions.user').count();

      // Get recent transactions
      const recentTransactions = await strapi.db.query('api::optimized-transaction-history.optimized-transaction-history').findMany({
        limit: 10,
        orderBy: { createdAt: 'desc' },
        populate: ['user'],
      });

      // Calculate success rate
      const successRate = aggregated.total_transactions > 0
        ? ((aggregated.successful_transactions / aggregated.total_transactions) * 100).toFixed(2)
        : 0;

      ctx.send({
        success: true,
        data: {
          dateRange: { from, to },
          totalTransactions: aggregated.total_transactions,
          totalAmount: parseFloat(aggregated.total_amount).toFixed(2),
          successfulTransactions: aggregated.successful_transactions,
          failedTransactions: aggregated.failed_transactions,
          pendingTransactions: aggregated.pending_transactions,
          successRate: parseFloat(successRate),
          totalUsers,
          byService: aggregated.by_service,
          recentTransactions: recentTransactions.map(t => ({
            id: t.id,
            service: t.service,
            user: t.user?.email,
            amount: t.amount,
            status: t.status,
            createdAt: t.createdAt,
          })),
        },
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      throw new ApplicationError('Failed to fetch dashboard statistics');
    }
  },

  /**
   * Get statistics for specific services
   */
  async getServiceStats(ctx) {
    try {
      const { service, dateFrom, dateTo, network, page = 1, pageSize = 25 } = ctx.query;

      const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = dateTo ? new Date(dateTo) : new Date();

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

      const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = dateTo ? new Date(dateTo) : new Date();

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

      const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = dateTo ? new Date(dateTo) : new Date();

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
