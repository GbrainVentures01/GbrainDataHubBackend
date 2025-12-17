module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/analytics/dashboard',
      handler: 'api::analytics.analytics.getDashboardStats',
      config: {
   policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/chart-data',
      handler: 'api::analytics.analytics.getChartData',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/services/stats',
      handler: 'api::analytics.analytics.getServiceStats',
      config: {
   policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/revenue',
      handler: 'api::analytics.analytics.getRevenueStats',
      config: {
     policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/transactions',
      handler: 'api::analytics.analytics.getTransactions',
      config: {
      policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/webhook-logs',
      handler: 'api::analytics.analytics.getWebhookLogs',
      config: {
       policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/airtime',
      handler: 'api::analytics.analytics.getAirtimeAnalytics',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/data',
      handler: 'api::analytics.analytics.getDataAnalytics',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/data-transactions',
      handler: 'api::analytics.analytics.getDataTransactions',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
