const { base64encode } = require("nodejs-base64");
const customNetwork = require("../customNetwork");
const randomString = require("randomstring");
const getToken = require("./getToken");
// const callbackUrl = "http://localhost:3000/confirm-payment";
const callbackUrl = "https://www.gbrainventures.com/confirm-payment";
module.exports = async ({ userData, amount, ref, gateway }) => {
  try {
    console.log("funding");
    const FwaveReq = {
      amount: amount,
      customer: {
        email: userData.email,
        phonenumber: userData.phone_number,
      },
      tx_ref: ref,
      currency: "NGN",
      redirect_url: callbackUrl,
    };
    const credoReq = {
      amount: amount,
      channels: ["card", "bank"],
      currency: "NGN",
      customerPhoneNumber: userData.phone_number,
      email: userData.email,
      customerFirstName: userData.first_name,
      customerLastName: userData.last_name,
      reference: ref,
      callbackUrl: callbackUrl,
    };
    const MonReq = {
      amount: Number(amount),
      customerName: `${userData.first_name} ${userData.last_name}`,
      customerEmail: userData.email,
      paymentReference: ref,
      paymentDescription: "Wallet Funding ",
      currencyCode: "NGN",
      contractCode: process.env.MONNIFY_CONTRACT_CODE,
      redirectUrl: callbackUrl,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
    };
    let monifyToken;
    if (gateway === "monify") {
      monifyToken = await getToken();
      console.log("TOKEN: ", monifyToken);
    }
    const { data } = await customNetwork({
      method: "POST",
      target:
        gateway === "fwave" ? null : gateway === "monify" ? "monify" : "credo",
      path:
        gateway === "fwave"
          ? "v3/payments"
          : gateway === "monify"
          ? "api/v1/merchant/transactions/init-transaction"
          : "transaction/initialize",
      headers: {
        Authorization:
          gateway === "fwave"
            ? `Bearer ${process.env.FLUTTER_WAVE_LIVE_SECRET_KEY}`
            : gateway === "monify"
            ? `Bearer ${monifyToken}`
            : process.env.CREDO_SECRET,
        // process.env.CREDO_SECRET,
      },
      requestBody:
        gateway === "fwave"
          ? FwaveReq
          : gateway === "monify"
          ? MonReq
          : credoReq,
    });

    // console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};
