const axios = require("axios");
const { generateReference } = require("../utils/generateReference.js");
const { v4 } = require("uuid");
const Payments = require("../models/payments.js");
const customError = require("../customError.js");
const Wallets = require("../models/wallet.js");
const TransactionHistoryWallets = require("../models/transactionHistoryWallet.js");
const TransactionHistoryWallet = require("../models/transactionHistoryWallet.js");
const Wallet = require("../models/wallet.js");
const crypto = require("crypto");
const dotenv = require("dotenv");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Users = require("../models/user.js");
const {
    getAccountNameFromSafeHaven,
} = require("../utils/get-account-name-from-safehaven.js");
const { getAccessToken } = require("../utils/get-safehaven-access-token.js");

dotenv.config();

const SAFEHAVEN_API_BASE_URL = process.env.SAFEHAVEN_API_BASE_URL;
const SAFEHAVEN_API_KEY = process.env.SAFEHAVEN_API_KEY;
const SAFEHAVEN_URL = process.env.SAFEHAVEN_URL;
const SAFEHAVEN_CLIENT_ID = process.env.SAFEHAVEN_CLIENT_ID;
const paystackBaseUrl = "https://api.paystack.co";
const paystackLiveKey = process.env.PAYSTACK_SECRET_KEY;
// const paystackLiveKey = "sk_test_63a0e81026c20e744a08f18c5d7b724f905540c2"

// Fincra Encryption Key
const FINCRA_ENCRYPTION_KEY = "";

const fincraAccountUrl = "https://sandboxapi.fincra.com";

