module.exports = {
  routes: [
    {
      method: "POST",
      path: "/crypto/deposit",
      handler: "crypto.generateDepositAddress",
    },
  ],
};
