module.exports = {
    routes: [
      {
        method: "POST",
        path: "/transaction-completion-atm-card/hooks",
        handler: "transaction-completion-atm-card.handleCompletion",
      },
    ],
  };
  