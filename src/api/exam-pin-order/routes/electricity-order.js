module.exports = {
  routes: [
    {
      method: "POST",
      path: "/buy-exam-pin",
      handler: "exam-pin-order.create",
    },
  ],
};
