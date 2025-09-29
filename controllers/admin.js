const User = require("../models/user");
const TransactionHistoryWallet = require("../models/transactionHistoryWallet");
const customError = require("../customError");
const RecentActivity = require("../models/recentActivity");
const bcrypt = require("bcryptjs");
const { v4 } = require("uuid");
const { sendOTPEmail } = require("../mail template/authentication-mail");
const { generateOneTimePasswords } = require("../utils/oneTimePasswords");
const { generateToken } = require("../utils/jwt");
const {
    setSessionExpirationInHours,
    setSessionExpirationInMinutes,
} = require("../utils/sessionExpiration");
const { hasOtpExpired } = require("../utils/verifyOtpValidity");
const EmailOtps = require("../models/emailOtps");
const Notifications = require("../models/notification");
const Wallet = require("../models/wallet");
const generateReferralCode = require("../utils/referralCodes");
const DataPlan = require("../models/DataPlans");
const nineMobileDataPlans = require("../models/9mobileDataPlans");
const ServiceFees = require("../models/ServiceFees");
const WithdrawalFees = require("../models/WithdrawalFees");
const Referral = require("../models/referral"); // Import the Referral model
const UserDataPlanPrices = require("../models/userDataPlanPrice");
const dotenv = require("dotenv");
const { default: axios } = require("axios");
const DataPlans = require("../models/DataPlans");

dotenv.config();

