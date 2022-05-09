module.exports = {
  routes: [
    {
      method: "GET",
      path: "/data-orders/me",
      handler: "data-order.findMe",
    },
  ],
};
