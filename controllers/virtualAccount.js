const { default: axios } = require("axios");
const dotenv = require("dotenv");
const FincraVirtualAccounts = require("../models/fincraVirtualAccounts");
const customError = require("../customError");
const { v4 } = require("uuid");
const jwt = require("jsonwebtoken");
const os = require("os");
const path = require("path");
const fs = require("fs");
const VirtualAccounts = require("../models/virtualAccounts");
const { getAccessToken } = require("../utils/get-safehaven-access-token");

dotenv.config();

const paystackBaseUrl = "https://api.paystack.co";
const paystackLiveKey = "sk_live_2b9869aa9472d35555827ef98d7112a5bf1e2c47";
// const paystackLiveKey = "sk_test_63a0e81026c20e744a08f18c5d7b724f905540c2"
const safeHavenUrl = "https://api.safehavenmfb.com";

const fincraUrl = "https://api.fincra.com/profile/virtual-accounts";

function isAccountValid(expiresAt) {
    console.log(expiresAt);
    const expirationDate = new Date(expiresAt);
    const currentDate = new Date();

    console.log(expirationDate, "expire date");

    console.log(currentDate, "current date");

    return currentDate > expirationDate;
}

async function generateFincraVirtualAccount(req, res, next) {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        let userAccount = await VirtualAccounts.findOne({ userId });

        if (userAccount) {
            if (userAccount?.fincraAccount) {
                // Check if the existing Fincra account is expired
                if (!isAccountValid(userAccount.fincraAccount.expiresAt)) {
                    return res.json({
                        message: "Fincra virtual account is still valid",
                    });
                }

                // Account is expired, so update it
                const reference = v4();
                const payload = {
                    amount: "0",
                    expiresAt: "15815520",
                    merchantReference: reference,
                };
                const response = await axios.post(
                    `${fincraUrl}/transfer`,
                    payload,
                    {
                        headers: {
                            "api-key": "7HnUNPtLG08ZJI1U4MQ1WFOFiIUm8erU",
                        },
                    }
                );

                const fincraData = {
                    accountNumber:
                        response.data.data.accountInformation.accountNumber,
                    accountName:
                        response.data.data.accountInformation.accountName,
                    bankName: response.data.data.accountInformation.bankName,
                    expiresAt: new Date(response.data.data.expiresAt),
                };

                await VirtualAccounts.findByIdAndUpdate(userAccount._id, {
                    $set: { fincraAccount: fincraData },
                });

                return res.json({
                    message: "Fincra virtual account updated successfully",
                });
            }
        }
        // If the user has no virtual account at all, create a new one
        const reference = v4();
        const payload = {
            amount: "0",
            expiresAt: "15815520",
            merchantReference: reference,
        };
        const response = await axios.post(`${fincraUrl}/transfer`, payload, {
            headers: { "api-key": "7HnUNPtLG08ZJI1U4MQ1WFOFiIUm8erU" },
        });

        const newUserAccount = new VirtualAccounts({
            userId,
            fincraAccount: {
                accountNumber:
                    response.data.data.accountInformation.accountNumber,
                accountName: response.data.data.accountInformation.accountName,
                bankName: response.data.data.accountInformation.bankName,
                expiresAt: new Date(response.data.data.expiresAt),
            },
        });

        await newUserAccount.save();

        return res.json({
            message: "Fincra virtual account created successfully",
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

// async function getUserVirtualAccounts(req, res, next) {
//     try {
//         const { userId } = req.params;

//         const checkIfUserAccountExists = await VirtualAccounts.find({ userId });

//         if (checkIfUserAccountExists.length === 0) {
//             throw new customError("No virtual account found for this user");
//         }

//         return res.json({
//             data: "User virtual account found",
//             message: checkIfUserAccountExists,
//         });
//     } catch (err) {
//         console.log(err);
//         next(customError(err));
//     }
// }

// Generate Client Assertion

function generateClientAssertion() {
    const now = Math.floor(Date.now() / 1000);

    try {
        const privateKey = fs.readFileSync("./privatekey.pem", "utf8");
        //   console.log(process.env.SAFEHAVEN_CLIENT_ID, "client id");
        // console.log("PRIVATE KEY HERE", privateKey);
        const payload = {
            iss: "https://zangapay.com", // company website url
            sub: "f19b9f76732f35c0c9cfc0aa135956a8", // oauth client id
            aud: "https://api.safehavenmfb.com", // Sandbox or production URL
            iat: now, // Current timestamp
            exp: now + 3600, // Expiry in 1 hour
        };

        const header = {
            typ: "JWT",
            alg: "RS256",
        };

        return jwt.sign(payload, privateKey, { algorithm: "RS256", header });
    } catch (error) {
        console.log("client assertion error", error);
    }
}

// Create Virtual Account
async function generateSafeHavenVirtualAccount(req, res, next) {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        let userAccount = await VirtualAccounts.findOne({ userId });
        console.log("User Virtual Account", userAccount);

        if (userAccount) {
            if (userAccount?.safeHavenAccount) {
                // Check if the existing SafeHaven account is expired
                if (!isAccountValid(userAccount.safeHavenAccount.expiresAt)) {
                    return res.json({
                        message: "SafeHaven virtual account is still valid",
                    });
                }

                // Account is expired, so update it
                const accessToken = await getAccessToken();
                console.log("access Token", accessToken);

                const accountData = {
                    validFor: 900,
                    settlementAccount: {
                        bankCode: "090286",
                        accountNumber: "0114121606",
                    },
                    amountControl: "UnderPayment",
                    amount: 0,
                    callbackUrl: "https://zangapay.com",
                    externalReference: v4(),
                };

                const response = await axios.post(
                    `https://api.safehavenmfb.com/virtual-accounts`,
                    accountData,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken?.access_token}`,
                            "Content-Type": "application/json",
                            ClientID: `f19b9f76732f35c0c9cfc0aa135956a8`,
                        },
                    }
                );

                console.log(
                    response.data,
                    "RESPONSE FROM SAFE HAVEN CREATE VIRTUAL ACCOUNT"
                );

                const safeHavenData = {
                    accountNumber: response.data.data.accountNumber,
                    accountName: response.data.data.accountName,
                    bankName: response.data.data.bankName || "Safe Haven",
                    expiresAt: new Date(response.data.data.expiryDate),
                };

                await VirtualAccounts.findByIdAndUpdate(userAccount._id, {
                    $set: { safeHavenAccount: safeHavenData },
                });

                return res.json({
                    message: "SafeHaven virtual account updated successfully",
                });
            }
        }

        // If the user has no virtual account at all, create a new one
        const accessToken = await getAccessToken();

        const accountData = {
            validFor: 900,
            settlementAccount: {
                bankCode: "090286",
                accountNumber: "0114121606",
            },
            amountControl: "UnderPayment",
            amount: 0,
            callbackUrl: "https://zangapay.com",
            externalReference: v4(),
        };

        const response = await axios.post(
            `https://api.safehavenmfb.com/virtual-accounts`,
            accountData,
            {
                headers: {
                    Authorization: `Bearer ${accessToken?.access_token}`,
                    "Content-Type": "application/json",
                    ClientID: `f19b9f76732f35c0c9cfc0aa135956a8`,
                },
            }
        );

        console.log(
            response.data,
            "RESPONSE FROM SAFE HAVEN CREATE VIRTUAL ACCOUNT : 300",
            response.data.data
        );

        if (!response.data?.data) {
            // throw new Error(response);
            console.log(response);
            return;
        }

        const newUserAccount = new VirtualAccounts({
            userId,
            safeHavenAccount: {
                accountNumber: response.data.data.accountNumber,
                accountName: response.data.data.accountName,
                bankName: response.data.data.bankName || "Safe Haven",
                expiresAt: new Date(response.data.data.expiryDate),
            },
        });

        await newUserAccount.save();

        return res.json({
            message: "SafeHaven virtual account created successfully",
        });
    } catch (error) {
        console.error(
            "Error creating virtual account:",
            error.response?.data || error.message
        );
        return res.status(500).json({
            message: "Failed to create SafeHaven virtual account",
            error: error.response?.data || error.message,
        });
    }
}

async function checkIfCustomerExist(email) {
    try {
        const res = await axios.get(`${paystackBaseUrl}/customer/${email}`, {
            headers: { Authorization: `Bearer ${paystackLiveKey}` },
        });
        if (res.data.status) {
            return res.data.data;
        }
    } catch (error) {
        return null;
    }
}

async function generatePaystackVirtualAccount(req, res, next) {
    try {
        const { userId, email, firstName, lastName, phone } = req.body;
        console.log("body of gn:", req.body);
        let user = await VirtualAccounts.findOne({ email });
        if (user) {
            return res.json({
                message: "User Already Exist",
                customerCode: user.customerCode,
                virtualAccount: user.VirtualAccount,
                bankName: user.bankName,
            });
        }
        const existingCustomer = await checkIfCustomerExist(email);

        let customerCode;
        if (existingCustomer) {
            customerCode = existingCustomer.customer_code;
        } else {
            const customerResponse = await axios.post(
                `${paystackBaseUrl}/customer`,
                {
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    metadata: { user_id: userId },
                },
                {
                    headers: { Authorization: `Bearer ${paystackLiveKey}` },
                }
            );

            if (!customerResponse.data.status) {
                return res
                    .status(500)
                    .json({ message: "Failed to create customer" });
            }
            customerCode = customerResponse.data.data.customer_code;
        }
        // generate acc
        const accResponse = await axios.post(
            `${paystackBaseUrl}/dedicated_account`,
            {
                customer: customerCode,
                preferred_bank: "wema-bank",
                country: "NG",
                account_number: "auto",
                metadata: { user_id: userId },
            },
            { headers: { Authorization: `Bearer ${paystackLiveKey}` } }
        );

        if (!accResponse.data.status) {
            return res
                .status(500)
                .json({ message: "Failed to create virtual account" });
        }

        const accountData = accResponse.data.data;
        console.log("Account Data:", accountData);
        const newUserAccount = new VirtualAccounts({
            userId,
            fincraAccount: {
                accountNumber: accountData.account_number,
                accountName: accountData.account_name,
                bankName: accountData.bank.name,
                expiresAt: accountData.expiresAt,
                walletBalance: 0, //no model yet
            },
        });
        await newUserAccount.save();

        res.json({
            message: "Customer & Virtual Account Created Successfully",
            customerCode,
            virtualAccount: accountData.account_number,
            bankName: accountData.bank.name,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred" });
    }
}

async function getUserVirtualAccounts(req, res, next) {
    try {
        const { userId } = req.params;
        console.log(req.params, req.body);

        const checkIfUserAccountExists = await VirtualAccounts.find({ userId });
        console.log(req.params, req.body);

        if (checkIfUserAccountExists.length === 0) {
            throw new customError("No virtual account found for this user");
        }

        return res.json({
            data: "User virtual account found",
            message: checkIfUserAccountExists,
        });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

module.exports = {
    generateFincraVirtualAccount,
    getUserVirtualAccounts,
    generateSafeHavenVirtualAccount,
    generatePaystackVirtualAccount,
    generateClientAssertion,
};
