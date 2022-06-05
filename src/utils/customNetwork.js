const axios = require("axios");
const monnify = "https://sandbox.monnify.com/";
const vtpassUrl = "https://sandbox.vtpass.com/api/";

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

  const config = {
    method,
    url: `${target === "vtpass" ? vtpassUrl : monnify}${path}`,
    params: params,
    headers: headers,
    data: requestBody,
  };
  const response = await axios(config);
  return response;
};
