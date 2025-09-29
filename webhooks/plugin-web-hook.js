const customError = require("../customError");
const axios = require("axios");

const pluginUrl = 'https://pluginng.com/api/'


async function pluginWebHookEvent(req, res, next) {
  try {
    // Configuration for Axios request
     

    const loginResponse = await axios.post(`${pluginUrl}login`, {
      email: 'murphygomen49@gmail.com',
      password: 'Jesusiseverything22#'
    })

    const token = loginResponse.data.data.token;

    console.log(token, 'token')
    var config = {
      method: "get",
      maxBodyLength: Infinity,
      url: '', // Add the actual URL here
      headers: {},
    };

    // Make the request using axios
    const response = await axios(config);

    console.log(response.data, 'from plugin webhook')
    // Process response
    res.json({ data: response.data });
  } catch (err) {
    console.error(err);
    next(customError(err));
  }
}

module.exports = pluginWebHookEvent;
