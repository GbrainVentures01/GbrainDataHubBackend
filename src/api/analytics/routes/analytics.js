module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/analytics/dashboard',
      handler: 'analytics.getDashboardStats',
      config: {
   policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/services/stats',
      handler: 'analytics.getServiceStats',
      config: {
   policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/revenue',
      handler: 'analytics.getRevenueStats',
      config: {
     policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/transactions',
      handler: 'analytics.getTransactions',
      config: {
      policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/webhook-logs',
      handler: 'analytics.getWebhookLogs',
      config: {
       policies: [],
        middlewares: [],
      },
    },
  ],
};