async function signupUserWithEmail(req, res, next) {
    try {
        const {
            email,
            firstName,
            lastName,
            password,
            phone,
            role = "admin",
        } = req.body;

        if (!email || !firstName || !lastName || !password || !phone)
            return next(
                customError(
                    "You have a missing parameter (firstname, lastname, password, phone, email)",
                    400
                )
            );

        const checkIfEmailExists = await User.find({ email });

        const checkIfPhoneExists = await User.find({ phone });

        if (checkIfEmailExists.length > 0)
            return next(customError("User email exists in our database"));

        if (checkIfPhoneExists.length > 0)
            return next(customError("User phone exists in our database"));

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(password, salt);

        const referralCode = generateReferralCode();

        const sessionExpirationDuration = 60 * 360 * 1000;

        const sessionExpireAt = Date.now() + sessionExpirationDuration;

        const createNewUser = new User({
            firstName,
            lastName,
            email,
            phone,
            password: hash,
            sessionExpireAt,
            referralCode,
            role,
        });

        await createNewUser.save();

        // Log the activity
        await logActivity(
            createNewUser._id,
            "ACCOUNT_CREATION",
            `New admin account created for ${firstName} ${lastName}`,
            0,
            "success",
            { email, phone }
        );

        return res.json({ message: [createNewUser], status: 200 });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function addAdminOfficials(req, res, next) {
    try {
        const { email, firstName, lastName, password, phone, role } = req.body;

        if (!email || !firstName || !lastName || !password || !phone || !role)
            return next(
                customError(
                    "You have a missing parameter (firstname, lastname, password, phone, email, role)",
                    400
                )
            );

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(customError("You are not authorized to add an admin"));

        const checkIfEmailExists = await User.find({ email });

        const checkIfPhoneExists = await User.find({ phone });

        if (checkIfEmailExists.length > 0)
            return next(customError("User email exists in our database"));

        if (checkIfPhoneExists.length > 0)
            return next(customError("User phone exists in our database"));

        if (role !== "admin") return next(customError("Invalid role"));

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(password, salt);

        const referralCode = generateReferralCode();

        const sessionExpirationDuration = 60 * 360 * 1000;

        const sessionExpireAt = Date.now() + sessionExpirationDuration;

        const createNewUser = new User({
            firstName,
            lastName,
            email,
            phone,
            password: hash,
            sessionExpireAt,
            referralCode,
            role,
        });

        await createNewUser.save();

        // Log the activity
        await logActivity(
            createNewUser._id,
            "ACCOUNT_CREATION",
            `New admin account created for ${firstName} ${lastName}`,
            0,
            "success",
            { email, phone }
        );

        return res.json({ message: [createNewUser], status: 200 });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}
// Signin with email and password
async function signinWithEmailAndPassword(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return next(
                customError("You have a missing parameter (password, email)")
            );

        const getUserInfo = await User.find({ email });

        if (getUserInfo.length === 0)
            return next(
                customError(
                    "User does not exist. Please register to gain access"
                )
            );

        if (
            getUserInfo[0].role !== "admin" &&
            getUserInfo[0].role !== "support"
        )
            return next(
                customError("You are not authorized to access this application")
            );

        const isPasswordMatch = bcrypt.compareSync(
            password,
            getUserInfo[0].password
        );

        if (!isPasswordMatch) return next(customError("Incorrect password."));

        const token = generateToken(getUserInfo[0]._id.toString(), "email");

        const sessionExpirationDuration = setSessionExpirationInHours(1);

        const updateUserSession = await User.findByIdAndUpdate(
            getUserInfo[0]._id,
            {
                sessionExpireAt: sessionExpirationDuration,
            },
            { new: true }
        );

        const userObject = updateUserSession.toObject();

        const { password: _, ...withoutPassword } = userObject;

        return res.json({
            message: { user: withoutPassword, token },
            status: 200,
        });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

// Logout user session
// Logout user session
async function logoutUserSession(req, res, next) {
    try {
        const userId = req.userId;

        if (!userId)
            return next(customError("You have a missing parameter (userId)"));

        const updateUserSession = await User.findByIdAndUpdate(
            userId,
            {
                sessionExpireAt: 0,
            },
            { new: true }
        );

        return res.json({
            message: "You have successfully logged out",
            session: "",
            status: 200,
        });
    } catch (err) {
        next(customError(err));
    }
}

async function sendEmailOtpForForgottenPassword(req, res, next) {
    try {
        const { email } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists[0].length === 0)
            return next(customError("User does not exist"));

        if (checkIfUserEmailExists[0].role !== "admin")
            return next(
                customError("You are not authorized to reset this password")
            );

        const checkIfUserHasValidOtp = await EmailOtps.find({
            email,
            isValid: true,
        });

        if (checkIfUserHasValidOtp.length > 0) {
            const updateAllValidOtpToInvalid = await EmailOtps.updateMany(
                { email, isValid: true },
                { $set: { isValid: false } }
            );

            const otp = generateOneTimePasswords();

            const expirationTime = setSessionExpirationInMinutes(5);

            const newOtp = new EmailOtps({
                userId: checkIfUserEmailExists[0]._id,
                otp,
                expirationTime,
                email: checkIfUserEmailExists[0].email,
                isValid: true,
            });

            await newOtp.save();

            sendOTPEmail(
                checkIfUserEmailExists[0].email,
                "Reset Password",
                otp,
                "verifying your email",
                `${checkIfUserEmailExists[0].firstName}
        ${checkIfUserEmailExists[0].lastName}`
            );

            return res.json({ message: "Otp have been sent successfully" });
        }
        const otp = generateOneTimePasswords();

        const expirationTime = setSessionExpirationInMinutes(5);

        const newOtp = new EmailOtps({
            userId: checkIfUserEmailExists[0]._id,
            otp,
            expirationTime,
            email: checkIfUserEmailExists[0].email,
            isValid: true,
        });

        await newOtp.save();

        sendOTPEmail(
            checkIfUserEmailExists[0].email,
            "Reset Your Password",
            otp,
            "verifying your email",
            `${checkIfUserEmailExists[0].firstName}
        ${checkIfUserEmailExists[0].lastName}`
        );

        return res.json({ message: "Otp have been sent successfully" });
    } catch (err) {
        next(customError(err));
    }
}

async function verifyEmailOtpSentToUser(req, res, next) {
    try {
        const { otp, email } = req.body;

        const [checkIfUserExists, checkIfUserOtpExists] = await Promise.all([
            User.find({ email }),
            EmailOtps.findOne({ email, isValid: true }).sort({ createdAt: -1 }),
        ]);

        if (checkIfUserExists.length === 0)
            return next(customError("Email not found"));

        if (!checkIfUserOtpExists)
            return next(
                customError("Otp is expired or not sent by user. Try again")
            );

        if (hasOtpExpired(checkIfUserOtpExists.expirationTime))
            return next(customError("Otp is currently expired. Try again"));

        if (!checkIfUserOtpExists.isValid)
            return next(customError("Otp is expired"));

        const isOtpMatched = +otp === checkIfUserOtpExists.otp;

        if (!isOtpMatched) return next(customError("Otp is not valid"));

        const [updateOtpStatusToNotValid, updateUserEmailToVerified] =
            await Promise.all([
                EmailOtps.findByIdAndUpdate(checkIfUserOtpExists._id, {
                    isValid: false,
                    expirationTime: 0,
                }),
                User.findByIdAndUpdate(checkIfUserOtpExists.userId, {
                    isEmailVerified: true,
                }),
            ]);

        return res.json({ message: "Otp Verified Successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function updateAdminRole(req, res, next) {
    try {
        const { role, id } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("User does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to update this role")
            );

        const checkIfUserEmailExists = await User.findById(id);

        if (!checkIfUserEmailExists)
            return next(customError("User does not exist"));

        const updateUserRole = await User.findByIdAndUpdate(
            checkIfUserEmailExists._id,
            {
                $set: {
                    role,
                },
            },
            { new: true }
        );

        return res.json({ message: updateUserRole, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function deleteAdminOfficials(req, res, next) {
    try {
        const { id } = req.params;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to delete this admin")
            );

        const checkIfUserEmailExists = await User.findById(id);

        if (!checkIfUserEmailExists)
            return next(customError("User does not exist"));

        const deleteUser = await User.findByIdAndDelete(
            checkIfUserEmailExists._id
        );

        return res.json({ message: deleteUser, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}
// Handle forgotten password
async function resetUserPassword(req, res, next) {
    try {
        const { password } = req.body;

        const userId = req.userId;

        const checkIfUserEmailExists = await User.findById(userId);

        if (!checkIfUserEmailExists)
            return next(customError("User does not exist"));

        if (checkIfUserEmailExists.role !== "admin")
            return next(
                customError("You are not authorized to reset this password")
            );

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(password, salt);

        const updatedPassword = await User.findByIdAndUpdate(
            userId,
            { password: hash },
            { new: true }
        );

        return res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function getAllUsers(req, res, next) {
    try {
        const users = await User.find({});

        return res.json({ message: users, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function getTotalRevenue(req, res, next) {
    try {
        // Get monthly revenue data
        const monthlyRevenue = await TransactionHistoryWallet.aggregate([
            {
                $match: {
                    status: "success",
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), 0, 1), // From start of current year
                    },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" },
                    },
                    revenue: { $sum: "$amount" },
                },
            },
            {
                $sort: {
                    "_id.year": 1,
                    "_id.month": 1,
                },
            },
        ]);

        // Get monthly user registration data
        const monthlyUsers = await User.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), 0, 1), // From start of current year
                    },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" },
                    },
                    users: { $sum: 1 },
                },
            },
            {
                $sort: {
                    "_id.year": 1,
                    "_id.month": 1,
                },
            },
        ]);

        // Get total all-time revenue
        const totalRevenue = await TransactionHistoryWallet.aggregate([
            {
                $match: { status: "success" },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                },
            },
        ]);

        // Get total all-time users
        const totalUsers = await User.countDocuments();

        // Combine revenue and users data for monthly view
        const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        const combinedData = months.map((name, index) => {
            const monthNumber = index + 1;
            const revenueData = monthlyRevenue.find(
                (item) => item._id.month === monthNumber
            ) || { revenue: 0 };
            const userData = monthlyUsers.find(
                (item) => item._id.month === monthNumber
            ) || { users: 0 };

            // Calculate percentage changes
            let revenuePercentageChange = 0;
            let usersPercentageChange = 0;

            if (index > 0) {
                const prevMonthNumber = index;
                const prevRevenueData = monthlyRevenue.find(
                    (item) => item._id.month === prevMonthNumber
                ) || { revenue: 0 };
                const prevUserData = monthlyUsers.find(
                    (item) => item._id.month === prevMonthNumber
                ) || { users: 0 };

                // Calculate revenue percentage change
                if (prevRevenueData.revenue !== 0) {
                    revenuePercentageChange =
                        ((revenueData.revenue - prevRevenueData.revenue) /
                            prevRevenueData.revenue) *
                        100;
                } else if (revenueData.revenue > 0) {
                    revenuePercentageChange = 100; // If previous month was 0 and current month has value
                }

                // Calculate users percentage change
                if (prevUserData.users !== 0) {
                    usersPercentageChange =
                        ((userData.users - prevUserData.users) /
                            prevUserData.users) *
                        100;
                } else if (userData.users > 0) {
                    usersPercentageChange = 100; // If previous month was 0 and current month has value
                }
            }

            return {
                name,
                revenue: revenueData.revenue || 0,
                users: userData.users || 0,
                revenuePercentageChange:
                    Math.round(revenuePercentageChange * 100) / 100, // Round to 2 decimal places
                usersPercentageChange:
                    Math.round(usersPercentageChange * 100) / 100, // Round to 2 decimal places
            };
        });

        // Calculate overall percentage changes (comparing current month with previous month)
        const currentMonth = new Date().getMonth();
        const currentMonthData = combinedData[currentMonth];
        const previousMonthData = combinedData[currentMonth - 1];

        let overallRevenuePercentageChange = 0;
        let overallUsersPercentageChange = 0;

        if (previousMonthData) {
            if (previousMonthData.revenue !== 0) {
                overallRevenuePercentageChange =
                    ((currentMonthData.revenue - previousMonthData.revenue) /
                        previousMonthData.revenue) *
                    100;
            } else if (currentMonthData.revenue > 0) {
                overallRevenuePercentageChange = 100;
            }

            if (previousMonthData.users !== 0) {
                overallUsersPercentageChange =
                    ((currentMonthData.users - previousMonthData.users) /
                        previousMonthData.users) *
                    100;
            } else if (currentMonthData.users > 0) {
                overallUsersPercentageChange = 100;
            }
        }

        return res.json({
            data: combinedData,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
            totalUsers,
            overallRevenuePercentageChange:
                Math.round(overallRevenuePercentageChange * 100) / 100,
            overallUsersPercentageChange:
                Math.round(overallUsersPercentageChange * 100) / 100,
            message: "Revenue and user statistics retrieved successfully",
        });
    } catch (err) {
        console.error("Error calculating revenue and users:", err);
        next(customError(err));
    }
}

async function getRecentActivities(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            activityType,
            startDate,
            endDate,
        } = req.query;

        // Build query object
        let query = {};

        // Add activity type filter if provided
        if (activityType) {
            query.activityType = activityType;
        }

        // Add date range filter if provided
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        // Execute query with pagination
        const activities = await RecentActivity.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("userId", "firstName lastName email");

        // Get total count for pagination
        const total = await RecentActivity.countDocuments(query);

        return res.json({
            activities,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            message: "Recent activities retrieved successfully",
        });
    } catch (err) {
        console.error("Error fetching recent activities:", err);
        next(customError(err));
    }
}

// Add activity logging helper function
async function logActivity(
    userId,
    activityType,
    description,
    amount = 0,
    status = "success",
    metadata = {}
) {
    try {
        const activity = new RecentActivity({
            userId,
            activityType,
            description,
            amount,
            status,
            metadata,
        });
        await activity.save();
        return activity;
    } catch (error) {
        console.error("Error logging activity:", error);
        // Don't throw the error to prevent disrupting the main flow
        return null;
    }
}

async function fundUserAccount(req, res, next) {
    try {
        const { accountNumber, amount } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists) return next(customError("Admin not found"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to fund this account")
            );

        const checkIfUserWalletExists = await Wallet.findOne({ accountNumber });

        if (!checkIfUserWalletExists)
            return next(customError("User wallet not found"));

        const updateUserWallet = await Wallet.findByIdAndUpdate(
            checkIfUserWalletExists._id,
            {
                balance: checkIfUserWalletExists.balance + amount,
            }
        );

        await logActivity(
            userId,
            "ADMIN_FUND",
            `Admin funded user account with ₦${amount}`,
            checkIfUserWalletExists.accountNumber
        );

        return res.json({ message: updateUserWallet, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function getAllTransactions(req, res, next) {
    try {
        const transactions = await TransactionHistoryWallet.find({}).sort({
            createdAt: -1,
        });

        return res.json({ message: transactions, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function getTransactionById(req, res, next) {
    try {
        const { transactionId } = req.params;

        const transaction = await TransactionHistoryWallet.findById(
            transactionId
        );

        if (!transaction) return next(customError("Transaction not found"));

        return res.json({ message: transaction, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function sendNotifications(req, res, next) {
    try {
        const { title, message, type } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to send notifications")
            );

        const payload = {
            title,
            message,
            type,
        };

        const newNotification = new Notifications(payload);

        await newNotification.save();

        return res.json({ message: newNotification, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function getAllNotifications(req, res, next) {
    try {
        const { type } = req.params;

        if (!type) return next(customError("Type is required"));

        const notifications = await Notifications.find({ type }).sort({
            createdAt: -1,
        });

        return res.json({ message: notifications, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function markUserNotificationsAsRead(req, res, next) {
    try {
        const notifications = await Notifications.updateMany(
            { type: "users" }, // Filter for notifications of type 'users'
            { $set: { read: true } }, // Ensure read is set to true even if missing
            { upsert: false } // Do not insert new documents, only update existing ones
        );

        return res.json({
            message: "Notifications updated",
            updatedCount: notifications.modifiedCount,
            status: 200,
        });
    } catch (error) {
        next(customError(error));
    }
}

async function fundReferralUsersAccount(req, res, next) {
    try {
        const { amount, referralCode } = req.body;

        const userId = req.userId;

        const checkIfReferralCodeExists = await User.findOne({ referralCode });

        if (!checkIfReferralCodeExists)
            return next(customError("Referral code not found"));

        const checkIfUserWalletExists = await Wallet.findOne({
            userId: checkIfReferralCodeExists._id,
        });

        if (!checkIfUserWalletExists)
            return next(customError("User wallet not found"));

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to fund this account")
            );

        const updateUserWallet = await Wallet.findByIdAndUpdate(
            checkIfReferralCodeExists._id,
            {
                balance: checkIfReferralCodeExists.balance + amount,
            }
        );

        await logActivity(
            checkIfReferralCodeExists._id,
            "ACCOUNT_FUNDING",
            `Admin funded user account with ₦${amount}`
        );

        return res.json({ message: updateUserWallet, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function getAllAdminOfficials(req, res, next) {
    try {
        const officials = await User.find({
            role: { $in: ["admin", "support"] },
        });

        if (officials.length === 0)
            return next(customError("No admin officials found"));

        // Map through officials and remove password from each object
        const officialsWithoutPassword = officials.map((official) => {
            const officialObj = official.toObject();
            delete officialObj.password;
            return officialObj;
        });

        return res.json({ message: officialsWithoutPassword, status: 200 });
    } catch (error) {
        next(customError(error));
    }
}

async function getTransactionStats(req, res, next) {
    try {
        // Get transactions grouped by type with counts and total amounts
        const transactionStats = await TransactionHistoryWallet.aggregate([
            {
                $match: { status: "success" },
            },
            {
                $group: {
                    _id: "$transactionType",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$amount" },
                },
            },
            {
                $project: {
                    type: "$_id",
                    count: 1,
                    totalAmount: 1,
                    _id: 0,
                },
            },
        ]);

        // Get total counts
        const totalTransactions = await TransactionHistoryWallet.countDocuments(
            { status: "success" }
        );
        const totalAmount = await TransactionHistoryWallet.aggregate([
            {
                $match: { status: "success" },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                },
            },
        ]);

        // Get monthly transaction counts
        const monthlyTransactions = await TransactionHistoryWallet.aggregate([
            {
                $match: {
                    status: "success",
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), 0, 1),
                    },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" },
                    },
                    count: { $sum: 1 },
                    amount: { $sum: "$amount" },
                },
            },
            {
                $sort: {
                    "_id.year": 1,
                    "_id.month": 1,
                },
            },
        ]);

        // Format monthly data
        const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        const monthlyData = months.map((name, index) => {
            const monthNumber = index + 1;
            const monthData = monthlyTransactions.find(
                (item) => item._id.month === monthNumber
            ) || { count: 0, amount: 0 };

            return {
                name,
                count: monthData.count || 0,
                amount: monthData.amount || 0,
            };
        });

        return res.json({
            transactionsByType: transactionStats,
            totalTransactions,
            totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
            monthlyData,
            message: "Transaction statistics retrieved successfully",
        });
    } catch (err) {
        console.error("Error calculating transaction statistics:", err);
        next(customError(err));
    }
}

async function getTotalTransactionsAmount(req, res, next) {
    try {
        const totalAmount = await TransactionHistoryWallet.aggregate([
            {
                $match: { status: "success" },
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $convert: {
                                input: "$amount",
                                to: "double",
                                onError: 0,
                                onNull: 0,
                            },
                        },
                    },
                },
            },
        ]);

        return res.json({
            totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
            message: "Total transaction amount retrieved successfully",
        });
    } catch (err) {
        console.error("Error calculating total amount:", err);
        next(customError(err));
    }
}

async function getUsersWalletAndTransactions(req, res, next) {
    try {
        // Get pagination parameters from query with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalUsers = await User.countDocuments();
        // Get total count of users for pagination

        // Get users with pagination
        const users = await User.find({}, { password: 0 })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }); // Sort by newest first

        // Get transaction counts for all users
        const transactionCounts = await TransactionHistoryWallet.aggregate([
            {
                $group: {
                    _id: "$userId",
                    totalTransactions: { $sum: 1 },
                    successfulTransactions: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "success"] }, 1, 0],
                        },
                    },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "success"] },
                                {
                                    $convert: {
                                        input: "$amount",
                                        to: "double",
                                        onError: 0,
                                        onNull: 0,
                                    },
                                },
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        // Get wallet balances for all users
        const wallets = await Wallet.find({});

        // Combine all the data
        const usersData = users.map((user) => {
            const userTransactions = transactionCounts.find(
                (t) => t._id.toString() === user._id.toString()
            ) || {
                totalTransactions: 0,
                successfulTransactions: 0,
                totalAmount: 0,
            };

            const userWallet = wallets.find(
                (w) => w.userId === user._id.toString()
            ) || {
                balance: 0,
                accountNumber: "Not created",
            };

            return {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                walletBalance: userWallet.balance,
                accountNumber: userWallet.accountNumber,
                totalTransactions: userTransactions.totalTransactions,
                successfulTransactions: userTransactions.successfulTransactions,
                totalTransactionAmount: userTransactions.totalAmount,
                createdAt: user.createdAt,
                isBlocked: user.isBlocked,
                isDeleted: user.isDeleted,
            };
        });

        return res.json({
            message: usersData,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
            usersPerPage: limit,
            status: 200,
        });
    } catch (err) {
        console.error("Error fetching users wallet and transactions:", err);
        next(customError(err));
    }
}

async function getActiveUsers(req, res, next) {
    try {
        const { timeframe = "30" } = req.query; // Default to 30 days
        const daysToConsider = parseInt(timeframe);

        // Calculate the date threshold
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - daysToConsider);

        // Get users who have made transactions within the timeframe
        const activeUserTransactions = await TransactionHistoryWallet.aggregate(
            [
                {
                    $match: {
                        createdAt: { $gte: dateThreshold },
                        status: "success",
                    },
                },
                {
                    $group: {
                        _id: "$userId",
                        lastTransaction: { $max: "$createdAt" },
                        transactionCount: { $sum: 1 },
                        totalAmount: {
                            $sum: {
                                $convert: {
                                    input: "$amount",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                },
                            },
                        },
                    },
                },
                {
                    $match: {
                        // Consider users active if they have made at least 2 transactions
                        transactionCount: { $gte: 2 },
                    },
                },
            ]
        );

        // Get user details for active users
        const activeUserIds = activeUserTransactions.map((t) => t._id);
        const activeUsers = await User.find(
            { _id: { $in: activeUserIds } },
            { password: 0 }
        );

        // Combine user details with their transaction data
        const activeUsersData = activeUsers.map((user) => {
            const transactionData = activeUserTransactions.find(
                (t) => t._id.toString() === user._id.toString()
            );

            return {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                lastTransaction: transactionData.lastTransaction,
                transactionCount: transactionData.transactionCount,
                totalAmount: transactionData.totalAmount,
            };
        });

        // Calculate activity metrics
        const totalActiveUsers = activeUsersData.length;
        const totalUsers = await User.countDocuments();
        const activeUserPercentage = (totalActiveUsers / totalUsers) * 100;

        // Get activity distribution
        const activityDistribution = {
            highlyActive: activeUsersData.filter((u) => u.transactionCount > 5)
                .length,
            moderatelyActive: activeUsersData.filter(
                (u) => u.transactionCount >= 3 && u.transactionCount <= 5
            ).length,
            lightlyActive: activeUsersData.filter(
                (u) => u.transactionCount === 2
            ).length,
        };

        return res.json({
            activeUsers: activeUsersData,
            metrics: {
                totalActiveUsers,
                totalUsers,
                activeUserPercentage:
                    Math.round(activeUserPercentage * 100) / 100,
                timeframeDays: daysToConsider,
                activityDistribution,
            },
            status: 200,
        });
    } catch (err) {
        console.error("Error fetching active users:", err);
        next(customError(err));
    }
}

async function getDashboardStats(req, res, next) {
    try {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

        // Get current and previous month's data
        const currentMonthStart = new Date(currentYear, currentMonth, 1);
        const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);

        // Fetch all required data in parallel
        const [
            currentMonthStats,
            previousMonthStats,
            activeUsers,
            totalUsers,
            monthlyTransactions,
            monthlyUserGrowth,
            recentActivities,
        ] = await Promise.all([
            // Current month statistics
            TransactionHistoryWallet.aggregate([
                {
                    $match: {
                        createdAt: { $gte: currentMonthStart },
                        status: "success",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: {
                            $sum: {
                                $convert: {
                                    input: "$amount",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                },
                            },
                        },
                        transactionCount: { $sum: 1 },
                    },
                },
            ]),

            // Previous month statistics
            TransactionHistoryWallet.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: previousMonthStart,
                            $lt: currentMonthStart,
                        },
                        status: "success",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: {
                            $sum: {
                                $convert: {
                                    input: "$amount",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                },
                            },
                        },
                        transactionCount: { $sum: 1 },
                    },
                },
            ]),

            // Active users in last 30 days
            TransactionHistoryWallet.aggregate([
                {
                    $match: {
                        createdAt: { $gte: thirtyDaysAgo },
                        status: "success",
                    },
                },
                {
                    $group: {
                        _id: "$userId",
                    },
                },
                {
                    $count: "activeUsers",
                },
            ]),

            // Total users count
            User.countDocuments(),

            // Monthly transactions for chart
            TransactionHistoryWallet.aggregate([
                {
                    $match: {
                        status: "success",
                        createdAt: { $gte: new Date(currentYear, 0, 1) },
                    },
                },
                {
                    $group: {
                        _id: {
                            month: { $month: "$createdAt" },
                            year: { $year: "$createdAt" },
                        },
                        amount: {
                            $sum: {
                                $convert: {
                                    input: "$amount",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                },
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { "_id.year": 1, "_id.month": 1 },
                },
            ]),

            // Monthly user growth for chart
            User.aggregate([
                {
                    $group: {
                        _id: {
                            month: { $month: "$createdAt" },
                            year: { $year: "$createdAt" },
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { "_id.year": 1, "_id.month": 1 },
                },
            ]),

            // Recent activities
            RecentActivity.find({
                createdAt: { $gte: thirtyDaysAgo },
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate("userId", "firstName lastName"),
        ]);

        // Calculate percentage changes and format data
        const currentMonthData = currentMonthStats[0] || {
            totalAmount: 0,
            transactionCount: 0,
        };
        const previousMonthData = previousMonthStats[0] || {
            totalAmount: 0,
            transactionCount: 0,
        };
        const activeUsersCount = activeUsers[0]?.activeUsers || 0;

        // Calculate percentage changes
        const revenueChange = previousMonthData.totalAmount
            ? ((currentMonthData.totalAmount - previousMonthData.totalAmount) /
                  previousMonthData.totalAmount) *
              100
            : 0;
        const transactionChange = previousMonthData.transactionCount
            ? ((currentMonthData.transactionCount -
                  previousMonthData.transactionCount) /
                  previousMonthData.transactionCount) *
              100
            : 0;

        // Format chart data
        const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        const chartData = months.map((month, index) => {
            const monthNumber = index + 1;
            const transactionData = monthlyTransactions.find(
                (item) => item._id.month === monthNumber
            ) || { amount: 0, count: 0 };
            const userData = monthlyUserGrowth.find(
                (item) => item._id.month === monthNumber
            ) || { count: 0 };

            return {
                month,
                amount: transactionData.amount,
                transactionCount: transactionData.count,
                userCount: userData.count,
            };
        });

        // Calculate average transaction value
        const avgTransactionValue = currentMonthData.transactionCount
            ? currentMonthData.totalAmount / currentMonthData.transactionCount
            : 0;

        // Calculate user activity rate
        const userActivityRate = totalUsers
            ? (activeUsersCount / totalUsers) * 100
            : 0;

        return res.json({
            status: 200,
            data: {
                overview: {
                    totalRevenue: {
                        amount: currentMonthData.totalAmount,
                        percentageChange: Math.round(revenueChange * 100) / 100,
                    },
                    totalUsers: {
                        count: totalUsers,
                        activeUsers: activeUsersCount,
                    },
                    totalTransactions: {
                        count: currentMonthData.transactionCount,
                        percentageChange:
                            Math.round(transactionChange * 100) / 100,
                    },
                    avgTransactionValue,
                    userActivityRate: Math.round(userActivityRate * 100) / 100,
                },
                charts: {
                    transactionOverview: chartData,
                    userGrowth: chartData,
                },
                recentActivities: recentActivities.map((activity) => ({
                    id: activity._id,
                    user: `${activity?.username}`,
                    type: activity?.activityType,
                    description: activity?.description,
                    amount: activity?.amount,
                    date: activity?.createdAt,
                })),
            },
        });
    } catch (err) {
        console.error("Error fetching dashboard statistics:", err);
        next(customError(err));
    }
}
async function updateDataPlan(req, res, next) {
    try {
        const { subcategory_id, planName, newAmount } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to fund this account")
            );

        // Validate input
        if (!subcategory_id || !planName || newAmount === undefined) {
            return next(
                customError(
                    "Missing parameters: subcategory_id, planName, and newAmount are required",
                    400
                )
            );
        }

        // Update the specific plan's amount
        const result = await DataPlan.updateOne(
            {
                "plans.subcategory_id": subcategory_id,
                "plans.plan.plan": planName,
            },
            { $set: { "plans.$[outer].plan.$[inner].amount": newAmount } },
            {
                arrayFilters: [
                    { "outer.subcategory_id": subcategory_id }, // Filter for the outer array (plans)
                    { "inner.plan": planName }, // Filter for the inner array (plan)
                ],
                new: true, // Return the updated document
            }
        );

        // Check if the update was successful
        if (result.matchedCount === 0) {
            return next(customError("Data plan not found", 404));
        }

        return res.json({
            message: "Data plan updated successfully",
            status: 200,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function updateNineMobilePlan(req, res, next) {
    try {
        const { planId, newAmount } = req.body;

        if (!planId || newAmount === undefined) {
            return next(
                customError(
                    "Missing parameters: planId and newAmount are required",
                    400
                )
            );
        }

        // Assuming you have a DataPlan model to interact with the Nine Mobile plans
        const updatedPlan = await DataPlan.findOneAndUpdate(
            { _id: planId, network: "9MOBILE" }, // Ensure we are updating the correct network
            { amount: newAmount },
            { new: true }
        );

        if (!updatedPlan) {
            return next(customError("Nine Mobile plan not found", 404));
        }

        return res.json({
            message: "Nine Mobile plan updated successfully",
            updatedPlan,
            status: 200,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function getNineMobileDataPlans(req, res, next) {
    try {
        const dataPlans = await nineMobileDataPlans.find();

        if (dataPlans.length === 0)
            return next(customError("Data plans not found"));

        return res.json({ message: dataPlans });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

const getDataPlans = async (req, res) => {
    try {
        const pluginUrl = process.env.PLUGIN_URL; // or your defined pluginUrl

        // Step 1: Log in to get the token
        const loginResponse = await axios.post(`${pluginUrl}login`, {
            email: process.env.PLUGIN_EMAIL,
            password: process.env.PLUGIN_PASSWORD,
        });

        const token = loginResponse.data.data.token;

        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        // Step 2: Fetch all plans from your API endpoint
        const response = await axios.get(`${pluginUrl}get/plans`, { headers });

        // Step 3: Extract data plans
        const allPlans = response.data.data;
        const dataPlans = allPlans.filter((plan) => plan.category === "Data");

        // Step 4: Store data plans in the database
        await DataPlans.deleteMany({}); // Clear existing plans before saving new ones

        const newPlans = new DataPlans({
            plans: dataPlans.map((plan) => ({
                subcategory_id: plan.subcategory_id,
                title: plan.title,
                category: plan.category,
                plan: plan.plan.map((p) => ({
                    plan: p.plan,
                    amount: p.amount,
                    userPrice: 0, // Placeholder for user price
                    total: p.amount, // Total is initially set to the original amount
                })),
            })),
        });

        await newPlans.save();

        // Step 5: Fetch user-specific prices
        const userPrices = await UserDataPlanPrices.find({}); // Fetch all user prices

        // Step 6: Merge user prices with data plans
        dataPlans.forEach((plan) => {
            plan.plan.forEach((p) => {
                const userPriceEntry = userPrices.find(
                    (up) =>
                        up.plan === p.plan &&
                        up.subcategory_id === plan.subcategory_id
                );
                if (userPriceEntry) {
                    p.userPrice = userPriceEntry.userPrice; // Set user price
                    p.total = p.userPrice + p.amount; // Calculate total
                } else {
                    p.userPrice = 0; // Default user price if not set
                    p.total = p.amount; // Total is just the original amount
                }
            });
        });

        // Step 7: Return the updated plans with user prices and totals
        res.status(200).json({ data: dataPlans });
    } catch (error) {
        console.error("Error fetching mobile network plans:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: error.message,
        });
    }
};

async function getServiceFees(req, res, next) {
    try {
        // Assuming you have a ServiceFees model
        const serviceFees = await ServiceFees.find();

        if (serviceFees.length === 0) {
            const storeServiceFees = new ServiceFees({
                giftcards: 0,
                "virtual-card": 0,
                airtime2cash: 0,
                betting: 0,
                esims: 0,
                deposits: 0,
                flight: 0,
                insurance: 0,
                "intl-airtime-data": 0,
                education: 0,
                tv: 0,
                electricity: 0,
                internet: 0,
            });

            await storeServiceFees.save();

            return res.json({ message: storeServiceFees[0], status: 200 });
        }

        return res.json({ message: serviceFees, status: 200 });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function getWithdrawalFees(req, res, next) {
    try {
        // Assuming you have a WithdrawalFees model
        const withdrawalFees = await WithdrawalFees.find();

        if (withdrawalFees.length === 0) {
            const storeFees = new WithdrawalFees({
                method: "withdrawal",
                tier: "1st",
                minAmount: 100,
                maxAmount: 200000,
                fixedFee: 100,
            });

            await storeFees.save();

            return res.json({ message: [storeFees], status: 200 });
        }
        return res.json({ message: withdrawalFees, status: 200 });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function updateServiceFees(req, res, next) {
    try {
        const { fees } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to fund this account")
            );

        if (!fees) {
            return next(
                customError("Missing parameters: fees are required", 400)
            );
        }

        // Assuming you have a ServiceFees model to update
        const data = await ServiceFees.updateMany({}, { $set: fees });

        return res.json({
            message: "Service fees updated successfully",
            status: 200,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

const updateWithdrawalFees = async (req, res, next) => {
    try {
        const { fees } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to fund this account")
            );

        if (!fees || !Array.isArray(fees)) {
            return next(
                customError("Missing parameters: fees must be an array", 400)
            );
        }

        const bulkOps = fees.map((fee) => ({
            updateOne: {
                filter: { _id: fee._id }, // Match by _id
                update: { $set: { fixedFee: fee.fixedFee } }, // Only update fixedFee
            },
        }));

        const result = await WithdrawalFees.bulkWrite(bulkOps);

        return res.json({
            message: "Withdrawal fees updated successfully",
            status: 200,
            modifiedCount: result.modifiedCount,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
};

async function storeServiceFees(req, res, next) {
    try {
        const serviceFeesData = req.body;

        // Create a new ServiceFees document
        const newServiceFees = new ServiceFees(serviceFeesData);
        await newServiceFees.save();

        return res.json({
            message: "Service fees stored successfully",
            newServiceFees,
            status: 201,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function storeWithdrawalFees(req, res, next) {
    try {
        const withdrawalFeesData = req.body;

        // Create a new WithdrawalFees document
        const newWithdrawalFees = new WithdrawalFees(withdrawalFeesData);
        await newWithdrawalFees.save();

        return res.json({
            message: "Withdrawal fees stored successfully",
            newWithdrawalFees,
            status: 201,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function getReferralStats(req, res, next) {
    try {
        const totalReferrals = await Referral.countDocuments();
        const activeCodes = await Referral.countDocuments({
            usageCount: { $gt: 0 },
        });
        const totalRewards = await Referral.aggregate([
            { $group: { _id: null, total: { $sum: "$totalReward" } } },
        ]);

        return res.json({
            totalReferrals,
            activeCodes,
            totalRewards: totalRewards.length > 0 ? totalRewards[0].total : 0,
            status: 200,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function listReferrals(req, res, next) {
    try {
        const referrals = await Referral.find()(referrals, "referraks");
        const referralUsers = await Promise.all(
            referrals.map(async (el) => {
                const users = await User.find({
                    referralCode: el.referralCode,
                });
                // Assuming you want to add `referrerCode` or any other property to each user
                return users.map((user) => ({
                    ...user.toObject(), // Convert Mongoose document to plain JS object
                    usageCount: el.usageCount, // Add additional property
                    // You can add more properties here,
                    referralCode: user.referralCode,
                    totalReward: el.totalReward,
                }));
            })
        );

        return res.json({
            referralUsers: referralUsers.flat(),
            status: 200,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

async function creditUserByReferralCode(req, res, next) {
    try {
        const { referralCode, creditAmount } = req.body;

        const userId = req.userId;

        const checkIfAdminExists = await User.findById(userId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));

        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to fund this account")
            );

        if (!referralCode || creditAmount === undefined) {
            return next(
                customError(
                    "Missing parameters: referralCode and creditAmount are required",
                    400
                )
            );
        }

        // Find the referral using the referral code
        const referral = await Referral.findOne({ referralCode });

        if (!referral) {
            return next(customError("Referral code not found", 404));
        }

        // Update the usage count and total reward for the referral
        referral.usageCount += 1;
        referral.totalReward += creditAmount;
        await referral.save();

        // Credit the referrer's wallet
        const userWallet = await Wallet.findOne({
            userId: referral.referrerId,
        });
        if (userWallet) {
            userWallet.balance += creditAmount;
            await userWallet.save();
        }

        return res.json({
            message: "User credited successfully",
            referral,
            status: 200,
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

const updateUserDataPlanPrice = async (req, res, next) => {
    try {
        const { subcategory_id, plan, userPrice } = req.body;

        // Check if the user price entry exists for the specific plan in the given subcategory
        let userPriceEntry = await UserDataPlanPrices.findOne({
            subcategory_id,
            plan,
        });

        if (userPriceEntry) {
            // Update existing entry
            userPriceEntry.userPrice = userPrice;
            await userPriceEntry.save();
        } else {
            // Create a new entry if it doesn't exist
            userPriceEntry = new UserDataPlanPrices({
                subcategory_id,
                plan,
                userPrice,
            });
            await userPriceEntry.save();
        }

        return res.json({
            message: "User price updated successfully",
            data: userPriceEntry,
        });
    } catch (error) {
        console.error("Error updating user data plan price:", error);
        next(customError(error));
    }
};

/**
 * Block a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function blockUser(req, res, next) {
    try {
        const { userId, action } = req.params;

        // Check if admin exists and has proper permissions
        const adminId = req.userId;
        const checkIfAdminExists = await User.findById(adminId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));
        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to block this user")
            );

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) return next(customError("User not found"));

        if (action === "block") {
            // If user is already blocked
            if (user.isBlocked)
                return next(customError("User is already blocked"));

            // Block the user
            const blockedUser = await User.findByIdAndUpdate(
                userId,
                { isBlocked: true },
                { new: true }
            );

            // Log the activity
            await logActivity(
                adminId,
                "USER_BLOCKED",
                `Admin blocked user ${user.firstName} ${user.lastName}`,
                0,
                "success",
                { userId, email: user.email }
            );

            return res.json({
                message: "User blocked successfully",
                user: blockedUser,
                status: 200,
            });
        } else if (action === "unblock") {
            // Block the user
            const blockedUser = await User.findByIdAndUpdate(
                userId,
                { isBlocked: false },
                { new: true }
            );

            // Log the activity
            await logActivity(
                adminId,
                "USER_UNBLOCKED",
                `Admin unblocked user ${user.firstName} ${user.lastName}`,
                0,
                "success",
                { userId, email: user.email }
            );

            return res.json({
                message: "User unblocked successfully",
                user: blockedUser,
                status: 200,
            });
        }
    } catch (err) {
        console.error("Error blocking user:", err);
        next(customError(err));
    }
}

/**
 * Unblock a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function unblockUser(req, res, next) {
    try {
        const { userId } = req.params;

        // Check if admin exists and has proper permissions
        const adminId = req.userId;
        const checkIfAdminExists = await User.findById(adminId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));
        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to unblock this user")
            );

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) return next(customError("User not found"));

        // If user is not blocked
        if (!user.isBlocked) return next(customError("User is not blocked"));

        // Unblock the user
        const unblockedUser = await User.findByIdAndUpdate(
            userId,
            { isBlocked: false },
            { new: true }
        );

        // Log the activity
        await logActivity(
            adminId,
            "USER_UNBLOCKED",
            `Admin unblocked user ${user.firstName} ${user.lastName}`,
            0,
            "success",
            { userId, email: user.email }
        );

        return res.json({
            message: "User unblocked successfully",
            user: unblockedUser,
            status: 200,
        });
    } catch (err) {
        console.error("Error unblocking user:", err);
        next(customError(err));
    }
}

/**
 * Delete a user (soft delete by setting isDeleted flag)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */

async function deleteUser(req, res, next) {
    try {
        const { userId } = req.params;

        // Check if admin exists and has proper permissions
        const adminId = req.userId;
        const checkIfAdminExists = await User.findById(adminId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));
        if (checkIfAdminExists.role !== "admin")
            return next(
                customError("You are not authorized to delete this user")
            );

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) return next(customError("User not found"));

        // If user is already deleted
        if (user.isDeleted) return next(customError("User is already deleted"));

        // Soft delete the user by setting isDeleted flag
        const deletedUser = await User.findByIdAndUpdate(
            userId,
            { isDeleted: true },
            { new: true }
        );

        // Log the activity
        await logActivity(
            adminId,
            "USER_DELETED",
            `Admin deleted user ${user.firstName} ${user.lastName}`,
            0,
            "success",
            { userId, email: user.email }
        );

        return res.json({
            message: "User deleted successfully",
            user: deletedUser,
            status: 200,
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        next(customError(err));
    }
}

async function hardDeleteUser(req, res, next) {
    try {
        const { userId } = req.params;

        // Check if admin exists and has proper permissions
        const adminId = req.userId;
        const checkIfAdminExists = await User.findById(adminId);

        if (!checkIfAdminExists)
            return next(customError("Admin does not exist"));
        if (checkIfAdminExists.role !== "admin")
            return next(
                customError(
                    "You are not authorized to permanently delete this user"
                )
            );

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) return next(customError("User not found"));

        // Hard delete the user (completely remove from database)
        await User.findByIdAndDelete(userId);

        // Log the activity
        await logActivity(
            adminId,
            "USER_HARD_DELETED",
            `Admin permanently deleted user ${user.firstName} ${user.lastName}`,
            0,
            "success",
            { userId, email: user.email }
        );

        return res.json({
            message: "User permanently deleted successfully",
            status: 200,
        });
    } catch (err) {
        console.error("Error permanently deleting user:", err);
        next(customError(err));
    }
}

async function getReferredUsers(req, res, next) {
    try {
        const { code } = req.params;

        const findReferredUsers = await Referral.find({ referralCode: code });

        if (findReferredUsers.length === 0)
            return next(customError("Referral not found"));

        const listOutUsers = await Promise.all(
            findReferredUsers[0].referredUsersId.map(async (el) => {
                const findUsers = await User.findById(el);

                return findUsers;
            })
        );

        return res.json({ message: listOutUsers });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

module.exports = {
    signupUserWithEmail,
    signinWithEmailAndPassword,
    logoutUserSession,
    getAllUsers,
    getTotalRevenue,
    getRecentActivities,
    logActivity,
    fundUserAccount,
    getAllTransactions,
    getTransactionById,
    sendNotifications,
    getAllNotifications,
    fundReferralUsersAccount,
    resetUserPassword,
    verifyEmailOtpSentToUser,
    sendEmailOtpForForgottenPassword,
    getAllAdminOfficials,
    updateAdminRole,
    addAdminOfficials,
    deleteAdminOfficials,
    getTransactionStats,
    getTotalTransactionsAmount,
    getUsersWalletAndTransactions,
    getActiveUsers,
    getDashboardStats,
    updateDataPlan,
    updateNineMobilePlan,
    getNineMobileDataPlans,
    getDataPlans,
    getServiceFees,
    getWithdrawalFees,
    updateServiceFees,
    updateWithdrawalFees,
    storeServiceFees,
    storeWithdrawalFees,
    getReferralStats,
    listReferrals,
    creditUserByReferralCode,
    markUserNotificationsAsRead,
    updateUserDataPlanPrice,
    blockUser,
    unblockUser,
    deleteUser,
    hardDeleteUser,
    getReferredUsers,
};
