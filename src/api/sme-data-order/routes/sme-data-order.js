module.exports = {
  routes: [
    {
      method: "POST",
      path: "/sme-data-orders",
      handler: "sme-data-order.create",
    },
  ],
};
