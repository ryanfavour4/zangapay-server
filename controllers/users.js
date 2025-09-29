const {
    createUserWithEmailAndPassword,
    deleteUser,
    logoutUser,
    sendEmailOneTimePassword,
    sendPhoneOneTimePassword,
    signInUserWithAppleOauth,
    signInWithEmailAndPassword,
    updateUserPassword,
    updateUserPhoneNumber,
    verifyUserOneTimePassword,
    createUserUsingEmailForOauth,
    createAnnoymousSession,
} = require("../utils/appwrite.js");
const { v4: uuid } = require("uuid");
const User = require("../models/user.js");
const customError = require("../customError.js");
const { default: mongoose } = require("mongoose");
const Pins = require("../models/Pin.js");
const bcrypt = require("bcryptjs");
const generateReferralCode = require("../utils/referralCodes.js");
const { generateToken } = require("../utils/jwt.js");
const {
    setSessionExpirationInHours,
} = require("../utils/sessionExpiration.js");
const generateOneTimePasswords = require("../utils/oneTimePasswords.js");
const {
    setSessionExpirationInMinutes,
} = require("../utils/sessionExpiration.js");
const { sendOTPEmail } = require("../mail template/authentication-mail.js");
const EmailOtps = require("../models/emailOtps.js");
const hasOtpExpired = require("../utils/verifyOtpValidity.js");
const Referral = require("../models/referral.js");
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");

const signupValidators = [
    body("email").isEmail().normalizeEmail(),
    body("firstName").isString().isLength({ min: 1, max: 50 }).trim().escape(),
    body("lastName").isString().isLength({ min: 1, max: 50 }).trim().escape(),
    body("password").isString().isLength({ min: 8, max: 100 }),
    body("phone").isString().isLength({ min: 7, max: 20 }).trim().escape(),
    body("code").optional().isString().isLength({ max: 20 }).trim().escape(),
];

const signinValidators = [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8, max: 100 }),
];

// Signup user with email
async function signupUserWithEmail(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({ message: "Invalid input", errors: errors.array() });
        }
        const { email, firstName, lastName, password, phone, code } = req.body;

        const checkIfEmailExists = await User.find({ email });
        const checkIfPhoneExists = await User.find({ phone });

        if (checkIfEmailExists.length > 0)
            return next(customError("User email exists in our database"));

        if (checkIfPhoneExists.length > 0)
            return next(customError("User phone exists in our database"));

        let salt = await bcrypt.genSalt(10);
        let hash = await bcrypt.hash(password, salt);

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
        });

        await createNewUser.save();

        if (code) {
            // Create a new referral entry for the user

            const checkIfReferralExists = await Referral.find({
                referralCode: code,
            });

            if (checkIfReferralExists.length === 0) {
                const newReferral = new Referral({
                    referralCode: code,
                    usageCount: 1,
                    referredUsersId: [createNewUser._id],
                });

                await newReferral.save();
            } else {
                const updateReferral = await Referral.findByIdAndUpdate(
                    checkIfReferralExists[0]._id,
                    {
                        $set: {
                            usageCount: checkIfReferralExists[0].usageCount + 1,
                            referredUsersId: [
                                ...checkIfReferralExists[0].referredUsersId,
                                createNewUser._id,
                            ],
                        },
                    }
                );
            }
        }

        return res.json({ message: [createNewUser], status: 200 });
    } catch (err) {
        console.log("Signup error:", err.message);
        next(customError(err));
    }
}

