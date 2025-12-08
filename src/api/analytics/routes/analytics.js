module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/analytics/dashboard',
      handler: 'analytics.getDashboardStats',
      config: {
        auth: false,
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/analytics/services/stats',
      handler: 'analytics.getServiceStats',
      config: {
        auth: false,
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/analytics/revenue',
      handler: 'analytics.getRevenueStats',
      config: {
        auth: false,
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/analytics/transactions',
      handler: 'analytics.getTransactions',
      config: {
        auth: false,
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/analytics/webhook-logs',
      handler: 'analytics.getWebhookLogs',
      config: {
        auth: false,
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
  ],
};
