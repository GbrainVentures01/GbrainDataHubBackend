module.exports = {
  routes: [
    {
      method: "POST",
      path: "/buy-electricity",
      handler: "electricity-order.create",
    },
    {
      method: "POST",
      path: "/buy-electricity/verify",
      handler: "electricity-order.verifyMeter",
    },
  ],
};