// Signin with email and password
async function signinWithEmailAndPassword(req, res, next) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({ message: "Invalid input", errors: errors.array() });
        }
        const { email, password } = req.body;

        const getUserInfo = await User.find({ email });

        if (getUserInfo.length === 0)
            return next(
                customError(
                    "User does not exist. Please register to gain access"
                )
            );

        const isPasswordMatch = await bcrypt.compare(
            password,
            getUserInfo[0].password
        );

        if (!isPasswordMatch) return next(customError("Incorrect password."));

        // Generate a new sessionId for single-session enforcement
        const newSessionId = crypto.randomBytes(32).toString("hex");
        await User.findByIdAndUpdate(getUserInfo[0]._id, {
            sessionId: newSessionId,
        });

        const token = generateToken(getUserInfo[0]._id, "email", newSessionId);

        if (getUserInfo[0].isBlocked)
            return next(
                customError(
                    "Your account is currently blocked. Contact customer support",
                    401
                )
            );

        if (getUserInfo[0].isDeleted)
            return next(
                customError("Your account is deleted and does not exist.")
            );

        const sessionExpirationDuration = setSessionExpirationInHours(1);

        const updateUserSession = await User.findByIdAndUpdate(
            getUserInfo[0]._id,
            {
                sessionExpireAt: sessionExpirationDuration,
            },
            { new: true }
        );

        const userObject = updateUserSession.toObject();

        const { password: pass, ...withoutPassword } = userObject;

        return res.json({
            message: { user: withoutPassword, token },
            status: 200,
        });
    } catch (err) {
        console.log("Signin error:", err.message);
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

// Delete user from codebase
async function deleteUserFromCodebase(req, res, next) {
    try {
        const userId = req.userId;

        if (!userId)
            return next(
                customError("You have a missing parameter (userId, identityId)")
            );

        const response = await User.findByIdAndUpdate(userId, {
            isDeleted: true,
        });

        return res.json({ message: "User have been deleted", status: 200 });
    } catch (err) {
        next(customError(err));
    }
}

async function sendPhoneOtpForVerification(req, res, next) {
    try {
        const { userId, phone } = req.body;

        console.log(userId, phone, "user");

        const sendOtp = await sendPhoneOneTimePassword(userId, phone);

        console.log(sendOtp);
        return res.json({ message: sendOtp });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function verifyOtpSentToUser(req, res, next) {
    try {
        const { userId, otp } = req.body;

        console.log(userId, otp);

        const verifyOtp = await verifyUserOneTimePassword(userId, otp);

        console.log(verifyOtp);

        return res.json({ message: verifyOtp });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

// Send email OTP for verification
async function sendEmailOtpForVerification(req, res, next) {
    try {
        const { email } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists[0].length === 0)
            return next(customError("User does not exist"));

        const checkIfUserHasValidOtp = await EmailOtps.find({
            email,
            isValid: true,
        });
        console.log(checkIfUserHasValidOtp, "email otps");

        if (checkIfUserHasValidOtp.length > 0) {
            const updateAllValidOtpToInvalid = await EmailOtps.updateMany(
                { email, isValid: true },
                { $set: { isValid: false } }
            );

            const otp = generateOneTimePasswords();

            const expirationTime = setSessionExpirationInMinutes(5);

            console.log(
                "Generated Expiration Time (ms):",
                expirationTime.getTime()
            );
            console.log("Current Time at Creation (ms):", Date.now());

            const newOtp = new EmailOtps({
                userId: checkIfUserEmailExists[0]._id,
                otp,
                expirationTime,
                email: checkIfUserEmailExists[0].email,
                isValid: true,
            });

            await newOtp.save();

            console.log("Current Time After Save:", Date.now());
            sendOTPEmail(
                checkIfUserEmailExists[0].email,
                "Verify Your Email",
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
            "Verify Your Email",
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

async function sendEmailOtpForForgottenPassword(req, res, next) {
    try {
        const { email } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists[0].length === 0)
            return next(customError("User does not exist"));

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

async function sendEmailOtpForResetPin(req, res, next) {
    try {
        const { email } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists[0].length === 0)
            return next(customError("User does not exist"));

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
                "Reset Your Pin",
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
            "Reset Your Pin",
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

async function sendEmailOtpForSignin(req, res, next) {
    try {
        const { email } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists[0].length === 0)
            return next(customError("User does not exist"));

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
                "Signin To Zangapay Account",
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
            "Signin To Zangapay Account",
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

async function sendEmailOtpForAccountDeletion(req, res, next) {
    try {
        const { email } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists[0].length === 0)
            return next(customError("User does not exist"));

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
                "Delete Zangapay Account",
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
            "Delete Zangapay Account",
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
// Verify OTP sent to user
async function verifyEmailOtpSentToUser(req, res, next) {
    try {
        const { otp, email } = req.body;

        console.log(otp, email);
        const [checkIfUserExists, checkIfUserOtpExists] = await Promise.all([
            User.find({ email }),
            EmailOtps.findOne({ email, isValid: true }).sort({ createdAt: -1 }),
        ]);

        console.log(checkIfUserExists, "checkIfUserExists");

        if (checkIfUserExists.length === 0)
            return next(customError("Email not found"));

        if (!checkIfUserOtpExists)
            return next(
                customError("Otp is expired or not sent by user. Try again")
            );

        if (hasOtpExpired(checkIfUserOtpExists.expirationTime))
            return next(customError("Otp is currently expired. Try again"));

        console.log(checkIfUserOtpExists);

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

// Handle forgotten password
async function resetUserPassword(req, res, next) {
    try {
        const { email, password } = req.body;

        const checkIfUserEmailExists = await User.find({ email });

        if (checkIfUserEmailExists.length === 0)
            return next(customError("User does not exist"));

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(password, salt);

        const updatedPassword = await User.findOneAndUpdate(
            { email },
            { password: hash },
            { new: true }
        );

        return res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function updateUserPasswordDb(req, res, next) {
    try {
        const { password } = req.body;

        const userId = req.userId;

        const checkIfUserEmailExists = await User.findById(userId);

        if (!checkIfUserEmailExists)
            return next(customError("User does not exist"));

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

// Update user info in the database
async function updateUserInfoInDb(req, res, next) {
    try {
        const { ...updateData } = req.body;

        console.log(updateData.updateData.profileImage, "updateUserInfo");

        const userId = req.userId;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData.updateData,
            { new: true }
        );

        console.log(updatedUser, "usee");
        return res.json({ message: updatedUser });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

// Get user info from the database
async function getUserInfoFromDb(req, res, next) {
    try {
        const userId = req.userId;

        const findUserById = await User.findById(userId);

        if (!findUserById) return next(customError("User does not exist"));

        return res.json({ message: findUserById });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function getCurrentSession(req, res, next) {
    try {
        const userId = req.userId;

        const findUserById = await User.findById(userId);

        if (!findUserById) return next(customError("User does not exist"));

        if (hasSessionExpired(findUserById.sessionExpireAt))
            return next(customError("User session has expired"));

        return res.json({ message: "User session is still valid" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function blockUser(req, res, next) {
    try {
        const userId = req.userId;

        const checkIfUserExists = await User.findById(userId);

        if (!checkIfUserExists) return next(customError("User does not exist"));

        await User.findByIdAndUpdate(userId, {
            isBlocked: true,
        });

        return res.json({ message: "User blocked successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function createUserPin(req, res, next) {
    try {
        const { pin, userId } = req.body;

        if (!pin || !userId) return next(customError("Pin must be provided"));

        const checkIfUserPinExists = await Pins.find({ userId });

        if (checkIfUserPinExists.length > 0) {
            let salt = bcrypt.genSaltSync(10);
            let hash = bcrypt.hashSync(pin, salt);

            const updatePin = await Pins.findByIdAndUpdate(
                checkIfUserPinExists[0]._id,
                {
                    pin: hash,
                }
            );

            return res.json({ message: "Pin updated successfully" });
        }

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(pin, salt);

        const newUserPin = new Pins({
            userId,
            pin: hash,
        });

        await newUserPin.save();

        console.log(newUserPin);

        return res.json({ message: "Pin Created successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function loginUserPin(req, res, next) {
    try {
        const { pin, userId } = req.body;

        if (!pin || !userId) return next(customError("Pin must be provided"));

        const checkIfUserPinExists = await Pins.find({ userId });

        if (checkIfUserPinExists.length === 0)
            return next(customError("Pin does not exit"));

        let isMatched = bcrypt.compareSync(pin, checkIfUserPinExists[0].pin);

        if (!isMatched) return next(customError("Invalid pin"));

        const token = generateToken(userId, "pin");

        return res.json({ message: "Pin is valid", token });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function transactionUserPin(req, res, next) {
    try {
        const { pin, userId } = req.body;

        if (!pin || !userId) return next(customError("Pin must be provided"));

        const checkIfUserPinExists = await Pins.find({ userId });

        if (checkIfUserPinExists.length === 0)
            return next(customError("Pin does not exit"));

        let isMatched = bcrypt.compareSync(pin, checkIfUserPinExists[0].pin);

        if (!isMatched) return next(customError("Invalid pin"));

        return res.json({ message: "Pin is valid" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function changeUserPin(req, res, next) {
    try {
        const { pin } = req.body;

        console.log(pin, "pin");

        const userId = req.userId;

        console.log(userId, "userId");

        if (!pin || !userId) return next(customError("Pin must be provided"));

        const checkIfUserPinExists = await Pins.find({ userId });

        if (checkIfUserPinExists.length === 0)
            return next(customError("Pin does not exit"));

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(pin, salt);

        const updateUserPin = await Pins.findByIdAndUpdate(
            checkIfUserPinExists[0]._id,
            {
                pin: hash,
            }
        );

        return res.json({ message: "Pin updated successfully" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function checkIfUserHavePin(req, res, next) {
    try {
        const { userId } = req.params;

        if (!userId) return next(customError("Pin must be provided"));

        const checkIfUserPinExists = await Pins.find({ userId });

        if (checkIfUserPinExists.length === 0)
            return next(customError("Pin does not exit"));

        return res.json({ message: "User have a pin" });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}
// Update user info in the database
// async function updateUserInfoInDb(req, res, next) {
//     try {
//         const { userId, updateData, isNotUpdating = false } = req.body;

//         console.log(updateData, 'update data');
//         const getUser = await User.findById(userId);

//         console.log('found user', getUser)
//         if (!getUser) {
//             return next(customError('User not found'));
//         }

//         if (updateData?.phone) {
//             const existingUser = await User.findOne({ phone: updateData.phone });

//             if (existingUser && existingUser._id.toString() !== userId) {
//                 return next(customError('Phone number already in use by another user'));
//             }
//         }

//         if (isNotUpdating) {
//             const existingUser = await User.findOne({ phone: updateData.phone });

//             if (existingUser.length > 0) {
//                 return next(customError('Phone number already in use by another user'));
//             }
//         } else {
//             console.log('reached update place')
//             const response = await User.findByIdAndUpdate(updateData.userId, updateData, { new: true, runValidators: true });

//             console.log(response, 'updated user');
//             return res.json({ message: response });
//         }
//     } catch (err) {
//         console.log(err);
//         next(customError(err));
//     }
// }

// // Update user phone number in Auth
// async function updateUserPhoneInAuth(req, res, next) {
//     try {
//         const { phone } = req.body;

//         const findUserByPhone = await User.find({ phone });

//         if (findUserByPhone.length === 0)
//             return next(customError('User does not have a phone number or does not exist'));

//         const response = await updateUserPhoneNumber(findUserByPhone[0].userAuthId, phone);

//         return res.json({ message: 'User phone has been updated' });
//     } catch (err) {
//         next(customError(err));
//     }
// }

// // Get user info from the database
// async function getUserInfoFromDb(req, res, next) {
//     try {
//         const { userId, email } = req.body;

//         console.log(userId,'userId')

//        if(!email){
//         const findUserById = await User.find({ _id: userId });

//         if (findUserById.length === 0)
//             return next(customError('User does not exist'));

//         return res.json({ message: findUserById[0] });
// }
// else{
//         const findUserByEmail = await User.find({email});

//        console.log(findUserByEmail, 'user');

//         if (findUserByEmail.length === 0)
//             return next(customError('User does not have an email or does not exist'));

//         return res.json({ message: findUserByEmail[0] });
// }
//     } catch (err) {
//         console.log(err);
//         next(customError(err));
//     }
// }

// async function getCurrentSession(req, res, next) {
//   try {
//     const { userId } = req.params;

//     console.log(userId, 'userId');

//     if (!userId) return next(customError('User is not authenticated'));

//     // Validate if userId is a valid ObjectId
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return next(customError('Invalid user Id'));
//     }

//     const objectId = new mongoose.Types.ObjectId(userId);

//     console.log('Passed through');

//     const findUserById = await User.find({ _id: objectId });

//     console.log(findUserById, 'user');

//     if (findUserById.length === 0)
//       return next(customError('User does not exist'));

//     const currentDate = Date.now();

//     if (findUserById[0].sessionExpireAt < currentDate)
//       return next(customError('User session has expired'));

//     return res.json({ message: findUserById[0] });
//   } catch (err) {
//     console.log(err);
//     next(customError(err));
//   }
// }

module.exports = {
    signupUserWithEmail,
    signinWithEmailAndPassword,
    logoutUserSession,
    deleteUserFromCodebase,
    sendEmailOtpForForgottenPassword,
    sendEmailOtpForVerification,
    sendEmailOtpForResetPin,
    sendEmailOtpForSignin,
    sendEmailOtpForAccountDeletion,
    verifyEmailOtpSentToUser,
    resetUserPassword,
    transactionUserPin,
    updateUserPassword,
    updateUserInfoInDb,
    getUserInfoFromDb,
    getCurrentSession,
    blockUser,
    createUserPin,
    loginUserPin,
    changeUserPin,
    sendPhoneOtpForVerification,
    verifyOtpSentToUser,
    checkIfUserHavePin,
    updateUserPasswordDb,
    signupValidators,
    signinValidators,
};

