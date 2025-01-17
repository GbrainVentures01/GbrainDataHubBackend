const customNetwork = require("../customNetwork");

module.exports = async ({ token, userData }) => {
  try {
    const { data } = await customNetwork({
      method: "PUT",
      target: "monify",
      path: `api/v1/bank-transfer/reserved-accounts/add-linked-accounts/${userData.email}`,
      headers: { Authorization: `Bearer ${token}` },
      requestBody: {
        getAllAvailableBanks: false,
        preferredBanks: ["50515", "058"],
      },
    });
    return data;
  } catch (error) {
    console.log("ERROR: ", error);
    return error;
  }
};
