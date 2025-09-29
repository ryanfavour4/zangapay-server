const dotenv = require("dotenv");
dotenv.config();
const { v4 } = require("uuid");
const axios = require("axios");
const customError = require("../customError");
const { getAccessToken } = require("../utils/get-safehaven-access-token.js");
const { logActivity } = require("./admin.js");
const TransactionHistoryWallet = require("../models/transactionHistoryWallet.js");
const Wallet = require("../models/wallet");

const SAFEHAVEN_CLIENT_ID = process.env.SAFEHAVEN_CLIENT_ID;
const SAFEHAVEN_URL = process.env.SAFEHAVEN_URL;
const SAFEHAVEN_ACCOUNT_NUMBER = process.env.SAFEHAVEN_ACCOUNT_NUMBER;

/**
 * @typedef {object} ServiceResponseData
 * @property {string} _id
 * @property {string} name
 * @property {string} identifier
 * @property {string} description
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} __v
 * @returns {Promise<{data:ServiceResponseData[], message:string}>}
 */
async function getVacServicesSafehaven(req, res, next) {
    const token = await getAccessToken();
    if (!token) throw new Error("Authentication failed");

    try {
        const servicesResponse = await axios.get(
            `${SAFEHAVEN_URL}/vas/services`,
            {
                headers: {
                    authorization: `Bearer ${token.access_token}`,
                    ClientID: SAFEHAVEN_CLIENT_ID,
                    "content-type": "application/json",
                    accept: "application/json",
                },
            }
        );

        return res.json({
            data: servicesResponse.data.data,
            message: "Services fetched successfully.",
        });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function purchaseAirtimeServicesSafehaven(req, res, next) {
    const {
        phone,
        subcategory_id,
        amount,
        userId,
        name,
        email,
        serviceCategoryId,
    } = req.body;

    const token = await getAccessToken();
    if (!token) throw new Error("Authentication failed");

    try {
        const checkIfUserWalletExists = await Wallet.find({ userId });
        const reference = v4();

        if (checkIfUserWalletExists.length === 0)
            return next(customError("User wallet not found"));

        if (checkIfUserWalletExists[0].balance < +amount)
            return next(customError("Insufficient funds"));

        const purchaseAirtimeData = {
            amount,
            channel: "WEB",
            serviceCategoryId: serviceCategoryId || "61efaba1da92348f9dde5f6c",
            debitAccountNumber: SAFEHAVEN_ACCOUNT_NUMBER,
            phoneNumber: phone,
            statusUrl: "https://zangapay.com/",
        };

        const purchaseAirtimeResponse = await axios.post(
            `${SAFEHAVEN_URL}/vas/pay/airtime`,
            purchaseAirtimeData,
            {
                headers: {
                    authorization: `Bearer ${token.access_token}`,
                    ClientID: SAFEHAVEN_CLIENT_ID,
                    "content-type": "application/json",
                    accept: "application/json",
                },
            }
        );

        if (purchaseAirtimeResponse.data.status === false) {
            return next(customError(purchaseAirtimeResponse.data.message));
        }

        // Step 3: Deduct the amount from the user's wallet
        const existingWallet = await Wallet.findOne({ userId });

        if (existingWallet) {
            existingWallet.balance -= amount; // Deduct the amount
            await existingWallet.save();
            console.log(`💰 Wallet updated: NGN ${amount} deducted.`);
        } else {
            console.log("❌ Wallet not found for user:", userId);
            return res.status(404).json({ message: "Wallet not found" });
        }

        console.log(purchaseAirtimeResponse.data);

        // Step 4: Log the transaction history
        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: "Bills",
            amount: +amount,
            status: "success",
            details: `You successfully purchased ${+amount} naira worth of airtime to ${phone}`,
            txId: reference,
            rId: v4(),
            name: "Airtime Topup",
            username: name,
            provider: "Airtime",
            receipt: response.data,
        });

        await newTransaction.save();

        sendReceiptEmail(email, {
            type: "Airtime Topup",
            details: { ...response.data, amount },
        });

        await logActivity(
            userId,
            "BILL_PAYMENT",
            `${name} purchased airtime worth ₦${amount}`,
            amount,
            "success",
            {
                provider: "Airtime",
                phone,
            }
        );

        return res.json({
            text: "Airtime purchased successfully",
            message: newTransaction,
        });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

module.exports = { getVacServicesSafehaven, purchaseAirtimeServicesSafehaven };
