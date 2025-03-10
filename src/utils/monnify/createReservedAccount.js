const customNetwork = require("../customNetwork");

module.exports = async ({ token, userData, bvn }) => {
  try {
    const { data } = await customNetwork({
      method: "POST",
      target: "monify",
      path: "api/v2/bank-transfer/reserved-accounts",
      headers: { Authorization: `Bearer ${token}` },
      requestBody: {
        accountReference: userData.email,
        accountName: userData.username,
        currencyCode: "NGN",
        contractCode: `${process.env.MONNIFY_CONTRACT_CODE}`,
        customerEmail: userData.email,
        bvn: bvn,
        customerName: userData.username,
        getAllAvailableBanks: false,
        preferredBanks: ["50515", "058", "232"],
      },
    });
    return data;
  } catch (error) {
    console.log("ERROR: ", error);
    return error;
  }
};
