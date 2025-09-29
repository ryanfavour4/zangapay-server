const express = require('express');
const { signupUserWithEmail, signinWithEmailAndPassword, getUserInfoFromDb,sendEmailOtpForVerification, getCurrentSession, updateUserInfoInDb, logoutUserSession, createUserPin, changeUserPin, loginUserPin, sendEmailOtpForResetPin, checkIfUserHavePin, deleteUserFromCodebase, updateUserPassword, resetUserPassword, verifyEmailOtpSentToUser, sendEmailOtpForForgottenPassword, sendEmailOtpForSignin, sendEmailOtpForAccountDeletion, transactionUserPin, sendPhoneOtpForVerification, verifyOtpSentToUser, updateUserPasswordDb, signupValidators, signinValidators } = require('../controllers/users');

const authMiddleware = require('../middlewares/authMiddleware');
const rateLimit = require('express-rate-limit');


const router = express.Router();

// Rate limiter for auth endpoints (5 requests per minute per IP)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts, please try again in a minute.'
});

router.post('/user/signup', authLimiter, signupValidators, signupUserWithEmail);

router.post('/user/signin', authLimiter, signinValidators, signinWithEmailAndPassword);

router.post('/user/otp/email', sendEmailOtpForVerification);

router.post('/user/otp/email/verify', verifyEmailOtpSentToUser);

router.post('/user/otp/phone', sendPhoneOtpForVerification);

router.post('/user/otp/phone/verify', verifyOtpSentToUser);

router.post('/user/forgotten-password/otp/email', sendEmailOtpForForgottenPassword);

router.post('/user/signin/otp/email', sendEmailOtpForSignin);

router.post('/user/delete-account/otp/email', sendEmailOtpForAccountDeletion);

router.patch('/user/update', authMiddleware('email'), updateUserInfoInDb);

router.patch('/user/update/password', authMiddleware('email'), updateUserPasswordDb);

router.patch('/user/reset/password', resetUserPassword);

router.get('/user/check/pin/:userId', checkIfUserHavePin)

router.get('/user/info', authMiddleware('email'), getUserInfoFromDb);

router.get('/user/session', authMiddleware('email'), getCurrentSession);

router.post('/user/logout',authMiddleware('email'), logoutUserSession);

router.post('/user/create/pin', createUserPin);

router.post('/user/login/transaction/pin', transactionUserPin);

router.patch('/user/update/pin', authMiddleware('email'), changeUserPin);

router.post('/user/login/pin', loginUserPin)

router.post('/user/reset-pin/otp/email', sendEmailOtpForResetPin);

router.delete('/user/delete-account', authMiddleware('email'), deleteUserFromCodebase);

// router.delete('/user/delete-account', deleteUserFromCodebase);


// // router.post('/user/google/oauth', signInUserWithGoogleOauth);
// // router.post('/user/apple/oauth', signUserWithAppleOauth);
// // router.post('/user/facebook/oauth', signInUserWithFacebookOauth);

// router.patch('/user/update/phone', updateUserPhoneInAuth);

// router.post('/user/oauth/google', signUserWithGoogleOauth)

module.exports = router;
