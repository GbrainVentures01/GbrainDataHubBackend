const { base64encode } = require("nodejs-base64")
const customNetwork = require("../customNetwork")


module.exports = async () => {
    try {
        const {data} = await customNetwork({
       method:"POST", path:"api/v1/auth/login",
       headers:{
       Authorization:`Basic ${base64encode(`MK_TEST_Q061E5LZVB:${process.env.MONNIFY_MERCHANT_CLIENT_SECRET}`)}`}})
       const token = data?.responseBody?.accessToken
       return token

    } catch (error) {
        console.log(error)
        return ""
    }
}