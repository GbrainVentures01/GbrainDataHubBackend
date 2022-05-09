const customNetwork = require("../customNetwork")

module.exports =  async ({token, userData}) => {
    try {
        const {data} = await customNetwork({method:"POST", path:"api/v2/bank-transfer/reserved-accounts", headers:{Authorization:`Bearer ${token}`}, requestBody:{
            "accountReference": userData.email,
            "accountName": "Test Reserved Account",
            "currencyCode": "NGN",
            "contractCode": "6230647961",
            "customerEmail": userData.email,
            "bvn": "21212121212",
            "customerName": userData.username,
            "getAllAvailableBanks": false,
            "preferredBanks": ["035"]
        }})
        return data?.responseBody
    } catch (error) {
        return error
    }
}

