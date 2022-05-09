const sha512 = require('js-sha512').sha512;

module.exports = async (requestBody) => {
const DEFAULT_MERCHANT_CLIENT_SECRET = 'P4W2YR7DCQY7FD95TQADTW8VHXGP9WEZ'

const hashData = `${requestBody}`
const computeHash = (hashData) => {
    const result = sha512.hmac(DEFAULT_MERCHANT_CLIENT_SECRET, hashData)
    return result
}

const computedHash = computeHash(hashData);
return computedHash
}