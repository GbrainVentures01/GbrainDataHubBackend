module.exports = {
  routes: [
    {
      method: "POST",
      path: "/buy-tv-cables",
      handler: "tvcables-order.create",
    },
  ],
};
