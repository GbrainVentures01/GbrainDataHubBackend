module.exports = ({ env }) => ({
  proxy: true,
  url: env("MY_HEROKU_URL"),
  app: {
    keys: env.array("APP_KEYS", ["afe7405d67f206b6", "63e90c0711630990"]),
  },
});
