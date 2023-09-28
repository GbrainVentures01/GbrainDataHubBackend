const sha512 = require("js-sha512").sha512;

const DEFAULT_MERCHANT_CLIENT_SECRET = process.env.MONNIFY_SECRET_KEY;
module.exports = async (requestBody) => {
  const result = sha512.hmac(DEFAULT_MERCHANT_CLIENT_SECRET, requestBody);
  console.log("Computed hash", result);
  return result;
};
