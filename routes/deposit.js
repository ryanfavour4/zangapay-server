const express = require("express");
const {
    verifyAccountNumber,
    listBanks,
    initiateTransfer,
    verifySafeHavenWebhook,
    initiateSafeHavenTransfer,
    verifyPaystackWebhook,
    performNameEnquiry,
    safeHavenBanksList,
} = require("../controllers/deposit");

const router = express.Router();

// router.post("/verify-bank", verifyAccountNumber);
router.post("/verify-bank", performNameEnquiry);

// router.get("/list-banks", listBanks);
router.get("/list-banks", safeHavenBanksList);

router.post("/transfer/bank", initiateTransfer);

router.post("/safehaven/initialize", initiateSafeHavenTransfer);
// new
router.post("/paystack/webhook/verify", verifyPaystackWebhook);

router.post("/safehaven/webhook/verify", verifySafeHavenWebhook);

module.exports = router;

