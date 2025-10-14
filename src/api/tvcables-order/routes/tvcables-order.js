module.exports = {
  routes: [
    {
      method: "POST",
      path: "/buy-tv-cables",
      handler: "tvcables-order.create",
    },
    {
      method: "POST",
      path: "/buy-tv-cables/verify",
      handler: "tvcables-order.verifyDetails",
    },
    {
      method: "POST",
      path: "/buy-tv-cables/mobile",
      handler: "tvcables-order.mobileBuyCable",
    },
  ],
};
