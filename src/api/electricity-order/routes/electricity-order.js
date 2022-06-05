module.exports = {
  routes: [
    {
      method: "POST",
      path: "/buy-electricity",
      handler: "electricity-order.create",
    },
  ],
};
