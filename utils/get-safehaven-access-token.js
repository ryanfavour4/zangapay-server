const dotenv = require("dotenv");
const axios = require("axios");
const { generateClientAssertion } = require("../controllers/virtualAccount");
dotenv.config();

// function generateClientAssertion() {
//     const now = Math.floor(Date.now() / 1000);

//     try {
//         const privateKey = fs.readFileSync("../privatekey.pem", "utf8");

//         const payload = {
//             iss: "https://zangapay.com", // company website url
//             sub: "f19b9f76732f35c0c9cfc0aa135956a8", // oauth client id
//             aud: "https://api.safehavenmfb.com", // Sandbox or production URL
//             iat: now, // Current timestamp
//             exp: now + 3600, // Expiry in 1 hour
//         };

//         const header = {
//             typ: "JWT",
//             alg: "RS256",
//         };

//         return jwt.sign(payload, privateKey, { algorithm: "RS256", header });
//     } catch (error) {
//         console.log("client assertion error", error);
//     }
// }

// Get Access Token
async function getAccessToken() {
    const clientAssertion = generateClientAssertion();

    try {
        const options = {
            method: "POST",
            url: `https://api.safehavenmfb.com/oauth2/token`,
            headers: {
                accept: "application/json",
                "content-type": "application/json",
            },
            data: {
                grant_type: "client_credentials",
                client_assertion_type:
                    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: clientAssertion,
                client_id: `f19b9f76732f35c0c9cfc0aa135956a8`,
            },
        };

        const response = await axios.request(options);

        return response.data;
    } catch (error) {
        console.error(
            "Error obtaining access token:",
            error.response?.data || error.message
        );
        throw new Error("Failed to obtain access token");
    }
}

module.exports = {
    generateClientAssertion,
    getAccessToken,
};
