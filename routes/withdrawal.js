const express = require("express");
const {
    withdrawalWithFlutterwave,
    withdrawalWithPaystack,
    withdrawalWithSafehaven,
    verifyTransferOtp,
} = require("../controllers/withdrawal");

const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");

router.post(
    "/withdraw/paystack",
    authMiddleware("email"),
    withdrawalWithPaystack
);

router.post(
    "/withdraw/safehaven",
    authMiddleware("email"),
    withdrawalWithSafehaven
);

module.exports = router;

