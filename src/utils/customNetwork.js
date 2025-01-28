const axios = require("axios");
const fwave = "https://api.flutterwave.com/";
const vtpassUrl = "https://vtpass.com/api/";
const datahouse = "https://www.datahouse.com.ng/api/";
const ogdamsUrl = "https://simhosting.ogdams.ng/api/v1/";
const ogdamsAirtimeUrl = "https://automation.airtimetocash.com/api/v1/";
const bello = "https://bellodigitalworld.ng/api/v1/";
const credo = "https://api.public.credodemo.com/";
const monify = "https://api.monnify.com/";
const payvessel = "https://api.payvessel.com/";
// const monify = "https://sandbox.monnify.com/";

// const baseUrl = `${testUrl}/api`;

// module.exports = RequestMethod = {
//   POST: "POST",
//   GET: "GET",
//   PUT: "PUT",
//   PATCH: "PATCH",
//   DELETE: "DELETE",
// };

/* @description the function below is used to make network request to external server...... It
 * can easily be passed around
 *
 */

module.exports = async ({
  method,
  path,
  requestBody,
  target,
  params,
  headers,
}) => {
  if (!method || !path) {
    throw new Error(
      "A required parameter is missing. Please provide method or path"
    );
  }
  console.log("MAKING NETWORK CALL: ");
  const returnBaseUrl = (target) => {
    switch (target) {
      case "vtpass":
        return vtpassUrl;
      case "ogdams":
        return ogdamsUrl;
      case "ogdams_airtime":
        return ogdamsAirtimeUrl;
      case "data_house":
        return datahouse;
      case "bello":
        return bello;
      case "credo":
        return credo;
      case "monify":
        return monify;
      case "payvessel":
        return payvessel;
      default:
        return fwave;
    }
  };
  console.log(requestBody);
  console.log(`${returnBaseUrl(target)}${path}`);
  const config = {
    method,
    url: `${returnBaseUrl(target)}${path}`,
    params: params,
    headers: headers,
    data: requestBody,
  };
  const response = await axios(config);
  return response;
};
