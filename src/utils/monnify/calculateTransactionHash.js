const sha512 = require('js-sha512').sha512;

module.exports = async (requestBody) => {
const DEFAULT_MERCHANT_CLIENT_SECRET = process.env.MONNIFY_MERCHANT_CLIENT_SECRET

const hashData = `${requestBody}`
console.log(hashData)
const computeHash = (hashData) => {
    const result = sha512.hmac(DEFAULT_MERCHANT_CLIENT_SECRET, hashData)
    return result
}

const computedHash = computeHash(hashData);
return computedHash
}