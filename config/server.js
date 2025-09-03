const cronTasks = require("./cron-tasks");
module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1335),
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});
