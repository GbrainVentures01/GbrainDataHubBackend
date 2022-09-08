const customNetwork = require("../customNetwork");

module.exports = async ({ userData, amount, ref }) => {
  try {
    console.log("funding");
    const { data } = await customNetwork({
      method: "POST",
      path: "v3/payments",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTER_WAVE_TEST_SECRET_KEY}`,
      },
      requestBody: {
        amount: amount,
        customer: {
          email: userData.email,
          phonenumber: userData.phone_number,
        },
        tx_ref: ref,
        currency: "NGN",
        redirect_url: "https://www.gbrainventures.com/confirm-payment",
      },
    });

    // console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};
