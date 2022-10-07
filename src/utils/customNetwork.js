const axios = require("axios");
const fwave = "https://api.flutterwave.com/";
const vtpassUrl = "https://vtpass.com/api/";
const ogdamsUrl = "https://simhosting.ogdams.ng/api/v1/";

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
  const returnBaseUrl = (target) => {
    switch (target) {
      case "vtpass":
        return vtpassUrl;
      case "ogdams":
        return ogdamsUrl;

      default:
        return fwave;
    }
  };

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
