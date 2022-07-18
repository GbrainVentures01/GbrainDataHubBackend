module.exports = ({ env }) => ({
  // ...
  email: {
    config: {
      enabled: true,
      provider: "sendmail",
      settings: {
        defaultFrom: "admin@strapimail.com",
        defaultReplyTo: "admin@strapimail.com",
      },
    },
  },
  // ...
});
