const express = require("express");
const {
    storeBankDetails,
    getBankDetails,
    listNigerianBanks,
    verifyBankAccountDetails,
    getBanksListSafeHaven,
} = require("../controllers/banks");
const { performNameEnquiry } = require("../controllers/deposit");

const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");

router.post("/banks/store", authMiddleware("email"), storeBankDetails);

router.get("/banks/get", authMiddleware("email"), getBankDetails);

router.get("/banks/list", listNigerianBanks);

router.get("/banks/list/safehaven", getBanksListSafeHaven);

router.post("/banks/verify/details", verifyBankAccountDetails);

router.post("/banks/verify/details/safehaven", performNameEnquiry);

module.exports = router;
