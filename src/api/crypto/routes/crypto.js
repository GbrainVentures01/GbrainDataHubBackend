module.exports = {
  routes: [
    {
      method: "POST",
      path: "/crypto/deposit",
      handler: "crypto.generateDepositAddress",
      config: {
        auth: {
          strategies: ["api-token", "jwt"],
        },
      },
    },
    {
      method: "POST",
      path: "/crypto/record-deposit",
      handler: "crypto.recordDeposit",
      config: {
        auth: {
          strategies: ["api-token", "jwt"],
        },
      },
    },
    {
      method: "PUT",
      path: "/crypto/update-deposit/:id",
      handler: "crypto.updateDepositStatus",
      config: {
        auth: {
          strategies: ["api-token", "jwt"],
        },
      },
    },
  ],
};
