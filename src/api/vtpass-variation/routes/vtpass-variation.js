module.exports = {
    routes: [
      {
        method: "GET",
        path: "/vtpass-variation/:provider",
        handler: "vtpass-variation.connect",
      },
    ],
  };
  