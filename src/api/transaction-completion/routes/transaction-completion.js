module.exports = {
    routes: [
      {
        method: "POST",
        path: "/transaction-completion/hooks",
        handler: "transaction-completion.handleCompletion",
      },
    ],
  };
  