async function listBanks(req, res, next) {
    try {
        const response = await axios.get(
            `${fincraAccountUrl}/core/banks?currency=NGN&country=NG`,
            {
                headers: {
                    "api-key": "",
                },
            }
        );

        return res.json({ message: response.data });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function verifyAccountNumber(req, res, next) {
    try {
        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode)
            next(customError("Account number and bank code are required"));

        const body = {
            accountNumber,
            bankCode,
            type: "nuban",
        };

        const response = await axios.post(
            `${fincraAccountUrl}/core/accounts/resolve`,
            body,
            {
                headers: {
                    "api-key": "SiYH55vavpRO4ZyKkIbEkVqjk9XAGmHk",
                },
            }
        );

        return res.json({ message: response.data });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function initiateTransfer(req, res, next) {
    try {
        const {
            code = "999992",
            account_number = "8039914037",
            amount = "1000",
            narration,
            userId,
        } = req.body;

        const checkIfUserWalletExists = await Wallet.find({ userId });

        if (checkIfUserWalletExists.length === 0)
            return next(customError("User wallet not found"));

        if (checkIfUserWalletExists[0].balance < +amount)
            return next(customError("Insufficient funds"));

        const details = {
            business: "6688cb082195ddbd1b82aaad",
            sourceCurrency: "NGN",
            destinationCurrency: "NGN",
            amount: "200",
            description: "Payment",
            customerReference: "TXT-001",
            beneficiary: {
                firstName: "John",
                lastName: "Doe",
                email: "test@fincra.com",
                type: "individual",
                accountHolderName: "john doe",
                accountNumber: "0726219090",
                country: "NGN",
                bankCode: "044",
                //   sortCode: '9090',
                //   registrationNumber: 'A909'
            },
        };

        const response = await axios.post(
            `${fincraAccountUrl}/disbursements/payouts`,
            details,
            {
                headers: {
                    "api-key": "",
                },
            }
        );

        // if(response.message === 'Please enable IP Whitelisting to access this service'){
        //     return next(customError('Please enable IP Whitelisting to access this service'))
        // }
        // else if(response.message ==='This request cannot be processed. Please contact your account administrator'){
        //     return next(customError('This request cannot be processed. Please contact customer support'))
        // }
        // else if(response.message === 'Transfer creation failed'){
        //     return next(customError('This request cannot be processed. Withdrawal failed'))
        // }

        // const checkIfPaymentExists = await Payments.find({ userId });

        // console.log(checkIfPaymentExists)

        // if (checkIfPaymentExists.length > 0 || !checkIfPaymentExists) {
        //     const updatePaymentAmt = await Payments.findByIdAndUpdate(checkIfPaymentExists[0]._id, {
        //         amount,
        //         accessCode: response.data.reference,
        //         isConfirmed: false
        //     });
        // } else {
        //     const savePaymentInitiationInDb = new Payments({
        //         accessCode: response.data.reference,
        //         amount,
        //         isConfirmed: false,
        //         userId,
        //     });

        //     await savePaymentInitiationInDb.save();
        //     return res.json({ message: response.data });
        // }

        return res.json({ message: response });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

//paystack
async function initializeMoneyDepositWithPaystackWallet(req, res, next) {
    const { email, amount, userId, name } = await req.body;
    const API_SECRET_KEY = "";

    const amountInKobo = amount * 100; // Convert NGN to Kobo

    const transactionDetails = {
        email,
        amount: amountInKobo,
        metadata: {
            variable_name: name,
            display_name: name,
            userId,
            value: name,
        },
    };

    try {
        const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            transactionDetails,
            {
                headers: {
                    Authorization: `Bearer ${API_SECRET_KEY}`,
                },
            }
        );

        const checkIfPaymentExists = await Payments.find({ userId });

        if (checkIfPaymentExists.length > 0 || !checkIfPaymentExists) {
            const updatePaymentAmt = await Payments.findByIdAndUpdate(
                checkIfPaymentExists[0]._id,
                {
                    amount: amountInKobo,
                    accessCode: response.data.data.reference,
                    isConfirmed: false,
                }
            );
        } else {
            const savePaymentInitiationInDb = new Payments({
                accessCode: response.data.data.reference,
                amount: amountInKobo,
                isConfirmed: false,
                userId,
            });

            await savePaymentInitiationInDb.save();

            return res.json({ message: response.data });
        }

        return res.json({ message: response.data });
    } catch (error) {
        console.log(error);
        return next(customError(error));
    }
}

// Webhook Handler
async function verifyFincraWebhook(req, res) {
    try {
        const { headers, body } = req;

        // Validate Fincra webhook signature
        const signature = headers["x-fincra-signature"];
        const hmac = crypto.createHmac("sha512", FINCRA_ENCRYPTION_KEY);
        hmac.update(JSON.stringify(body));
        const generatedSignature = hmac.digest("hex");

        if (signature !== generatedSignature) {
            return res.status(400).json({ message: "Invalid signature" });
        }

        // Process the webhook data
        const { event, data } = body;

        if (!event || !data) {
            return res.status(400).json({ message: "Invalid data received" });
        }

        // Extract necessary information from the data payload
        const { amountReceived, recipient, reference, status } = data;
        const userId = recipient ? recipient.email : null; // Assuming userId is stored in recipient's email

        if (!userId || !amountReceived || !status) {
            return res
                .status(400)
                .json({ message: "Incomplete transaction data" });
        }

        // Check for existing wallet
        const existingWallet = await Wallets.findOne({ userId });

        // Handle different event types
        switch (event) {
            case "payout.successful":
                if (status === "successful") {
                    const amountToAdd = +amountReceived;

                    if (existingWallet) {
                        existingWallet.balance += amountToAdd;
                        await existingWallet.save();
                    } else {
                        const newWallet = new Wallets({
                            userId,
                            balance: amountToAdd,
                        });
                        await newWallet.save();
                    }

                    const newTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: amountToAdd,
                        status: "completed",
                        details: "Deposited funds to account",
                        txId: reference,
                        rId: v4(),
                        name: "Top up",
                    });

                    await newTransaction.save();
                    return res.json({
                        message: "Balance updated successfully",
                    });
                }
                break;

            case "payout.failed":
                if (status === "failed") {
                    const failedTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: +amountReceived,
                        status: "failed",
                        details: "Transaction failed",
                        txId: reference,
                        rId: v4(),
                        name: "Top up",
                    });

                    await failedTransaction.save();
                    return res.json({
                        message: "Transaction recorded as failed",
                    });
                }
                break;

            // Add more cases for other event types as needed

            default:
                return res
                    .status(400)
                    .json({ message: "Unhandled event type" });
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function verifyPaystackWebhook(req, res, next) {
    try {
        const hash = crypto
            .createHmac("sha512", paystackLiveKey)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (hash !== req.headers["x-paystack-signature"]) {
            console.log("❌ Invalid Paystack signature.");
            return res.status(400).json({ message: "Invalid signature" });
        }

        const eventData = req.body;

        // Handle different event types
        switch (eventData.event) {
            case "charge.success":
                // Existing handling for charge.success
                let { customer, metadata } = eventData.data;
                const amount = eventData.data.amount / 100; // Convert to NGN
                // let userId = customer.metadata.user_id;

                const user = await Users.find({ email: customer?.email });

                let userId = user[0]?._id;

                if (!userId) {
                    console.log(
                        "❌ No user ID found in metadata. Fetching from Paystack..."
                    );
                    const customerCode = customer.customer_code;

                    try {
                        const customerResponse = await axios.get(
                            `${paystackBaseUrl}/customer/${customerCode}`,
                            {
                                headers: {
                                    Authorization: `Bearer ${paystackLiveKey}`,
                                },
                            }
                        );
                        userId = customerResponse.data.data.metadata?.user_id;

                        if (!userId) {
                            console.log(
                                "❌ User not found in DB and no userId in Paystack. Aborting."
                            );
                            return res
                                .status(400)
                                .json({ message: "User ID missing" });
                        }
                    } catch (error) {
                        console.error(
                            "🚨 Error fetching customer details from Paystack:",
                            error.message
                        );
                        return res
                            .status(500)
                            .json({ message: "Failed to fetch user ID" });
                    }
                }

                console.log(customer, "cstomer");

                if (user.length === 0) {
                    console.log("❌ User not found in database.");
                    return res.status(404).json({ message: "User not found" });
                }

                let wallet = await Wallets.findOne({ userId });
                if (wallet) {
                    wallet.balance += amount;
                    await wallet.save();
                    console.log(`💰 Wallet updated: NGN ${amount} added.`);
                } else {
                    wallet = new Wallets({ userId, balance: amount });
                    await wallet.save();
                    console.log("📌 New wallet created:", wallet);
                }

                // Update payments table
                const paymentRecord = await Payments.findOne({
                    userId,
                    amount: amount * 100,
                });
                if (paymentRecord) {
                    paymentRecord.isConfirmed = true;
                    await paymentRecord.save();
                }

                // Save transaction history
                const newTransaction = new TransactionHistoryWallets({
                    userId,
                    transactionType: "paystack deposit",
                    amount,
                    status: "completed",
                    details: "Funds deposited via transfer",
                    txtId: crypto.randomUUID(),
                    rId: crypto.randomUUID(),
                    name: "Incoming Transfer",
                });

                await newTransaction.save();
                return res
                    .status(200)
                    .json({ message: "Wallet updated successfully", wallet });

            case "transfer.success":
            // const { amount: transferAmount, reference: transferReference, recipient } = eventData.data;

            // // Use the Payments model to find the userId associated with the transfer
            // const paymentRecordForTransfer = await Payments.findOne({ accessCode: transferReference });

            // console.log(paymentRecordForTransfer)

            // if (!paymentRecordForTransfer) {
            //     console.log("❌ Payment record not found for reference:", transferReference);
            //     return res.status(400).json({ message: "Payment record not found" });
            // }

            // const transferUserId = paymentRecordForTransfer.userId; // Get userId from payment record

            // // Log the transfer success
            // console.log(`✅ Transfer successful: ${transferAmount} to ${recipient.name} (Reference: ${transferReference})`);

            // // Deduct the amount from the user's wallet
            // const existingWallet = await Wallets.findOne({ userId: transferUserId });

            // if (existingWallet) {
            //     existingWallet.balance -= transferAmount; // Deduct the amount
            //     await existingWallet.save();
            //     console.log(`💰 Wallet updated: NGN ${transferAmount} deducted.`);
            // } else {
            //     console.log("❌ Wallet not found for user:", transferUserId);
            //     return res.status(404).json({ message: "Wallet not found" });
            // }

            // // Optionally, you can log the transaction or update transaction history here
            // const newTransferTransaction = new TransactionHistoryWallets({
            //     userId: transferUserId,
            //     transactionType: 'transfer deduction',
            //     amount: -transferAmount, // Negative amount for deduction
            //     status: 'completed',
            //     details: `Deducted amount for transfer: ${transferReference}`,
            //     txId: transferReference,
            //     rId: v4(),
            //     name: 'Transfer Deduction',
            // });

            // await newTransferTransaction.save();
            // return res.json({ message: 'Transfer processed successfully' });

            default:
                console.log("ℹ️ Unhandled event:", eventData.event);
                return res.status(400).json({ message: "Unhandled event" });
        }
    } catch (error) {
        console.error("🚨 Webhook processing error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

const privateKeyPath = "";

// Name Enquiry
async function performNameEnquiry(req, res, next) {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
        return res
            .status(400)
            .json({ message: "Account number and bank code are required" });
    }
    const response = await getAccountNameFromSafeHaven(accountNumber, bankCode);
    console.log(response);

    if (response) {
        res.json({ message: response });
    } else {
        next(customError(err));
    }
}

// SAFE HAVEN BANK LIST

async function safeHavenBanksList(req, res, next) {
    // 1. Get a fresh token
    const token = await getAccessToken();
    if (!token) throw new Error("Authentication failed");

    try {
        const response = await axios.get(`${SAFEHAVEN_URL}/transfers/banks`, {
            headers: {
                authorization: `Bearer ${token.access_token}`,
                ClientID: SAFEHAVEN_CLIENT_ID,
                accept: "application/json",
            },
        });

        console.log(response.data);

        return res.json({ message: response.data });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

// Initiate Transfer
async function initiateSafeHavenTransfer(req, res) {
    try {
        // 1. Get a fresh token
        const token = await getAccessToken();
        if (!token) throw new Error("Authentication failed");

        const transferPayload = {
            nameEnquiryReference: "999240210824165216179017735887",
            debitAccountNumber: "0108083411",
            beneficiaryBankCode: "999240",
            beneficiaryAccountNumber: "0104695931",
            narration: "Test Transfer Narration 1.1",
            amount: 1234.56,
            saveBeneficiary: false,
            paymentReference: "123XYZ",
        };

        const response = await axios.post(
            "https://api.safehavenmfb.com/transfers", // Confirm endpoint
            transferPayload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ClientId: "669792f7e5ae200024d43bb0",
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            }
        );

        res.status(200).json({ data: response.data });
    } catch (error) {
        console.error("Full error:", error.response?.data || error.message);
        res.status(500).json({
            error: "Transfer failed",
            details: error.response?.data,
        });
    }
}

// Webhook endpoint to receive events
async function verifySafeHavenWebhook(req, res) {
    try {
        const {
            event,
            status,
            amountReceived,
            reference,
            userId,
            amount,
            narration,
            paymentReference,
        } = req.body;

        // Log the incoming webhook for debugging purposes
        console.log("Received Webhook Event:", event);
        console.log("Event Data:", req.body);

        // Handle different event types
        switch (event) {
            case "transfer": // Successful transfer
                if (status === "Completed") {
                    const amountToAdd = +amountReceived;

                    const existingWallet = await Wallets.findOne({ userId });

                    if (existingWallet) {
                        existingWallet.balance += amountToAdd;
                        await existingWallet.save();
                    } else {
                        const newWallet = new Wallets({
                            userId,
                            balance: amountToAdd,
                        });
                        await newWallet.save();
                    }

                    const newTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: amountToAdd,
                        status: "completed",
                        details: "Deposited funds to account",
                        txId: reference,
                        rId: v4(),
                        name: "Top up",
                    });

                    await newTransaction.save();
                    return res.json({
                        message: "Balance updated successfully",
                    });
                }
                break;
            case "virtualAccount.transfer": // Successful transfer
                if (status === "Completed") {
                    const amountToAdd = +amountReceived;

                    const existingWallet = await Wallets.findOne({ userId });

                    if (existingWallet) {
                        existingWallet.balance += amountToAdd;
                        await existingWallet.save();
                    } else {
                        const newWallet = new Wallets({
                            userId,
                            balance: amountToAdd,
                        });
                        await newWallet.save();
                    }

                    const newTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: amountToAdd,
                        status: "completed",
                        details: "Deposited funds to account",
                        txId: reference,
                        rId: v4(),
                        name: "Top up",
                    });

                    await newTransaction.save();
                    return res.json({
                        message: "Balance updated successfully",
                    });
                }
                break;
            case "transfer.failed": // Failed transfer
                if (status === "failed") {
                    const failedTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: +amountReceived,
                        status: "failed",
                        details: "Transaction failed",
                        txId: reference,
                        rId: v4(),
                        name: "Top up",
                    });

                    await failedTransaction.save();
                    return res.json({
                        message: "Transaction recorded as failed",
                    });
                }
                break;
            case "virtualAccount.transfer.successful": // Virtual account successful transfer
                // Similar handling as transfer.successful
                if (status === "successful") {
                    const amountToAdd = +amount;

                    const existingWallet = await Wallets.findOne({ userId });

                    if (existingWallet) {
                        existingWallet.balance += amountToAdd;
                        await existingWallet.save();
                    } else {
                        const newWallet = new Wallets({
                            userId,
                            balance: amountToAdd,
                        });
                        await newWallet.save();
                    }

                    const newTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: amountToAdd,
                        status: "completed",
                        details: "Deposited funds to virtual account",
                        txId: paymentReference,
                        rId: v4(),
                        name: "Top up from virtual account",
                    });

                    await newTransaction.save();
                    return res.json({
                        message:
                            "Virtual account transfer successful, balance updated",
                    });
                }
                break;

            case "virtualAccount.transfer.failed": // Virtual account transfer failed
                // Similar handling as transfer.failed
                if (status === "failed") {
                    const failedTransaction = new TransactionHistoryWallets({
                        userId,
                        transactionType: "deposit",
                        amount: +amount,
                        status: "failed",
                        details: "Virtual account transfer failed",
                        txId: paymentReference,
                        rId: v4(),
                        name: "Top up from virtual account",
                    });

                    await failedTransaction.save();
                    return res.json({
                        message: "Virtual account transfer recorded as failed",
                    });
                }
                break;

            default:
                return res
                    .status(400)
                    .json({ message: "Unhandled event type" });
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

// Paystack

module.exports = {
    performNameEnquiry,
    safeHavenBanksList,
    verifyAccountNumber,
    listBanks,
    initiateTransfer,
    verifyFincraWebhook,
    initiateSafeHavenTransfer,
    verifySafeHavenWebhook,
    verifyPaystackWebhook,
};
