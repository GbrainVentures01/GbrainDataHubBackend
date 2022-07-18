module.exports = {
  routes: [
    {
      method: "GET",
      path: "/transaction-history",
      handler: "transaction-history.fetch",
    },
  ],
};
