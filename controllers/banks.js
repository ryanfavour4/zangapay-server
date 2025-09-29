const customError = require("../customError");
const Banks = require("../models/banks");
const axios = require("axios");
const Flutterwave = require("flutterwave-node-v3");
const dotenv = require("dotenv");
const { getAccessToken } = require("../utils/get-safehaven-access-token");

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const SAFEHAVEN_CLIENT_ID = process.env.SAFEHAVEN_CLIENT_ID;
const SAFEHAVEN_URL = process.env.SAFEHAVEN_URL;

async function storeBankDetails(req, res, next) {
    try {
        const { bankCode, accountNumber, bankName, fullname } = req.body;

        const userId = req.userId;

        if (!userId || !bankCode || !accountNumber || !bankName || !fullname)
            return next(customError("some parameters are missing"));

        const newBank = new Banks({
            userId,
            bankCode,
            accountNumber,
            bankName,
            fullname,
        });

        await newBank.save();

        res.json({ message: "Bank stored successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function getBankDetails(req, res, next) {
    try {
        const userId = req.userId;

        const checkIfUserBankExists = await Banks.find({ userId });

        if (checkIfUserBankExists.length === 0)
            return next(customError("User does not have stored bank details"));

        res.json({ message: checkIfUserBankExists });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function listNigerianBanks(req, res, next) {
    try {
        const response = await axios.get("https://api.paystack.co/bank", {
            headers: {
                Authorization: `Bearer sk_test_8b983dd225c5a8b73a783a5c2f1f92291270a377`,
            },
            params: {
                currency: "NGN",
            },
        });

        return res.json({ message: response.data });
    } catch (err) {
        console.log(err);
        return next(customError(err));
    }
}

async function getBanksListSafeHaven(req, res, next) {
    // 1. Get a fresh token
    const token = await getAccessToken();
    if (!token) throw new Error("Authentication failed");

    try {
        const response = await axios.get(`${SAFEHAVEN_URL}/transfers/banks`, {
            headers: {
                authorization: `Bearer ${token.access_token}`,
                ClientID: SAFEHAVEN_CLIENT_ID,
                "content-type": "application/json",
                accept: "application/json",
            },
        });

        console.log("======", response.data, "EVERY SINGLE BANK LIST");

        return res.json({ message: response.data });
    } catch (err) {
        console.log(err);
        return next(customError(err));
    }
}

async function verifyBankAccountDetails(req, res, next) {
    try {
        const { account_number, bankCode } = req.body;

        const response = await axios.get(
            `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bankCode}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        return res.json({ message: response.data });
    } catch (err) {
        console.log(err);
        return next(customError(err));
    }
}

module.exports = {
    storeBankDetails,
    getBankDetails,
    listNigerianBanks,
    verifyBankAccountDetails,
    getBanksListSafeHaven,
};
