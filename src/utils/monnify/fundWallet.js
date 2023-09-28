const customNetwork = require("../customNetwork");
const callbackUrl = "https://gbrainventures.netlify.app/confirm-payment";
// const callbackUrl = "https://www.gbrainventures.com/confirm-payment";
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
    const { data } = await customNetwork({
      method: "POST",
      target: gateway === "fwave" ? null : "credo",
      path: gateway === "fwave" ? "v3/payments" : "transaction/initialize",
      headers: {
        Authorization:
          gateway === "fwave"
            ? `Bearer ${process.env.FLUTTER_WAVE_LIVE_SECRET_KEY}`
            : process.env.CREDO_SECRET,
        // process.env.CREDO_SECRET,
      },
      requestBody: gateway === "fwave" ? FwaveReq : credoReq,
    });

    // console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};
