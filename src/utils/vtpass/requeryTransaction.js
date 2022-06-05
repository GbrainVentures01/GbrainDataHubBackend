const { base64encode } = require("nodejs-base64");
const customNetwork = require("../customNetwork");

module.exports = async ({ requeryParams }) => {
  try {
    const status = await customNetwork({
      method: "GET",
      requestBody: requeryParams,
      target: "vtpass",
      headers: {
        Authorization: `Basic ${base64encode(
          `${process.env.VTPASS_USERNAME}:${process.env.VTPASS_PASSWORD}`
        )}`,
      },
      path: "requery",
    });
    return status;
  } catch (error) {
    cosnsole.log(error.message);
  }
};
