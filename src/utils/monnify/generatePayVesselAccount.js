const customNetwork = require("../customNetwork");

module.exports = async ({ requestBody, userData }) => {
  try {
    const { data } = await customNetwork({
      method: "POST",
      target: "payvessel",
      path: `api/external/request/customerReservedAccount/`,
      headers: {
        "api-key": process.env.PAYVESSEL_API_KEY,
        "api-secret": `Bearer ${process.env.PAYVESSEL_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      requestBody: requestBody,
    });
    return data;
  } catch (error) {
    console.log("ERROR: ", error);
    return error;
  }
};
