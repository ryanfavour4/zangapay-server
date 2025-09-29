const { v4 } = require("uuid");
const customError = require("../customError.js");
const Wallet = require("../models/wallet.js");
const TransactionHistoryWallet = require("../models/transactionHistoryWallet.js");
const User = require("../models/user.js");
const Notifications = require("../models/notification.js");

async function transferBetweenUsers(req, res, next) {
    try {
        const { userId, receiverId, amount, note } = req.body;

        let uniqueTrackingId = v4();

        const [
            checkIfUserWalletExists,
            checkIfReceiverWalletExists,
            checkIfReceieverUserExists,
            checkIfSenderUserExists,
        ] = await Promise.all([
            Wallet.findOne({ userId }),
            Wallet.findOne({ userId: receiverId }),
            User.findById(receiverId),
            User.findById(userId),
        ]);

        console.log(checkIfUserWalletExists);

        if (!checkIfUserWalletExists)
            return next(customError("Sender wallet not found"));
        if (!checkIfReceiverWalletExists)
            return next(customError("Receiver wallet not found"));

        if (checkIfUserWalletExists.balance < parseInt(amount)) {
            return next(customError("Insufficient balance"));
        }

        const [updateUserWallet, updateReceiverWallet] = await Promise.all([
            Wallet.findByIdAndUpdate(
                checkIfUserWalletExists._id,
                {
                    $set: {
                        balance:
                            checkIfUserWalletExists.balance - parseInt(amount),
                    },
                },
                {
                    new: true,
                    runValidators: true,
                }
            ),
            Wallet.findByIdAndUpdate(
                checkIfReceiverWalletExists._id,
                {
                    $set: {
                        balance:
                            checkIfReceiverWalletExists.balance +
                            parseInt(amount),
                    },
                },
                {
                    new: true,
                    runValidators: true,
                }
            ),
        ]);

        const receiverNotification = new Notifications({
            userId: receiverId,
            trackingId: uniqueTrackingId,
            amount,
            description: `Incoming transfer from ${checkIfSenderUserExists[0].firstName} ${checkIfSenderUserExists[0].lastName}`,
            bank: "Zangapay",
        });

        const transactionHistory = new TransactionHistoryWallet({
            userId,
            transactionType: "transfer",
            amount,
            name: "Incoming Transfer from",
            status: "success",
            txId: v4(),
            receiverNote: note,
            receiverIdForTransfer: checkIfReceieverUserExists[0]._id,
            username: `${checkIfSenderUserExists[0].firstName} ${checkIfSenderUserExists[0].lastName}`,
        });

        await Promise.all([receiverNotification.save()]);
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

// Get user wallet balances
async function getUserWalletBalances(req, res, next) {
    try {
        const { userId, accountNumber } = req.params;

        const response = await Wallet.findOne({ userId });

        console.log(response, "old wallet");

        if (!response) {
            const newWallet = new Wallet({
                userId: userId,
                accountNumber: accountNumber,
                balance: 0,
            });

            await newWallet.save();

            console.log("new wallet", newWallet);

            return res.json({ message: newWallet.balance });
        }

        return res.json({ message: response.balance });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

module.exports = {
    getUserWalletBalances,
    transferBetweenUsers,
};

