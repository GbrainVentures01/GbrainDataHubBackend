const customNetwork = require("../customNetwork");

module.exports = async ({ token, userData, amount, ref }) => {
  try {
    const { data } = await customNetwork({
      method: "POST",
      path: "api/v1/merchant/transactions/init-transaction",
      headers: { Authorization: `Bearer ${token}` },
      requestBody: {
        amount: amount,
        customerName: userData.username,
        customerEmail: userData.email,
        paymentReference: ref,
        paymentDescription: "Trial transaction",
        currencyCode: "NGN",
        contractCode: `${process.env.MONNIFY_CONTRACT_CODE}`,
        redirectUrl: "https://gbrainventures.netlify.app/confirm-payment",
        paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
      },
    });

    return data?.responseBody;
  } catch (error) {
    return error;
  }
};
