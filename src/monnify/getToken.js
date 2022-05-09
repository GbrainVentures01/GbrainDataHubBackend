const { base64encode } = require("nodejs-base64")
const customNetwork = require("../customNetwork")


module.exports = async () => {
    try {
        const {data} = await customNetwork({method:"POST", path:"api/v1/auth/login", headers:{Authorization:`Basic ${base64encode("MK_TEST_Q061E5LZVB:P4W2YR7DCQY7FD95TQADTW8VHXGP9WEZ")}`}})
       const token = data?.responseBody?.accessToken
       return token

    } catch (error) {
        console.log(error)
        return ""
    }
}