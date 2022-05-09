module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'a6a90a45adb3c2d7b410416b34427f66'),
  },
});
