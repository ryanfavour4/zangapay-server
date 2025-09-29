const { getAccessToken } = require("./get-safehaven-access-token.js");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();
const customError = require("../customError");

const SAFEHAVEN_CLIENT_ID = process.env.SAFEHAVEN_CLIENT_ID;
const SAFEHAVEN_URL = process.env.SAFEHAVEN_URL;

/**
 * @typedef {object} AccountInfo
 * @property {string} responseCode
 * @property {string} responseMessage
 * @property {string} sessionId
 * @property {string} bankCode
 * @property {string} accountNumber
 * @property {string} accountName
 * @property {string} kycLevel
 * @property {string} bvn
 *
 * @param {number} accountNumber
 * @param {number} bankCode
 * @returns {Promise<{data:AccountInfo}>}
 */
async function getAccountNameFromSafeHaven(accountNumber, bankCode) {
    // 1. Get a fresh token
    const token = await getAccessToken();
    if (!token) throw new Error("Authentication failed");

    try {
        console.log(token.access_token);
        console.log(SAFEHAVEN_CLIENT_ID);
        console.log(
            `"GET ACCOUNT NAME FROM SAFE HAVEN", ${SAFEHAVEN_URL}/transfers/name-enquiry`
        );
        console.log({
            bankCode: bankCode,
            accountNumber: accountNumber,
        });

        const response = await axios.post(
            `${SAFEHAVEN_URL}/transfers/name-enquiry`,
            {
                bankCode: bankCode,
                accountNumber: accountNumber,
            },
            {
                headers: {
                    authorization: `Bearer ${token.access_token}`,
                    ClientID: SAFEHAVEN_CLIENT_ID,
                    "content-type": "application/json",
                    accept: "application/json",
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error(
            "Name enquiry failed:",
            error.response?.data || error.message
        );
        next(customError(error));
        throw new Error("Name enquiry failed");
    }
}

module.exports = {
    getAccountNameFromSafeHaven,
};
