module.exports = {
  routes: [
    {
      method: "POST",
      path: "/quidax-webhooks",
      handler: "quidax-webhook.handleWebhook",
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Webhooks come from external source
      },
    },
  ],
};
